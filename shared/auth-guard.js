// =========================================================
// TravelBuddy — Protected Page Auth Guard
// ---------------------------------------------------------
// Include this as the VERY FIRST <script> in <head>, before any
// stylesheet/script that could paint page content, on every page that
// must not be reachable by a logged-out visitor.
//
//   <script src="../shared/auth-guard.js" data-guard="user"></script>     (user-dashboard/*)
//   <script src="../../shared/auth-guard.js" data-guard="admin"></script> (admin_dashboard/html/admin.html)
//
// This reuses the SAME session tokens the rest of the app already
// writes on login (see login/login.js and shared/auth-cookie-client.js):
//   - user pages  -> localStorage 'travelBuddyToken'
//   - admin pages -> localStorage 'admin_token' / 'travelBuddyAdminToken'
//
// It does not invent a second authentication system. It only adds a
// synchronous, render-blocking check so a logged-out visitor never sees
// even a flash of private markup/data before common.js's async
// /api/auth/me check would otherwise catch it.
//
// Defense in depth:
//   1) SYNC check here — no token in localStorage -> redirect immediately,
//      before the rest of <head>/<body> is parsed or painted.
//   2) ASYNC check already done by user-dashboard/js/common.js and
//      admin_dashboard/js/admin-auth.js — calls the backend, and logs the
//      visitor out if the token is invalid/expired/revoked.
//   3) The backend API itself must reject unauthenticated/unauthorized
//      requests (401/403) for any private endpoint — the frontend check
//      below is a UX/SEO nicety, never the real security boundary.
// =========================================================
(function () {
    'use strict';

    var thisScript = document.currentScript;
    var guardType = (thisScript && thisScript.getAttribute('data-guard')) || 'user';

    function hasSession() {
        try {
            if (guardType === 'admin') {
                return Boolean(
                    localStorage.getItem('admin_token') ||
                    localStorage.getItem('travelBuddyAdminToken')
                );
            }
            return Boolean(localStorage.getItem('travelBuddyToken'));
        } catch (e) {
            // Storage blocked (private mode edge-cases, etc.) — treat as
            // logged out rather than risk exposing a protected page.
            return false;
        }
    }

    if (hasSession()) return;

    // Not logged in: stop the browser from painting any protected markup
    // and send the visitor to login, preserving where they were headed so
    // login can return them there afterward.
    try {
        document.documentElement.style.display = 'none';
    } catch (e) { /* no-op */ }

    var loginUrl = guardType === 'admin' ? '../../login/login.html' : '../login/login.html';
    var returnTo = window.location.pathname + window.location.search + window.location.hash;
    var target = loginUrl + '?redirect=' + encodeURIComponent(returnTo);

    window.location.replace(target);

    // Belt-and-braces: if replace() is somehow delayed, stop the rest of
    // this document from executing/parsing further inline scripts.
    window.stop && window.stop();
})();
