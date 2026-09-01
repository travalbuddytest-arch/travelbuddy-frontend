(function () {
  'use strict';

  const { API_ORIGIN, authHeaders, escapeHTML } = window.TravelBuddy;

  // Elements
  const currentDeviceIcon = document.getElementById('currentDeviceIcon');
  const currentDeviceName = document.getElementById('currentDeviceName');
  const currentDeviceDetails = document.getElementById('currentDeviceDetails');

  const devicesLoading = document.getElementById('devicesLoading');
  const devicesEmpty = document.getElementById('devicesEmpty');
  const devicesTableWrap = document.getElementById('devicesTableWrap');
  const devicesTableBody = document.getElementById('devicesTableBody');
  const logoutOthersBtn = document.getElementById('logoutOthersBtn');

  let allSessions = [];

  function getDeviceIcon(deviceType, os) {
    const d = (deviceType || '').toLowerCase();
    const o = (os || '').toLowerCase();
    if (d === 'mobile' || o.includes('android') || o.includes('ios')) {
      return '<i class="fa-solid fa-mobile-screen-button"></i>';
    }
    if (d === 'tablet' || o.includes('ipad')) {
      return '<i class="fa-solid fa-tablet-screen-button"></i>';
    }
    return '<i class="fa-solid fa-laptop"></i>';
  }

  async function loadDevices() {
    if (devicesLoading) devicesLoading.classList.remove('hidden');
    if (devicesEmpty) devicesEmpty.classList.add('hidden');
    if (devicesTableWrap) devicesTableWrap.classList.add('hidden');

    try {
      const res = await fetch(`${API_ORIGIN}/api/settings/devices`, { headers: authHeaders() });
      const data = await res.json();

      if (!res.ok) {
        window.showToast(data.error || 'Failed to load logged devices.', 'error');
        return;
      }

      allSessions = data.sessions || [];
      const current = allSessions.find(s => s.isCurrent) || allSessions[0];
      const others = allSessions.filter(s => s !== current && !s.isCurrent);

      // Render Current Device
      if (current) {
        currentDeviceName.textContent = `${current.browser || 'Web Browser'} on ${current.os || 'Desktop'}`;
        currentDeviceIcon.innerHTML = getDeviceIcon(current.deviceType, current.os);
        const loc = current.location || 'Location unavailable';
        const ip = current.ipAddress || 'IP private';
        currentDeviceDetails.textContent = `${loc} · IP: ${ip} · Active right now`;
      }

      // Render Other Devices
      if (!others.length) {
        if (devicesEmpty) devicesEmpty.classList.remove('hidden');
        if (logoutOthersBtn) logoutOthersBtn.style.display = 'none';
        return;
      }

      if (logoutOthersBtn) logoutOthersBtn.style.display = 'inline-flex';
      if (devicesTableWrap) devicesTableWrap.classList.remove('hidden');
      renderOtherDevices(others);
    } catch (err) {
      console.error(err);
      window.showToast('Could not reach server to load devices.', 'error');
    } finally {
      if (devicesLoading) devicesLoading.classList.add('hidden');
    }
  }

  function renderOtherDevices(sessions) {
    if (!devicesTableBody) return;

    devicesTableBody.innerHTML = sessions.map(s => {
      const dateStr = window.TravelBuddyDate
        ? window.TravelBuddyDate.formatDateTime(s.lastUsedAt || s.createdAt)
        : new Date(s.lastUsedAt || s.createdAt).toLocaleString('en-IN');

      const icon = getDeviceIcon(s.deviceType, s.os);
      const name = s.deviceName || s.browser || 'Web Browser';
      const osText = `${s.os || 'Unknown OS'} ${s.osVersion || ''}`.trim();
      const ipLoc = `${s.location || 'Unknown location'} (${s.ipAddress || 'IP hidden'})`;

      return `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="font-size:16px; color:var(--text-muted);">${icon}</span>
              <strong style="font-size:13.5px; color:var(--text-main);">${escapeHTML(name)}</strong>
            </div>
          </td>
          <td style="font-size:13px;">${escapeHTML(osText)}</td>
          <td style="font-size:12.5px; color:var(--text-muted);">${escapeHTML(ipLoc)}</td>
          <td style="font-size:12.5px; color:var(--text-muted);">${escapeHTML(dateStr)}</td>
          <td>
            <button type="button" class="btn-ghost revoke-session-btn" data-id="${escapeHTML(s._id)}" style="color:var(--error); padding:4px 10px; font-size:12px; height:auto;">
              <i class="fa-solid fa-arrow-right-from-bracket"></i> Revoke
            </button>
          </td>
        </tr>
      `;
    }).join('');

    devicesTableBody.querySelectorAll('.revoke-session-btn').forEach(btn => {
      btn.addEventListener('click', () => revokeSession(btn.dataset.id));
    });
  }

  async function revokeSession(id) {
    if (!confirm('Log out this device session?')) return;

    try {
      const res = await fetch(`${API_ORIGIN}/api/settings/devices/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      const data = await res.json();

      if (!res.ok) {
        window.showToast(data.error || 'Failed to revoke device.', 'error');
        return;
      }

      window.showToast('Device logged out successfully.', 'success');
      loadDevices();
    } catch (err) {
      console.error(err);
      window.showToast('Network error revoking session.', 'error');
    }
  }

  // Log Out All Other Devices
  if (logoutOthersBtn) {
    logoutOthersBtn.addEventListener('click', async () => {
      const others = allSessions.filter(s => !s.isCurrent);
      if (!others.length) return;

      if (!confirm(`Are you sure you want to log out ${others.length} other active session(s)?`)) return;

      let successCount = 0;
      for (const s of others) {
        try {
          const res = await fetch(`${API_ORIGIN}/api/settings/devices/${encodeURIComponent(s._id)}`, {
            method: 'DELETE',
            headers: authHeaders()
          });
          if (res.ok) successCount++;
        } catch (e) {
          console.error(e);
        }
      }

      window.showToast(`Logged out ${successCount} session(s).`, 'success');
      loadDevices();
    });
  }

  loadDevices();
})();
