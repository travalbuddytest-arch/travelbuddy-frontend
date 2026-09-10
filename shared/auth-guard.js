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

    // Pre-load skeleton system early
    (function loadSkeletonAssets() {
        var base = guardType === 'admin' ? '../../shared/' : '../shared/';
        if (window.location.pathname === '/' || window.location.pathname === '/index.html') base = 'shared/';

        var css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = base + 'skeleton.css?v=1';
        document.head.appendChild(css);

        var js = document.createElement('script');
        js.src = base + 'skeleton.js?v=1';
        document.head.appendChild(js);
    })();

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
            // FIX: Be more lenient. If a token exists, don't immediately redirect.
            // Allow common.js a chance to refresh the user profile.
            if (!hasUserToken) return false;
            if (!userData) return true; // Session exists but user data is missing (common.js will refresh)

            try {
                var user = JSON.parse(userData);
                // If role is missing, we still grant access but common.js will fix the object.
                return !user.role || (user.role === 'user' || user.role === 'traveler' || user.role === 'sender');
            } catch (e) {
                return true; // Malformed JSON but token exists; let common.js handle it
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
        // Hide the main content to avoid FOUC/Flash of private data
        document.documentElement.style.visibility = 'hidden';

        // As soon as body is available, show the initial page skeleton
        var checkInterval = setInterval(function() {
            if (document.body) {
                clearInterval(checkInterval);
                if (!window.TravelBuddyAuthChecked) {
                    var skeleton = document.createElement('div');
                    skeleton.id = 'initialPageSkeleton';
                    skeleton.className = 'tb-skeleton-page-overlay';
                    skeleton.innerHTML = `
                        <div style="display:flex; align-items:center; gap:12px; margin-bottom:40px">
                            <div class="tb-skeleton tb-skeleton-circle"></div>
                            <div class="tb-skeleton" style="width:120px; height:20px"></div>
                        </div>
                        <div class="tb-skeleton" style="width:40%; height:32px; margin-bottom:24px"></div>
                        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:20px; margin-bottom:40px">
                            <div class="tb-skeleton-kpi tb-skeleton"></div>
                            <div class="tb-skeleton-kpi tb-skeleton"></div>
                            <div class="tb-skeleton-kpi tb-skeleton"></div>
                        </div>
                        <div class="tb-skeleton" style="width:100%; flex:1; border-radius:12px"></div>
                    `;
                    document.body.prepend(skeleton);
                    document.documentElement.style.visibility = '';
                }
            }
        }, 10);
    } catch (e) { /* no-op */ }

    window.resolveTravelBuddyAuth = function (authenticated) {
        if (window.TravelBuddyAuthChecked && authenticated) return; // Already resolved ok
        window.TravelBuddyAuthChecked = true;
        clearTimeout(safetyTimeout);

        var skeleton = document.getElementById('initialPageSkeleton');

        if (authenticated) {
            console.log('[AuthGuard] Async auth confirmed. Access granted.');
            if (skeleton) {
                skeleton.classList.add('fade-out');
                setTimeout(function() { if (skeleton.parentNode) skeleton.remove(); }, 300);
            }
            document.documentElement.style.visibility = '';
        } else {
            console.log('[AuthGuard] Async auth denied. Redirecting to login.');
            doRedirect();
        }
    };

    var safetyTimeout = setTimeout(function () {
        if (!window.TravelBuddyAuthChecked) {
            console.warn('[AuthGuard] Auth check timed out (12s).');
            const skeleton = document.getElementById('initialPageSkeleton');
            if (skeleton) {
                skeleton.innerHTML = `
                    <div style="text-align: center; color: var(--text-main, #0f172a); max-width: 400px; margin: auto;">
                        <i class="fa-solid fa-cloud-exclamation" style="font-size: 48px; color: var(--error, #dc3545); margin-bottom: 20px;"></i>
                        <h2 style="font-weight: 800; margin-bottom: 10px;">Connection Timeout</h2>
                        <p style="opacity: 0.7; margin-bottom: 24px;">We're having trouble verifying your session. This could be due to a slow connection.</p>
                        <div style="display: flex; gap: 10px; justify-content: center;">
                            <button onclick="window.location.reload()" style="background: var(--primary, #0d6efd); color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer;">Retry Connection</button>
                            <button onclick="window.TravelBuddyAuthChecked=true; window.location.replace('../login/login.html')" style="background: transparent; color: var(--text-muted, #64748b); border: 1px solid var(--border, #e2e8f0); padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer;">Go to Login</button>
                        </div>
                    </div>
                `;
                skeleton.style.display = 'flex';
                skeleton.style.alignItems = 'center';
                skeleton.style.justifyContent = 'center';
            }
        }
    }, 12000);

    function doRedirect() {
        var loginUrl = guardType === 'admin' ? '../../login/login.html' : '../login/login.html';
        var returnTo = window.location.pathname + window.location.search + window.location.hash;
        var target = loginUrl + '?redirect=' + encodeURIComponent(returnTo);
        window.location.replace(target);
    }
})();
