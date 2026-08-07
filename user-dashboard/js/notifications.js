(function () {
  'use strict';

  const { API_ORIGIN, authHeaders, escapeHTML, setNotifBadge, getNotificationRoute } = window.TravelBuddy;
  const API_BASE = `${API_ORIGIN}/api/notifications`;

  // Every stored notification only carries a `type` + plain text from the
  // server. This maps each type to the icon/color the UI already used.
  const TYPE_META = {
    parcel_posted: { icon: 'fa-route', color: '#0D6EFD' },
    parcel_accepted: { icon: 'fa-box', color: '#0D6EFD' },
    parcel_status: { icon: 'fa-truck-fast', color: '#F5A524' },
    message: { icon: 'fa-message', color: '#7C5CFC' },
    wallet_added: { icon: 'fa-indian-rupee-sign', color: '#17A673' },
    reward_added: { icon: 'fa-gift', color: '#17A673' },
  };
  const DEFAULT_META = { icon: 'fa-bell', color: '#0D6EFD' };

  const notifList = document.getElementById('notifList');
  const notifTabs = document.getElementById('notifTabs');
  const markAllReadBtn = document.getElementById('markAllReadBtn');
  let notifFilter = 'all';
  let notifications = [];

  function timeAgo(iso) {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const diffMs = Date.now() - then;
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  function updateNotifBadge() {
    const unreadCount = notifications.filter((n) => !n.read).length;
    setNotifBadge(unreadCount);
  }

  function renderNotifications() {
    if (!notifList) return;

    const items = notifications.filter((n) => notifFilter === 'all' || !n.read);
    if (!items.length) {
      notifList.innerHTML = `<p class="empty-state"><i class="fa-solid fa-bell-slash"></i>You're all caught up!</p>`;
      return;
    }

    notifList.innerHTML = items.map((n, i) => {
      const meta = TYPE_META[n.type] || DEFAULT_META;
      return `
      <li class="notif-item ${n.read ? '' : 'unread'}" data-id="${escapeHTML(n.id)}" style="animation-delay:${i * 0.05}s">
        <div class="notif-icon" style="background:${escapeHTML(meta.color)}"><i class="fa-solid ${escapeHTML(meta.icon)}"></i></div>
        <div>
          <span class="notif-text">${escapeHTML(n.text)}</span>
          <span class="notif-time">${escapeHTML(timeAgo(n.createdAt))}</span>
        </div>
      </li>
    `;
    }).join('');

    notifList.querySelectorAll('.notif-item').forEach((el) => {
      el.addEventListener('click', async () => {
        const n = notifications.find((x) => x.id === el.dataset.id);
        if (!n) return;
        if (!n.read) {
          n.read = true;
          updateNotifBadge();
          renderNotifications();
          try {
            await fetch(`${API_BASE}/${n.id}/read`, { method: 'PATCH', headers: authHeaders() });
          } catch (err) {
            console.error('mark notification read failed:', err);
          }
        }
        const route = getNotificationRoute?.(n);
        // Already on notifications.html, so only navigate away when the
        // notification actually points somewhere else.
        if (route && route !== 'notifications.html') {
          window.location.href = route;
        }
      });
    });
  }

  async function loadNotifications() {
    if (!notifList) return;
    try {
      const res = await fetch(API_BASE, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) {
        window.showToast(data.error || 'Could not load notifications.', 'error');
        return;
      }
      notifications = data.notifications || [];
      renderNotifications();
      updateNotifBadge();
    } catch (err) {
      console.error('load notifications failed:', err);
      window.showToast('Could not reach the server.', 'error');
    }
  }

  if (notifTabs) {
    notifTabs.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        notifTabs.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        notifFilter = btn.dataset.filter;
        renderNotifications();
      });
    });
  }

  if (markAllReadBtn) {
    markAllReadBtn.addEventListener('click', async () => {
      notifications.forEach((n) => (n.read = true));
      updateNotifBadge();
      renderNotifications();
      try {
        await fetch(`${API_BASE}/mark-all-read`, { method: 'PATCH', headers: authHeaders() });
        window.showToast('All notifications marked as read.', 'success');
      } catch (err) {
        console.error('mark-all-read failed:', err);
        window.showToast('Could not reach the server.', 'error');
      }
    });
  }

  // Real-time: common.js's shared socket fires this the instant a new
  // notification arrives, so it appears without a page refresh.
  document.addEventListener('travelbuddy:notification', (e) => {
    if (!e.detail) return;
    notifications.unshift(e.detail);
    renderNotifications();
    updateNotifBadge();
  });

  loadNotifications();
})();
