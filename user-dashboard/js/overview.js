(function () {
  'use strict';

  const { API_ORIGIN, authHeaders, escapeHTML } = window.TravelBuddy;
  const API_BASE = `${API_ORIGIN}/api/postparcel`;
  const NOTIF_BASE = `${API_ORIGIN}/api/notifications`;
  const ACTIVITY_LIMIT = 6;

  // Same type -> icon/label mapping used on the Notifications page, so
  // "Recent Activity" here is just a live, capped view of real notifications
  // instead of the old hardcoded dummy list.
  const TYPE_META = {
    parcel_posted: { icon: 'fa-box', color: '#0D6EFD', label: 'Parcel posted' },
    parcel_accepted: { icon: 'fa-handshake', color: '#17A673', label: 'Parcel accepted' },
    parcel_status: { icon: 'fa-truck-fast', color: '#F5A524', label: 'Delivery update' },
    message: { icon: 'fa-message', color: '#7C5CFC', label: 'New message' },
    wallet_added: { icon: 'fa-indian-rupee-sign', color: '#17A673', label: 'Wallet updated' },
    reward_added: { icon: 'fa-gift', color: '#17A673', label: 'Reward added' },
  };
  const DEFAULT_META = { icon: 'fa-bell', color: '#0D6EFD', label: 'Update' };

  let activity = [];

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

  function renderActivity() {
    const list = document.getElementById('activityList');
    if (!list) return;

    if (!activity.length) {
      list.innerHTML = `<p class="empty-state"><i class="fa-solid fa-bell-slash"></i>No recent activity yet.</p>`;
      return;
    }

    list.innerHTML = activity.slice(0, ACTIVITY_LIMIT).map((item, i) => {
      const meta = TYPE_META[item.type] || DEFAULT_META;
      return `
      <li class="activity-item" style="animation-delay:${i * 0.06}s">
        <div class="activity-icon" style="background:${meta.color}"><i class="fa-solid ${meta.icon}"></i></div>
        <div>
          <span class="activity-text"><strong>${escapeHTML(meta.label)}</strong> - ${escapeHTML(item.text)}</span>
          <span class="activity-time">${escapeHTML(timeAgo(item.createdAt))}</span>
        </div>
      </li>
    `;
    }).join('');
  }

  async function loadActivity() {
    const list = document.getElementById('activityList');
    if (!list) return;
    try {
      const res = await fetch(`${NOTIF_BASE}?limit=${ACTIVITY_LIMIT}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) return;
      activity = data.notifications || [];
      renderActivity();
    } catch (err) {
      console.error('load activity failed:', err);
    }
  }

  // Real-time: common.js's shared socket dispatches this the instant a new
  // notification arrives, so a fresh action shows up here without a refresh.
  document.addEventListener('travelbuddy:notification', (e) => {
    if (!e.detail) return;
    activity.unshift(e.detail);
    renderActivity();
    if (e.detail.type === 'wallet_added' || e.detail.type === 'reward_added') {
      loadWallet();
      loadStats();
    }
  });

  function animateCount(el, target, prefix) {
    if (!el) return;
    const duration = 900;
    const start = performance.now();
    const safeTarget = Number(target) || 0;
    const labelPrefix = prefix || '';

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(safeTarget * eased);
      el.textContent = labelPrefix + value.toLocaleString('en-IN');
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  async function loadStats() {
    document.querySelectorAll('.stat-card').forEach((card) => card.classList.add('is-loading'));

    try {
      const res = await fetch(`${API_BASE}/stats`, { headers: authHeaders() });
      const data = await res.json();

      if (!res.ok) {
        window.showToast(data.error || 'Could not load your stats.', 'error');
        return;
      }

      animateCount(document.getElementById('statActiveParcels'), data.activeParcels);
      animateCount(document.getElementById('statCompletedDeliveries'), data.completedDeliveries);
      animateCount(document.getElementById('statTripsPosted'), data.tripsPosted);
      animateCount(document.getElementById('statTotalEarnings'), data.totalEarnings, 'Rs. ');

      const earningsEl = document.getElementById('walletEarningsValue');
      if (earningsEl) earningsEl.textContent = `Rs. ${Number(data.totalEarnings || 0).toLocaleString('en-IN')}`;
    } catch (err) {
      console.error(err);
      window.showToast('Could not reach the server.', 'error');
    } finally {
      document.querySelectorAll('.stat-card').forEach((card) => card.classList.remove('is-loading'));
    }
  }

  async function loadWallet() {
    const heroValue = document.getElementById('heroWalletValue');
    const balanceValue = document.getElementById('walletBalanceValue');
    if (!heroValue && !balanceValue) return;

    try {
      const user = await window.TravelBuddy.getCurrentUser();
      if (!user) return;
      const balance = `Rs. ${Number(user.walletBalance || 0).toLocaleString('en-IN')}`;
      if (heroValue) heroValue.textContent = balance;
      if (balanceValue) balanceValue.textContent = balance;
    } catch (err) {
      console.error('load wallet failed:', err);
    }
  }

  loadActivity();
  loadStats();
  loadWallet();


  const orderSearch = document.getElementById('globalSearch');
  if (orderSearch) {
    orderSearch.placeholder = 'Enter Order ID, e.g. TB-20260709-A7K2P';
    orderSearch.closest('.search-wrap')?.classList.add('is-order-search');
    const goTrack = () => {
      const value = orderSearch.value.trim().toUpperCase();
      if (!value) return window.showToast('Enter your Order ID.', 'error');
      if (!/^TB-\d{8}-[A-Z0-9]{5}$/.test(value)) return window.showToast('Enter a valid Order ID.', 'error');
      window.location.href = `track.html?orderId=${encodeURIComponent(value)}`;
    };
    orderSearch.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); goTrack(); } });
    orderSearch.closest('.search-wrap')?.addEventListener('click', (e) => { if (e.target.tagName === 'I') goTrack(); });
  }

})();
