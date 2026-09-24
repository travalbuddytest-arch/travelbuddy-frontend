(() => {
  'use strict';

  const apiBase = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) || 'https://api.carryparcel.in';
  const nativeFetch = window.fetch.bind(window);

  window.fetch = async function fetchWithAuth(input, init = {}) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const isCarryParcelApi = typeof url === 'string' && url.startsWith(`${apiBase}/`);

    const isProtectedPage = () => {
      const guardedPage = document.currentScript && document.currentScript.getAttribute('data-guard');
      const path = window.location.pathname || '';
      return Boolean(guardedPage) || path.includes('/user-dashboard/') || path.includes('/admin_dashboard/');
    };

    const response = await nativeFetch(input, isCarryParcelApi ? { ...init, credentials: 'include' } : init);

    if (isCarryParcelApi) {
      if (response.status === 401) {
        if (isProtectedPage() && !window.location.pathname.includes('login.html')) {
          console.warn('[Auth] Received 401. Logging out and redirecting.');
          if (window.CarryParcelAuth && typeof window.CarryParcelAuth.logout === 'function') {
            window.CarryParcelAuth.logout();
          }

          const returnTo = window.location.pathname + window.location.search + window.location.hash;
          const redirectUrl = `/login/login.html?reason=session_expired&redirect=${encodeURIComponent(returnTo)}`;
          window.location.href = redirectUrl;
        }
      } else if (response.status === 403) {
        console.warn('Access denied (403):', url);
      } else if (response.status === 429 && window.TBToast) {
        window.TBToast.show('Too many requests. Please wait a moment.', 'warning');
      }
    }

    return response;
  };

  const consentDefaults = { necessary: true, preferences: false, analytics: false };

  function getStoredConsent() {
    try {
      const cookie = document.cookie.split('; ').find((entry) => entry.startsWith('carryparcel_cookie_consent='));
      if (!cookie) return { ...consentDefaults };
      const rawValue = decodeURIComponent(cookie.split('=').slice(1).join('='));
      return { ...consentDefaults, ...JSON.parse(rawValue) };
    } catch (error) {
      return { ...consentDefaults };
    }
  }

  window.CarryParcelAuth = {
    async logout() {
      try {
        const fcmToken = localStorage.getItem('carryParcelFcmToken');
        if (fcmToken) {
          await nativeFetch(`${apiBase}/api/notifications/device-token`, {
            method: 'DELETE',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: fcmToken }),
          });
        }
      } catch (error) {
        // Ignore cleanup failures and continue logout flow.
      }

      try {
        await nativeFetch(`${apiBase}/api/auth/logout`, { method: 'POST', credentials: 'include' });
      } catch (error) {
        // Ignore logout errors and clear local state regardless.
      }

      localStorage.removeItem('carryParcelToken');
      localStorage.removeItem('carryParcelUser');
      localStorage.removeItem('carryParcelFcmToken');
      localStorage.removeItem('carryParcelAdminToken');
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      localStorage.removeItem('travelBuddyAdminToken');
      localStorage.removeItem('carryParcelLoggedIn');
      localStorage.removeItem('carryParcelAdminLoggedIn');

      if (window.CarryParcel && typeof window.CarryParcel.clearClientCache === 'function') {
        window.CarryParcel.clearClientCache();
      }
    },

    isAdmin() {
      return Boolean(localStorage.getItem('carryParcelAdminLoggedIn'));
    },

    getAdmin() {
      try {
        return JSON.parse(localStorage.getItem('carryParcelAdmin') || '{}');
      } catch (error) {
        return {};
      }
    },

    async logoutAdmin() {
      try {
        const fcmToken = localStorage.getItem('carryParcelFcmToken');
        if (fcmToken) {
          await nativeFetch(`${apiBase}/api/notifications/device-token`, {
            method: 'DELETE',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: fcmToken }),
          });
        }
      } catch (error) {
        // Ignore cleanup failures and continue logout flow.
      }

      try {
        await nativeFetch(`${apiBase}/api/admin/logout`, { method: 'POST', credentials: 'include' });
      } catch (error) {
        // Ignore logout errors and clear local state regardless.
      }

      localStorage.removeItem('carryParcelAdminToken');
      localStorage.removeItem('carryParcelAdmin');
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      localStorage.removeItem('travelBuddyAdminToken');
      localStorage.removeItem('carryParcelFcmToken');
      localStorage.removeItem('carryParcelLoggedIn');
      localStorage.removeItem('carryParcelAdminLoggedIn');
    },
  };

  window.CarryParcelCookies = {
    get() {
      return getStoredConsent();
    },
    has(type) {
      const consent = getStoredConsent();
      return type === 'necessary' || Boolean(consent[type]);
    },
    open() {
      const settingsButton = document.getElementById('tbCookieSettings');
      if (settingsButton && typeof settingsButton.click === 'function') {
        settingsButton.click();
      }
    },
  };

  window.TravelBuddyCookieConsent = window.CarryParcelCookies;
})();
