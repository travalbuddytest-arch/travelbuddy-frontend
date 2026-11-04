/**
 * TravelBuddy — System Configuration Overview & Administration
 */

const API_ORIGIN = APP_CONFIG.API_BASE_URL;

async function apiGet(url) {
  const headers = { 'X-CP-Admin-Request': 'true' };
  const res = await fetch(`${API_ORIGIN}${url}`, { headers, credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, data };
  return data;
}

async function apiPut(url, body) {
  const headers = {
    'Content-Type': 'application/json',
    'X-CP-Admin-Request': 'true'
  };
  const res = await fetch(`${API_ORIGIN}${url}`, { method: 'PUT', headers, credentials: 'include', body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, data };
  return data;
}

export default function initSystemSettings() {
  loadSystemData();
  loadSettings();
  bindForm();
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

async function loadSettings() {
  try {
    const data = await apiGet('/api/admin/settings');
    const s = data.settings || {};

    const maintEl = document.getElementById('settingMaintenanceMode');
    const signupsEl = document.getElementById('settingAllowSignups');
    const freePostEl = document.getElementById('settingFreePostLimit');
    const commEl = document.getElementById('settingCommissionPercent');

    if (maintEl) maintEl.checked = Boolean(s.maintenanceMode);
    if (signupsEl) signupsEl.checked = Boolean(s.allowNewSignups);
    if (freePostEl) freePostEl.value = s.freePostLimit ?? 2;
    if (commEl) commEl.value = s.platformCommissionPercent ?? 10;
  } catch (err) {
    console.warn('Settings failed to load:', err);
  }
}

function bindForm() {
  const form = document.getElementById('systemSettingsForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('saveSettingsBtn');
    if (btn) btn.disabled = true;

    const body = {
      maintenanceMode: document.getElementById('settingMaintenanceMode')?.checked ?? false,
      allowNewSignups: document.getElementById('settingAllowSignups')?.checked ?? true,
      freePostLimit: parseInt(document.getElementById('settingFreePostLimit')?.value, 10) || 2,
      platformCommissionPercent: parseInt(document.getElementById('settingCommissionPercent')?.value, 10) || 10,
    };

    try {
      const data = await apiPut('/api/admin/settings', body);
      if (window.showToast) window.showToast('System configuration saved successfully.', 'success');
    } catch (err) {
      const msg = err.data?.error || 'Could not save system settings.';
      if (window.showToast) window.showToast(msg, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

window.initSystemSettings = initSystemSettings;
try { initSystemSettings(); } catch (e) { console.warn('system-settings init failed', e); }
