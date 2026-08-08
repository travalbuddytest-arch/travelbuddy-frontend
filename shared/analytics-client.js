// shared/analytics-client.js
// Reports page views and exit/session-duration info to the Website
// Analytics System backend (routes/analyticsTrack.js). Loaded on every
// page automatically by nav-include.js — see the bottom of that file.
//
// This is intentionally the ONLY piece of the analytics system that has
// to be included per-page, and it's injected automatically rather than
// pasted into every .html file, to avoid touching ~20 existing pages.
//
// Why this exists at all: the backend is a pure REST API and never sees
// page navigation directly (this is a static multi-page site), so the
// frontend has to actively report "a page was viewed" / "the visitor
// left" itself.
(function () {
  'use strict';

  var API_BASE = `${APP_CONFIG.API_BASE_URL}/api/analytics`;
  var pageLoadedAt = Date.now();
  var reportedExit = false;

  function safeGet(fn, fallback) {
    try { var v = fn(); return v === undefined || v === null ? fallback : v; } catch (e) { return fallback; }
  }

  function collectContext() {
    return {
      page: location.pathname + location.search,
      referrer: safeGet(function () { return document.referrer; }, ''),
      screenResolution: safeGet(function () { return screen.width + 'x' + screen.height; }, ''),
      screenWidth: safeGet(function () { return screen.width; }, 0),
      timezone: safeGet(function () { return Intl.DateTimeFormat().resolvedOptions().timeZone; }, ''),
      language: safeGet(function () { return navigator.language; }, ''),
    };
  }

  function track(type, meta) {
    var payload = collectContext();
    payload.type = type;
    if (meta) payload.meta = meta;

    try {
      fetch(API_BASE + '/track', {
        method: 'POST',
        credentials: 'include', // carries the tb_vid/tb_sid cookies (and login cookie, if any)
        headers: { 'Content-Type': 'application/json' },
        // Some browsers cancel in-flight fetches on page unload; page_view
        // fires on load so that's not a concern for the initial call.
        body: JSON.stringify(payload),
        keepalive: type !== 'page_view', // let custom/late events survive a same-tick navigation
      }).catch(function () { /* analytics must never surface an error to the user */ });
    } catch (e) { /* ignore */ }
  }

  function reportSessionEnd() {
    if (reportedExit) return;
    reportedExit = true;
    var durationSeconds = Math.round((Date.now() - pageLoadedAt) / 1000);
    var payload = JSON.stringify({ page: location.pathname + location.search, durationSeconds: durationSeconds });
    try {
      if (navigator.sendBeacon) {
        // A Blob with an explicit application/json type keeps the request's
        // Content-Type as application/json so express.json() parses it —
        // sendBeacon(url, string) would send text/plain instead.
        navigator.sendBeacon(API_BASE + '/session-end', new Blob([payload], { type: 'application/json' }));
      } else {
        fetch(API_BASE + '/session-end', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(function () {});
      }
    } catch (e) { /* ignore */ }
  }

  // Analytics is non-critical. Starting a cross-origin request while the
  // parser is still building the page competes with the first paint.
  function runWhenIdle(callback) {
    if ('requestIdleCallback' in window) window.requestIdleCallback(callback, { timeout: 2500 });
    else window.setTimeout(callback, 800);
  }

  function startAnalytics() {
    track('page_view');
    schedulePresenceSocket();
  }

  if (document.readyState === 'complete') runWhenIdle(startAnalytics);
  else window.addEventListener('load', function () { runWhenIdle(startAnalytics); }, { once: true });

  // 'pagehide' fires reliably for both tab close and same-tab navigation,
  // including on mobile Safari where 'beforeunload'/'unload' are unreliable.
  window.addEventListener('pagehide', reportSessionEnd);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') reportSessionEnd();
  });

  // Exposed so other frontend scripts can report meaningful in-page actions
  // (e.g. "Support Ticket Created") without needing to know about cookies
  // or the API shape. Not wired into every action yet — that's a later
  // phase — but the hook is here for register.js/support.js/etc to call:
  //   window.TBAnalytics.track('support_ticket_created', { ticketId })
  window.TBAnalytics = { track: track };

  // ---- Real-time presence (powers the admin dashboard's live cards) ----
  // A plain Socket.IO connection that stays open for as long as this page
  // is open. The backend counts it as "one live visitor" from the moment
  // it connects to the moment it disconnects (tab close / navigation) —
  // see socket/visitorSocket.js. No events need to be sent after connecting;
  // presence itself IS the signal.
  var SOCKET_ORIGIN = APP_CONFIG.SOCKET_URL;

  function connectPresenceSocket() {
    if (!window.io || window.TBAnalyticsPresenceSocket) return;
    try {
      var ctx = collectContext();
      var socket = window.io(APP_CONFIG.SOCKET_URL + '/live-visitors', {
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 2,
        transports: ['websocket', 'polling'],
        query: {
          page: ctx.page,
          device: safeGet(function () { return /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop'; }, 'unknown'),
        },
      });
      // Best-effort only — a failed/blocked presence socket must never
      // affect the page itself, hence no error handling beyond this.
      socket.on('connect_error', function () {});
      window.TBAnalyticsPresenceSocket = socket;
    } catch (e) { /* ignore */ }
  }

  function schedulePresenceSocket() {
    runWhenIdle(function () {
      if (document.visibilityState === 'hidden') return;
      if (window.io) {
        connectPresenceSocket();
        return;
      }
    // Load the client lazily so pages that don't already include it
    // (login/register/home/etc) don't need an extra <script> tag added.
    try {
      var s = document.createElement('script');
      s.src = APP_CONFIG.SOCKET_URL + '/socket.io/socket.io.js';
      s.async = true;
      s.onload = connectPresenceSocket;
      s.onerror = function () {}; // e.g. backend not running — silently skip presence tracking
      document.head.appendChild(s);
      } catch (e) { /* ignore */ }
    });
  }
})();
