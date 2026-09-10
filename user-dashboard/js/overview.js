(function () {
  'use strict';

  const { API_ORIGIN, authHeaders } = window.TravelBuddy;
  const API_BASE = `${API_ORIGIN}/api/postparcel`;
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
        // Stats are already showing 0, we can shimmer them
        document.querySelectorAll('.tb-metric-card').forEach(card => card.classList.add('is-loading'));
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
      document.querySelectorAll('.tb-metric-card').forEach(card => card.classList.remove('is-loading'));
    }
  }

  function showOverviewError(msg) {
    window.showToast(msg, 'error');
    document.querySelectorAll('.tb-metric-value').forEach(el => {
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

  // Real-time updates
  document.addEventListener('travelbuddy:notification', (e) => {
    if (!e.detail) return;
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
