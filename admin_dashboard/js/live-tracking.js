/**
 * TravelBuddy — Authorized Admin Live Parcel Tracking
 * Specifically for active, in-transit parcels.
 */

const API_ORIGIN = APP_CONFIG.API_BASE_URL;

async function apiGet(url) {
  const token = localStorage.getItem('admin_token') || localStorage.getItem('travelBuddyAdminToken');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API_ORIGIN}${url}`, { headers, credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, data };
  return data;
}

let map = null;
let travelerMarker = null;
let firestoreUnsubscribe = null;
let inTransitParcels = [];
let currentParcelId = null;

export default function initLiveTracking() {
  const mapEl = document.getElementById('liveTrackingMap');
  if (!mapEl) return;

  initMap();
  loadInTransit().then(() => {
    // Check for ID in hash (e.g. #live-tracking?id=...)
    const hash = window.location.hash;
    const match = hash.match(/id=([a-f0-9]+)/);
    if (match && match[1]) {
      window.selectParcelForTracking(match[1]);
    }
  });
  wireEvents();
}

function initMap() {
  if (map) return;
  // Default to central India
  map = L.map('liveTrackingMap', { zoomControl: false }).setView([20.5937, 78.9629], 5);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
}

function wireEvents() {
  document.getElementById('refreshInTransit')?.addEventListener('click', loadInTransit);
  document.getElementById('trackingSearch')?.addEventListener('input', (e) => {
    renderParcelList(e.target.value.trim());
  });
  document.getElementById('closeDet')?.addEventListener('click', () => {
    document.getElementById('trackingDetails')?.classList.add('hidden');
    stopTracking();
  });
}

async function loadInTransit() {
  const list = document.getElementById('inTransitList');
  if (!list) return;

  try {
    const data = await apiGet('/api/admin/parcels?status=in_transit&limit=100');
    inTransitParcels = data.parcels || [];
    renderParcelList();
  } catch (err) {
    console.warn('Failed to load in-transit parcels:', err);
    list.innerHTML = `<div class="error-state">Failed to load.</div>`;
  }
}

function renderParcelList(query = '') {
  const list = document.getElementById('inTransitList');
  if (!list) return;

  const filtered = inTransitParcels.filter(p =>
    !query || p.orderId.toLowerCase().includes(query.toLowerCase())
  );

  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state">No parcels found.</div>`;
    return;
  }

  list.innerHTML = filtered.map(p => `
    <div class="parcel-item ${currentParcelId === p._id ? 'active' : ''}" onclick="window.selectParcelForTracking('${p._id}')">
      <div class="p-head">
        <strong>${esc(p.orderId)}</strong>
        <span class="p-status">In Transit</span>
      </div>
      <div class="p-route">${esc(p.fromCity)} → ${esc(p.toCity)}</div>
      <div class="p-meta">Traveler: ${esc(p.acceptedBy?.firstName || '—')}</div>
    </div>
  `).join('');
}

window.selectParcelForTracking = async (parcelId) => {
  currentParcelId = parcelId;
  renderParcelList(document.getElementById('trackingSearch')?.value);

  let parcel = inTransitParcels.find(p => p._id === parcelId);

  if (!parcel) {
    // If not in list (e.g. status changed or page loaded with specific ID), fetch directly
    try {
      const data = await apiGet(`/api/admin/parcels/detail/${parcelId}`);
      parcel = data.parcel;
    } catch (err) {
      console.warn('Failed to fetch parcel details for tracking:', err);
      return;
    }
  }

  if (!parcel) return;

  document.getElementById('detOrderId').textContent = parcel.orderId || parcel.parcelNumber || '—';
  document.getElementById('detTraveler').textContent = parcel.acceptedBy ? `${parcel.acceptedBy.firstName || ''} ${parcel.acceptedBy.lastName || ''}` : 'No Traveler';
  document.getElementById('detFrom').textContent = parcel.fromCity || '—';
  document.getElementById('detTo').textContent = parcel.toCity || '—';
  document.getElementById('trackingDetails').classList.remove('hidden');

  const travelerId = parcel.acceptedBy?._id || parcel.acceptedBy;
  if (travelerId) {
    startTracking(String(travelerId));
  } else {
    updateTrackingStatus('NOT AVAILABLE', 'No traveler assigned.');
  }
};

function startTracking(travelerId) {
  stopTracking();
  if (!travelerId || typeof firebase === 'undefined') return;

  const db = firebase.firestore();
  firestoreUnsubscribe = db.collection('locations').doc(travelerId)
    .onSnapshot((doc) => {
      if (doc.exists) {
        const data = doc.data();
        updateMapLocation(data);
      } else {
        updateTrackingStatus('OFFLINE', 'No live location found for this traveler.');
      }
    }, (err) => {
      console.error('Firestore tracking error:', err);
      updateTrackingStatus('ERROR', 'Connection failed.');
    });
}

function stopTracking() {
  if (firestoreUnsubscribe) firestoreUnsubscribe();
  firestoreUnsubscribe = null;
  if (travelerMarker) {
    travelerMarker.remove();
    travelerMarker = null;
  }
}

function updateMapLocation(data) {
  const lat = data.lat || data.latitude;
  const lng = data.lng || data.longitude;
  if (!lat || !lng) return;

  const pos = [lat, lng];
  if (!travelerMarker) {
    const travelerIcon = L.divIcon({
      className: 'custom-div-icon',
      html: "<div class='live-marker'></div>",
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    travelerMarker = L.marker(pos, { icon: travelerIcon }).addTo(map);
    map.setView(pos, 15);
  } else {
    travelerMarker.setLatLng(pos);
    map.panTo(pos);
  }

  const speed = data.speed ? Math.round(data.speed * 3.6) : 0;
  document.getElementById('detSpeed').textContent = `${speed} km/h`;

  const ts = data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
  document.getElementById('detLastUpdate').textContent = ts.toLocaleTimeString();

  const diffMins = (Date.now() - ts.getTime()) / 60000;
  if (diffMins < 2) updateTrackingStatus('LIVE');
  else if (diffMins < 10) updateTrackingStatus('STALE');
  else updateTrackingStatus('OFFLINE');
}

function updateTrackingStatus(state, label = '') {
  const pill = document.querySelector('.status-pill.live');
  if (!pill) return;
  pill.className = `status-pill live ${state.toLowerCase()}`;
  pill.querySelector('span') || (pill.innerHTML = `<i></i>${state}`);
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

window.initLiveTracking = initLiveTracking;

try { initLiveTracking(); } catch (e) { console.warn('live-tracking init failed', e); }
