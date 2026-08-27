const API_ORIGIN = APP_CONFIG.API_BASE_URL;

async function apiGet(url) {
  const token = localStorage.getItem('admin_token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API_ORIGIN}${url}`, { headers, credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, data };
  return data;
}

export function initSystem() {
  const el = document.getElementById('systemHealth');
  if (!el) return;
  loadSystem();
}

async function loadSystem() {
  const container = document.getElementById('systemHealth');
  if (!container) return;

  container.innerHTML = '<div class="loading" style="text-align:center;padding:40px;color:#98a2b3;grid-column:1/-1">Checking system health...</div>';

  try {
    const data = await apiGet('/api/admin/system');
    const overallHealthy = data.status === 'healthy';

    const db = data.database || {};
    const dbOk = db.status === 'connected';
    const srv = data.server || {};
    const uptime = srv.uptime ? Math.floor(srv.uptime / 3600) + 'h ' + Math.floor((srv.uptime % 3600) / 60) + 'm' : '—';
    const mem = srv.memory || {};

    const collGrid = db.collections
      ? Object.entries(db.collections).map(([name, count]) =>
          `<span><b>${escHtml(name)}</b><small>${count}</small></span>`
        ).join('')
      : '';

    container.innerHTML = `
      <div class="sys-banner ${overallHealthy ? 'healthy' : 'degraded'}" style="grid-column:1/-1">
        <i class="fa-solid ${overallHealthy ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i>
        <div>
          <strong>System ${overallHealthy ? 'Healthy' : 'Degraded'}</strong>
          <span>${data.timestamp ? (window.TravelBuddyDate ? window.TravelBuddyDate.formatDateTime(data.timestamp) : new Date(data.timestamp).toLocaleString('en-IN')) : ''}</span>
        </div>
      </div>
      <div class="sys-card">
        <div class="sys-card-header ${dbOk ? 'ok' : 'err'}">
          <i class="fa-solid fa-database"></i>
          <div><strong>Database</strong><span>MongoDB</span></div>
          <span class="status-tag ${dbOk ? 'active' : 'danger'}">${dbOk ? 'Connected' : db.status || 'Unknown'}</span>
        </div>
        <div class="sys-card-body">
          <div><span>Latency</span><b>${db.latency != null ? db.latency + 'ms' : '—'}</b></div>
          <div><span>Collections</span><b>${Object.keys(db.collections || {}).length}</b></div>
          ${db.error ? `<div><span>Error</span><b class="error-text">${escHtml(db.error)}</b></div>` : ''}
        </div>
        ${collGrid ? `<div class="sys-card-footer"><div class="coll-grid">${collGrid}</div></div>` : ''}
      </div>
      <div class="sys-card">
        <div class="sys-card-header ok">
          <i class="fa-solid fa-server"></i>
          <div><strong>Server</strong><span>Node.js ${srv.nodeVersion || '—'}</span></div>
          <span class="status-tag active">Running</span>
        </div>
        <div class="sys-card-body">
          <div><span>Uptime</span><b>${uptime}</b></div>
          <div><span>Platform</span><b>${srv.platform || '—'}</b></div>
          <div><span>Hostname</span><b>${srv.hostname || '—'}</b></div>
          <div><span>CPU Cores</span><b>${srv.cpus || '—'}</b></div>
          ${srv.loadAvg ? `<div><span>Load Avg</span><b>${srv.loadAvg.map(l => l.toFixed(2)).join(', ')}</b></div>` : ''}
        </div>
        <div class="sys-card-footer mem-bar">
          <div class="mem-item"><span>RSS</span><strong>${mem.rss || '—'}</strong></div>
          <div class="mem-item"><span>Heap Total</span><strong>${mem.heapTotal || '—'}</strong></div>
          <div class="mem-item"><span>Heap Used</span><strong>${mem.heapUsed || '—'}</strong></div>
        </div>
      </div>
    `;
  } catch (err) {
    console.warn('System health check failed:', err);
    container.innerHTML = `
      <div class="error" style="grid-column:1/-1;text-align:center;padding:40px;color:#f04438">
        <i class="fa-solid fa-cloud-exclamation"></i> Failed to check system health.
        <button class="retry-inline">Retry</button>
      </div>
    `;
    const retry = container.querySelector('.retry-inline');
    if (retry) retry.addEventListener('click', () => loadSystem());
  }
}

function escHtml(s) { if (!s) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

try { initSystem(); } catch (e) { console.warn('system init failed', e); }
