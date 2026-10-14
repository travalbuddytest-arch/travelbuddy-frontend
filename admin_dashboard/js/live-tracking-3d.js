/**
 * CarryParcel Admin — Live Tracking 3D map module.
 *
 * Data-honesty contract (do not break):
 *  • The map only ever draws origins, destinations, routes and "live" traveler
 *    markers from REAL coordinates returned by GET /api/admin/live-tracking.
 *  • Live traveler pins come only from the Firestore `locations` collection via
 *    the admin endpoint. Nothing here fabricates positions, routes or parcels.
 *  • Location docs are labelled LIVE only if newer than 2 minutes; otherwise
 *    STALE (< 10 min) or OFFLINE — historical/cached positions are never
 *    presented as live.
 *  • Parcels without coordinates appear in the lists/summary with a clear
 *    "location unavailable" state and are simply not plotted on the map.
 *
 * Map stack: Leaflet 1.9.4 (vendored in shared/vendor/leaflet.js, exposes
 * window.L) + OpenStreetMap standard raster tiles (keyless) + a 2.5D CSS
 * perspective-tilt presentation.
 *
 * Basemap: defaults to OSM's public raster tiles, which require NO API key.
 * CARTO's basemaps.cartocdn.com raster style (light_all) now REQUIRES an API
 * key — keyless requests are answered with an "API key required" watermark
 * (see https://github.com/CartoDB/basemap-styles), which is what produced the
 * blank/watermarked Live Tracking map. A different provider (keyed or not) can
 * be selected by setting, before this script runs:
 *   window.LIVE_TRACKING_MAP_OPTIONS = {
 *     basemapTilesUrl: 'https://.../{z}/{x}/{y}.png',
 *     basemapAttribution: '...',
 *     basemapMaxZoom: 19,
 *   };
 * Never hardcode private keys in this file; keep them server-side.
 *
 * An optional real terrain-tile provider can be plugged in without touching
 * this file via `window.LIVE_TRACKING_MAP_OPTIONS = { terrainTilesUrl: '...' }`
 * (e.g. Esri World Hillshade:
 *  https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}).
 *
 * Cleanup contract for admin.js (activatePage):
 *  • window.initLiveTracking()   — (re)build map, listeners, polling, socket.
 *  • window.destroyLiveTracking()— remove map, socket listeners, timers, DOM
 *    handlers so re-visits never double-bind.
 */

/* global APP_CONFIG, L, io, CarryParcelSocket, goToParcel, showToast */
'use strict';

const API_ORIGIN = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) || '';
const POLL_MS = 30000;                    // board refresh cadence while visible
const LIVE_MAX_MS = 2 * 60 * 1000;         // < 2 min  -> LIVE
const STALE_MAX_MS = 10 * 60 * 1000;       // < 10 min -> STALE, else OFFLINE
const ACTIVITY_KEY = 'cp_admin_live_activity_v1';
const MAX_ACTIVITY = 100;
const MAP_OPTIONS = window.LIVE_TRACKING_MAP_OPTIONS || {};

// Keyless default basemap. OSM's public tile service has a documented usage
// policy (https://operations.osmfoundation.org/policies/tiles/): keep the
// attribution, don't bulk-download, and keep traffic modest — fine for an
// internal admin dashboard. Providers are swapped via LIVE_TRACKING_MAP_OPTIONS
// (not by editing this file), and keyed providers must be wired up with a
// server-side key, never a hardcoded client credential.
const DEFAULT_BASEMAP_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const DEFAULT_BASEMAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const BASEMAP_URL = MAP_OPTIONS.basemapTilesUrl || DEFAULT_BASEMAP_URL;
const BASEMAP_ATTRIBUTION = MAP_OPTIONS.basemapAttribution || DEFAULT_BASEMAP_ATTRIBUTION;
const BASEMAP_MAX_ZOOM = MAP_OPTIONS.basemapMaxZoom || 19;

// Static geographic reference grid of major Indian city centroids. Used ONLY
// to name/group clusters of REAL parcel coords — never to place invented pins.
const CITY_GAZETTEER = [
  { name: 'Mumbai',      lat: 19.0760,  lng: 72.8777  },
  { name: 'Delhi NCR',   lat: 28.6139,  lng: 77.2090  },
  { name: 'Bengaluru',   lat: 12.9716,  lng: 77.5946  },
  { name: 'Hyderabad',   lat: 17.3850,  lng: 78.4867  },
  { name: 'Chennai',     lat: 13.0827,  lng: 80.2707  },
  { name: 'Kolkata',     lat: 22.5726,  lng: 88.3639  },
  { name: 'Pune',        lat: 18.5204,  lng: 73.8567  },
  { name: 'Ahmedabad',   lat: 23.0225,  lng: 72.5714  },
  { name: 'Jaipur',      lat: 26.9124,  lng: 75.7873  },
  { name: 'Lucknow',     lat: 26.8467,  lng: 80.9462  },
  { name: 'Surat',       lat: 21.1702,  lng: 72.8311  },
  { name: 'Kanpur',      lat: 26.4499,  lng: 80.3319  },
  { name: 'Nagpur',      lat: 21.1458,  lng: 79.0882  },
  { name: 'Indore',      lat: 22.7196,  lng: 75.8577  },
  { name: 'Bhopal',      lat: 23.2599,  lng: 77.4126  },
  { name: 'Patna',       lat: 25.5941,  lng: 85.1376  },
  { name: 'Vadodara',    lat: 22.3072,  lng: 73.1812  },
  { name: 'Ludhiana',    lat: 30.9010,  lng: 75.8573  },
  { name: 'Agra',        lat: 27.1767,  lng: 78.0081  },
  { name: 'Nashik',      lat: 19.9975,  lng: 73.7898  },
  { name: 'Faridabad',   lat: 28.4089,  lng: 77.3178  },
  { name: 'Rajkot',      lat: 22.3039,  lng: 70.8022  },
  { name: 'Varanasi',    lat: 25.3176,  lng: 82.9739  },
  { name: 'Srinagar',    lat: 34.0837,  lng: 74.7973  },
  { name: 'Chandigarh',  lat: 30.7333,  lng: 76.7794  },
  { name: 'Guwahati',    lat: 26.1445,  lng: 91.7362  },
  { name: 'Thiruvananthapuram', lat: 8.5241, lng: 76.9366 },
  { name: 'Bhubaneswar', lat: 20.2961,  lng: 85.8245  },
];

const STATUS_META = {
  pending:                  { label: 'Pending',                  icon: 'fa-clock',                    cls: 'pending' },
  accepted:                 { label: 'Accepted',                 icon: 'fa-person-walking-luggage',   cls: 'accepted' },
  pickup_point_pending:     { label: 'Pickup point pending',     icon: 'fa-map-pin',                 cls: 'pickup' },
  pickup_point_selected:    { label: 'Pickup point selected',    icon: 'fa-map-pin',                 cls: 'pickup' },
  pickup_confirmed:         { label: 'Pickup confirmed',         icon: 'fa-key',                     cls: 'pickup' },
  in_transit:               { label: 'In transit',               icon: 'fa-truck-fast',              cls: 'in-transit' },
  delivery_point_pending:   { label: 'Delivery point pending',   icon: 'fa-box-open',                cls: 'delivery' },
  delivery_point_selected:  { label: 'Delivery point selected',  icon: 'fa-box-open',                cls: 'delivery' },
  delivered:                { label: 'Delivered',                icon: 'fa-circle-check',            cls: 'delivered' },
  disputed:                 { label: 'Disputed',                 icon: 'fa-scale-balanced',          cls: 'disputed' },
  cancelled:                { label: 'Cancelled',                icon: 'fa-ban',                     cls: 'cancelled' },
  cancelled_by_sender:      { label: 'Cancelled (sender)',       icon: 'fa-ban',                     cls: 'cancelled' },
  cancelled_by_traveler:    { label: 'Cancelled (traveler)',     icon: 'fa-ban',                     cls: 'cancelled' },
  cancelled_by_system:      { label: 'Cancelled (system)',       icon: 'fa-ban',                     cls: 'cancelled' },
};

const state = {
  map: null,
  started: false,
  destroyed: true,
  tab: 'parcels',
  parcels: [],
  parcelsTotal: 0,
  users: [],
  usersTotal: 0,
  locations: {},            // { userId: { lat, lng, updatedAt, ... } } — real GPS docs only
  summary: null,
  generatedAt: null,
  lastGoodAt: null,
  firestore: { configured: false, error: null },
  activity: [],
  selectedParcelId: null,
  selectedUserId: null,
  busy: false,
  pollTimer: null,
  visibilityHandler: null,
  fullscreenHandler: null,
  socket: null,
  socketHandlers: {},       // event -> handler (for cleanup)
  domListeners: [],         // [el, type, fn, opts] (for cleanup)
  routeLayer: null,
  pinLayer: null,
  liveLayer: null,
  clusterLayer: null,
  terrainLayer: null,
  noDataChip: null,
};

const els = {};

function $(id) { return document.getElementById(id); }

function escHtml(s) {
  if (s === undefined || s === null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(+d)) return '—';
  return d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(+d)) return '—';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function timeAgo(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const diff = Date.now() - (+d);
  if (isNaN(diff)) return '—';
  if (diff < 0) return 'just now';
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function statusMeta(status) {
  return STATUS_META[status] || { label: String(status || '').replace(/_/g, ' ') || 'Unknown', icon: 'fa-circle-info', cls: 'other' };
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/* ────────────────────────────── API ────────────────────────────── */

async function apiGet(url) {
  const res = await fetch(`${API_ORIGIN}${url}`, {
    headers: { 'X-CP-Admin-Request': 'true', 'Accept': 'application/json' },
    credentials: 'include',
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data && data.error ? data.error : `Request failed (${res.status})`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

/* ───────────────────── Location freshness helpers ───────────────────── */

function locAgeMs(loc) {
  if (!loc || !loc.updatedAt) return null;
  const d = new Date(loc.updatedAt);
  return isNaN(+d) ? null : Date.now() - (+d);
}

function locFreshness(loc) {
  const age = locAgeMs(loc);
  if (age === null) return 'none';
  if (age < LIVE_MAX_MS) return 'live';
  if (age < STALE_MAX_MS) return 'stale';
  return 'offline';
}

function parcelLoc(p) {
  if (!p || !p.traveler) return { state: 'none', label: 'No traveler', loc: null };
  const loc = state.locations[p.traveler.id];
  if (!loc) return { state: 'none', label: 'No live location', loc: null };
  const f = locFreshness(loc);
  const labels = { live: 'Live', stale: 'Stale', offline: 'Offline' };
  return { state: f, label: labels[f] || 'Unknown', loc };
}

/* ─────────────────────────── DOM wiring ─────────────────────────── */

function on(el, type, fn, opts) {
  if (!el) return;
  el.addEventListener(type, fn, opts || false);
  state.domListeners.push([el, type, fn, opts || false]);
}

function grabEls() {
  els.refreshBtn = $('refreshBtn');
  els.tabs = Array.prototype.slice.call(document.querySelectorAll('.filter-tab'));
  els.parcelFilters = $('parcelFilters');
  els.userFilters = $('userFilters');
  els.parcelListContainer = $('parcelListContainer');
  els.userListContainer = $('userListContainer');
  els.parcelList = $('parcelList');
  els.userList = $('userList');
  els.parcelCount = $('parcelCount');
  els.userCount = $('userCount');
  els.parcelSearch = $('parcelSearch');
  els.parcelStatusFilter = $('parcelStatusFilter');
  els.parcelFromFilter = $('parcelFromFilter');
  els.parcelToFilter = $('parcelToFilter');
  els.dateFrom = $('dateFrom');
  els.dateTo = $('dateTo');
  els.locationFreshnessFilter = $('locationFreshnessFilter');
  els.resetParcelFilters = $('resetParcelFilters');
  els.userSearch = $('userSearch');
  els.userRoleFilter = $('userRoleFilter');
  els.userCityFilter = $('userCityFilter');
  els.userOnlineFilter = $('userOnlineFilter');
  els.resetUserFilters = $('resetUserFilters');
  els.activeParcelsCount = $('activeParcelsCount');
  els.inTransitCount = $('inTransitCount');
  els.pendingPickupCount = $('pendingPickupCount');
  els.usersWithLocationCount = $('usersWithLocationCount');
  els.activityFeed = $('activityFeed');
  els.liveIndicator = $('liveIndicator');
  els.mapStatus = $('mapStatus');
  els.fullscreenBtn = $('fullscreenBtn');
  els.recenterBtn = $('recenterBtn');
  els.toggle3DBtn = $('toggle3DBtn');
  els.mapEl = $('liveTrackingMap');
  els.legendItems = $('legendItems');
  els.lastUpdated = $('lastUpdated');
  els.mapLoadingOverlay = $('mapLoadingOverlay');
  els.mapErrorOverlay = $('mapErrorOverlay');
  els.mapErrorMessage = $('mapErrorMessage');
  els.retryMapLoad = $('retryMapLoad');
  els.detailPopup = $('detailPopup');
  els.popupTitle = $('popupTitle');
  els.popupBody = $('popupBody');
  els.popupCloseBtn = $('popupCloseBtn');
  els.popupViewDetails = $('popupViewDetails');
  els.closePopup = $('closePopup');
}

/* ─────────────────────────── Init / Destroy ─────────────────────────── */

function initLiveTracking() {
  if (!els.mapEl && $('liveTrackingMap')) grabEls();
  if (!els.mapEl) return;

  // Re-visit while already fully initialized → just refresh data.
  if (state.started && state.map) {
    refresh(true);
    return;
  }

  state.started = true;
  state.destroyed = false;
  state.activity = loadPersistedActivity();

  grabEls();
  bindEvents();
  renderLegend();
  renderActivity(state.activity);
  createMap();
  connectSocket();
  showMapLoading('Loading live tracking data…');
  startPolling();

  refresh(true).catch((err) => {
    console.warn('live-tracking initial load failed:', err);
  });
}

function destroyLiveTracking() {
  if (state.destroyed) return;
  state.destroyed = true;
  state.started = false;

  stopPolling();
  removeSocketHandlers();

  if (state.visibilityHandler) {
    document.removeEventListener('visibilitychange', state.visibilityHandler);
    state.visibilityHandler = null;
  }
  if (state.fullscreenHandler) {
    document.removeEventListener('fullscreenchange', state.fullscreenHandler);
    state.fullscreenHandler = null;
  }

  for (const [el, type, fn, opts] of state.domListeners) {
    try { el.removeEventListener(type, fn, opts); } catch (_) { /* noop */ }
  }
  state.domListeners = [];

  if (state.map) {
    try {
      state.map.remove(); // resets container._leaflet_id → safe to re-init
    } catch (_) { /* noop */ }
    state.map = null;
    state.routeLayer = null;
    state.pinLayer = null;
    state.liveLayer = null;
    state.clusterLayer = null;
    state.terrainLayer = null;
  }

  if (els.noDataChip && els.noDataChip.parentNode) {
    els.noDataChip.parentNode.removeChild(els.noDataChip);
    els.noDataChip = null;
  }

  closeDetail();
  console.log('[LiveTracking] Cleanup complete.');
}

/* ─────────────────────────── Map ─────────────────────────── */

function createMap() {
  if (state.map) return;
  if (typeof L === 'undefined') {
    showMapError('Leaflet failed to load. Check that shared/vendor/leaflet.js is served.');
    return;
  }
  const map = L.map(els.mapEl, {
    zoomControl: false,
    zoomSnap: 0.5,
    minZoom: 3,
    maxZoom: 10,
    worldCopyJump: false,
  }).setView([20.5937, 78.9629], 5);

  // Keyless OpenStreetMap raster basemap by default (see note at top of file).
  // CARTO's basemaps.cartocdn.com raster style now returns an "API key required"
  // watermark for keyless requests — that was the blank Live Tracking map.
  L.tileLayer(BASEMAP_URL, {
    attribution: BASEMAP_ATTRIBUTION,
    maxZoom: BASEMAP_MAX_ZOOM,
  }).addTo(map);

  L.control.zoom({ position: 'bottomright' }).addTo(map);
  map.attributionControl.setPrefix('');

  state.routeLayer = L.layerGroup().addTo(map);
  state.pinLayer = L.layerGroup().addTo(map);
  state.liveLayer = L.layerGroup().addTo(map);
  state.clusterLayer = L.layerGroup().addTo(map);

  if (MAP_OPTIONS.terrainTilesUrl) {
    state.terrainLayer = L.tileLayer(MAP_OPTIONS.terrainTilesUrl, {
      opacity: 0.35,
      maxZoom: 10,
      attribution: MAP_OPTIONS.terrainAttribution ? '<a href="' + escHtml(MAP_OPTIONS.terrainAttributionUrl || '#') + '">' + escHtml(MAP_OPTIONS.terrainAttribution) + '</a>' : '',
    }).addTo(map);
  }

  state.map = map;
}

function radiusAtZoom(z) {
  if (z <= 4) return 150;
  if (z === 5) return 90;
  if (z === 6) return 60;
  if (z === 7) return 38;
  return 18; // z >= 8
}

function divIcon(html, size, anchor, cls) {
  return L.divIcon({
    className: cls ? `lt-icon-wrap ${cls}` : 'lt-icon-wrap',
    html,
    iconSize: size,
    iconAnchor: anchor || [Math.round(size[0] / 2), Math.round(size[1] / 2)],
    popupAnchor: [0, -Math.round(size[1] / 2)],
  });
}

function originIcon() {
  return divIcon('<div class="lt-pin lt-origin">P</div>', [26, 26], [13, 13], 'lt-i-origin');
}

function destIcon() {
  return divIcon('<div class="lt-pin lt-dest">D</div>', [26, 26], [13, 13], 'lt-i-dest');
}

function liveIcon(freshness) {
  const cls = freshness === 'live' ? 'lt-live' : freshness === 'stale' ? 'lt-live lt-stale' : 'lt-live lt-offline';
  return divIcon(`<div class="lt-pin ${cls}"></div>`, [22, 22], [11, 11], 'lt-i-live');
}

function clusterIcon(count) {
  const sizeCls = count > 50 ? 'lt-c-lg' : count > 15 ? 'lt-c-md' : 'lt-c-sm';
  return divIcon(`<div class="lt-cluster ${sizeCls}">${count}</div>`, [count > 50 ? 44 : 34, count > 50 ? 44 : 34], [count > 50 ? 22 : 17, count > 50 ? 22 : 17], 'lt-i-cluster');
}

function validCoords(c) {
  return c && Number.isFinite(c.lat) && Number.isFinite(c.lng);
}

/**
 * Manual city-level clustering of REAL coords.
 * Each point is assigned to the nearest gazetteer city within `radiusKm`
 * (falls back to a grid-cell "Region" cluster otherwise). Cluster pins sit at
 * the centroid of their member coordinates — never at an invented point.
 */
function buildClusters(items, zoom) {
  const radiusKm = radiusAtZoom(zoom);
  const groups = new Map();
  for (const item of items) {
    if (!validCoords(item)) continue;
    const nearest = CITY_GAZETTEER.reduce((best, city) => {
      const d = haversineKm(item.lat, item.lng, city.lat, city.lng);
      return d < best.d ? { name: city.name, d } : best;
    }, { name: null, d: radiusKm });
    let key, label;
    if (nearest.name) {
      key = `city:${nearest.name}`;
      label = nearest.name;
    } else {
      key = `cell:${Math.round(item.lat * 10)},${Math.round(item.lng * 10)}`;
      label = 'Region';
    }
    if (!groups.has(key)) {
      groups.set(key, { label, lat: 0, lng: 0, count: 0, members: [] });
    }
    const g = groups.get(key);
    g.lat += item.lat;
    g.lng += item.lng;
    g.count += 1;
    g.members.push(item);
  }
  const out = [];
  groups.forEach((g) => {
    if (g.count === 1) {
      out.push({ single: true, label: g.label, lat: g.members[0].lat, lng: g.members[0].lng, member: g.members[0] });
    } else {
      out.push({ single: false, label: g.label, lat: g.lat / g.count, lng: g.lng / g.count, count: g.count, members: g.members });
    }
  });
  return out;
}

function renderMap() {
  if (!state.map) return;
  state.routeLayer.clearLayers();
  state.pinLayer.clearLayers();
  state.liveLayer.clearLayers();
  state.clusterLayer.clearLayers();

  const parcels = getFilteredParcels();
  const zoom = state.map.getZoom();

  // 1. Routes — only when both ends have real coords.
  const pinItems = [];
  for (const p of parcels) {
    const from = validCoords(p.fromCoords) ? [p.fromCoords.lat, p.fromCoords.lng] : null;
    const to = validCoords(p.toCoords) ? [p.toCoords.lat, p.toCoords.lng] : null;
    if (from && to) {
      const line = L.polyline([from, to], {
        color: '#1769ff',
        weight: 3,
        opacity: 0.65,
        dashArray: '6 8',
        lineCap: 'round',
      });
      line.on('click', () => selectParcel(p._id));
      state.routeLayer.addLayer(line);
    }
    if (from) pinItems.push({ lat: from[0], lng: from[1], parcel: p, isDest: false });
    if (to) pinItems.push({ lat: to[0], lng: to[1], parcel: p, isDest: true });
  }

  // 2. Real GPS traveler pins — deduped per traveler; freshness-graded.
  const liveByUser = new Map();
  for (const p of parcels) {
    if (!p.traveler) continue;
    const loc = state.locations[p.traveler.id];
    if (!loc || !validCoords(loc)) continue;
    if (!liveByUser.has(p.traveler.id)) liveByUser.set(p.traveler.id, { loc, traveler: p.traveler, parcelIds: [] });
    liveByUser.get(p.traveler.id).parcelIds.push(p._id);
  }
  const liveItems = [];
  liveByUser.forEach((entry) => {
    const f = locFreshness(entry.loc);
    const m = L.marker([entry.loc.lat, entry.loc.lng], { icon: liveIcon(f), keyboard: false, zIndexOffset: f === 'live' ? 300 : 100 });
    m.on('click', () => selectUser(entry.traveler.id));
    state.liveLayer.addLayer(m);
    liveItems.push({ lat: entry.loc.lat, lng: entry.loc.lng, user: entry.traveler, freshness: f });
  });

  // 3. City-level clustering of origin/dest pins. Clusters REPLACE individual
  //    pins at low zoom (groups of 1 render as individual pins). Live pins
  //    always stay individual — clustering GPS would misrepresent where
  //    travelers actually are.
  const clusters = buildClusters(pinItems, zoom);
  for (const c of clusters) {
    if (c.single) {
      const m = L.marker([c.lat, c.lng], { icon: c.member.isDest ? destIcon() : originIcon(), keyboard: false });
      m.on('click', () => selectParcel(c.member.parcel._id));
      state.pinLayer.addLayer(m);
      continue;
    }
    const m = L.marker([c.lat, c.lng], { icon: clusterIcon(c.count), keyboard: false });
    m.bindTooltip(`${c.label} · ${c.count}`, { direction: 'top', opacity: 0.95 });
    m.on('click', () => {
      const targetZoom = Math.min(state.map.getZoom() + 1, 9);
      state.map.flyTo(L.latLng(c.lat, c.lng), targetZoom, { duration: 0.4 });
    });
    state.clusterLayer.addLayer(m);
  }

  updateNoDataChip(parcels.length, liveItems.length, pinItems.length);
}

function updateNoDataChip(parcelCount, liveCount, pinCount) {
  removeNoDataChip();
  const mapEl = els.mapEl;
  if (!mapEl) return;
  if (pinCount === 0 && liveCount === 0) {
    const chip = document.createElement('div');
    chip.className = 'map-no-data';
    if (parcelCount === 0) {
      chip.innerHTML = '<i class="fa-solid fa-box-open"></i> No active parcels to map — check the list filters.';
    } else {
      chip.innerHTML = '<i class="fa-solid fa-location-slash"></i> ' + escHtml(parcelCount) + ' parcel(s) have no usable coordinates yet.';
    }
    mapEl.appendChild(chip);
    els.noDataChip = chip;
  }
}

function removeNoDataChip() {
  if (els.noDataChip && els.noDataChip.parentNode) {
    els.noDataChip.parentNode.removeChild(els.noDataChip);
  }
  els.noDataChip = null;
}

/* ─────────────────────────── Filtering ─────────────────────────── */

function matchesText(haystack, q) {
  const query = String(q || '').trim().toLowerCase();
  if (!query) return true;
  return String(haystack || '').toLowerCase().includes(query);
}

function getFilteredParcels() {
  const q = (els.parcelSearch && els.parcelSearch.value) || '';
  const status = (els.parcelStatusFilter && els.parcelStatusFilter.value) || 'all';
  const fromCity = (els.parcelFromFilter && els.parcelFromFilter.value) || 'all';
  const toCity = (els.parcelToFilter && els.parcelToFilter.value) || 'all';
  const dateFrom = (els.dateFrom && els.dateFrom.value) || '';
  const dateTo = (els.dateTo && els.dateTo.value) || '';
  const freshness = (els.locationFreshnessFilter && els.locationFreshnessFilter.value) || 'all';

  return state.parcels.filter((p) => {
    if (!matchesText([p.orderId, p.fromCity, p.toCity, p.sender && p.sender.name, p.traveler && p.traveler.name].join(' '), q)) return false;
    if (status !== 'all' && p.status !== status) return false;
    if (fromCity !== 'all' && (p.fromCity || '') !== fromCity) return false;
    if (toCity !== 'all' && (p.toCity || '') !== toCity) return false;
    if (dateFrom) {
      const t = new Date(p.createdAt).getTime();
      if (!t || t < new Date(dateFrom + 'T00:00:00').getTime()) return false;
    }
    if (dateTo) {
      const t = new Date(p.createdAt).getTime();
      if (!t || t > new Date(dateTo + 'T23:59:59').getTime()) return false;
    }
    if (freshness !== 'all' && parcelLoc(p).state !== freshness) return false;
    return true;
  });
}

function getFilteredUsers() {
  const q = (els.userSearch && els.userSearch.value) || '';
  const role = (els.userRoleFilter && els.userRoleFilter.value) || 'all';
  const city = (els.userCityFilter && els.userCityFilter.value) || 'all';
  const online = (els.userOnlineFilter && els.userOnlineFilter.value) || 'all';

  return state.users.filter((u) => {
    if (!matchesText([u.name, u.email, u.phone, u._id, u.city].join(' '), q)) return false;
    if (role === 'sender' && !u.isSender) return false;
    if (role === 'traveler' && !u.isTraveler) return false;
    if (city !== 'all' && (u.city || '') !== city) return false;
    if (online === 'online' && !u.isOnline) return false;
    if (online === 'offline' && u.isOnline) return false;
    return true;
  });
}

/* ─────────────────────────── Rendering (lists) ─────────────────────────── */

function renderLists() {
  const filtered = state.tab === 'parcels' ? getFilteredParcels() : getFilteredUsers();
  if (state.tab === 'parcels') renderParcelList(filtered);
  else renderUserList(filtered);
}

function renderParcelList(list) {
  const host = els.parcelList;
  const countEl = els.parcelCount;
  if (!host) return;
  countEl.textContent = String(list.length) + (state.parcelsTotal > list.length ? `/${state.parcelsTotal}` : '');
  if (!list.length) {
    host.innerHTML = `<div class="empty-state"><i class="fa-solid fa-box-open"></i><span>${state.parcels.length ? 'No parcels match the current filters.' : 'No active parcels right now.'}</span></div>`;
    return;
  }
  host.innerHTML = list.map((p) => {
    const sm = statusMeta(p.status);
    const loc = parcelLoc(p);
    const locClass = loc.state === 'live' ? 'loc-live' : loc.state === 'stale' ? 'loc-stale' : loc.state === 'offline' ? 'loc-offline' : 'loc-none';
    const hasCoords = validCoords(p.fromCoords) || validCoords(p.toCoords);
    return `
      <div class="parcel-item${state.selectedParcelId === p._id ? ' active' : ''}${hasCoords ? '' : ' no-coords'}" data-id="${escHtml(p._id)}" tabindex="0" role="button">
        <div class="p-head">
          <strong>${escHtml(p.orderId || p._id.slice(-6).toUpperCase())}</strong>
          <span class="status-chip ${escHtml(sm.cls)}"><i class="fa-solid ${escHtml(sm.icon)}"></i> ${escHtml(sm.label)}</span>
        </div>
        <div class="p-route"><i class="fa-solid fa-route"></i> ${escHtml(p.fromCity || '?')} &rarr; ${escHtml(p.toCity || '?')}</div>
        <div class="p-meta">
          <span title="Traveler"><i class="fa-solid fa-person-walking-luggage"></i> ${escHtml((p.traveler && p.traveler.name) || 'Unassigned')}</span>
          <span class="loc-state ${locClass}" title="GPS freshness"><i class="fa-solid fa-location-crosshairs"></i> ${escHtml(loc.label)}</span>
        </div>
        <div class="p-coords-note">${hasCoords ? '' : '<i class="fa-solid fa-triangle-exclamation"></i> Location unavailable — not plotted on map.'}</div>
      </div>`;
  }).join('');
  host.querySelectorAll('.parcel-item').forEach((item) => {
    on(item, 'click', () => selectParcel(item.dataset.id));
    on(item, 'keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectParcel(item.dataset.id); } });
  });
}

function renderUserList(list) {
  const host = els.userList;
  const countEl = els.userCount;
  if (!host) return;
  countEl.textContent = String(list.length) + (state.usersTotal > list.length ? `/${state.usersTotal}` : '');
  if (!list.length) {
    host.innerHTML = `<div class="empty-state"><i class="fa-solid fa-users"></i><span>${state.users.length ? 'No users match the current filters.' : 'No users found.'}</span></div>`;
    return;
  }
  host.innerHTML = list.map((u) => {
    const initials = String(u.name || u.email || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0] || '').join('').toUpperCase() || '?';
    const roleLabel = u.isTraveler ? 'Traveler' : u.isSender ? 'Sender' : 'User';
    const loc = state.locations[u._id];
    const f = loc ? locFreshness(loc) : 'none';
    return `
      <div class="user-item${state.selectedUserId === u._id ? ' active' : ''}" data-id="${escHtml(u._id)}" tabindex="0" role="button">
        <div class="u-avatar">${escHtml(initials)}</div>
        <div class="u-info">
          <b>${escHtml(u.name || u.email || u._id)}</b>
          <span>${escHtml(roleLabel)}${u.city ? ' · ' + escHtml(u.city) : ''}</span>
          <span class="u-meta"><i class="fa-solid fa-location-crosshairs"></i> ${f === 'live' ? 'Live' : f === 'stale' ? 'Stale' : f === 'offline' ? 'Offline' : 'No GPS'}${u.lastSeenAt ? ' · seen ' + timeAgo(u.lastSeenAt) : ''}</span>
        </div>
        <span class="online-dot ${u.isOnline ? 'on' : 'off'}" title="${u.isOnline ? 'Online' : 'Offline'}"></span>
      </div>`;
  }).join('');
  host.querySelectorAll('.user-item').forEach((item) => {
    on(item, 'click', () => selectUser(item.dataset.id));
    on(item, 'keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectUser(item.dataset.id); } });
  });
}

/* ─────────────────────────── Summary / status / legend ─────────────────────────── */

function renderSummary() {
  if (!state.summary) return;
  const s = state.summary;
  setText(els.activeParcelsCount, s.activeParcels);
  setText(els.inTransitCount, s.inTransit);
  setText(els.pendingPickupCount, s.pendingPickup);
  setText(els.usersWithLocationCount, s.usersWithLocation);
}

function setText(el, v) { if (el) el.textContent = (v === undefined || v === null) ? '0' : String(v); }

function updateMapStatus(level, text) {
  if (!els.mapStatus) return;
  els.mapStatus.className = 'map-status ' + (level || '');
  els.mapStatus.innerHTML = '';
  const i = document.createElement('i');
  els.mapStatus.appendChild(i);
  els.mapStatus.appendChild(document.createTextNode(text || ''));
}

function renderLegend() {
  if (!els.legendItems) return;
  els.legendItems.innerHTML = [
    '<div class="legend-item"><span class="legend-swatch"><span class="legend-line"></span></span><span>Route (direct line, approx.)</span></div>',
    '<div class="legend-item"><span class="legend-swatch"><span class="lt-pin lt-origin mini">P</span></span><span>Pickup point</span></div>',
    '<div class="legend-item"><span class="legend-swatch"><span class="lt-pin lt-dest mini">D</span></span><span>Delivery point</span></div>',
    '<div class="legend-item"><span class="legend-swatch"><span class="lt-pin lt-live mini"></span></span><span>Traveler &mdash; live (&lt; 2 min)</span></div>',
    '<div class="legend-item"><span class="legend-swatch"><span class="lt-pin lt-live lt-stale mini"></span></span><span>Traveler &mdash; stale (2&ndash;10 min)</span></div>',
    '<div class="legend-item"><span class="legend-swatch"><span class="lt-pin lt-live lt-offline mini"></span></span><span>Traveler &mdash; offline (&gt; 10 min)</span></div>',
    '<div class="legend-item"><span class="legend-swatch"><span class="lt-cluster lt-c-sm mini">8</span></span><span>City cluster (count)</span></div>',
  ].join('');
}

/* ─────────────────────────── Detail popup ─────────────────────────── */

function openDetail(title, bodyHtml) {
  if (!els.detailPopup) return;
  els.popupTitle.textContent = title;
  els.popupBody.innerHTML = bodyHtml;
  els.detailPopup.classList.remove('hidden');
}

function closeDetail() {
  if (!els.detailPopup) return;
  els.detailPopup.classList.add('hidden');
}

function selectParcel(id) {
  const p = state.parcels.find((x) => x._id === id);
  if (!p) return;
  state.selectedParcelId = id;
  renderParcelList(getFilteredParcels());
  showParcelDetail(p);
  focusMapOn(p);
}

function showParcelDetail(p) {
  const sm = statusMeta(p.status);
  const loc = parcelLoc(p);
  const from = validCoords(p.fromCoords);
  const to = validCoords(p.toCoords);
  const history = (p.trackingHistory || []).slice(-4).reverse().map((h) => {
    const m = statusMeta(h.status);
    return `<div class="popup-history-item"><i class="fa-solid ${escHtml(m.icon)}"></i><div><b>${escHtml(m.label)}</b><span>${timeAgo(h.timestamp)}${h.note ? ' — ' + escHtml(h.note) : ''}</span></div></div>`;
  }).join('') || '<div class="popup-history-empty">No status updates recorded yet.</div>';

  const locRow = !p.traveler
    ? '<div class="popup-row"><i class="fa-solid fa-location-crosshairs"></i><div><b>No traveler assigned</b><span>Live GPS only appears once a traveler is assigned and shares their location.</span></div></div>'
    : loc.loc
      ? `<div class="popup-row"><i class="fa-solid fa-location-crosshairs"></i><div><b>${escHtml(loc.label)} location</b><span>${loc.loc.lat.toFixed(5)}, ${loc.loc.lng.toFixed(5)} &middot; updated ${timeAgo(loc.loc.updatedAt)}</span></div></div>`
      : '<div class="popup-row"><i class="fa-solid fa-location-crosshairs"></i><div><b>No live location</b><span>No Firestore GPS document for this traveler.</span></div></div>';

  openDetail(`Parcel ${escHtml(p.orderId || p._id.slice(-6).toUpperCase())}`, `
    <p class="popup-status ${escHtml(sm.cls)}"><i class="fa-solid ${escHtml(sm.icon)}"></i> ${escHtml(sm.label)}</p>
    <div class="popup-row"><i class="fa-solid fa-route"></i><div><b>${escHtml(p.fromCity || '?')} &rarr; ${escHtml(p.toCity || '?')}</b><span>${from && to ? 'Route plotted on map' : from || to ? 'Only one end has coordinates — route line not drawn.' : 'No coordinates recorded for this parcel.'}</span></div></div>
    <div class="popup-row"><i class="fa-solid fa-person-walking-luggage"></i><div><b>${escHtml((p.traveler && (p.traveler.name || p.traveler.email)) || 'Unassigned')}</b><span>${p.traveler ? (p.traveler.isOnline ? 'Online now' : 'Offline') : 'No traveler assigned'}</span></div></div>
    <div class="popup-row"><i class="fa-solid fa-user"></i><div><b>${escHtml((p.sender && (p.sender.name || p.sender.email)) || '—')}</b><span>Sender</span></div></div>
    ${locRow}
    <div class="popup-row"><i class="fa-solid fa-calendar"></i><div><b>${fmtDateTime(p.createdAt)}</b><span>Posted</span></div></div>
    <div class="popup-section"><h5><i class="fa-solid fa-clock-rotate-left"></i> Recent updates</h5>${history}</div>
  `);
}

function selectUser(id) {
  const u = state.users.find((x) => x._id === id);
  state.selectedUserId = id;
  renderUserList(getFilteredUsers());
  if (!u) return;
  showUserDetail(u);
  const loc = state.locations[id];
  if (loc && state.map) {
    state.map.flyTo(L.latLng(loc.lat, loc.lng), Math.max(state.map.getZoom(), 9), { duration: 0.5 });
  }
}

function showUserDetail(u) {
  const initials = String(u.name || u.email || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0] || '').join('').toUpperCase() || '?';
  const loc = state.locations[u._id];
  const f = loc ? locFreshness(loc) : 'none';
  const roleLabel = u.isTraveler ? 'Traveler' : u.isSender ? 'Sender' : 'User';
  const locBlock = loc
    ? `<div class="popup-row"><i class="fa-solid fa-location-crosshairs"></i><div><b>${escHtml(f === 'live' ? 'Live location' : f === 'stale' ? 'Stale location' : 'Last known location')}</b><span>${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)} &middot; updated ${timeAgo(loc.updatedAt)}${f !== 'live' ? ' &middot; not current' : ''}</span></div></div>`
    : '<div class="popup-row"><i class="fa-solid fa-location-crosshairs"></i><div><b>No live location</b><span>This user has no Firestore GPS document right now.</span></div></div>';

  openDetail(`User ${escHtml(u.name || u.email || u._id)}`, `
    <div class="popup-avatar">${escHtml(initials)}</div>
    <div class="popup-row"><i class="fa-solid fa-id-badge"></i><div><b>${escHtml(roleLabel)}</b><span>${u.isTraveler && u.isSender ? 'Also a sender' : u.city ? escHtml(u.city) : 'No saved city'}</span></div></div>
    <div class="popup-row"><i class="fa-solid fa-envelope"></i><div><b>${escHtml(u.email || '—')}</b><span>${escHtml(u.phone || 'no phone')}</span></div></div>
    <div class="popup-row"><i class="fa-solid fa-signal"></i><div><b>${u.isOnline ? 'Online now' : 'Offline'}</b><span>Last seen ${u.lastSeenAt ? timeAgo(u.lastSeenAt) : '—'}</span></div></div>
    ${locBlock}
  `);
}

function focusMapOn(p) {
  if (!state.map) return;
  const pts = [];
  if (validCoords(p.fromCoords)) pts.push(L.latLng(p.fromCoords.lat, p.fromCoords.lng));
  if (validCoords(p.toCoords)) pts.push(L.latLng(p.toCoords.lat, p.toCoords.lng));
  if (p.traveler && state.locations[p.traveler.id]) {
    pts.push(L.latLng(state.locations[p.traveler.id].lat, state.locations[p.traveler.id].lng));
  }
  if (pts.length) {
    state.map.fitBounds(L.latLngBounds(pts).pad(0.25), { maxZoom: 10, duration: 0.5 });
  }
}

/* ─────────────────────────── Activity feed ─────────────────────────── */

function loadPersistedActivity() {
  try {
    const raw = sessionStorage.getItem(ACTIVITY_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.slice(0, MAX_ACTIVITY) : [];
  } catch (_) { return []; }
}

function persistActivity() {
  try {
    sessionStorage.setItem(ACTIVITY_KEY, JSON.stringify(state.activity.slice(0, MAX_ACTIVITY)));
  } catch (_) { /* storage full/blocked — non fatal */ }
}

function pushActivity(entry) {
  if (!entry || !entry.ts) return;
  state.activity = [entry, ...state.activity].slice(0, MAX_ACTIVITY);
  renderActivity(state.activity);
  persistActivity();
}

function renderActivity(list) {
  if (!els.activityFeed) return;
  if (!list || !list.length) {
    els.activityFeed.innerHTML = '<div class="activity-empty"><i class="fa-solid fa-tower-broadcast"></i><span>Waiting for activity…</span></div>';
    return;
  }
  els.activityFeed.innerHTML = list.map((a) => `
    <div class="activity-item">
      <i class="fa-solid ${escHtml(a.icon)}"></i>
      <div><b>${escHtml(a.title)}</b><p>${escHtml(a.description)}</p></div>
      <time>${timeAgo(a.ts)}</time>
    </div>`).join('');
}

function backfillActivityFromParcels() {
  const entries = [];
  for (const p of state.parcels) {
    const route = `${p.fromCity || '?'} → ${p.toCity || '?'}`;
    for (const h of (p.trackingHistory || [])) {
      const sm = statusMeta(h.status);
      entries.push({
        icon: sm.icon,
        title: `${sm.label} — ${p.orderId || p._id.slice(-6).toUpperCase()}`,
        description: route + (h.note ? ` · ${h.note}` : ''),
        ts: h.timestamp,
      });
    }
  }
  entries.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  const merged = [...state.activity];
  const seen = new Set(merged.map((e) => `${e.title}|${e.ts}`));
  for (const e of entries) {
    const key = `${e.title}|${e.ts}`;
    if (!seen.has(key)) { merged.push(e); seen.add(key); }
  }
  merged.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  state.activity = merged.slice(0, MAX_ACTIVITY);
  renderActivity(state.activity);
  persistActivity();
}

/* ─────────────────────────── Socket ─────────────────────────── */

function connectSocket() {
  try {
    if (!window.CarryParcelSocket || typeof io === 'undefined') return;
    const socket = CarryParcelSocket.connect('/admin');
    if (!socket) return;
    state.socket = socket;

    const onUpdate = (payload) => handleParcelUpdate(payload || {});
    const onStats = () => { if (state.map && !state.destroyed) { /* heartbeat only — data comes from REST */ } };
    socket.on('parcel:update', onUpdate);
    socket.on('admin:stats', onStats);
    state.socketHandlers['parcel:update'] = onUpdate;
    state.socketHandlers['admin:stats'] = onStats;
  } catch (err) {
    console.warn('[LiveTracking] socket setup failed:', err);
  }
}

function removeSocketHandlers() {
  if (state.socket && window.CarryParcelSocket) {
    for (const [event, handler] of Object.entries(state.socketHandlers)) {
      try { state.socket.off(event, handler); } catch (_) { /* noop */ }
    }
  }
  state.socketHandlers = {};
  state.socket = null;
}

function handleParcelUpdate(payload) {
  const norm = {
    _id: String(payload.id || payload._id || ''),
    orderId: payload.orderId || null,
    status: payload.status,
    fromCity: payload.fromCity || null,
    toCity: payload.toCity || null,
    fromCoords: validCoords(payload.fromCoords) ? { lat: payload.fromCoords.lat, lng: payload.fromCoords.lng } : null,
    toCoords: validCoords(payload.toCoords) ? { lat: payload.toCoords.lat, lng: payload.toCoords.lng } : null,
    traveler: payload.traveler ? { id: String(payload.traveler.id || ''), name: payload.traveler.name || 'Traveler', isOnline: true } : null,
    sender: payload.sender ? { id: String(payload.sender.id || ''), name: payload.sender.name || 'Sender' } : null,
    createdAt: state.parcels.find((x) => x._id === String(payload.id || payload._id))?.createdAt || payload.updatedAt || new Date().toISOString(),
    updatedAt: payload.updatedAt || new Date().toISOString(),
    trackingHistory: [],
  };
  if (!norm._id) return;

  const idx = state.parcels.findIndex((x) => x._id === norm._id);
  if (idx >= 0) {
    const prev = state.parcels[idx];
    norm.trackingHistory = prev.trackingHistory || [];
    state.parcels[idx] = norm;
    if (norm.status && norm.status !== prev.status && STATUS_META[norm.status]) {
      pushActivity({
        icon: STATUS_META[norm.status].icon || 'fa-truck-fast',
        title: `${STATUS_META[norm.status].label} — ${norm.orderId || norm._id.slice(-6).toUpperCase()}`,
        description: `${norm.fromCity || '?'} → ${norm.toCity || '?'}`,
        ts: new Date().toISOString(),
      });
    }
  } else if (payload.status && ACTIVE_STATUS_SET.has(payload.status)) {
    state.parcels.unshift(norm);
    pushActivity({
      icon: STATUS_META[payload.status]?.icon || 'fa-box',
      title: `New ${STATUS_META[payload.status]?.label || payload.status} — ${norm.orderId || norm._id.slice(-6).toUpperCase()}`,
      description: `${norm.fromCity || '?'} → ${norm.toCity || '?'}`,
      ts: new Date().toISOString(),
    });
  } else if (payload.status && !ACTIVE_STATUS_SET.has(payload.status)) {
    // left the live set (delivered/cancelled) → drop it from the map honestly
    state.parcels = state.parcels.filter((x) => x._id !== norm._id);
    pushActivity({
      icon: 'fa-box-archive',
      title: `${(STATUS_META[payload.status] || {}).label || payload.status} — ${norm.orderId || norm._id.slice(-6).toUpperCase()}`,
      description: `${norm.fromCity || '?'} → ${norm.toCity || '?'} (no longer live-tracked)`,
      ts: new Date().toISOString(),
    });
  }

  renderLists();
  renderMap();
  renderSummary();
  updateLastUpdated(new Date().toISOString());
  updateMapStatus('live', 'Live');
}

const ACTIVE_STATUS_SET = new Set([
  'accepted', 'pickup_point_pending', 'pickup_point_selected',
  'pickup_confirmed', 'in_transit',
  'delivery_point_pending', 'delivery_point_selected',
]);

/* ─────────────────────────── Data refresh ─────────────────────────── */

function showMapLoading(text) {
  if (els.mapLoadingOverlay) {
    els.mapLoadingOverlay.classList.remove('hidden');
    const span = els.mapLoadingOverlay.querySelector('span');
    if (span) span.textContent = text || 'Loading map data…';
  }
  hideMapError();
}

function hideMapLoading() {
  if (els.mapLoadingOverlay) els.mapLoadingOverlay.classList.add('hidden');
}

function showMapError(message) {
  hideMapLoading();
  if (els.mapErrorOverlay) {
    if (els.mapErrorMessage) els.mapErrorMessage.textContent = message || 'An error occurred while loading the map.';
    els.mapErrorOverlay.classList.remove('hidden');
  }
  updateMapStatus('error', 'Offline');
}

function hideMapError() {
  if (els.mapErrorOverlay) els.mapErrorOverlay.classList.add('hidden');
}

async function refresh(manual) {
  if (state.destroyed) return;
  if (document.hidden) { schedulePoll(); return; }
  if (state.busy) return;
  state.busy = true;
  if (manual) showMapLoading('Refreshing…');
  updateMapStatus('updating', 'Updating…');
  try {
    const data = await apiGet('/api/admin/live-tracking');
    if (state.destroyed) return;
    applyData(data);
    hideMapError();
    hideMapLoading();
    const age = Date.now() - new Date(data.generatedAt).getTime();
    updateMapStatus(age < LIVE_MAX_MS ? 'live' : 'stale', age < LIVE_MAX_MS ? 'Live' : 'Last update ' + timeAgo(data.generatedAt));
    updateLastUpdated(data.generatedAt);
    if (els.liveIndicator) {
      els.liveIndicator.innerHTML = '<i></i> Live';
      els.liveIndicator.classList.remove('offline');
    }
  } catch (err) {
    if (state.destroyed) return;
    console.warn('[LiveTracking] refresh failed:', err);
    if (err && (err.status === 401 || err.status === 403)) {
      showMapError('Admin session expired or permission denied. Please reload the dashboard to log in again.');
    } else {
      showMapError('Could not reach the tracking server. Check your connection and retry.');
    }
    if (els.liveIndicator) {
      els.liveIndicator.innerHTML = '<i></i> Offline';
      els.liveIndicator.classList.add('offline');
    }
  } finally {
    state.busy = false;
    schedulePoll();
  }
}

function applyData(data) {
  state.parcels = Array.isArray(data.parcels) ? data.parcels : [];
  state.parcelsTotal = Number.isFinite(data.parcelsTotal) ? data.parcelsTotal : state.parcels.length;
  state.users = Array.isArray(data.users) ? data.users : [];
  state.usersTotal = Number.isFinite(data.usersTotal) ? data.usersTotal : state.users.length;
  state.locations = data.locations && typeof data.locations === 'object' ? data.locations : {};
  state.summary = data.summary || null;
  state.generatedAt = data.generatedAt || null;
  state.lastGoodAt = Date.now();
  state.firestore = data.firestore || { configured: false, error: null };

  // Honest signalling: server can still serve real parcel routing data even
  // when Firestore (live GPS) is not configured — surface it, don't hide it.
  if (els.mapStatus && !state.firestore.configured) {
    els.mapStatus.title = 'Live GPS (Firestore) is not configured on the server — no traveler pins will appear. Parcel and route data is still real.';
  }

  populateCitySelects();
  renderLists();
  renderMap();
  renderSummary();
  backfillActivityFromParcels();
}

function populateCitySelects() {
  if (!els.parcelFromFilter || !els.parcelToFilter) return;
  const fromCities = [...new Set(state.parcels.map((p) => p.fromCity).filter(Boolean))].sort();
  const toCities = [...new Set(state.parcels.map((p) => p.toCity).filter(Boolean))].sort();
  const userCities = [...new Set(state.users.map((u) => u.city).filter(Boolean))].sort();

  fillSelect(els.parcelFromFilter, fromCities, 'parcelFromFilter');
  fillSelect(els.parcelToFilter, toCities, 'parcelToFilter');
  fillSelect(els.userCityFilter, userCities, 'userCityFilter');
}

function fillSelect(sel, values, idName) {
  const current = sel.value;
  const options = ['<option value="all">' + (idName === 'userCityFilter' ? 'All Cities' : 'All Cities') + '</option>']
    .concat(values.map((v) => `<option value="${escHtml(v)}">${escHtml(v)}</option>`));
  sel.innerHTML = options.join('');
  if (values.includes(current)) sel.value = current;
}

function updateLastUpdated(iso) {
  if (!els.lastUpdated) return;
  const d = new Date(iso);
  els.lastUpdated.textContent = isNaN(+d) ? '—' : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/* ─────────────────────────── Polling ─────────────────────────── */

function schedulePoll() {
  if (state.destroyed) return;
  stopPolling();
  state.pollTimer = setTimeout(() => {
    if (state.destroyed) return;
    if (document.hidden) { schedulePoll(); return; }
    refresh(false).catch(() => {});
  }, POLL_MS);
}

function stopPolling() {
  if (state.pollTimer) {
    clearTimeout(state.pollTimer);
    state.pollTimer = null;
  }
}

function startPolling() {
  const handler = () => {
    if (state.destroyed) return;
    if (!document.hidden) {
      if (!state.busy) refresh(false).catch(() => {});
      else schedulePoll();
    } else {
      schedulePoll();
    }
  };
  document.addEventListener('visibilitychange', handler);
  state.visibilityHandler = handler;
}

/* ─────────────────────────── Controls / events ─────────────────────────── */

function toggleFullscreen() {
  const el = document.querySelector('.map-panel') || els.mapEl;
  if (!el) return;
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  } else if (el.requestFullscreen) {
    el.requestFullscreen().catch(() => {});
  }
}

function updateFullscreenIcon() {
  if (els.fullscreenBtn) {
    els.fullscreenBtn.innerHTML = document.fullscreenElement
      ? '<i class="fa-solid fa-compress"></i>'
      : '<i class="fa-solid fa-expand"></i>';
  }
}

function toggle3D() {
  const panel = document.querySelector('.map-panel');
  const root = document.querySelector('.live-tracking-container');
  const el = root || panel;
  if (!el) return;
  const on = el.classList.toggle('is-3d');
  if (els.toggle3DBtn) {
    els.toggle3DBtn.innerHTML = on ? '<i class="fa-solid fa-earth-asia"></i>' : '<i class="fa-solid fa-cube"></i>';
    els.toggle3DBtn.title = on ? 'Exit 3D view' : 'Toggle 3D view';
  }
  if (state.map) {
    // small delay lets the CSS transform settle before the map re-lays out
    setTimeout(() => state.map.invalidateSize(), 60);
  }
}

function switchTab(tab) {
  state.tab = tab;
  els.tabs.forEach((b) => {
    const active = b.dataset.filter === tab;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  if (els.parcelFilters) els.parcelFilters.classList.toggle('hidden', tab !== 'parcels');
  if (els.userFilters) els.userFilters.classList.toggle('hidden', tab !== 'users');
  if (els.parcelListContainer) els.parcelListContainer.classList.toggle('hidden', tab !== 'parcels');
  if (els.userListContainer) els.userListContainer.classList.toggle('hidden', tab !== 'users');
  renderLists();
}

function resetParcelFilters() {
  if (els.parcelSearch) els.parcelSearch.value = '';
  if (els.parcelStatusFilter) els.parcelStatusFilter.value = 'all';
  if (els.parcelFromFilter) els.parcelFromFilter.value = 'all';
  if (els.parcelToFilter) els.parcelToFilter.value = 'all';
  if (els.dateFrom) els.dateFrom.value = '';
  if (els.dateTo) els.dateTo.value = '';
  if (els.locationFreshnessFilter) els.locationFreshnessFilter.value = 'all';
  renderLists();
  renderMap();
}

function resetUserFilters() {
  if (els.userSearch) els.userSearch.value = '';
  if (els.userRoleFilter) els.userRoleFilter.value = 'all';
  if (els.userCityFilter) els.userCityFilter.value = 'all';
  if (els.userOnlineFilter) els.userOnlineFilter.value = 'all';
  renderLists();
}

function bindEvents() {
  on(els.refreshBtn, 'click', () => refresh(true).catch(() => {}));
  els.tabs.forEach((b) => on(b, 'click', () => switchTab(b.dataset.filter)));
  ['input', 'change'].forEach((evt) => {
    on(els.parcelSearch, evt, () => { renderLists(); renderMap(); });
    on(els.parcelStatusFilter, evt, () => { renderLists(); renderMap(); });
    on(els.parcelFromFilter, evt, () => { renderLists(); renderMap(); });
    on(els.parcelToFilter, evt, () => { renderLists(); renderMap(); });
    on(els.locationFreshnessFilter, evt, () => { renderLists(); renderMap(); });
    on(els.userSearch, evt, () => renderLists());
    on(els.userRoleFilter, evt, () => renderLists());
    on(els.userCityFilter, evt, () => renderLists());
    on(els.userOnlineFilter, evt, () => renderLists());
  });
  on(els.dateFrom, 'change', () => { renderLists(); renderMap(); });
  on(els.dateTo, 'change', () => { renderLists(); renderMap(); });
  on(els.resetParcelFilters, 'click', resetParcelFilters);
  on(els.resetUserFilters, 'click', resetUserFilters);
  on(els.fullscreenBtn, 'click', toggleFullscreen);
  on(els.recenterBtn, 'click', () => {
    if (state.map) state.map.flyTo([20.5937, 78.9629], 5, { duration: 0.6 });
  });
  on(els.toggle3DBtn, 'click', toggle3D);
  on(els.retryMapLoad, 'click', () => refresh(true).catch(() => {}));
  on(els.popupCloseBtn, 'click', closeDetail);
  on(els.closePopup, 'click', closeDetail);
  on(els.popupViewDetails, 'click', () => {
    if (!state.selectedParcelId) { closeDetail(); return; }
    const p = state.parcels.find((x) => x._id === state.selectedParcelId);
    if (!p) { closeDetail(); return; }
    if (p.orderId && typeof window.goToParcel === 'function') {
      closeDetail();
      window.goToParcel(p.orderId);
    } else {
      window.showToast ? window.showToast('This parcel has no order ID to open.') : closeDetail();
    }
  });

  const fullscreenHandler = updateFullscreenIcon;
  document.addEventListener('fullscreenchange', fullscreenHandler);
  state.fullscreenHandler = fullscreenHandler;
}

/* ─────────────────────────── Boot ─────────────────────────── */

// First-load auto-start (called again by admin.js' activatePage on re-visits).
window.initLiveTracking = initLiveTracking;
window.destroyLiveTracking = destroyLiveTracking;

initLiveTracking();