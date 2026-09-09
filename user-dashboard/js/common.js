(function () {
  'use strict';

  async function injectDashboardComponents() {
    const sidebarPlaceholder = document.getElementById('tbAppSidebarInclude');
    const topbarPlaceholder = document.getElementById('tbAppTopbarInclude');
    const v = '3'; // Cache bust version

    const cachedSidebar = sessionStorage.getItem('tb_sidebar_html');
    const cachedTopbar = sessionStorage.getItem('tb_topbar_html');

    if (sidebarPlaceholder) {
      if (cachedSidebar) {
        sidebarPlaceholder.outerHTML = cachedSidebar;
        initSidebarEvents();
      }
      try {
        const res = await fetch(`/shared/app-sidebar.html?v=${v}`);
        if (res.ok) {
          const html = await res.text();
          if (html !== cachedSidebar) {
            sessionStorage.setItem('tb_sidebar_html', html);
            if (!cachedSidebar) {
              sidebarPlaceholder.outerHTML = html;
              initSidebarEvents();
            }
          }
        }
      } catch (e) { console.error('Sidebar injection failed', e); }
    }

    if (topbarPlaceholder) {
      if (cachedTopbar) {
        topbarPlaceholder.outerHTML = cachedTopbar;
        initTopbarEvents();
      }
      try {
        const res = await fetch(`/shared/app-topbar.html?v=${v}`);
        if (res.ok) {
          const html = await res.text();
          if (html !== cachedTopbar) {
            sessionStorage.setItem('tb_topbar_html', html);
            if (!cachedTopbar) {
              topbarPlaceholder.outerHTML = html;
              initTopbarEvents();
            }
          }
        }
      } catch (e) { console.error('Topbar injection failed', e); }
    }
  }

  function initSidebarEvents() {
    highlightActiveNav();

    // Use Event Delegation on document.body for robust mobile menu handling.
    // This solves the race condition where HTML injection happens after listener binding.
    document.body.addEventListener('click', (e) => {
      const target = e.target;

      // Open Menu
      if (target.closest('#menuBtn')) {
        openSidebar();
      }

      // Close Menu (✕ button or Overlay)
      if (target.closest('#sidebarClose') || target.closest('#sidebarOverlay')) {
        closeSidebar();
      }

      // Close on Nav Link click (Mobile only)
      if (target.closest('.sidebar .nav-item[href]')) {
        if (window.matchMedia('(max-width: 991px)').matches) {
          closeSidebar();
        }
      }

      // Logout Button
      if (target.closest('#logoutBtn')) {
        logoutNow();
      }
    });

    initUserSidebarCollapse();
  }

  function initTopbarEvents() {
    const pageTitleEl = document.getElementById('pageTitle');
    if (pageTitleEl) {
      const titleText = document.title.replace('TravelBuddy - ', '').replace('TravelBuddy — ', '').trim();
      pageTitleEl.textContent = titleText;
    }

    personalizeUser();
    const userChip = document.getElementById('userChip');
    if (userChip) {
      userChip.setAttribute('role', 'button');
      userChip.setAttribute('tabindex', '0');
      userChip.setAttribute('aria-haspopup', 'menu');
      userChip.setAttribute('aria-expanded', 'false');
      const setUserMenuOpen = (open) => {
        userChip.classList.toggle('open', open);
        userChip.setAttribute('aria-expanded', open ? 'true' : 'false');
      };
      userChip.addEventListener('click', (e) => {
        e.stopPropagation();
        if (e.target.closest('.user-menu')) return;
        setUserMenuOpen(!userChip.classList.contains('open'));
      });
      userChip.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        setUserMenuOpen(!userChip.classList.contains('open'));
      });
      document.getElementById('userMenu')?.addEventListener('click', (e) => e.stopPropagation());
      document.addEventListener('click', closeUserMenu);
    }
    const globalSearch = document.getElementById('globalSearch');
    if (globalSearch) {
      globalSearch.addEventListener('click', () => { window.location.href = 'search.html'; });
      globalSearch.addEventListener('input', () => { window.location.href = `search.html?q=${encodeURIComponent(globalSearch.value)}`; });
    }
    document.getElementById('topbarLogoutLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      closeUserMenu();
      logoutNow();
    });
    document.querySelectorAll('.user-menu a, .user-menu button').forEach((link) => {
      const text = link.textContent.trim().toLowerCase();
      if (text.includes('my profile')) {
        link.addEventListener('click', (e) => { e.preventDefault(); closeUserMenu(); openProfileModal('profile'); });
      }
      if (text.includes('settings')) {
        link.addEventListener('click', (e) => { e.preventDefault(); closeUserMenu(); openProfileModal('settings'); });
      }
      if (text.includes('privacy mode') || text.includes('balances')) {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          setPrivacyMode(!isPrivacyMode());
        });
      }
    });

    const userMenu = document.getElementById('userMenu');
    if (userMenu && !userMenu.querySelector('.privacy-toggle-btn')) {
       const hr = userMenu.querySelector('hr');
       const toggleHtml = `
         <button type="button" class="user-menu-btn privacy-toggle-btn">
           <i class="fa-solid fa-eye"></i> <span class="btn-label">Hide Balances</span>
         </button>
       `;
       if (hr) hr.insertAdjacentHTML('beforebegin', toggleHtml);
       else userMenu.insertAdjacentHTML('beforeend', toggleHtml);

       const newBtn = userMenu.querySelector('.privacy-toggle-btn');
       newBtn?.addEventListener('click', (e) => {
          e.preventDefault();
          setPrivacyMode(!isPrivacyMode());
       });
    }
    updatePrivacyUI();
  }

  injectDashboardComponents();

  const toast = document.getElementById('toast');
  let toastTimer;
  // MUST be declared here (top of IIFE) — renderProfileAvatar() references
  // this variable and renderProfileAvatar is called inside personalizeUser()
  // which runs at line ~152, long before the old `let profilePhotoCacheBust`
  // declaration at line ~628 would have been reached. A `let` in the TDZ
  // (Temporal Dead Zone) throws ReferenceError, which was the root cause of
  // the "Cannot access 'profilePhotoCacheBust' before initialization" error.
  let profilePhotoCacheBust = null;
  const API_ORIGIN = APP_CONFIG.API_BASE_URL;

  function showToast(message, type) {
    if (!toast) return;
    clearTimeout(toastTimer);
    const icons = {
      success: 'fa-circle-check',
      error: 'fa-circle-exclamation',
      warning: 'fa-triangle-exclamation',
      info: 'fa-circle-info',
    };
    const icon = document.createElement('i');
    icon.className = `fa-solid ${icons[type] || icons.info}`;
    icon.setAttribute('aria-hidden', 'true');
    toast.replaceChildren(icon, document.createTextNode(String(message ?? '')));
    toast.className = 'toast show' + (type ? ' ' + type : '');
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
  }
  window.showToast = showToast;

  function escapeHTML(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function authHeaders() {
    const token = localStorage.getItem('travelBuddyToken');
    return token ? {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    } : {
      'Content-Type': 'application/json',
    };
  }

  function getAuthToken() {
    return localStorage.getItem('travelBuddyToken') || null;
  }

  function setButtonLoading(button, isLoading, loadingText) {
    if (!button) return;
    let label = button.querySelector('.btn-label');
    if (!label) {
      // Auto-wrap content in btn-label for consistency
      const content = button.innerHTML;
      button.innerHTML = `<span class="btn-label">${content}</span><span class="spinner" aria-hidden="true"></span>`;
      label = button.querySelector('.btn-label');
    }
    const spinner = button.querySelector('.spinner');

    if (isLoading) {
      if (!button.dataset.originalLabel) {
        button.dataset.originalLabel = label.innerHTML;
      }
      if (loadingText) label.innerHTML = loadingText;
      button.classList.add('btn-loading');
      button.disabled = true;
    } else {
      if (button.dataset.originalLabel) {
        label.innerHTML = button.dataset.originalLabel;
      }
      button.classList.remove('btn-loading');
      button.disabled = false;
    }
    button.setAttribute('aria-busy', String(isLoading));
  }

  /**
   * Global Form Lock System
   * Prevents double-submission and interaction while processing.
   */
  function FormLock(form, isLocked, options = {}) {
    if (!form) return;
    const {
      submitBtn = form.querySelector('button[type="submit"]'),
      loadingText = 'Processing...',
      lockInputs = true
    } = options;

    if (isLocked) {
      form.classList.add('form-locked');
      if (submitBtn) setButtonLoading(submitBtn, true, loadingText);
      if (lockInputs) {
        form.querySelectorAll('input, select, textarea, button:not([type="submit"])').forEach(el => {
          if (!el.hasAttribute('disabled')) {
            el.setAttribute('data-was-disabled', 'false');
            el.disabled = true;
          } else {
            el.setAttribute('data-was-disabled', 'true');
          }
        });
      }
    } else {
      form.classList.remove('form-locked');
      if (submitBtn) setButtonLoading(submitBtn, false);
      if (lockInputs) {
        form.querySelectorAll('input, select, textarea, button').forEach(el => {
          if (el.getAttribute('data-was-disabled') === 'false') {
            el.disabled = false;
          }
          el.removeAttribute('data-was-disabled');
        });
      }
    }
  }

  function formatDate(iso, options) {
    if (window.TravelBuddyDate) return window.TravelBuddyDate.formatDateTime(iso);
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return 'Date unavailable';
    return date.toLocaleDateString('en-IN', options || { day: 'numeric', month: 'short' });
  }

  function formatPaise(paise) {
    const p = Number(paise) || 0;
    return '₹' + (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function toPaise(rupees) {
    return Math.round(Number(rupees || 0) * 100);
  }

  function statusBadge(status) {
    const s = String(status || '').toLowerCase();
    const label = s.replace(/_/g, ' ');
    let tagClass = 'tag--pending';
    let icon = 'fa-clock';
    if (['accepted', 'pickup_point_selected'].includes(s)) {
      tagClass = 'tag--accepted'; icon = 'fa-check';
    } else if (['pickup_confirmed', 'in_transit', 'delivery_point_pending', 'delivery_point_selected', 'processing'].includes(s)) {
      tagClass = 'tag--in_transit'; icon = 'fa-truck-fast';
    } else if (['delivered', 'completed', 'paid', 'released', 'approved'].includes(s)) {
      tagClass = 'tag--delivered'; icon = 'fa-circle-check';
    } else if (s.includes('cancel') || ['failed', 'rejected'].includes(s)) {
      tagClass = 'tag--cancelled'; icon = 'fa-circle-xmark';
    } else if (['held', 'disputed'].includes(s)) {
      tagClass = 'tag--held'; icon = 'fa-shield-halved';
    }
    return `<span class="tag ${tagClass}"><i class="fa-solid ${icon}"></i> ${escapeHTML(label)}</span>`;
  }

  function highlightActiveNav() {
    const currentPath = window.location.pathname.split('/').pop() || 'overview.html';
    document.querySelectorAll('.sidebar .nav-item').forEach((item) => {
      const href = item.getAttribute('href') || '';
      const targetFile = href.split('/').pop().split('?')[0];
      const isActive = targetFile && currentPath.toLowerCase() === targetFile.toLowerCase();

      if (isActive) {
        item.classList.add('active');
        // Highlighting for the parent section heading
        item.closest('.nav-group')?.classList.add('has-active');
      } else if (targetFile && !item.hasAttribute('data-keep-active')) {
        item.classList.remove('active');
      }
    });
  }

  function isPrivacyMode() {
    return localStorage.getItem('tb_privacy_mode') === 'true';
  }

  function setPrivacyMode(enabled) {
    localStorage.setItem('tb_privacy_mode', String(enabled));
    document.dispatchEvent(new CustomEvent('travelbuddy:privacy-toggled', { detail: { enabled } }));
    showToast(`Privacy mode ${enabled ? 'enabled (balances hidden)' : 'disabled'}.`, 'info');
    updatePrivacyUI();
  }

  function updatePrivacyUI() {
    const isPrivate = isPrivacyMode();
    document.querySelectorAll('.privacy-toggle-btn').forEach(btn => {
      btn.classList.toggle('active', isPrivate);
      const icon = btn.querySelector('i');
      if (icon) {
        icon.className = isPrivate ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
      }
      const label = btn.querySelector('.btn-label');
      if (label) label.textContent = isPrivate ? 'Show Balances' : 'Hide Balances';
    });
  }

  function loadAsset(url, type) {
    if (type === 'css') {
      if (!document.querySelector(`link[href="${url}"]`)) {
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        document.head.appendChild(link);
      }
    } else {
      if (!document.querySelector(`script[src="${url}"]`)) {
        var script = document.createElement('script');
        script.src = url;
        script.defer = true;
        document.body.appendChild(script);
      }
    }
  }

  window.TravelBuddy = {
    API_ORIGIN,
    escapeHTML,
    authHeaders,
    getAuthToken,
    setButtonLoading,
    FormLock,
    formatDate,
    formatPaise,
    formatRupees: formatPaise,
    toPaise,
    statusBadge,
    highlightActiveNav,
    isPrivacyMode,
    setPrivacyMode,
  };

  const fetchCache = new Map();
  const inFlightRequests = new Map();

  /**
   * Enhanced fetch with memory caching and request deduplication.
   * @param {string} url
   * @param {Object} options
   * @param {number} ttl - Cache TTL in milliseconds (default 0, no cache)
   */
  async function fetchWithCache(url, options = {}, ttl = 0) {
    const method = options.method || 'GET';
    const isCacheable = method === 'GET' && ttl > 0;
    const cacheKey = `${url}:${JSON.stringify(options.headers || {})}`;

    if (isCacheable) {
      const cached = fetchCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < ttl) {
        return Promise.resolve(cached.data.clone());
      }
    }

    // Request Deduplication
    if (inFlightRequests.has(cacheKey)) {
      const pending = await inFlightRequests.get(cacheKey);
      return pending.clone();
    }

    const requestPromise = fetch(url, options);
    inFlightRequests.set(cacheKey, requestPromise);

    try {
      const response = await requestPromise;
      if (response.ok && isCacheable) {
        fetchCache.set(cacheKey, {
          timestamp: Date.now(),
          data: response.clone()
        });
      }
      return response;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  }

  function clearClientCache() {
    fetchCache.clear();
    inFlightRequests.clear();
  }

  window.TravelBuddy.fetchWithCache = fetchWithCache;
  window.TravelBuddy.clearClientCache = clearClientCache;

  async function parseJsonSafe(res) {
    try {
      return await res.json();
    } catch (err) {
      return {};
    }
  }

  function requestErrorMessage(status, fallback) {
    if (status === 401) return 'Your session has expired. Please log in again.';
    if (status === 403) return "You don't have permission to perform this action.";
    if (status === 404) return fallback || 'Requested item was not found.';
    if (status >= 500) return fallback || 'Unable to complete the request.';
    return fallback || 'Unable to complete the request.';
  }

  window.TravelBuddy.parseJsonSafe = parseJsonSafe;
  window.TravelBuddy.requestErrorMessage = requestErrorMessage;

  function attachRipple(button) {
    button.addEventListener('click', function (e) {
      // Basic double-submit prevention for all primary buttons
      if (button.classList.contains('btn-loading') || button.disabled) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const rect = button.getBoundingClientRect();
      const ripple = document.createElement('span');
      const size = Math.max(rect.width, rect.height);
      ripple.className = 'ripple';
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
      ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
      button.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove());
    });
  }
  document.querySelectorAll('.btn-primary').forEach(attachRipple);

  function parseStoredUser() {
    try {
      return JSON.parse(localStorage.getItem('travelBuddyUser') || '{}');
    } catch (err) {
      return {};
    }
  }

  function saveStoredUser(user) {
    localStorage.setItem('travelBuddyUser', JSON.stringify(user || {}));
  }

  function getDisplayName(user) {
    const first = (user.firstName || '').trim();
    const last = (user.lastName || '').trim();
    const full = `${first} ${last}`.trim();
    return full || user.name || 'TravelBuddy';
  }

  function getInitials(name) {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('') || 'TB';
  }

  function personalizeUser() {
    const user = parseStoredUser();
    const name = getDisplayName(user);
    const avatar = document.querySelector('.user-chip .avatar');
    const nameEl = document.querySelector('.user-chip .user-name');
    const greeting = document.getElementById('overviewGreeting');

    if (avatar) renderProfileAvatar(avatar, user, name);
    if (nameEl) nameEl.textContent = name;
    if (greeting) greeting.textContent = `Welcome back, ${name.split(' ')[0]}`;
  }

  personalizeUser();

  async function refreshCurrentUser() {
    // Return cached user immediately while refreshing
    const cached = parseStoredUser();
    const hasToken = Boolean(localStorage.getItem('travelBuddyToken'));

    if (cached && cached.id) {
       personalizeUser();
       // If we have a cached user AND a token, we consider the user authenticated
       // for the purpose of the initial guard check.
       if (window.resolveTravelBuddyAuth) window.resolveTravelBuddyAuth(true);
    } else if (!hasToken) {
       // No token and no cached user? Definitely logged out.
       if (window.resolveTravelBuddyAuth) window.resolveTravelBuddyAuth(false);
       return {};
    }

    try {
      const res = await fetchWithCache(`${API_ORIGIN}/api/auth/me`, { headers: authHeaders() }, 30000); // 30s cache
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401 && window.resolveTravelBuddyAuth) {
          window.resolveTravelBuddyAuth(false);
        }
        return cached; // Return cached on error if refresh failed
      }

      // FIX: Merge new data with cached data to preserve 'role' if API doesn't return it
      const mergedUser = { ...cached, ...data.user };
      saveStoredUser(mergedUser);
      personalizeUser();
      populateProfileForms(mergedUser);

      // Success: ensure auth is resolved
      if (window.resolveTravelBuddyAuth) window.resolveTravelBuddyAuth(true);
      return mergedUser;
    } catch (err) {
      console.error('Profile refresh failed:', err);
      // On network failure, we trust the cached user if it exists.
      if (cached && cached.id && window.resolveTravelBuddyAuth) {
         window.resolveTravelBuddyAuth(true);
      }
      return cached;
    }
  }
  window.TravelBuddy.getCurrentUser = refreshCurrentUser;

  async function refreshMessageBadge() {
    const badge = document.getElementById('navMsgBadge');
    if (!badge || document.getElementById('conversationSearch')) return;

    try {
      const res = await fetchWithCache(`${API_ORIGIN}/api/messages/unread-count`, { headers: authHeaders() }, 15000); // 15s cache
      const data = await res.json();
      if (!res.ok) return;
      const count = Number(data.count || 0);
      badge.textContent = count;
      badge.style.display = count ? '' : 'none';
    } catch (err) {
      console.error('Message badge refresh failed:', err);
    }
  }

  // ---------- Notification -> page routing (shared by the popup toast and the Notifications list) ----------
  // Small icon/color set used for the popup toast. notifications.js keeps
  // its own slightly larger copy for the full list, but both should agree
  // on the common types.
  const NOTIF_TYPE_META = {
    parcel_posted: { icon: 'fa-route', color: '#0D6EFD' },
    parcel_accepted: { icon: 'fa-box', color: '#0D6EFD' },
    parcel_status: { icon: 'fa-truck-fast', color: '#F5A524' },
    parcel_deleted: { icon: 'fa-trash', color: '#667085' },
    parcel_cancelled: { icon: 'fa-ban', color: '#DC3545' },
    message: { icon: 'fa-message', color: '#7C5CFC' },
    wallet_added: { icon: 'fa-indian-rupee-sign', color: '#17A673' },
    wallet_refunded: { icon: 'fa-indian-rupee-sign', color: '#17A673' },
    wallet_topup_required: { icon: 'fa-wallet', color: '#DC3545' },
    cash_payment_due: { icon: 'fa-money-bill-wave', color: '#F5A524' },
    earning_added: { icon: 'fa-sack-dollar', color: '#17A673' },
    reward_added: { icon: 'fa-gift', color: '#17A673' },
    rating_received: { icon: 'fa-star', color: '#F5A524' },
    rating_request: { icon: 'fa-comment-dots', color: '#0D6EFD' },
  };
  const NOTIF_DEFAULT_META = { icon: 'fa-bell', color: '#0D6EFD' };

  // Types that belong on the wallet/payments screen.
  const PAYMENT_NOTIF_TYPES = new Set([
    'wallet_added', 'wallet_refunded', 'wallet_topup_required',
    'cash_payment_due', 'earning_added', 'reward_added',
  ]);
  // Types for a parcel that's already finished/removed - nothing left to
  // track live, so History (the archive) is the right destination.
  const HISTORY_NOTIF_TYPES = new Set(['parcel_deleted', 'parcel_cancelled']);
  // Types for a parcel that's still an active, trackable journey.
  const TRACK_NOTIF_TYPES = new Set(['parcel_posted', 'parcel_accepted', 'parcel_status', 'rating_request', 'rating_received']);

  // Every dashboard page lives in this same folder, so plain relative paths
  // (no ../user-dashboard/ prefix) work from any of them.
  function getNotificationRoute(notification) {
    if (!notification || !notification.type) return null;
    const type = notification.type;
    const parcelId = notification.relatedParcel;
    const meta = notification.meta || {};

    if (type === 'message') {
      const params = new URLSearchParams();
      if (meta.conversationId) params.set('conversation', meta.conversationId);
      else if (parcelId) params.set('parcel', parcelId);
      const qs = params.toString();
      return `messages.html${qs ? `?${qs}` : ''}`;
    }
    if (PAYMENT_NOTIF_TYPES.has(type)) return 'payments.html';
    if (HISTORY_NOTIF_TYPES.has(type)) return 'history.html';
    if (TRACK_NOTIF_TYPES.has(type)) return `track.html${parcelId ? `?id=${encodeURIComponent(parcelId)}` : ''}`;
    // Unknown/future notification types still land somewhere useful.
    return 'notifications.html';
  }

  async function markNotificationRead(id) {
    if (!id) return;
    try {
      await fetch(`${API_ORIGIN}/api/notifications/${encodeURIComponent(id)}/read`, {
        method: 'PATCH',
        headers: authHeaders(),
      });
    } catch (err) {
      console.error('mark notification read failed:', err);
    }
  }

  window.TravelBuddy.getNotificationRoute = getNotificationRoute;
  window.TravelBuddy.markNotificationRead = markNotificationRead;

  // ---------- Notification bell badge + real-time push (shared across every dashboard page) ----------
  function setNotifBadge(count) {
    const navNotifBadge = document.getElementById('navNotifBadge');
    const bellDot = document.getElementById('bellDot');
    const bellBtn = document.getElementById('bellBtn');
    if (navNotifBadge) {
      navNotifBadge.textContent = count;
      navNotifBadge.style.display = count ? '' : 'none';
    }
    if (bellDot) bellDot.classList.toggle('hidden', count === 0);
    if (bellBtn && count > 0) {
      // A quick shake/pulse on the bell so a new arrival is noticeable even
      // if the toast is missed - restart the animation on every call by
      // removing then re-adding the class on the next frame.
      bellBtn.classList.remove('bell-ring');
      void bellBtn.offsetWidth;
      bellBtn.classList.add('bell-ring');
    }
  }

  async function refreshNotifBadge() {
    try {
      const res = await fetchWithCache(`${API_ORIGIN}/api/notifications/unread-count`, { headers: authHeaders() }, 15000);
      const data = await res.json();
      if (!res.ok) return;
      setNotifBadge(Number(data.count || 0));
    } catch (err) {
      console.error('Notification badge refresh failed:', err);
    }
  }

  // Rich, clickable popup for a live notification - separate from the plain
  // showToast() used everywhere else for simple success/error feedback, so
  // this can carry an icon and a click-to-open action without changing the
  // signature every other showToast() call in the codebase relies on.
  let notifToastTimer;
  let notifToastRoute = null;
  function showNotificationPopup(notification) {
    if (!toast || !notification) return;
    const meta = NOTIF_TYPE_META[notification.type] || NOTIF_DEFAULT_META;
    const route = getNotificationRoute(notification);
    notifToastRoute = route;

    clearTimeout(toastTimer);
    clearTimeout(notifToastTimer);

    toast.innerHTML = `
      <span class="toast-notif-icon" style="background:${escapeHTML(meta.color)}"><i class="fa-solid ${escapeHTML(meta.icon)}"></i></span>
      <span class="toast-notif-body">
        <span class="toast-notif-text">${escapeHTML(notification.text || 'New notification')}</span>
        ${route ? '<span class="toast-notif-hint">Tap to view</span>' : ''}
      </span>
    `;
    toast.className = 'toast show notification-popup' + (route ? ' is-clickable' : '');
    // Restart the pop-in animation even if a toast is already showing.
    toast.classList.remove('toast-pop');
    void toast.offsetWidth;
    toast.classList.add('toast-pop');

    toast.onclick = route
      ? () => {
        markNotificationRead(notification.id);
        window.location.href = route;
      }
      : null;

    notifToastTimer = setTimeout(() => {
      toast.classList.remove('show');
      toast.onclick = null;
    }, 5000);
  }
  window.TravelBuddy.showNotificationPopup = showNotificationPopup;

  // ---------- Ringtone ----------
  // Primary: the actual Microsoft Teams ringtone audio file, looped for as
  // long as the call keeps ringing. Falls back to a synthesized two-tone
  // chime (Web Audio API, no file needed) if the audio file fails to load
  // or the browser blocks playback.
  let ringtoneEl = null;
  let ringtoneCtx = null;
  let ringtoneInterval = null;

  function getRingtoneAudioEl() {
    if (ringtoneEl) return ringtoneEl;
    ringtoneEl = new Audio('../audio/incoming-call-ringtone.mp3');
    ringtoneEl.loop = true;
    ringtoneEl.preload = 'auto';
    return ringtoneEl;
  }

  function playRingtoneChime() {
    if (!ringtoneCtx) return;
    const now = ringtoneCtx.currentTime;
    // Short high-low-high-low chime, like Teams' call ring - two notes,
    // repeated twice per cycle with brief gaps between them.
    const notes = [
      { freq: 987.77, start: 0 },    // B5
      { freq: 1318.51, start: 0.20 }, // E6
      { freq: 987.77, start: 0.55 },
      { freq: 1318.51, start: 0.75 },
    ];
    notes.forEach(({ freq, start }) => {
      const osc = ringtoneCtx.createOscillator();
      const gain = ringtoneCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.22, now + start + 0.02);
      gain.gain.linearRampToValueAtTime(0.22, now + start + 0.14);
      gain.gain.linearRampToValueAtTime(0, now + start + 0.18);
      osc.connect(gain).connect(ringtoneCtx.destination);
      osc.start(now + start);
      osc.stop(now + start + 0.2);
    });
  }

  function playSynthesizedFallback() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      ringtoneCtx = new Ctx();
      ringtoneCtx.resume?.().catch(() => {});
      playRingtoneChime();
      ringtoneInterval = setInterval(playRingtoneChime, 1800);
    } catch (err) {
      console.error('Ringtone fallback playback failed:', err);
    }
  }

  function playRingtone() {
    stopRingtone();
    const audio = getRingtoneAudioEl();
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise?.catch) {
      // Browsers can block audio.play() until the page has seen a user
      // gesture (e.g. the very first incoming call before the person has
      // clicked anything). If the mp3 is blocked, fall back to the
      // synthesized chime so the call still rings audibly either way.
      playPromise.catch(() => playSynthesizedFallback());
    }
  }

  function stopRingtone() {
    if (ringtoneEl) {
      ringtoneEl.pause();
      ringtoneEl.currentTime = 0;
    }
    clearInterval(ringtoneInterval);
    ringtoneInterval = null;
    if (ringtoneCtx) {
      try { ringtoneCtx.close(); } catch (err) { /* already closed */ }
      ringtoneCtx = null;
    }
  }

  window.TravelBuddy.playRingtone = playRingtone;
  window.TravelBuddy.stopRingtone = stopRingtone;

  // ---------- Global incoming-call popup (rings on every dashboard page, not just Messages) ----------
  // messages.html already has its own dedicated call modal + WebRTC handling
  // wired to its own socket connection. Both that socket and this shared one
  // are joined to the same user:<id> room, so both receive "incoming-call" -
  // this listener skips itself whenever messages.html's own modal element is
  // present, so the call isn't announced twice on that page.
  let activeIncomingCall = null;

  function ensureIncomingCallPopup() {
    let el = document.getElementById('tbIncomingCallPopup');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'tbIncomingCallPopup';
    el.className = 'tb-call-popup hidden';
    el.innerHTML = `
      <div class="tb-call-popup-card">
        <div class="tb-call-popup-ring"><div class="tb-call-popup-avatar" id="tbCallPopupAvatar">TB</div></div>
        <div class="tb-call-popup-info">
          <strong id="tbCallPopupName">TravelBuddy user</strong>
          <span id="tbCallPopupSub"><i class="fa-solid fa-mobile-screen-button"></i> Incoming audio call...</span>
        </div>
        <div class="tb-call-popup-actions">
          <button type="button" class="tb-call-popup-btn tb-call-popup-reject" id="tbCallPopupReject" aria-label="Reject call">
            <i class="fa-solid fa-phone-slash"></i><span>Reject</span>
          </button>
          <button type="button" class="tb-call-popup-btn tb-call-popup-accept" id="tbCallPopupAccept" aria-label="Answer call">
            <i class="fa-solid fa-mobile-screen-button"></i><span>Answer</span>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    document.getElementById('tbCallPopupReject').addEventListener('click', rejectGlobalIncomingCall);
    document.getElementById('tbCallPopupAccept').addEventListener('click', acceptGlobalIncomingCall);
    return el;
  }

  function showGlobalIncomingCall({ callId, conversationId, caller }) {
    activeIncomingCall = { callId, conversationId, caller };
    const el = ensureIncomingCallPopup();
    document.getElementById('tbCallPopupAvatar').textContent = caller?.role === 'sender' ? 'VS' : 'VT';
    document.getElementById('tbCallPopupName').textContent = caller?.label || 'TravelBuddy user';
    el.classList.remove('hidden');
    // Restart the ring/pop animation even if a popup is already visible.
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    playRingtone();
  }

  function hideGlobalIncomingCall() {
    const el = document.getElementById('tbIncomingCallPopup');
    stopRingtone();
    if (!el) return;
    el.classList.remove('show');
    setTimeout(() => el.classList.add('hidden'), 200);
    activeIncomingCall = null;
  }

  function rejectGlobalIncomingCall() {
    if (!activeIncomingCall) return;
    window.TravelBuddy.socket?.emit('reject-call', { callId: activeIncomingCall.callId });
    hideGlobalIncomingCall();
  }

  function acceptGlobalIncomingCall() {
    if (!activeIncomingCall) return;
    const { callId, conversationId } = activeIncomingCall;
    hideGlobalIncomingCall();
    // messages.js reads acceptCall on load and answers the same call there -

    // that's where the mic/WebRTC/call-bar UI already lives.
    window.location.href = `messages.html?conversation=${encodeURIComponent(conversationId)}&acceptCall=${encodeURIComponent(callId)}`;
  }

  function connectNotificationSocket() {
    const token = getAuthToken();
    if (!token || !window.TravelBuddySocket) return;

    const socket = TravelBuddySocket.connect('/', token);
    if (!socket) return;

    const updateLiveStatus = (status) => {
        let el = document.getElementById('tbLiveStatus');
        if (!el) {
            el = document.createElement('div');
            el.id = 'tbLiveStatus';
            el.className = 'tb-live-status';
            el.innerHTML = '<span class="dot"></span> <span class="text">Live</span>';
            document.body.appendChild(el);
        }
        const dot = el.querySelector('.dot');
        const text = el.querySelector('.text');

        if (status === 'connected') {
            dot.className = 'dot connected';
            text.textContent = 'Live';
            setTimeout(() => el.classList.add('fade-out'), 3000);
        } else if (status === 'connecting') {
            dot.className = 'dot connecting';
            text.textContent = 'Connecting...';
            el.classList.remove('fade-out');
        } else {
            dot.className = 'dot disconnected';
            text.textContent = 'Offline';
            el.classList.remove('fade-out');
        }
    };

    socket.on('connect', () => {
      refreshNotifBadge();
      refreshMessageBadge();
      updateLiveStatus('connected');
    });

    socket.on('connect_error', (err) => {
      console.error('Notification socket connection failed:', err.message || err);
      updateLiveStatus('disconnected');
    });

    socket.on('reconnect_attempt', () => {
      updateLiveStatus('connecting');
    });

    socket.on('notification:new', ({ notification, unreadCount }) => {
      setNotifBadge(Number(unreadCount || 0));
      showNotificationPopup(notification);
      document.dispatchEvent(new CustomEvent('travelbuddy:notification', { detail: notification }));
    });

    socket.on('parcel_status_change', (data) => {
      console.log('[Live] Parcel status change:', data);
      document.dispatchEvent(new CustomEvent('travelbuddy:parcel-status', { detail: data }));
      showToast(`Parcel #${data.parcelId.slice(-6)}: ${data.status.replace(/_/g, ' ')}`, 'info');
    });

    socket.on('incoming-call', (payload) => {
      if (document.getElementById('incomingCallModal')) return;
      showGlobalIncomingCall(payload);
    });

    socket.on('end-call', ({ callId }) => {
      if (activeIncomingCall && String(activeIncomingCall.callId) === String(callId)) hideGlobalIncomingCall();
    });

    window.TravelBuddy.socket = socket;
    return socket;
  }


  window.TravelBuddy.refreshNotifBadge = refreshNotifBadge;
  window.TravelBuddy.setNotifBadge = setNotifBadge;

  const sidebar = () => document.getElementById('sidebar');
  const sidebarOverlay = () => document.getElementById('sidebarOverlay');

  function openSidebar() {
    const s = sidebar(), o = sidebarOverlay();
    if (!s || !o) return;
    s.classList.add('open');
    o.classList.add('show');
    document.body.classList.add('sidebar-is-open');
  }

  function closeSidebar() {
    const s = sidebar(), o = sidebarOverlay();
    if (!s || !o) return;
    s.classList.remove('open');
    o.classList.remove('show');
    document.body.classList.remove('sidebar-is-open');
  }

  function initUserSidebarCollapse() {
    function runInit() {
      if (window.TravelBuddySidebarCollapse) {
        window.TravelBuddySidebarCollapse.init({
          sidebarId: 'sidebar',
          toggleBtnId: 'sidebarToggle',
          storageKey: 'travelbuddy_user_sidebar_collapsed',
          navItemSelector: '.nav-item',
          collapsedClass: 'sidebar-collapsed'
        });
      }
    }

    if (window.TravelBuddySidebarCollapse) {
      runInit();
    } else {
      const script = document.createElement('script');
      script.src = '/shared/sidebar-collapse.js?v=1';
      script.onload = runInit;
      document.head.appendChild(script);
    }
  }

  function closeUserMenu() {
    const chip = document.getElementById('userChip');
    if (!chip) return;
    chip.classList.remove('open');
    chip.setAttribute('aria-expanded', 'false');
  }
  // Injection re-binds these on demand.
  /*
  if (userChip) {
    // ...
  }
  */

  // profilePhotoCacheBust is declared at the TOP of this IIFE (see line ~5).

  function renderProfileAvatar(el, user, name) {
    if (!el) return;
    const photo = user?.profilePhoto || '';
    el.style.backgroundImage = '';
    el.querySelectorAll('img.tb-profile-photo').forEach((img) => img.remove());
    if (photo) {
      el.textContent = '';
      const img = document.createElement('img');
      img.className = 'tb-profile-photo';
      img.src = resolveMediaUrl(photo, {
        cacheBust: profilePhotoCacheBust && profilePhotoCacheBust.path === photo ? profilePhotoCacheBust.value : null,
      });
      img.alt = 'Profile photo';
      img.style.cssText = 'width:100%;height:100%;display:block;object-fit:cover;border-radius:inherit;';
      img.onerror = () => {
        img.remove();
        el.classList.remove('has-photo');
        el.textContent = getInitials(name);
      };
      el.appendChild(img);
      el.classList.add('has-photo');
    } else {
      el.classList.remove('has-photo');
      el.textContent = getInitials(name);
    }
  }
  // The API stores uploads as relative paths (for example /uploads/avatar.png).
  // Resolve them against Render, rather than the Netlify page origin.
  function resolveMediaUrl(value, options) {
    const source = String(value || '').trim();
    if (!source || source.startsWith('data:') || /^https?:\/\//i.test(source)) return source;
    try {
      const url = new URL(source, `${API_ORIGIN}/`);
      if (options?.cacheBust) url.searchParams.set('v', String(options.cacheBust));
      return url.href;
    } catch (err) {
      return source;
    }
  }
  window.TravelBuddy.resolveMediaUrl = resolveMediaUrl;
  function resizeProfilePhoto(file) { return new Promise((resolve,reject)=>{ const r=new FileReader(); r.onerror=reject; r.onload=()=>{ const img=new Image(); img.onerror=reject; img.onload=()=>{ const size=320,c=document.createElement('canvas'); c.width=size;c.height=size; const x=c.getContext('2d'),side=Math.min(img.width,img.height),sx=(img.width-side)/2,sy=(img.height-side)/2; x.drawImage(img,sx,sy,side,side,0,0,size,size); resolve(c.toDataURL('image/jpeg',.82)); }; img.src=r.result; }; r.readAsDataURL(file); }); }

  function createProfileModal() {
    if (document.getElementById('profileModalOverlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay hidden';
    overlay.id = 'profileModalOverlay';
    overlay.innerHTML = `
      <div class="modal-card profile-modal" role="dialog" aria-modal="true" aria-labelledby="profileModalTitle">
        <button class="modal-close" id="profileModalClose" aria-label="Close">
          <i class="fa-solid fa-xmark"></i>
        </button>

        <div class="profile-head">
          <div class="avatar profile-avatar" id="profileAvatar">TB</div>
          <div>
            <h2 class="modal-title" id="profileModalTitle">My Profile</h2>
            <p class="profile-email" id="profileEmailText">Signed in user</p>
          </div>
        </div>

        <div class="profile-tabs" role="tablist">
          <button class="tab-btn active" type="button" data-profile-tab="profile">Profile</button>
          <button class="tab-btn" type="button" data-profile-tab="details">Details</button>
          <button class="tab-btn" type="button" data-profile-tab="settings">Settings</button>
        </div>

        <section class="profile-tab-panel profile-photo-only" id="profileTabProfile">
          <div class="profile-photo-focus">
            <div class="avatar profile-avatar profile-avatar-large" id="profilePhotoPreview">TB</div>
            <div class="profile-photo-actions">
              <label class="btn-ghost profile-photo-btn" for="profilePhotoInput"><i class="fa-solid fa-camera"></i><span id="profilePhotoActionText">Add Photo</span></label>
              <input id="profilePhotoInput" type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" hidden>
              <button type="button" class="btn-ghost" id="removeProfilePhoto"><i class="fa-solid fa-trash-can"></i> Remove Photo</button>
            </div>
            <p class="profile-photo-help">Your photo is saved to your TravelBuddy account and shown in your profile avatar.</p>
          </div>
        </section>

        <section class="profile-tab-panel hidden" id="profileTabDetails">
          <form class="stack-form" id="dashboardProfileForm">
            <div class="form-row">
              <div class="field"><label for="profileFirstName">First Name</label><input type="text" id="profileFirstName" required /></div>
              <div class="field"><label for="profileLastName">Last Name</label><input type="text" id="profileLastName" required /></div>
            </div>
            <div class="field"><label for="profileEmail">Email</label><input type="email" id="profileEmail" disabled /></div>
            <div class="field"><label for="profilePhone">Mobile Number</label><input type="tel" id="profilePhone" placeholder="+919876543210" /></div>
            <button type="submit" class="btn-primary"><span class="btn-label"><i class="fa-solid fa-bookmark"></i> Save Profile</span><span class="spinner" aria-hidden="true"></span></button>
          </form>
        </section>

        <section class="profile-tab-panel hidden" id="profileTabSettings">
          <form class="stack-form" id="dashboardPasswordForm">
            <div class="field">
              <label for="currentPassword">Current Password</label>
              <input type="password" id="currentPassword" autocomplete="current-password" />
            </div>
            <div class="field">
              <label for="newPassword">New Password</label>
              <input type="password" id="newPassword" autocomplete="new-password" />
            </div>
            <button type="submit" class="btn-primary">
              <span class="btn-label"><i class="fa-solid fa-key"></i> Change Password</span>
              <span class="spinner" aria-hidden="true"></span>
            </button>
          </form>
          <div class="profile-danger">
            <button type="button" class="btn-ghost" id="profileLogoutBtn">
              <i class="fa-solid fa-arrow-right-from-bracket"></i> Log out
            </button>
          </div>
        </section>
      </div>
    `;

    document.body.appendChild(overlay);
    attachRipple(overlay.querySelector('.btn-primary'));
    attachRipple(overlay.querySelectorAll('.btn-primary')[1]);
    bindProfileModal();
    async function saveDashboardPhoto(profilePhoto) {
      const u = parseStoredUser();
      const payload = { firstName: u.firstName || 'Travel', lastName: u.lastName || 'Buddy', phone: u.phone || '', profilePhoto };
      const res = await fetch(`${API_ORIGIN}/api/auth/me`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save profile photo.');
      // The server has silently returned a saved user before without the
      // photo actually taking (the toast still said "saved" either way).
      // Comparing what came back against what we sent turns that into an
      // honest error instead of a false success, and refetching /api/auth/me
      // once catches the case where the PUT response itself is stale but
      // the write did land.
      const returnedPhoto = data.user?.profilePhoto || '';
      const savedOk = profilePhoto
        ? (returnedPhoto && (profilePhoto.startsWith('data:image/') || returnedPhoto === profilePhoto))
        : !returnedPhoto;
      if (!savedOk) {
        try {
          const check = await fetch(`${API_ORIGIN}/api/auth/me`, { headers: authHeaders() });
          const checkData = await check.json();
          const checkedPhoto = checkData.user?.profilePhoto || '';
          const checkedOk = profilePhoto
            ? (checkedPhoto && (profilePhoto.startsWith('data:image/') || checkedPhoto === profilePhoto))
            : !checkedPhoto;
          if (check.ok && checkedOk) {
            data.user = checkData.user;
          } else {
            throw new Error('not saved');
          }
        } catch (verifyErr) {
          throw new Error('The photo did not save on the server. Please try again, or use a smaller image.');
        }
      }
      if (data.user?.profilePhoto) {
        profilePhotoCacheBust = { path: data.user.profilePhoto, value: Date.now() };
      } else {
        profilePhotoCacheBust = null;
      }
      updateDashboardUser(data.user);
      return data.user;
    }
    document.getElementById('profilePhotoInput')?.addEventListener('change', async (e)=>{ const f=e.target.files?.[0]; if(!f)return; const allowed=['image/jpeg','image/png']; if(!allowed.includes(f.type)){ showToast('Invalid image format\nPlease upload a JPG, JPEG, or PNG image.', 'error'); e.target.value=''; return; } if(f.size>5*1024*1024){ showToast('Choose an image smaller than 5 MB.', 'error'); e.target.value=''; return; } try { const photo=await resizeProfilePhoto(f); const preview=document.getElementById('profilePhotoPreview'); if(preview) renderProfileAvatar(preview,{...parseStoredUser(),profilePhoto:photo},getDisplayName(parseStoredUser())); await saveDashboardPhoto(photo); showToast('Profile photo saved.', 'success'); } catch(err) { showToast(err.message, 'error'); } e.target.value=''; });
    document.getElementById('removeProfilePhoto')?.addEventListener('click',async()=>{ try { await saveDashboardPhoto(''); showToast('Profile photo removed.', 'success'); } catch(err) { showToast(err.message, 'error'); } });
  }

  // BUG FIX: this function used to be declared in the middle of
  // saveDashboardPhoto()'s body (only working because of `function`
  // hoisting), and saveDashboardPhoto called populateProfileForms(user)
  // directly AND through this helper, updating the profile form twice on
  // every photo save. Moved to a normal top-level function and the
  // duplicate call removed.
  function updateDashboardUser(user) {
    if (!user) return;
    saveStoredUser(user);
    const fullName = getDisplayName(user);
    document.querySelectorAll('[data-user-name], #userName, #profileName, .user-name').forEach((el) => {
      el.textContent = fullName;
    });
    // Only hydrate avatars that represent the signed-in user. Message thread
    // avatars and chat headers represent other people and must keep their
    // conversation-specific photos.
    document.querySelectorAll('.user-chip .avatar, [data-user-avatar], #userAvatar, #profileAvatar, #profilePhotoPreview, .user-avatar, .profile-avatar').forEach((el) => {
      renderProfileAvatar(el, user, fullName);
    });
    populateProfileForms(user);
    personalizeUser();
    document.dispatchEvent(new CustomEvent('travelbuddy:profile-updated', { detail: { user } }));
  }


  function populateProfileForms(user) {
    const safeUser = user || parseStoredUser();
    const name = getDisplayName(safeUser);
    const avatar = document.getElementById('profileAvatar');
    const emailText = document.getElementById('profileEmailText');
    const firstName = document.getElementById('profileFirstName');
    const lastName = document.getElementById('profileLastName');
    const email = document.getElementById('profileEmail');
    const phone = document.getElementById('profilePhone');
    const photoActionText = document.getElementById('profilePhotoActionText');
    const removePhotoButton = document.getElementById('removeProfilePhoto');
    if (photoActionText) photoActionText.textContent = safeUser.profilePhoto ? 'Change Photo' : 'Add Photo';
    if (removePhotoButton) removePhotoButton.hidden = !safeUser.profilePhoto;

    if (avatar) renderProfileAvatar(avatar, safeUser, name);
    const photoPreview = document.getElementById('profilePhotoPreview');
    if (photoPreview) renderProfileAvatar(photoPreview, safeUser, name);
    if (emailText) emailText.textContent = safeUser.email || 'No email available';
    if (firstName) firstName.value = safeUser.firstName || '';
    if (lastName) lastName.value = safeUser.lastName || '';
    if (email) email.value = safeUser.email || '';
    if (phone) phone.value = safeUser.phone || '';
  }

  function setProfileTab(tabName) {
    document.querySelectorAll('[data-profile-tab]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.profileTab === tabName);
    });
    document.getElementById('profileTabProfile')?.classList.toggle('hidden', tabName !== 'profile');
    document.getElementById('profileTabDetails')?.classList.toggle('hidden', tabName !== 'details');
    document.getElementById('profileTabSettings')?.classList.toggle('hidden', tabName !== 'settings');
  }

  function openProfileModal(tabName) {
    createProfileModal();
    populateProfileForms();
    setProfileTab(tabName || 'profile');
    document.getElementById('profileModalOverlay').classList.remove('hidden');
    document.getElementById(tabName === 'settings' ? 'currentPassword' : tabName === 'details' ? 'profileFirstName' : 'profilePhotoInput')?.focus();
  }

  function closeProfileModal() {
    document.getElementById('profileModalOverlay')?.classList.add('hidden');
  }

  async function logoutNow(){
    try{await window.TravelBuddyAuth?.logout();}catch{}
    localStorage.removeItem('travelBuddyUser');
    clearClientCache();
    showToast('Logged out successfully.','success');
    setTimeout(()=>{window.location.href='../login/login.html';},500);
  }

  function bindProfileModal() {
    const overlay = document.getElementById('profileModalOverlay');
    document.getElementById('profileModalClose')?.addEventListener('click', closeProfileModal);
    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) closeProfileModal();
    });

    document.querySelectorAll('[data-profile-tab]').forEach((btn) => {
      btn.addEventListener('click', () => setProfileTab(btn.dataset.profileTab));
    });

    document.getElementById('dashboardProfileForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = e.currentTarget.querySelector('.btn-primary');
      const payload = {
        firstName: document.getElementById('profileFirstName').value.trim(),
        lastName: document.getElementById('profileLastName').value.trim(),
        phone: document.getElementById('profilePhone').value.trim(),
        profilePhoto: parseStoredUser().profilePhoto || '',
      };

      if (!payload.firstName || !payload.lastName) {
        showToast('First name and last name are required.', 'error');
        return;
      }

      setButtonLoading(submitBtn, true);
      try {
        const res = await fetch(`${API_ORIGIN}/api/auth/me`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify(payload),
        });
        const data = await parseJsonSafe(res);
        if (!res.ok) {
          showToast(data.error || 'Could not update profile.', 'error');
          return;
        }
        saveStoredUser(data.user);
        personalizeUser();
        populateProfileForms(data.user);
        showToast('Profile updated.', 'success');
      } catch (err) {
        console.error(err);
        showToast('Unable to connect to the server.', 'error');
      } finally {
        setButtonLoading(submitBtn, false);
      }
    });

    document.getElementById('dashboardPasswordForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = e.currentTarget.querySelector('.btn-primary');
      const currentPassword = document.getElementById('currentPassword').value;
      const newPassword = document.getElementById('newPassword').value;

      if (!currentPassword || !newPassword) {
        showToast('Enter current and new password.', 'error');
        return;
      }
      if (newPassword.length < 8) {
        showToast('New password must be at least 8 characters.', 'error');
        return;
      }

      setButtonLoading(submitBtn, true);
      try {
        const res = await fetch(`${API_ORIGIN}/api/auth/me/password`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        const data = await parseJsonSafe(res);
        if (!res.ok) {
          showToast(data.error || requestErrorMessage(res.status, 'Could not change password.'), 'error');
          return;
        }
        e.currentTarget.reset();
        showToast('Password changed successfully.', 'success');
      } catch (err) {
        console.error(err);
        showToast('Unable to connect to the server.', 'error');
      } finally {
        setButtonLoading(submitBtn, false);
      }
    });

    document.getElementById('profileLogoutBtn')?.addEventListener('click', logoutNow);
  }

  /*
  document.querySelectorAll('.user-menu a').forEach((link) => {
    // ...
  });
  */

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeSidebar();
    closeUserMenu();
    closeProfileModal();
  });

  /*
  const globalSearch = document.getElementById('globalSearch');
  if (globalSearch) {
    // ...
  }
  */

  /*
  document.querySelectorAll('.user-menu a[href="../login/login.html"]').forEach((link) => {
    // ...
  });
  */

  /*
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logoutNow);
  }
  */

  function initImageSkeletons() {
    if (!window.TravelBuddySkeleton) return;
    document.querySelectorAll('img[data-skeleton="true"]').forEach(img => {
      window.TravelBuddySkeleton.handleImage(img);
    });
  }

  loadAsset('/shared/ai-assistant.css', 'css');
  loadAsset('/shared/ai-assistant.js', 'js');
  highlightActiveNav();
  refreshCurrentUser();
  refreshMessageBadge();
  refreshNotifBadge();
  connectNotificationSocket();
  initImageSkeletons();
})();
