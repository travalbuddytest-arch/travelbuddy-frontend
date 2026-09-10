/**
 * TravelBuddy — System Configuration Overview
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

export default function initSystemSettings() {
  loadSystemData();
}

async function loadSystemData() {
  try {
    const data = await apiGet('/api/admin/system');
    const { server } = data;

    if (server) {
      document.getElementById('sysEnv').textContent = server.platform || 'Production';
      document.getElementById('sysNode').textContent = server.nodeVersion;
      document.getElementById('sysUptime').textContent = formatUptime(server.uptime);
    }
  } catch (err) {
    console.warn('System data failed to load:', err);
  }
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

window.initSystemSettings = initSystemSettings;
try { initSystemSettings(); } catch (e) { console.warn('system-settings init failed', e); }
