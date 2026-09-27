// =========================================================
// CarryParcel — Auth-aware CTA routing for public pages
// ---------------------------------------------------------
// Public pages (about, team, support, contact, the seo-* set) are
// readable by anyone, logged in or out. But any button that would
// open the authenticated app must not drop a logged-out visitor
// straight into /user-dashboard/* — auth-guard.js would bounce them
// back to the login screen with no memory of where they were going.
//
// Usage (anchors are preferred — they work without JS and stay crawlable):
//   <a class="btn btn-primary" href="/login/login.html"
//      data-auth-cta="/user-dashboard/post.html">Post a Parcel</a>
//
// Usage (for elements that must stay <button>, e.g. inside a card widget):
//   <button class="btn btn-primary"
//      data-auth-cta="/user-dashboard/support.html">Get Help</button>
//
// Resolution:
//   logged in  -> the data-auth-cta URL
//   logged out -> /login/login.html?redirect=<encoded data-auth-cta URL>
//
// Optional: data-auth-cta-admin overrides the destination when the
// visitor holds an admin session (e.g. an admin clicking "Post a Parcel"
// should land on the admin console, not a user page they may not own).
//   <a data-auth-cta="/user-dashboard/post.html"
//      data-auth-cta-admin="/admin_dashboard/html/admin.html">Post a Parcel</a>
//
// WHY THE FLAGS ARE 'carryParcelLoggedIn' + 'carryParcelUser'
// ---------------------------------------------------------
// The older 'carryParcelToken' key is dead. Nothing in the app writes it any
// more — the only remaining references read it, plus one
// localStorage.removeItem() on logout as legacy cleanup. The live session is an
// HttpOnly 'carryparcel_session' cookie (unreadable from JS by design) mirrored
// by localStorage flags. Both parts are required because that is exactly what
// shared/auth-guard.js demands before it will render a user-dashboard page, so
// CTA routing can never disagree with the guard about whether a destination is
// reachable. See currentRole() below.
// =========================================================
(function () {
    'use strict';

    /**
     * Which dashboard, if any, the visitor may actually reach right now.
     * Mirrors hasSession() in shared/auth-guard.js branch for branch, including
     * its deliberate leniency, so the two can never disagree:
     *
     *   admin -> needs 'carryParcelAdminLoggedIn' plus an admin/superadmin blob
     *   user  -> needs 'carryParcelLoggedIn'; a missing profile blob is treated
     *            as a valid session (the guard lets common.js refresh it), while
     *            a present blob must carry a user/traveler/sender role or none
     *            at all.
     *
     * Matching the guard is the whole point. shared/nav-basic-behavior.js only
     * looks for the profile blob, so a visitor can hold 'carryParcelUser'
     * without the login flag — and auth-guard.js would bounce such a visitor
     * straight back to login, losing the destination. Over-detecting causes a
     * redirect loop; under-detecting costs one login hop.
     * @returns {'admin'|'user'|null}
     */
    function currentRole() {
        try {
            if (localStorage.getItem('carryParcelAdminLoggedIn')) {
                var adminData = localStorage.getItem('carryParcelAdmin') || localStorage.getItem('admin_user');
                if (adminData) {
                    try {
                        var admin = JSON.parse(adminData);
                        if (admin && (admin.role === 'admin' || admin.role === 'superadmin')) return 'admin';
                    } catch (e) { /* malformed — fall through to the user check */ }
                }
            }

            if (!localStorage.getItem('carryParcelLoggedIn')) return null;

            var userData = localStorage.getItem('carryParcelUser');
            if (!userData) return 'user';   // guard allows this; common.js refreshes

            try {
                var user = JSON.parse(userData);
                var role = user && user.role;
                if (!role || role === 'user' || role === 'traveler' || role === 'sender') return 'user';
                return null;
            } catch (e) {
                return 'user';               // malformed blob, flag present — same as the guard
            }
        } catch (e) {
            /* private mode / storage disabled -> treat as guest */
            return null;
        }
    }

    function isLoggedIn() {
        return currentRole() !== null;
    }

    // login.js only honours same-site relative paths under /user-dashboard/
    // and rejects everything else as a potential open redirect
    // (getSafeRedirectTarget() in login/login.js). Mirror that rule here so
    // we never build a redirect link the login page will silently discard.
    function loginUrlFor(target) {
        return /^\/user-dashboard\//.test(target)
            ? '/login/login.html?redirect=' + encodeURIComponent(target)
            : '/login/login.html';
    }

    function targetFor(el, role) {
        var userTarget = el.getAttribute('data-auth-cta');
        if (!userTarget) return null;
        if (role !== 'admin') return userTarget;
        return el.getAttribute('data-auth-cta-admin') || userTarget;
    }

    function resolve(el) {
        var role = currentRole();
        var target = targetFor(el, role);
        if (!target) return null;
        return role ? target : loginUrlFor(target);
    }

    function applyAll(root) {
        var scope = root || document;
        var nodes = scope.querySelectorAll('[data-auth-cta], [data-cta-auth]');
        for (var i = 0; i < nodes.length; i++) {
            var el = nodes[i];

            // 'data-cta-auth' is the legacy attribute still used by the SEO
            // pages on index.html; normalise it so one code path serves both.
            if (!el.getAttribute('data-auth-cta') && el.getAttribute('data-cta-auth')) {
                el.setAttribute('data-auth-cta', el.getAttribute('data-cta-auth'));
            }

            var url = resolve(el);
            if (!url) continue;

            if (el.tagName === 'A') {
                // Progressive enhancement: a real href, so the link still
                // works with JS disabled and carries meaning to crawlers.
                el.setAttribute('href', url);
            }
            el.setAttribute('data-auth-cta-resolved', 'true');
        }
    }

    // Single delegated handler in the capture phase covers <button> elements
    // (which have no href to rewrite) and keeps anchors from double-navigating
    // even when their href was already resolved above.
    function onClick(event) {
        var el = event.target && event.target.closest
            ? event.target.closest('[data-auth-cta], [data-cta-auth]')
            : null;
        if (!el) return;

        var url = resolve(el);
        if (!url) return;

        event.preventDefault();
        window.location.href = url;
    }

    window.CarryParcelAuthCta = {
        currentRole: currentRole,
        isLoggedIn: isLoggedIn,
        loginUrlFor: loginUrlFor,
        resolve: resolve,
        applyAll: applyAll
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { applyAll(); });
    } else {
        applyAll();
    }

    document.addEventListener('click', onClick, true);
})();
