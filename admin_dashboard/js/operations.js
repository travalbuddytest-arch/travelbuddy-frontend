// operations.js — Live Operations page with Socket.IO real-time updates
const API_ORIGIN = APP_CONFIG.API_BASE_URL;
const SOCKET_ORIGIN = APP_CONFIG.SOCKET_URL;

// ── API helpers ──────────────────────────────
async function apiGet(url) {
  const token = localStorage.getItem('admin_token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API_ORIGIN}${url}`, { headers, credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, data };
  return data;
}

function timeAgo(date) {
  if (window.TravelBuddyDate) return window.TravelBuddyDate.formatRelative(date);
  if (!date) return '';
  const diffMs = +new Date() - +new Date(date);
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function fullTime(date) {
  if (window.TravelBuddyDate) return window.TravelBuddyDate.formatDateTime(date);
  if (!date) return '';
  try {
    return new Date(date).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

// ── Status helpers ───────────────────────────
const STATUS_LABELS = {
  pending: 'Pending', accepted: 'Accepted', pickup_confirmed: 'Pickup Confirmed',
  in_transit: 'In Transit', delivered: 'Delivered', cancelled: 'Cancelled',
};

const STATUS_COLORS = {
  accepted: '#12b76a',
  pickup_confirmed: '#f79009',
  in_transit: '#1769ff',
  delayed: '#f04438',
};

// ── SLA / delay thresholds (minutes) ─────────
// Used when a parcel sits in a status too long. `in_transit` prefers the
// real `estimatedArrival` field from the backend when present.
const SLA_MINUTES = {
  accepted: 180,          // waiting too long for pickup
  pickup_confirmed: 90,   // waiting too long for journey to start
  in_transit: 240,        // fallback if no estimatedArrival is set
};

function getDelayInfo(j) {
  const now = Date.now();
  if (j.status === 'in_transit' && j.estimatedArrival) {
    const diffMin = Math.floor((now - new Date(j.estimatedArrival).getTime()) / 60000);
    return diffMin > 0 ? { delayed: true, minutesLate: diffMin } : { delayed: false, minutesLate: 0 };
  }
  const sinceField = j.status === 'accepted' ? j.acceptedAt
    : j.status === 'pickup_confirmed' ? j.pickupConfirmedAt
    : j.status === 'in_transit' ? j.inTransitAt
    : null;
  const threshold = SLA_MINUTES[j.status];
  if (!sinceField || !threshold) return { delayed: false, minutesLate: 0 };
  const elapsedMin = Math.floor((now - new Date(sinceField).getTime()) / 60000);
  return elapsedMin > threshold ? { delayed: true, minutesLate: elapsedMin - threshold } : { delayed: false, minutesLate: 0 };
}

function statusColorFor(j) {
  const d = getDelayInfo(j);
  if (d.delayed) return STATUS_COLORS.delayed;
  return STATUS_COLORS[j.status] || STATUS_COLORS.accepted;
}

// ── Map city coordinates (percentage-based for India) ──
const CITIES = {
  'mumbai': { x: 35, y: 58, label: 'Mumbai' },
  'pune': { x: 40, y: 62, label: 'Pune' },
  'delhi': { x: 48, y: 18, label: 'Delhi' },
  'bangalore': { x: 48, y: 78, label: 'Bangalore' },
  'chennai': { x: 55, y: 75, label: 'Chennai' },
  'kolkata': { x: 70, y: 30, label: 'Kolkata' },
  'hyderabad': { x: 50, y: 65, label: 'Hyderabad' },
  'ahmedabad': { x: 27, y: 32, label: 'Ahmedabad' },
  'jaipur': { x: 40, y: 25, label: 'Jaipur' },
  'lucknow': { x: 55, y: 25, label: 'Lucknow' },
  'nagpur': { x: 50, y: 48, label: 'Nagpur' },
  'surat': { x: 32, y: 48, label: 'Surat' },
  'indore': { x: 40, y: 40, label: 'Indore' },
  'chandigarh': { x: 42, y: 12, label: 'Chandigarh' },
  'guwahati': { x: 80, y: 22, label: 'Guwahati' },
};

// ── State ─────────────────────────────────────
let journeysCache = [];
let socket = null;
let socketConnected = false;

const filters = { search: '', status: 'all' };
let heatmapOn = false;
let soundMuted = localStorage.getItem('ops_sound_muted') === '1';
let feedPaused = false;
let timeRange = '1h'; // '1h' | 'today' | 'week'
let activityLog = [];      // { type, title, description, severity, timestamp }
let pendingWhilePaused = 0;
let alreadyAlertedDelayed = new Set(); // orderIds we've already fired a delay alert for
let audioCtx = null;
let delayRefreshTimer = null;

// ── DOM refs ─────────────────────────────────
function $(id) { return document.getElementById(id); }

// ── Filtering ─────────────────────────────────
function matchesFilters(j) {
  const d = getDelayInfo(j);
  if (filters.status === 'delayed' && !d.delayed) return false;
  if (filters.status !== 'all' && filters.status !== 'delayed' && j.status !== filters.status) return false;
  if (filters.search) {
    const q = filters.search.toLowerCase();
    const haystack = [j.orderId, j.fromCity, j.toCity, j.sender, j.traveler].filter(Boolean).join(' ').toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

function getFilteredJourneys() {
  return journeysCache.filter(matchesFilters);
}

// ── Render: Stats ─────────────────────────────
function renderStats(stats) {
  if (!stats) return;
  const setNum = (id, val) => { const el = $(id); if (el) el.textContent = val != null ? val : '—'; };
  setNum('opsActive', stats.totalActive);
  setNum('opsAccepted', stats.accepted);
  setNum('opsPickup', stats.pickupConfirmed);
  setNum('opsTransit', stats.inTransit);
  setNum('opsRecent', stats.changedRecently);
}

function renderDelayedStat() {
  const delayedCount = journeysCache.filter(j => getDelayInfo(j).delayed).length;
  const el = $('opsDelayed');
  if (el) el.textContent = delayedCount;
}

// ── Render: Journey cards ─────────────────────
function renderJourneyCard(j) {
  const d = getDelayInfo(j);
  const color = statusColorFor(j);
  const key = escHtml(String(j._id || j.orderId));
  return `
    <div class="oj-card${d.delayed ? ' is-delayed' : ''}" data-key="${key}">
      <div class="oj-head">
        <b>${escHtml(j.orderId || '—')}</b>
        <span>
          <span class="ops-status" style="background:${color}15;color:${color}">${STATUS_LABELS[j.status] || j.status}</span>
          ${d.delayed ? `<span class="oj-delay-badge">Delayed ${d.minutesLate}m</span>` : ''}
        </span>
      </div>
      <div class="oj-route"><i class="fa-solid fa-location-dot"></i> ${escHtml(j.fromCity || '')} → ${escHtml(j.toCity || '')}</div>
      <div class="oj-meta">
        <span>${escHtml(j.sender || '—')}</span>
        ${j.traveler ? `<span>→ ${escHtml(j.traveler)}</span>` : '<span class="muted">Awaiting traveler</span>'}
      </div>
      <div class="progress"><i style="width:${Math.min(j.progress || 30, 100)}%;background:${color}"></i></div>
      <div class="oj-time">${j.lastUpdateMinutes != null ? (j.lastUpdateMinutes < 1 ? 'Just updated' : `${j.lastUpdateMinutes}m ago`) : ''}</div>
    </div>
  `;
}

function renderJourneyList() {
  const container = $('opsJourneyList');
  if (!container) return;
  const filtered = getFilteredJourneys();
  const count = $('journeyCount');
  if (count) {
    const filterActive = filters.search || filters.status !== 'all';
    count.textContent = filterActive ? `${filtered.length} of ${journeysCache.length} active` : `${journeysCache.length} active`;
  }

  if (!filtered.length) {
    container.innerHTML = `<div class="empty-ops">${journeysCache.length ? 'No journeys match this filter.' : 'No active journeys right now.'}</div>`;
    return;
  }
  container.innerHTML = filtered.map(renderJourneyCard).join('');
}

function renderMiniJourneys() {
  const container = $('miniJourneyList');
  if (!container) return;
  const filtered = getFilteredJourneys();
  if (!filtered.length) {
    container.innerHTML = '<div class="empty-ops" style="padding:10px;font-size:9px;">No active journeys</div>';
    return;
  }
  const top5 = filtered.slice(0, 5);
  container.innerHTML = top5.map(j => {
    const d = getDelayInfo(j);
    const color = statusColorFor(j);
    return `
    <div class="mj-item" data-key="${escHtml(String(j._id || j.orderId))}" style="cursor:pointer;">
      <span class="mj-id">${escHtml(j.orderId || '—')}${d.delayed ? ' <span style="color:#f04438">●</span>' : ''}</span>
      <span class="mj-route">${escHtml(j.fromCity || '')} → ${escHtml(j.toCity || '')}</span>
      <div class="progress"><i style="width:${Math.min(j.progress || 30, 100)}%;background:${color}"></i></div>
    </div>
  `;
  }).join('');
}

// ── Render: Map (pins, routes, heatmap, moving dots) ──
function updateCityPins() {
  const container = $('cityPins');
  if (!container) return;

  const filterActive = !!(filters.search || filters.status !== 'all');
  const matchedIds = new Set(getFilteredJourneys().map(j => j._id || j.orderId));

  const cityCounts = {};
  const cityDelayed = {};
  journeysCache.forEach(j => {
    const lowerFrom = (j.fromCity || '').toLowerCase();
    const lowerTo = (j.toCity || '').toLowerCase();
    const d = getDelayInfo(j);
    if (CITIES[lowerFrom]) { cityCounts[lowerFrom] = (cityCounts[lowerFrom] || 0) + 1; if (d.delayed) cityDelayed[lowerFrom] = true; }
    if (CITIES[lowerTo]) { cityCounts[lowerTo] = (cityCounts[lowerTo] || 0) + 1; if (d.delayed) cityDelayed[lowerTo] = true; }
  });

  container.innerHTML = '';

  if (heatmapOn) {
    // Aggregate journeys by route pair (direction-insensitive) — thicker/
    // brighter line = busier route.
    const routeMap = {};
    journeysCache.forEach(j => {
      const fromKey = (j.fromCity || '').toLowerCase();
      const toKey = (j.toCity || '').toLowerCase();
      const from = CITIES[fromKey], to = CITIES[toKey];
      if (!from || !to || fromKey === toKey) return;
      const isMatch = matchedIds.has(j._id || j.orderId);
      const pairKey = [fromKey, toKey].sort().join('|');
      if (!routeMap[pairKey]) routeMap[pairKey] = { from, to, count: 0, delayed: false, matchedCount: 0 };
      routeMap[pairKey].count += 1;
      if (isMatch) routeMap[pairKey].matchedCount += 1;
      if (getDelayInfo(j).delayed) routeMap[pairKey].delayed = true;
    });
    Object.values(routeMap).forEach(r => {
      const dx = r.to.x - r.from.x, dy = r.to.y - r.from.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      const color = r.delayed ? STATUS_COLORS.delayed : STATUS_COLORS.in_transit;
      const width = Math.min(2 + r.count * 1.8, 11);
      const dim = filterActive && r.matchedCount === 0;
      const line = document.createElement('i');
      line.className = 'ops-route-line' + (dim ? ' ops-route-dim' : '') + (r.delayed ? ' ops-route-delayed' : '');
      line.style.cssText = `
        position:absolute; height:${width}px; background:${color}; border-radius:${width}px; opacity:${dim ? 0.08 : Math.min(0.35 + r.count * 0.12, 0.9)};
        left:${r.from.x}%; top:${r.from.y}%; width:${dist}%;
        transform:rotate(${angle}deg); transform-origin:0 50%; pointer-events:none; color:${color};
      `;
      line.title = `${r.count} journeys on this route`;
      const dot = document.createElement('i');
      dot.className = 'ops-route-dot';
      dot.style.animationDuration = `${Math.max(4, 10 - r.count)}s`;
      line.appendChild(dot);
      container.appendChild(line);
    });
  } else {
    // One thin line per journey, colored by status/delay, each with its
    // own slow-moving dot standing in for a future live GPS position.
    journeysCache.forEach(j => {
      const fromKey = (j.fromCity || '').toLowerCase();
      const toKey = (j.toCity || '').toLowerCase();
      const from = CITIES[fromKey], to = CITIES[toKey];
      if (!from || !to || fromKey === toKey) return;
      const d = getDelayInfo(j);
      const color = statusColorFor(j);
      const isMatch = matchedIds.has(j._id || j.orderId);
      const dim = filterActive && !isMatch;
      const dx = to.x - from.x, dy = to.y - from.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      const line = document.createElement('i');
      line.className = 'ops-route-line' + (dim ? ' ops-route-dim' : '') + (d.delayed ? ' ops-route-delayed' : '');
      line.style.cssText = `
        position:absolute; height:2px; background:${color}; border-radius:2px; opacity:${dim ? 0.08 : (isMatch && filterActive ? 0.75 : 0.4)};
        left:${from.x}%; top:${from.y}%; width:${dist}%;
        transform:rotate(${angle}deg); transform-origin:0 50%; pointer-events:none; color:${color};
      `;
      line.title = j.orderId || '';
      if (!dim) {
        const dot = document.createElement('i');
        dot.className = 'ops-route-dot';
        dot.style.animationDuration = `${j.status === 'in_transit' ? 5 : 9}s`;
        line.appendChild(dot);
      }
      container.appendChild(line);
    });
  }

  // Draw city pins
  Object.entries(cityCounts).forEach(([key, count]) => {
    const city = CITIES[key];
    if (!city) return;
    const dim = filterActive && !getFilteredJourneys().some(j => (j.fromCity || '').toLowerCase() === key || (j.toCity || '').toLowerCase() === key);
    const pin = document.createElement('div');
    pin.className = 'ops-pin' + (dim ? ' ops-pin-dim' : '') + (cityDelayed[key] ? ' ops-pin-delayed' : '');
    pin.style.cssText = `left:${city.x}%;top:${city.y}%;`;
    pin.innerHTML = `<i class="fa-solid fa-location-dot"></i>`;
    pin.title = `${city.label}: ${count} parcels${cityDelayed[key] ? ' (delayed present)' : ''}`;
    container.appendChild(pin);

    const label = document.createElement('div');
    label.className = 'ops-city-label' + (dim ? ' ops-pin-dim' : '');
    label.style.cssText = `left:${city.x + 2}%;top:${city.y - 2}%;`;
    label.textContent = `${city.label} (${count})`;
    container.appendChild(label);
  });
}

function renderMap() {
  updateCityPins();
  renderMiniJourneys();
}

function renderAll() {
  renderJourneyList();
  renderMap();
  renderDelayedStat();
}

// ── Sound + Toast alerts ──────────────────────
function playAlertSound() {
  if (soundMuted) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioCtx;
    const now = ctx.currentTime;
    [880, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + i * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.18, now + i * 0.14 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.14 + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.14);
      osc.stop(now + i * 0.14 + 0.2);
    });
  } catch (err) { /* audio not available — ignore */ }
}

function showAdminToast(msg) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}

const HIGH_PRIORITY_TYPES = new Set(['cancelled', 'dispute', 'delayed', 'alert']);

// ── Activity feed ─────────────────────────────
const ACTIVITY_ICONS = {
  parcel_posted: 'fa-box', parcel_accepted: 'fa-person-walking-luggage',
  pickup_confirmed: 'fa-key', in_transit: 'fa-truck-fast',
  delivered: 'fa-circle-check', cancelled: 'fa-ban', delayed: 'fa-clock',
  dispute: 'fa-triangle-exclamation', alert: 'fa-bell', default: 'fa-circle-info'
};
const ACTIVITY_LABELS = {
  parcel_posted: 'Parcel posted', parcel_accepted: 'Traveler accepted',
  pickup_confirmed: 'Pickup OTP verified', in_transit: 'Parcel in transit',
  delivered: 'Delivery completed', cancelled: 'Parcel cancelled', delayed: 'Delivery delayed',
  dispute: 'Dispute raised', alert: 'Alert', default: 'Event'
};

function rangeStartMs(range) {
  const now = Date.now();
  if (range === '1h') return now - 60 * 60000;
  if (range === 'today') { const d = new Date(); d.setHours(0, 0, 0, 0); return +d; }
  if (range === 'week') return now - 7 * 24 * 60 * 60000;
  return 0;
}

function addActivityEvent(event) {
  const withTimestamp = { ...event, timestamp: event.timestamp || new Date().toISOString() };
  activityLog.unshift(withTimestamp);
  if (activityLog.length > 300) activityLog.length = 300;

  const isHighPriority = event.severity === 'high' || event.severity === 'critical' || HIGH_PRIORITY_TYPES.has(event.type);
  if (isHighPriority) {
    showAdminToast(`${ACTIVITY_LABELS[event.type] || event.title || 'Alert'}${event.description ? ' — ' + event.description : ''}`);
    playAlertSound();
  }

  if (feedPaused) {
    pendingWhilePaused += 1;
    updatePausedNote();
    return;
  }
  renderActivityFeed();
}

function renderActivityFeed() {
  const container = $('opsActivity');
  if (!container) return;
  const since = rangeStartMs(timeRange);
  const items = activityLog.filter(e => +new Date(e.timestamp) >= since).slice(0, 40);

  if (!items.length) {
    container.innerHTML = '<div style="padding:12px;font-size:9px;color:#98a2b3;text-align:center;">No events in this range yet.</div>';
    return;
  }

  container.innerHTML = items.map(event => {
    const icon = ACTIVITY_ICONS[event.type] || ACTIVITY_ICONS.default;
    const label = event.title || ACTIVITY_LABELS[event.type] || ACTIVITY_LABELS.default;
    const isCritical = event.severity === 'high' || event.severity === 'critical';
    return `
      <div class="activity${isCritical ? ' is-critical' : ''}">
        <i class="fa-solid ${icon}"></i>
        <div><b>${escHtml(label)}</b><p>${escHtml(event.description || '')}</p></div>
        <time>${timeAgo(event.timestamp)}</time>
      </div>
    `;
  }).join('');
}

function updatePausedNote() {
  const container = $('opsActivity');
  if (!container) return;
  let note = document.querySelector('.ops-feed-paused-note');
  if (pendingWhilePaused > 0 && feedPaused) {
    if (!note) {
      note = document.createElement('div');
      note.className = 'ops-feed-paused-note';
      note.addEventListener('click', () => { setFeedPaused(false); });
      container.parentElement.insertBefore(note, container);
    }
    note.textContent = `Feed paused — ${pendingWhilePaused} new event${pendingWhilePaused === 1 ? '' : 's'}. Click to resume.`;
  } else if (note) {
    note.remove();
  }
}

function setFeedPaused(paused) {
  feedPaused = paused;
  const btn = $('opsPauseFeed');
  if (btn) {
    btn.classList.toggle('active', paused);
    btn.innerHTML = paused ? '<i class="fa-solid fa-play"></i>' : '<i class="fa-solid fa-pause"></i>';
  }
  if (!paused) {
    pendingWhilePaused = 0;
    updatePausedNote();
    renderActivityFeed();
  }
}

// ── Delay watcher (periodic, since delay depends on the clock, not just events) ──
function checkForNewDelays() {
  journeysCache.forEach(j => {
    const d = getDelayInfo(j);
    const id = j.orderId || String(j._id);
    if (d.delayed && !alreadyAlertedDelayed.has(id)) {
      alreadyAlertedDelayed.add(id);
      addActivityEvent({
        type: 'delayed',
        title: 'Delivery delayed',
        description: `${j.orderId} is running ${d.minutesLate}m behind schedule (${escHtml(j.fromCity)} → ${escHtml(j.toCity)}).`,
        severity: 'high',
      });
    } else if (!d.delayed && alreadyAlertedDelayed.has(id)) {
      alreadyAlertedDelayed.delete(id);
    }
  });
}

// ── CSV export ─────────────────────────────────
function csvEscape(val) {
  const s = val == null ? '' : String(val);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportJourneysCSV() {
  const rows = getFilteredJourneys();
  const headers = ['Order ID', 'Status', 'Delayed', 'From', 'To', 'Sender', 'Sender Email', 'Sender Phone',
    'Traveler', 'Traveler Email', 'Traveler Phone', 'Price', 'Progress %', 'Created At', 'Accepted At',
    'Pickup Confirmed At', 'In Transit At', 'Last Updated'];
  const lines = [headers.join(',')];
  rows.forEach(j => {
    const d = getDelayInfo(j);
    lines.push([
      j.orderId, STATUS_LABELS[j.status] || j.status, d.delayed ? `Yes (${d.minutesLate}m)` : 'No',
      j.fromCity, j.toCity, j.sender || '', j.senderEmail || '', j.senderPhone || '',
      j.traveler || '', j.travelerEmail || '', j.travelerPhone || '', j.price || 0, j.progress || '',
      j.createdAt || '', j.acceptedAt || '', j.pickupConfirmedAt || '', j.inTransitAt || '', j.updatedAt || '',
    ].map(csvEscape).join(','));
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `travelbuddy-active-journeys-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showAdminToast(`Exported ${rows.length} journey${rows.length === 1 ? '' : 's'} to CSV`);
}

// ── Journey Detail Modal ───────────────────────
const TIMELINE_STEPS = [
  { key: 'createdAt', status: 'posted', label: 'Posted' },
  { key: 'acceptedAt', status: 'accepted', label: 'Accepted by Traveler' },
  { key: 'pickupConfirmedAt', status: 'pickup_confirmed', label: 'Pickup Confirmed (OTP)' },
  { key: 'inTransitAt', status: 'in_transit', label: 'In Transit' },
  { key: 'deliveredAt', status: 'delivered', label: 'Delivered (OTP)' },
];

function buildTimelineHtml(j) {
  const currentIdx = TIMELINE_STEPS.findIndex(s => s.status === j.status);
  return TIMELINE_STEPS.map((step, i) => {
    const ts = j[step.key];
    const done = !!ts && i <= currentIdx;
    const isCurrent = i === currentIdx;
    const stateClass = done ? 'done' : isCurrent ? 'current' : '';
    const icon = done ? 'fa-check' : isCurrent ? 'fa-truck-fast' : 'fa-circle';
    return `
      <div class="om-tl-step ${stateClass}">
        <div class="om-tl-dot"><i class="fa-solid ${icon}" style="font-size:${done || isCurrent ? '9px' : '6px'}"></i></div>
        <div>
          <div class="om-tl-label">${step.label}</div>
          <div class="om-tl-time">${ts ? fullTime(ts) : (isCurrent ? 'In progress' : 'Pending')}</div>
        </div>
      </div>
    `;
  }).join('');
}

function buildHistoryHtml(j) {
  const history = j.trackingHistory || [];
  if (!history.length) return '<div class="om-empty-history">No status history recorded yet.</div>';
  return history.slice().reverse().map(h => `
    <div class="om-history-item">
      <i class="fa-solid fa-circle-check"></i>
      <div>
        <div><b>${escHtml(STATUS_LABELS[h.status] || h.status)}</b></div>
        <div class="om-history-note">${escHtml(h.note || '')}</div>
        <div class="om-history-meta">${escHtml(capitalize(h.updatedByRole || 'system'))} • ${fullTime(h.timestamp)}</div>
      </div>
    </div>
  `).join('');
}

function contactCardHtml(role, name, email, phone) {
  if (!name) {
    return `
      <div class="om-contact-card">
        <div class="om-contact-role">${role}</div>
        <div class="om-contact-empty">Awaiting traveler</div>
      </div>`;
  }
  return `
    <div class="om-contact-card">
      <div class="om-contact-role">${role}</div>
      <div class="om-contact-name">${escHtml(name)}</div>
      ${email ? `<div class="om-contact-line"><i class="fa-solid fa-envelope"></i>${escHtml(email)}</div>` : ''}
      ${phone ? `<div class="om-contact-line"><i class="fa-solid fa-phone"></i>${escHtml(phone)}</div>` : '<div class="om-contact-line" style="color:#d0d5dd;">No phone on file</div>'}
    </div>`;
}

function openJourneyModal(key) {
  const j = journeysCache.find(x => String(x._id) === key || x.orderId === key);
  if (!j) return;
  const modal = $('opsJourneyModal');
  const body = $('opsModalBody');
  if (!modal || !body) return;

  const d = getDelayInfo(j);
  const color = statusColorFor(j);

  body.innerHTML = `
    <div class="om-head">
      <h2>${escHtml(j.orderId || '—')}</h2>
      <span class="ops-status" style="background:${color}15;color:${color}">${STATUS_LABELS[j.status] || j.status}</span>
    </div>
    <div class="om-route"><i class="fa-solid fa-location-dot"></i>${escHtml(j.fromCity || '')} → ${escHtml(j.toCity || '')} ${j.price ? `· ₹${(escHtml(j.price)/100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : ''}${j.weight ? ` · ${escHtml(j.weight)}kg` : ''}</div>
    ${d.delayed ? `<div class="om-delay-banner"><i class="fa-solid fa-triangle-exclamation"></i> Running ${d.minutesLate} minute${d.minutesLate === 1 ? '' : 's'} behind expected schedule</div>` : ''}

    <!-- Quick action buttons -->
    <div class="om-actions">
      <button class="pc-btn pc-btn-sm pc-btn-success om-action-btn" data-ops-action="approve" data-ops-id="${j._id}" ${j.status !== 'pending' ? 'disabled' : ''} title="Approve parcel"><i class="fa-solid fa-check"></i> Approve</button>
      <button class="pc-btn pc-btn-sm pc-btn-info om-action-btn" data-ops-action="pickup" data-ops-id="${j._id}" ${j.status !== 'accepted' ? 'disabled' : ''} title="Confirm pickup"><i class="fa-solid fa-hand-holding-box"></i> Pickup</button>
      <button class="pc-btn pc-btn-sm pc-btn-primary om-action-btn" data-ops-action="transit" data-ops-id="${j._id}" ${j.status !== 'pickup_confirmed' ? 'disabled' : ''} title="Mark in transit"><i class="fa-solid fa-truck-fast"></i> Transit</button>
      <button class="pc-btn pc-btn-sm pc-btn-success om-action-btn" data-ops-action="deliver" data-ops-id="${j._id}" ${j.status !== 'in_transit' ? 'disabled' : ''} title="Mark delivered"><i class="fa-solid fa-circle-check"></i> Deliver</button>
      <button class="pc-btn pc-btn-sm pc-btn-danger om-action-btn" data-ops-action="cancel" data-ops-id="${j._id}" ${j.status === 'delivered' || j.status === 'cancelled' ? 'disabled' : ''} title="Cancel parcel"><i class="fa-solid fa-ban"></i> Cancel</button>
    </div>

    <div class="om-section-title">Contacts</div>
    <div class="om-contacts">
      ${contactCardHtml('Sender', j.sender, j.senderEmail, j.senderPhone)}
      ${contactCardHtml('Traveler', j.traveler, j.travelerEmail, j.travelerPhone)}
    </div>

    <div class="om-section-title">Journey Timeline</div>
    <div class="om-timeline">${buildTimelineHtml(j)}</div>

    <div class="om-section-title">Status / OTP History</div>
    <div class="om-history">${buildHistoryHtml(j)}</div>
  `;
  modal.classList.add('show');
}

function closeJourneyModal() {
  const modal = $('opsJourneyModal');
  if (modal) modal.classList.remove('show');
}

// ── Initialize page ─────────────────────────

async function loadInitialData() {
  try {
    const data = await apiGet('/api/admin/active-journeys');
    if (data.journeys) {
      journeysCache = data.journeys;
      renderAll();
    }
    if (data.summary) renderStats(data.summary);
  } catch (err) {
    console.warn('Failed to load active journeys:', err);
    const container = $('opsJourneyList');
    if (container) {
      container.innerHTML = '<div class="empty-ops error-ops">Failed to load journeys. <button class="retry-inline" id="opsRetryBtn">Retry</button></div>';
      const retry = container.querySelector('#opsRetryBtn');
      if (retry) retry.addEventListener('click', () => loadInitialData());
    }
  }
}

function connectSocket() {
  const token = localStorage.getItem('admin_token');
  if (!token) {
    console.warn('No admin token — cannot connect Socket.IO');
    const indicator = $('liveIndicator');
    if (indicator) indicator.textContent = '● NO TOKEN';
    return;
  }

  socket = io(SOCKET_ORIGIN + '/admin', {
    auth: { token },
    withCredentials: true,
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    console.log('Admin Socket.IO connected');
    socketConnected = true;
    const indicator = $('liveIndicator');
    if (indicator) {
      indicator.textContent = '● LIVE';
      indicator.style.color = '#079455';
      indicator.style.background = '#ecfdf3';
    }
    renderActivityFeed();
  });

  socket.on('connect_error', (err) => {
    console.warn('Admin Socket.IO error:', err.message);
    socketConnected = false;
    const indicator = $('liveIndicator');
    if (indicator) {
      indicator.textContent = '● DISCONNECTED';
      indicator.style.color = '#f04438';
      indicator.style.background = '#fff0ee';
    }
  });

  socket.on('disconnect', () => {
    console.log('Admin Socket.IO disconnected');
    socketConnected = false;
    const indicator = $('liveIndicator');
    if (indicator) {
      indicator.textContent = '● DISCONNECTED';
      indicator.style.color = '#f04438';
      indicator.style.background = '#fff0ee';
    }
  });

  socket.on('admin:stats', (stats) => {
    renderStats(stats);
  });

  // The live payload from adminSocket.js's emitParcelUpdate only carries bare
  // sender/traveler IDs (`{id}`), not the display names/emails/phones loaded
  // via REST — merging it naively would clobber good data with "[object]".
  // So we drop those two fields from the patch and, for a journey we don't
  // already have enriched data for, just reload from REST instead of guessing.
  socket.on('parcel:update', (parcel) => {
    const idx = journeysCache.findIndex(j => j.orderId === parcel.orderId || String(j._id) === String(parcel.id));
    if (idx < 0) {
      if (['accepted', 'pickup_confirmed', 'in_transit'].includes(parcel.status)) {
        loadInitialData();
      }
      return;
    }
    const patch = { ...parcel };
    delete patch.id;
    delete patch.sender;
    delete patch.traveler;
    journeysCache[idx] = { ...journeysCache[idx], ...patch };

    if (['delivered', 'cancelled'].includes(parcel.status)) {
      journeysCache = journeysCache.filter(j => j.orderId !== parcel.orderId);
    }
    renderAll();
  });

  socket.on('admin:alert', (alert) => {
    addActivityEvent(alert);
  });
}

function wireToolbar() {
  const searchInput = $('opsSearch');
  if (searchInput) {
    let debounceTimer = null;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        filters.search = e.target.value.trim();
        renderAll();
      }, 200);
    });
  }

  const statusFilter = $('opsStatusFilter');
  if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
      filters.status = e.target.value;
      renderAll();
    });
  }

  const heatmapBtn = $('opsHeatmapToggle');
  if (heatmapBtn) {
    heatmapBtn.addEventListener('click', () => {
      heatmapOn = !heatmapOn;
      heatmapBtn.classList.toggle('active', heatmapOn);
      renderMap();
    });
  }

  const exportBtn = $('opsExportBtn');
  if (exportBtn) exportBtn.addEventListener('click', exportJourneysCSV);

  const soundBtn = $('opsSoundToggle');
  if (soundBtn) {
    const applySoundBtnState = () => {
      soundBtn.classList.toggle('muted', soundMuted);
      soundBtn.innerHTML = `<i class="fa-solid ${soundMuted ? 'fa-volume-xmark' : 'fa-volume-high'}"></i>`;
    };
    applySoundBtnState();
    soundBtn.addEventListener('click', () => {
      soundMuted = !soundMuted;
      localStorage.setItem('ops_sound_muted', soundMuted ? '1' : '0');
      applySoundBtnState();
    });
  }

  const timeRangeGroup = $('opsTimeRange');
  if (timeRangeGroup) {
    timeRangeGroup.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        timeRange = btn.dataset.range;
        timeRangeGroup.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
        renderActivityFeed();
      });
    });
  }

  const pauseBtn = $('opsPauseFeed');
  if (pauseBtn) pauseBtn.addEventListener('click', () => setFeedPaused(!feedPaused));
}

function wireJourneyClicks() {
  const listEls = [$('opsJourneyList'), $('miniJourneyList')];
  listEls.forEach(el => {
    if (!el) return;
    el.addEventListener('click', (e) => {
      const card = e.target.closest('[data-key]');
      if (card) openJourneyModal(card.dataset.key);
    });
  });

  const closeBtn = $('opsModalClose');
  const backdrop = $('opsModalBackdrop');
  if (closeBtn) closeBtn.addEventListener('click', closeJourneyModal);
  if (backdrop) backdrop.addEventListener('click', closeJourneyModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeJourneyModal();
  });

  // Status action buttons inside modal (delegated because body.innerHTML changes)
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-ops-action]');
    if (!btn) return;
    const action = btn.dataset.opsAction;
    const id = btn.dataset.opsId;
    if (!action || !id) return;

    const statusMap = {
      approve: { s: 'accepted', label: 'approved' },
      pickup: { s: 'pickup_confirmed', label: 'pickup confirmed' },
      transit: { s: 'in_transit', label: 'in transit' },
      deliver: { s: 'delivered', label: 'delivered' },
      cancel: { s: 'cancelled', label: 'cancelled' },
    };
    const def = statusMap[action];
    if (!def) return;

    let reason = '';
    if (action === 'cancel') {
      reason = prompt('Cancellation reason:');
      if (reason === null) return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
      const token = localStorage.getItem('admin_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${API_ORIGIN}/api/admin/parcels/status/${id}`, {
        method: 'PUT', headers, credentials: 'include',
        body: JSON.stringify({ status: def.s, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Action failed');
      showAdminToast(`Parcel ${def.label}`);
      closeJourneyModal();
      loadInitialData();
    } catch (err) {
      showAdminToast(err.message || 'Action failed');
      btn.disabled = false;
      const iconMap = { cancel: 'fa-ban', approve: 'fa-check', pickup: 'fa-hand-holding-box', transit: 'fa-truck-fast', deliver: 'fa-circle-check' };
      btn.innerHTML = `<i class="fa-solid ${iconMap[action] || 'fa-circle'}"></i> ${action.charAt(0).toUpperCase() + action.slice(1)}`;
    }
  });
}

export default function initOperations() {
  const map = $('opsMap');
  if (!map) return;

  const activity = $('opsActivity');
  if (activity) activity.innerHTML = '<div class="loading-ops">Connecting to live feed...</div>';
  const journeyList = $('opsJourneyList');
  if (journeyList) journeyList.innerHTML = '<div class="loading-ops">Loading active journeys...</div>';

  wireToolbar();
  wireJourneyClicks();
  loadInitialData();

  if (typeof io !== 'undefined') {
    connectSocket();
  } else {
    console.warn('Socket.IO client not loaded — live updates disabled');
    const indicator = $('liveIndicator');
    if (indicator) indicator.textContent = '● SOCKET.IO NOT LOADED';
  }

  const refreshBtn = $('opsRefresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.classList.add('spinning');
      await loadInitialData();
      setTimeout(() => refreshBtn.classList.remove('spinning'), 500);
    });
  }

  // Recompute delay flags + relative timestamps periodically — delay state
  // changes purely with the clock, not just on new socket events.
  if (delayRefreshTimer) clearInterval(delayRefreshTimer);
  delayRefreshTimer = setInterval(() => {
    checkForNewDelays();
    renderAll();
    renderActivityFeed();
  }, 30000);
}

try { initOperations(); } catch (e) { console.warn('operations init failed', e); }
