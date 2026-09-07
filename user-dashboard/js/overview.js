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

  const CACHE_KEY = 'tb_dashboard_data';

  async function loadDashboard() {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const data = JSON.parse(cached);
        applyDashboardData(data, true);
      } catch (e) { localStorage.removeItem(CACHE_KEY); }
    } else {
      // No cache: Show skeletons for initial load
      if (window.TravelBuddySkeleton) {
        window.TravelBuddySkeleton.show('#activityList', 'list-item', 5);
        window.TravelBuddySkeleton.show('#recentMessages', 'list-item', 3);
        // Stats are already showing 0, we can shimmer them
        document.querySelectorAll('.stat-card').forEach(card => card.classList.add('is-loading'));
      }
    }

    // 2. Fetch fresh data
    try {
      const res = await fetch(`${API_ORIGIN}/api/postparcel/dashboard-aggregator`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
        applyDashboardData(data, false);
      } else {
        console.error('Aggregator error:', data.error);
        if (!cached) showOverviewError(data.error || 'Failed to load dashboard data.');
      }
    } catch (err) {
      console.error('Aggregator fetch failed:', err);
      if (!cached) showOverviewError('Could not reach the server.');
    } finally {
      document.querySelectorAll('.stat-card').forEach(card => card.classList.remove('is-loading'));
    }
  }

  function showOverviewError(msg) {
    window.showToast(msg, 'error');
    document.querySelectorAll('.stat-value').forEach(el => {
       if (el.textContent === '0' || el.textContent === 'Rs. 0') el.textContent = '---';
    });
  }

  function applyDashboardData(data, isCached) {
    if (!data) return;

    // Apply User data
    if (data.user) {
      saveStoredUser(data.user);
      personalizeUser();
    }

    // Apply Unread counts
    if (data.unread) {
      setNotifBadge(data.unread.notifications || 0);
      const msgBadge = document.getElementById('navMsgBadge');
      if (msgBadge) {
        msgBadge.textContent = data.unread.messages || 0;
        msgBadge.style.display = data.unread.messages ? '' : 'none';
      }
    }

    // Apply Stats with animation
    if (data.stats) {
      if (isCached) {
        document.getElementById('statActiveParcels').textContent = (data.stats.activeParcels || 0).toLocaleString();
        document.getElementById('statCompletedDeliveries').textContent = (data.stats.completedDeliveries || 0).toLocaleString();
        document.getElementById('statTripsPosted').textContent = (data.stats.tripsPosted || 0).toLocaleString();
        document.getElementById('statTotalEarnings').textContent = window.TravelBuddy.formatPaise(data.stats.totalEarnings || 0);
      } else {
        animateCount(document.getElementById('statActiveParcels'), data.stats.activeParcels || 0, false);
        animateCount(document.getElementById('statCompletedDeliveries'), data.stats.completedDeliveries || 0, false);
        animateCount(document.getElementById('statTripsPosted'), data.stats.tripsPosted || 0, false);
        animateCount(document.getElementById('statTotalEarnings'), data.stats.totalEarnings || 0, true, '₹');
      }

      const earningsEl = document.getElementById('walletEarningsValue');
      if (earningsEl) earningsEl.textContent = window.TravelBuddy.formatPaise(data.stats.totalEarnings || 0);
    }

    // Apply Activity
    if (data.activity) {
      activity = data.activity;
      renderActivity();
    }

    // Apply Recent Messages
    if (data.recentMessages) {
       renderRecentMessages(data.recentMessages);
    }

    // Apply Wallet
    const heroValue = document.getElementById('heroWalletValue');
    const balanceValue = document.getElementById('walletBalanceValue');
    const lockedValue = document.getElementById('walletLockedValue');
    const isPrivate = window.TravelBuddy.isPrivacyMode();

    if (data.user) {
      const balanceText = isPrivate ? '••••' : window.TravelBuddy.formatPaise(data.user.walletBalance || 0);
      const lockedText = isPrivate ? '••••' : window.TravelBuddy.formatPaise(data.user.lockedBalance || 0);
      if (heroValue) heroValue.textContent = balanceText;
      if (balanceValue) balanceValue.textContent = balanceText;
      if (lockedValue) lockedValue.textContent = lockedText;
    }
  }

  function saveStoredUser(user) {
    localStorage.setItem('travelBuddyUser', JSON.stringify(user || {}));
  }

  function personalizeUser() {
     if (window.personalizeUser) window.personalizeUser();
  }

  function setNotifBadge(count) {
     if (window.TravelBuddy.setNotifBadge) window.TravelBuddy.setNotifBadge(count);
  }

  function renderRecentMessages(conversations) {
    const container = document.getElementById('recentMessages');
    if (!container) return;

    if (!conversations.length) {
      container.innerHTML = `<p class="empty-state"><i class="fa-solid fa-comments-slash"></i>No messages yet.</p>`;
      return;
    }

    container.innerHTML = conversations.map((c) => `
      <a href="messages.html?conversation=${encodeURIComponent(c.id)}" class="msg-thread-item">
        <div class="avatar avatar--sm">${escapeHTML(initials(c.other.label))}</div>
        <div class="msg-thread-info">
          <div class="msg-thread-name">
            <strong>${escapeHTML(c.other.label)}</strong>
            <span class="msg-thread-date">${escapeHTML(formatTime(c.lastMessageAt))}</span>
          </div>
          <span class="msg-thread-snippet">${escapeHTML(c.lastMessage || 'Start a conversation')}</span>
        </div>
        ${c.unreadCount ? `<span class="msg-unread-dot"></span>` : ''}
      </a>
    `).join('');
  }

  function renderActivity() {
    const list = document.getElementById('activityList');
    if (!list) return;

    if (!activity.length) {
      list.innerHTML = `<p class="empty-state"><i class="fa-solid fa-bell-slash"></i>No recent activity yet.</p>`;
      return;
    }

    const isPrivate = window.TravelBuddy.isPrivacyMode();

    list.innerHTML = activity.slice(0, ACTIVITY_LIMIT).map((item, i) => {
      let metaHtml = '';
      if (item.amount) {
        const directionClass = item.direction === 'debit' || item.type.includes('WITHDRAWAL') ? 'debit' : 'credit';
        const prefix = item.direction === 'debit' ? '-' : '+';
        const displayAmount = isPrivate ? '••••' : window.TravelBuddy.formatPaise(item.amount);
        metaHtml = `<span class="activity-amount ${directionClass}">${prefix}${displayAmount}</span>`;
      }

      return `
      <a href="${item.link || '#'}" class="activity-item" style="animation-delay:${i * 0.06}s; text-decoration:none;">
        <div class="activity-icon" style="background:#EFF6FF; color:var(--primary)"><i class="fa-solid ${item.icon || 'fa-bell'}"></i></div>
        <div style="flex:1">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span class="activity-text"><strong>${escapeHTML(item.title)}</strong></span>
            ${metaHtml}
          </div>
          <span class="activity-subtext" style="font-size:12px; color:var(--text-muted); display:block;">${escapeHTML(item.description)}</span>
          <span class="activity-time">${escapeHTML(timeAgo(item.timestamp))}</span>
        </div>
      </a>
    `;
    }).join('');
  }

  async function loadActivity() {
    const list = document.getElementById('activityList');
    if (!list) return;
    try {
      const res = await fetch(`${API_ORIGIN}/api/activity/history?limit=${ACTIVITY_LIMIT}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) return;
      activity = data.items || [];
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

  document.addEventListener('travelbuddy:parcel-status', (e) => {
    console.log('[Overview] Parcel status update received, refreshing dashboard...');
    loadDashboard();
  });

  function animateCount(el, target, isCurrency, prefix) {
    if (!el) return;
    const duration = 900;
    const start = performance.now();
    const safeTarget = Number(target) || 0;
    const labelPrefix = prefix || '';

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const isPrivate = window.TravelBuddy.isPrivacyMode();

      if (isCurrency) {
        if (isPrivate) {
          el.textContent = '••••';
          return;
        }
        const value = (safeTarget * eased) / 100;
        el.textContent = labelPrefix + value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      } else {
        const value = Math.round(safeTarget * eased);
        el.textContent = labelPrefix + value.toLocaleString('en-IN');
      }
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

      animateCount(document.getElementById('statActiveParcels'), data.activeParcels, false);
      animateCount(document.getElementById('statCompletedDeliveries'), data.completedDeliveries, false);
      animateCount(document.getElementById('statTripsPosted'), data.tripsPosted, false);
      animateCount(document.getElementById('statTotalEarnings'), data.totalEarnings, true, '₹');

      const earningsEl = document.getElementById('walletEarningsValue');
      if (earningsEl) earningsEl.textContent = window.TravelBuddy.formatPaise(data.totalEarnings || 0);
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
    const lockedValue = document.getElementById('walletLockedValue');
    const earningsValue = document.getElementById('walletEarningsValue');
    const isPrivate = window.TravelBuddy.isPrivacyMode();

    try {
      const res = await fetch(`${API_ORIGIN}/api/payments/wallet-summary`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (heroValue) heroValue.textContent = isPrivate ? '••••' : window.TravelBuddy.formatPaise(data.walletBalance || 0);
        if (balanceValue) balanceValue.textContent = isPrivate ? '••••' : window.TravelBuddy.formatPaise(data.walletBalance || 0);
        if (lockedValue) lockedValue.textContent = isPrivate ? '••••' : window.TravelBuddy.formatPaise(data.lockedBalance || 0);
        if (earningsValue) earningsValue.textContent = isPrivate ? '••••' : window.TravelBuddy.formatPaise(data.totalEarnings || 0);
        return;
      }
    } catch (e) {
      console.warn('wallet-summary fetch failed, falling back to profile', e);
    }

    try {
      const user = await window.TravelBuddy.getCurrentUser();
      if (!user) return;
      const balance = isPrivate ? '••••' : window.TravelBuddy.formatPaise(user.walletBalance || 0);
      const locked = isPrivate ? '••••' : window.TravelBuddy.formatPaise(user.lockedBalance || 0);
      if (heroValue) heroValue.textContent = balance;
      if (balanceValue) balanceValue.textContent = balance;
      if (lockedValue) lockedValue.textContent = locked;
    } catch (err) {
      console.error('load wallet failed:', err);
    }
  }

  document.addEventListener('travelbuddy:privacy-toggled', () => {
    loadWallet();
    loadStats();
    renderActivity();
  });

  function formatTime(iso) {
    if (window.TravelBuddyDate) return window.TravelBuddyDate.formatDateTime(iso);
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  function initials(name) {
    return (name || 'User').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  }

  function timeAgo(iso) {
    if (!iso) return '';
    const seconds = Math.floor((new Date() - new Date(iso)) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
  }

  async function loadRecentMessages() {
    const container = document.getElementById('recentMessages');
    if (!container) return;

    try {
      const res = await fetch(`${API_ORIGIN}/api/messages/conversations?limit=3`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) return;

      const conversations = data.conversations || [];
      if (!conversations.length) {
        container.innerHTML = `<p class="empty-state"><i class="fa-solid fa-comments-slash"></i>No messages yet.</p>`;
        return;
      }

      container.innerHTML = conversations.slice(0, 3).map((c) => `
        <a href="messages.html?conversation=${encodeURIComponent(c.id)}" class="msg-thread-item">
          <div class="avatar avatar--sm">${escapeHTML(initials(c.other.label))}</div>
          <div class="msg-thread-info">
            <div class="msg-thread-name">
              <strong>${escapeHTML(c.other.label)}</strong>
              <span class="msg-thread-date">${escapeHTML(formatTime(c.lastMessageAt))}</span>
            </div>
            <span class="msg-thread-snippet">${escapeHTML(c.lastMessage || 'Start a conversation')}</span>
          </div>
          ${c.unreadCount ? `<span class="msg-unread-dot"></span>` : ''}
        </a>
      `).join('');
    } catch (err) {
      console.error('load recent messages failed:', err);
    }
  }

  document.addEventListener('travelbuddy:privacy-toggled', () => {
    loadDashboard();
  });

  loadDashboard();


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
