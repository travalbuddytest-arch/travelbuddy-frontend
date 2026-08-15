// firebase-messaging-sw.js
//
// Handles push notifications that arrive while the browser tab is in the
// background or closed (foreground messages are handled separately by
// shared/push-client.js, since a visible tab doesn't need an OS-level
// notification banner).
//
// IMPORTANT: this file must be served from the site root (e.g.
// worker's scope defaults to its own directory and everything below it —
// if it were served from a subfolder it would only cover pages in that
// subfolder. If your static server's root isn't the Frontend/ folder,
// move this file to wherever that root is, or register it with an
// explicit { scope: '/' } (already done in push-client.js) and make sure
// the response includes a Service-Worker-Allowed: / header for that path.

importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');
importScripts('/shared/firebase-config.js');

const config = self.TravelBuddyFirebaseConfig || {};

// If the project hasn't filled in shared/firebase-config.js yet, skip
// initialization entirely rather than letting Firebase throw on empty values.
if (config.apiKey) {
  firebase.initializeApp(config);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || 'TravelBuddy';
    const body = payload.notification?.body || '';
    self.registration.showNotification(title, {
      body,
      icon: '/images/logo.jpeg',
      data: payload.data || {},
    });
  });

  // Clicking the OS notification focuses an existing TravelBuddy tab if one
  // is open, otherwise opens the notifications page.
  self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes('/user-dashboard/') && 'focus' in client) return client.focus();
        }
        if (clients.openWindow) return clients.openWindow('/user-dashboard/notifications.html');
      })
    );
  });
}
