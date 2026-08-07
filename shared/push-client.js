// shared/push-client.js
//
// Requests notification permission, registers this browser's FCM token with
// the backend, and shows a toast for pushes that arrive while the tab is
// open (background/closed-tab pushes are handled by firebase-messaging-sw.js
// instead, since there's no page here to show a toast in).
//
// Depends on shared/firebase-config.js and js/common.js (for window.TravelBuddy
// and window.showToast) being loaded first.
(async () => {
  'use strict';

  const config = window.TravelBuddyFirebaseConfig || {};
  if (!config.apiKey || !config.vapidKey) return;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return; // unsupported browser.
  if (!window.TravelBuddy) return; // common.js didn't load (e.g. this isn't a dashboard page).

  const { API_ORIGIN, authHeaders } = window.TravelBuddy;

  async function pushIsConfiguredOnServer() {
    try {
      const res = await fetch(`${API_ORIGIN}/api/notifications/push-status`, { headers: authHeaders() });
      const data = await res.json();
      return Boolean(data.configured);
    } catch (err) {
      return false;
    }
  }

  async function registerToken() {
    try {
      // Loaded lazily (rather than as static <script> tags on every page) so
      // pages that don't include this file at all pay zero extra cost, and
      // a page that does include it only fetches the SDK once permission is
      // actually relevant to check.
      await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
      await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

      if (!firebase.apps.length) firebase.initializeApp(config);
      const messaging = firebase.messaging();

      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
      const token = await messaging.getToken({ vapidKey: config.vapidKey, serviceWorkerRegistration: registration });
      if (!token) return;

      await fetch(`${API_ORIGIN}/api/notifications/device-token`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ token }),
      });
      // Stashed so logout (in auth-cookie-client.js) can unregister this exact
      // token without needing to reload the Firebase SDK just to fetch it again.
      localStorage.setItem('travelBuddyFcmToken', token);

      // Foreground messages: the tab is already open, so a native OS
      // notification would be redundant — use the same toast the rest of
      // the app already uses for everything else.
      messaging.onMessage((payload) => {
        const text = payload.notification?.body || payload.notification?.title;
        if (text && window.showToast) window.showToast(text, 'success');
      });
    } catch (err) {
      // Push is a best-effort enhancement — never let a failure here (blocked
      // permission, unsupported browser quirk, network hiccup) affect the
      // rest of the page.
      console.error('Push notification setup failed:', err);
    }
  }

  if (!(await pushIsConfiguredOnServer())) return;

  if (Notification.permission === 'granted') {
    registerToken();
  } else if (Notification.permission === 'default') {
    // Ask once the dashboard has actually loaded, not the instant the page
    // opens, so the permission prompt doesn't compete with the login/loading
    // experience.
    window.addEventListener('load', async () => {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') registerToken();
    });
  }
  // If permission === 'denied', do nothing — respect the user's choice
  // silently rather than nagging them on every page load.
})();
