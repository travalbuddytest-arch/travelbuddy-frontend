const API_ORIGIN = APP_CONFIG.API_BASE_URL;

async function apiGet(url) {
  const token = localStorage.getItem('admin_token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API_ORIGIN}${url}`, { headers, credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, data };
  return data;
}

export default function initAnalytics() {
  const el = document.getElementById('analytics-panel');
  if (!el) return;
  loadAnalytics();
}

async function loadAnalytics() {
  const metrics = document.getElementById('analyticsMetrics');
  const userChart = document.getElementById('userGrowthChart');
  const parcelChart = document.getElementById('parcelVolumeChart');
  const statusDist = document.getElementById('statusDistribution');
  const topRoutes = document.getElementById('topRoutes');

  if (metrics) metrics.innerHTML = '<div class="loading" style="text-align:center;padding:30px;color:#98a2b3">Loading analytics...</div>';

  try {
    const data = await apiGet('/api/admin/analytics');

    const r = data.revenue30d || {};
    const totalParcels = Object.values(data.statusDistribution || {}).reduce((a, b) => a + b, 0);
    if (metrics) {
      metrics.innerHTML = `
        <div class="metric-card"><span>Revenue (30d)</span><strong>₹${((r.total || 0)/100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
        <div class="metric-card"><span>Deliveries (30d)</span><strong>${r.count || 0}</strong></div>
        <div class="metric-card"><span>Total Parcels</span><strong>${totalParcels}</strong></div>
        <div class="metric-card"><span>Active Routes</span><strong>${(data.topRoutes || []).length}</strong></div>
      `;
    }

    if (userChart) renderBarChart(userChart, data.userGrowth || [], 'count', 'Users');
    if (parcelChart) renderBarChart(parcelChart, data.parcelGrowth || [], 'count', 'Parcels');

    if (statusDist) {
      const sd = data.statusDistribution || {};
      const labels = { pending: 'Pending', accepted: 'Accepted', pickup_confirmed: 'Pickup Confirmed', in_transit: 'In Transit', delivered: 'Delivered', cancelled: 'Cancelled' };
      const maxVal = Math.max(...Object.values(sd), 1);
      statusDist.innerHTML = Object.entries(sd).map(([key, val]) => {
        const pct = Math.round((val / maxVal) * 100);
        const color = key === 'delivered' ? '#12b76a' : key === 'cancelled' ? '#f04438' : key === 'in_transit' ? '#1769ff' : '#f79009';
        return `<div class="stat-bar"><span>${labels[key] || key}</span><b>${val}</b><i><u style="width:${pct}%;background:${color}"></u></i></div>`;
      }).join('');
    }

    if (topRoutes) {
      const routes = data.topRoutes || [];
      if (routes.length === 0) {
        topRoutes.innerHTML = '<p style="color:#98a2b3;font-size:11px;padding:12px;">No route data yet.</p>';
      } else {
        const maxCount = Math.max(...routes.map(r => r.count), 1);
        topRoutes.innerHTML = routes.map(r => {
          const routeName = `${capitalize(r._id?.from || '')} → ${capitalize(r._id?.to || '')}`;
          const pct = Math.round((r.count / maxCount) * 100);
          return `<div class="route-row"><span>${escHtml(routeName)}</span><b>${r.count}</b><span class="cell-mono">₹${((r.revenue || 0)/100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span><i><u style="width:${pct}%"></u></i></div>`;
        }).join('');
      }
    }
  } catch (err) {
    console.warn('Failed to load analytics:', err);
    if (metrics) {
      metrics.innerHTML = '<div class="error" style="text-align:center;padding:30px;color:#f04438"><i class="fa-solid fa-cloud-exclamation"></i> Failed to load analytics. <button class="retry-inline">Retry</button></div>';
      const retry = metrics.querySelector('.retry-inline');
      if (retry) retry.addEventListener('click', () => loadAnalytics());
    }
  }
}

function renderBarChart(container, data, valueKey, label) {
  if (!data || data.length === 0) {
    container.innerHTML = `<p style="color:#98a2b3;font-size:10px;padding:20px;text-align:center">No ${label.toLowerCase()} data yet.</p>`;
    return;
  }
  const maxVal = Math.max(...data.map(d => d[valueKey] || 0), 1);
  container.innerHTML = data.map(d => {
    const pct = Math.round(((d[valueKey] || 0) / maxVal) * 100);
    const dayLabel = d._id ? new Date(d._id + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }) : '';
    return `<div class="chart-col"><i class="bar" style="height:${pct}%"></i><span>${dayLabel}</span></div>`;
  }).join('');
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
function escHtml(s) { if (!s) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

try { initAnalytics(); } catch (e) { console.warn('analytics init failed', e); }
