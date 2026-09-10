/**
 * TravelBuddy — Admin Command Center
 * Central dashboard with real-time stats and prioritized actions.
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

export function initCommand() {
  const el = document.getElementById('kpis');
  if (!el) return;

  loadCommandData();
  document.getElementById('refreshCommand')?.addEventListener('click', loadCommandData);
}

async function loadCommandData() {
  const kpis = document.getElementById('kpis');
  const activity = document.getElementById('activity');
  const risks = document.getElementById('risks');

  // Simple Loading State
  kpis.innerHTML = '<div class="loading">Loading KPIs...</div>';

  try {
    const data = await apiGet('/api/admin/dashboard');
    const { stats, activity: feed, risks: riskList } = data;

    renderKPIs(stats);
    renderActivity(feed);
    renderRisks(riskList);
  } catch (err) {
    console.warn('Command data failed:', err);
    kpis.innerHTML = '<div class="error">Failed to load dashboard data.</div>';
  }
}

function renderKPIs(s) {
  const el = document.getElementById('kpis');
  const items = [
    ['fa-users', 'Total Users', s.totalUsers || 0, 'users'],
    ['fa-circle-dot', 'Active Now', s.activeNow || 0, 'active-users'],
    ['fa-box', 'Parcels Today', s.parcelsToday || 0, 'parcels'],
    ['fa-truck-fast', 'Deliveries', s.activeDeliveries || 0, 'parcels'],
    ['fa-indian-rupee-sign', 'Revenue', '₹' + ((s.platformRevenue || 0)/100).toLocaleString(), 'wallet'],
    ['fa-triangle-exclamation', 'Issues', s.needsAttention || 0, 'incidents'],
  ];

  el.innerHTML = items.map(([icon, label, val, page]) => `
    <div class="kpi" onclick="window.location.hash='#${page}'">
        <i class="fa-solid ${icon}"></i>
        <div>
            <span>${label}</span>
            <strong>${val}</strong>
        </div>
    </div>
  `).join('');
}

function renderActivity(feed) {
  const el = document.getElementById('activity');
  el.innerHTML = `<h4>Live Activity</h4><div class="feed">${feed.map(a => `
    <div class="feed-item">
        <i class="fa-solid ${a.icon}"></i>
        <div>
            <strong>${esc(a.title)}</strong>
            <p>${esc(a.description)}</p>
            <small>${a.timeLabel}</small>
        </div>
    </div>
  `).join('')}</div>`;
}

function renderRisks(risks) {
  const el = document.getElementById('risks');
  el.innerHTML = `<h4>Attention Required</h4><div class="risk-list">${risks.map(r => `
    <div class="risk-item" onclick="if('${r.orderId}') window.location.hash='#parcels?id=${r.orderId}'">
        <div class="risk-head">
            <span class="sev ${r.severity.toLowerCase()}">${r.severity}</span>
            <strong>${esc(r.title)}</strong>
        </div>
        <p>${esc(r.description)}</p>
    </div>
  `).join('')}</div>`;
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

try { initCommand(); } catch (e) { console.warn('command init failed', e); }
