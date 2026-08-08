// =========================================================
// TravelBuddy — Public page CTA auth routing
// ---------------------------------------------------------
// Public SEO pages (post-parcel/, send-parcel/, carry-parcel/, etc.) ship
// CTA buttons that must never open the authenticated app directly to a
// logged-out visitor. Markup default: href="../login/login.html".
//
// Usage:
//   <a class="seo-btn seo-btn-primary" href="../login/login.html"
//      data-cta-auth="../user-dashboard/post.html">Post a Parcel</a>
//
// Reuses the same 'travelBuddyToken' localStorage flag every other page
// in the app already checks (see shared/auth-guard.js, home/script.js).
// =========================================================
(function () {
    'use strict';

    function isLoggedIn() {
        try { return Boolean(localStorage.getItem('travelBuddyToken')); }
        catch (e) { return false; }
    }

    document.addEventListener('DOMContentLoaded', function () {
        var loggedIn = isLoggedIn();
        document.querySelectorAll('[data-cta-auth]').forEach(function (el) {
            if (loggedIn) {
                el.setAttribute('href', el.getAttribute('data-cta-auth'));
            }
            // Logged-out visitors keep the page's default login/register href.
        });
    });
})();
