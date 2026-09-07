// operations.js — Live Parcel Operations with Leaflet & Socket.IO
const API_ORIGIN = APP_CONFIG.API_BASE_URL;
const SOCKET_ORIGIN = APP_CONFIG.SOCKET_URL;

// ── State ─────────────────────────────────────
let parcelsMap = new Map(); // Store active parcels by ID
let markersMap = new Map(); // Store Leaflet markers by traveler/parcel ID
let routeLines = new Map(); // Store AntPath lines by parcel ID
let activeFilters = { search: '', status: 'all', time: 'all' };
let socket = null;
let map = null;
let markerClusterGroup = null;
let selectedParcelId = null;
let lastUpdateTimestamp = Date.now();

// ── DOM Refs ─────────────────────────────────
const $ = (id) => document.getElementById(id);

// ── Initialization ───────────────────────────
function initMap() {
    const mapEl = $('opsLeafletMap');
    if (!mapEl || map) return;

    // Initialize Leaflet map focused on India
    map = L.map('opsLeafletMap', {
        zoomControl: false,
        attributionControl: false
    }).setView([20.5937, 78.9629], 5);

    // Dark mode professional tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Initialize Marker Clustering
    markerClusterGroup = L.markerClusterGroup({
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        maxClusterRadius: 50
    });
    map.addLayer(markerClusterGroup);
}

// ── Data Fetching ─────────────────────────────
async function fetchActiveParcels() {
    try {
        const token = localStorage.getItem('admin_token');
        const res = await fetch(`${API_ORIGIN}/api/admin/active-journeys`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.journeys) {
            parcelsMap.clear();
            const bounds = [];
            data.journeys.forEach(j => {
                parcelsMap.set(String(j._id || j.id), j);
                if (j.fromCoords?.lat) {
                    bounds.push([j.fromCoords.lat, j.fromCoords.lng]);
                }
                if (j.toCoords?.lat) {
                    bounds.push([j.toCoords.lat, j.toCoords.lng]);
                }
            });
            renderAll();
            if (bounds.length > 0) {
                map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
            }
        }
    } catch (err) {
        console.error('Failed to fetch active parcels:', err);
    }
}

// ── Real-Time Events ──────────────────────────
function connectSocket() {
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    socket = io(`${SOCKET_ORIGIN}/admin`, {
        auth: { token },
        transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
        console.log('[Live] Admin socket connected');
        $('opsLiveDot').className = 'ops-dot live';
        $('opsLiveText').textContent = 'LIVE';
        lastUpdateTimestamp = Date.now();
        updateTimeUI();
    });

    socket.on('connect_error', () => {
        $('opsLiveDot').className = 'ops-dot';
        $('opsLiveText').textContent = 'CONNECTING...';
    });

    socket.on('disconnect', () => {
        $('opsLiveDot').className = 'ops-dot';
        $('opsLiveText').textContent = 'OFFLINE';
    });

    socket.on('parcel:update', (payload) => {
        console.log('[Live] Parcel update received:', payload);
        const id = String(payload.id);

        if (['delivered', 'cancelled', 'cancelled_by_sender', 'cancelled_by_traveler'].includes(payload.status)) {
            parcelsMap.delete(id);
            removeParcelFromMap(id);
        } else {
            // Merge or add
            const existing = parcelsMap.get(id) || {};
            parcelsMap.set(id, { ...existing, ...payload });
            updateParcelOnMap(id);
        }

        lastUpdateTimestamp = Date.now();
        renderAll();
    });

    socket.on('traveler:location', (data) => {
        const { travelerId, lat, lng } = data;
        // Find all parcels assigned to this traveler
        for (const [id, p] of parcelsMap.entries()) {
            if (String(p.traveler?.id) === String(travelerId)) {
                p.currentLocation = { lat, lng };
                p.lastLocationUpdate = new Date().toISOString();
                moveTravelerMarker(id, lat, lng);
            }
        }
        lastUpdateTimestamp = Date.now();
        updateTimeUI();
    });
}

// ── Rendering Logic ───────────────────────────
function renderAll() {
    renderKPIs();
    renderList();
    syncMarkers();
}

function renderKPIs() {
    const parcels = Array.from(parcelsMap.values());
    const stats = {
        active: parcels.length,
        transit: parcels.filter(p => p.status === 'in_transit').length,
        assigned: parcels.filter(p => p.traveler?.id).length,
        pickedUp: parcels.filter(p => ['pickup_confirmed', 'in_transit', 'delivery_point_pending', 'delivery_point_selected'].includes(p.status)).length,
        near: parcels.filter(p => p.status === 'delivery_point_selected').length,
        urgent: parcels.filter(p => p.status === 'disputed' || p.isDelayed).length
    };

    $('kpiActive').textContent = stats.active;
    $('kpiTransit').textContent = stats.transit;
    $('kpiAssigned').textContent = stats.assigned;
    $('kpiPickedUp').textContent = stats.pickedUp;
    $('kpiNear').textContent = stats.near;
    $('kpiUrgent').textContent = stats.urgent;
}

function renderList() {
    const list = $('opsList');
    const filtered = Array.from(parcelsMap.values()).filter(matchesFilters);
    $('opsListCount').textContent = filtered.length;

    list.innerHTML = filtered.map(p => `
        <div class="ops-list-item ${selectedParcelId === p.id ? 'active' : ''}" onclick="selectParcel('${p.id || p._id}')">
            <h4>
                <span>${p.orderId}</span>
                <span class="ops-list-status ${getStatusClass(p.status)}">${p.status.replace(/_/g, ' ')}</span>
            </h4>
            <p>${p.fromCity} → ${p.toCity}</p>
            <p style="font-size: 10px; margin-top: 4px;">${p.traveler?.name || 'Awaiting traveler'}</p>
        </div>
    `).join('');
}

function getStatusClass(status) {
    if (status === 'in_transit') return 'status-transit';
    if (status === 'accepted') return 'status-assigned';
    if (status === 'pending') return 'status-pending';
    if (status === 'pickup_confirmed') return 'status-assigned';
    if (status === 'disputed') return 'status-attention';
    return 'status-pending';
}

// ── Map Operations ────────────────────────────
function syncMarkers() {
    const filtered = Array.from(parcelsMap.values()).filter(matchesFilters);

    // Clear existing if needed or just update
    markerClusterGroup.clearLayers();

    filtered.forEach(p => {
        updateParcelOnMap(p.id || p._id);
    });
}

function updateParcelOnMap(id) {
    const p = parcelsMap.get(id);
    if (!p || !p.fromCoords?.lat) return;

    // Remove old marker/lines
    removeParcelFromMap(id);

    const statusColor = getStatusColor(p.status);

    const loc = p.currentLocation || p.fromCoords;
    if (!loc || !loc.lat) return; // Still no coordinates, skip marker

    const iconHtml = p.status === 'pending'
        ? `<i class="fa-solid fa-magnifying-glass" style="color: ${statusColor}; font-size: 16px; text-shadow: 0 0 8px rgba(0,0,0,0.3);"></i>`
        : `<i class="fa-solid fa-truck-fast" style="color: ${statusColor}; font-size: 20px; text-shadow: 0 0 10px rgba(0,0,0,0.5);"></i>`;

    const marker = L.marker([loc.lat, loc.lng], {
        icon: L.divIcon({
            className: 'ops-marker-traveler',
            html: iconHtml,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        })
    });

    marker.on('click', () => selectParcel(id));
    markerClusterGroup.addLayer(marker);
    markersMap.set(id, marker);

    // Route Visualization
    if (p.toCoords?.lat) {
        const path = [
            [p.fromCoords.lat, p.fromCoords.lng],
            [loc.lat, loc.lng],
            [p.toCoords.lat, p.toCoords.lng]
        ];

        const antPath = new L.Polyline.AntPath(path, {
            delay: 2000,
            dashArray: [10, 20],
            weight: 2,
            color: statusColor,
            pulseColor: '#ffffff',
            paused: false,
            reverse: false
        });

        antPath.addTo(map);
        routeLines.set(id, antPath);
    }
}

function removeParcelFromMap(id) {
    const m = markersMap.get(id);
    if (m) {
        markerClusterGroup.removeLayer(m);
        markersMap.delete(id);
    }
    const r = routeLines.get(id);
    if (r) {
        map.removeLayer(r);
        routeLines.delete(id);
    }
}

function moveTravelerMarker(id, lat, lng) {
    const m = markersMap.get(id);
    if (m) {
        m.setLatLng([lat, lng]);
        // Update route line too
        updateParcelOnMap(id);

        if (selectedParcelId === id) {
            updateDetailUI(parcelsMap.get(id));
        }
    }
}

function getStatusColor(status) {
    switch(status) {
        case 'in_transit': return '#3b82f6';
        case 'accepted': return '#10b981';
        case 'pickup_confirmed': return '#f59e0b';
        case 'disputed': return '#ef4444';
        case 'pending': return '#fbbf24';
        default: return '#94a3b8';
    }
}

// ── UI Actions ───────────────────────────────
window.selectParcel = (id) => {
    selectedParcelId = id;
    const p = parcelsMap.get(id);
    if (!p) return;

    // Center map
    const loc = p.currentLocation || p.fromCoords;
    map.flyTo([loc.lat, loc.lng], 10, { duration: 1.5 });

    updateDetailUI(p);
    renderList();
};

function updateDetailUI(p) {
    $('detOrderId').textContent = p.orderId;
    $('detStatus').innerHTML = `<span style="color: ${getStatusColor(p.status)}">●</span> ${p.status.replace(/_/g, ' ').toUpperCase()}`;
    $('detRoute').textContent = `${p.fromCity} → ${p.toCity}`;
    $('detTraveler').textContent = p.traveler?.name || 'Not assigned';
    $('detLocation').textContent = p.currentLocation ? `Lat: ${p.currentLocation.lat.toFixed(4)}, Lng: ${p.currentLocation.lng.toFixed(4)}` : 'At Source';

    const timeDiff = p.lastLocationUpdate ? Math.floor((Date.now() - new Date(p.lastLocationUpdate)) / 1000) : null;
    $('detLastSeen').textContent = timeDiff !== null ? `${timeDiff}s ago` : 'No updates';

    $('opsDetailPanel').classList.add('show');
}

function updateTimeUI() {
    const sec = Math.floor((Date.now() - lastUpdateTimestamp) / 1000);
    $('opsLastUpdate').textContent = sec < 5 ? 'Just now' : `${sec}s ago`;
}

function matchesFilters(p) {
    if (activeFilters.status !== 'all' && p.status !== activeFilters.status) return false;

    if (activeFilters.search) {
        const q = activeFilters.search.toLowerCase();
        const haystack = `${p.orderId} ${p.fromCity} ${p.toCity} ${p.traveler?.name || ''} ${p.sender?.name || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
    }

    return true;
}

// ── Event Wiring ─────────────────────────────
function wireUI() {
    $('opsSearch').oninput = (e) => {
        activeFilters.search = e.target.value.trim();
        renderAll();
    };

    $('opsStatusFilter').onchange = (e) => {
        activeFilters.status = e.target.value;
        renderAll();
    };

    $('opsResetFilters').onclick = () => {
        activeFilters = { search: '', status: 'all', time: 'all' };
        $('opsSearch').value = '';
        $('opsStatusFilter').value = 'all';
        renderAll();
        map.flyTo([20.5937, 78.9629], 5);
    };

    $('opsDetailClose').onclick = () => {
        $('opsDetailPanel').classList.remove('show');
        selectedParcelId = null;
        renderList();
    };
}

// ── Entry Point ──────────────────────────────
export default function initOperations() {
    initMap();
    fetchActiveParcels();
    connectSocket();
    wireUI();

    setInterval(updateTimeUI, 5000);
}

// Global exposure for onclick handlers in HTML
window.initOperations = initOperations;

try { initOperations(); } catch (e) { console.error('Ops init failed', e); }
