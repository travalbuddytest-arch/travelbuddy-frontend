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

    // Synchronous Zero-FOUC check for sidebar preference on desktop
    try {
        if (window.innerWidth > 900) {
            var sidebarKey = guardType === 'admin' ? 'travelbuddy_admin_sidebar_collapsed' : 'travelbuddy_user_sidebar_collapsed';
            if (localStorage.getItem(sidebarKey) === 'true') {
                document.documentElement.classList.add('sidebar-collapsed');
            }
        }
    } catch (e) {}

    function hasSession() {
        try {
            if (guardType === 'admin') {
                var hasToken = Boolean(localStorage.getItem('admin_token') || localStorage.getItem('travelBuddyAdminToken'));
                var adminData = localStorage.getItem('travelBuddyAdmin') || localStorage.getItem('admin_user');
                if (!hasToken || !adminData) return false;

                try {
                    var admin = JSON.parse(adminData);
                    return admin && admin.role === 'admin';
                } catch (e) {
                    return false;
                }
            }

            var hasUserToken = Boolean(localStorage.getItem('travelBuddyToken'));
            var userData = localStorage.getItem('travelBuddyUser');
            if (!hasUserToken || !userData) return false;

            try {
                var user = JSON.parse(userData);
                return user && (user.role === 'user' || user.role === 'traveler' || user.role === 'sender');
            } catch (e) {
                return false;
            }
        } catch (e) {
            return false;
        }
    }

    window.TravelBuddySanitizer = {
        sanitize(str) {
            if (typeof str !== 'string') return str;
            return str.replace(/[\$.]/g, '');
        },
        sanitizeObject(obj) {
            if (!obj || typeof obj !== 'object') return obj;
            for (let key in obj) {
                if (typeof obj[key] === 'string') {
                    obj[key] = this.sanitize(obj[key]);
                } else if (typeof obj[key] === 'object') {
                    this.sanitizeObject(obj[key]);
                }
            }
            return obj;
        }
    };

    if (hasSession()) {
        console.log('[AuthGuard] Session found in localStorage. Access granted.');
        return;
    }

    // Not logged in (or session not yet restored from cookies):
    // Enter CHECKING state. Hide the browser from painting any protected
    // markup while we wait for the async session restoration to finish.
    console.log('[AuthGuard] No session in localStorage. Entering CHECKING state...');

    try {
        document.documentElement.style.display = 'none';
    } catch (e) { /* no-op */ }

    window.resolveTravelBuddyAuth = function (authenticated) {
        if (window.TravelBuddyAuthChecked) return;
        window.TravelBuddyAuthChecked = true;
        clearTimeout(safetyTimeout);

        if (authenticated) {
            console.log('[AuthGuard] Async auth confirmed. Access granted.');
            document.documentElement.style.display = '';
        } else {
            console.log('[AuthGuard] Async auth denied. Redirecting to login.');
            doRedirect();
        }
    };

    var safetyTimeout = setTimeout(function () {
        if (!window.TravelBuddyAuthChecked) {
            console.warn('[AuthGuard] Auth check timed out (3s). Redirecting to login.');
            doRedirect();
        }
    }, 3000);

    function doRedirect() {
        var loginUrl = guardType === 'admin' ? '../../login/login.html' : '../login/login.html';
        var returnTo = window.location.pathname + window.location.search + window.location.hash;
        var target = loginUrl + '?redirect=' + encodeURIComponent(returnTo);
        window.location.replace(target);
    }
})();
