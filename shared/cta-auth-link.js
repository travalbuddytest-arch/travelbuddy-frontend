// =========================================================
// TravelBuddy — Public page CTA auth routing
// ---------------------------------------------------------
// DEPRECATED SHIM. The real implementation now lives in
// shared/auth-aware-cta.js, which fixes the auth-state bug this file
// had: it gated on localStorage 'carryParcelToken', a key nothing in
// the app writes any more, so isLoggedIn() was permanently false and
// every [data-cta-auth] element on the SEO pages kept its login href
// even for signed-in visitors.
//
// This shim stays in place because the SEO pages on index.html still
// load it. It contributes no behaviour of its own — it only invokes the
// shared module. New markup should use data-auth-cta instead.
//
// If the shared module is absent (script order / partial deploy), fall
// back to the old behaviour rather than leaving CTAs dead.
(function () {
    'use strict';

    if (window.CarryParcelAuthCta) {
        // auth-aware-cta.js normalises [data-cta-auth] into [data-auth-cta]
        // and rewrites hrefs on DOMContentLoaded on its own.
        return;
    }

    // Mirrors shared/auth-guard.js branch for branch, including its leniency
    // when the profile blob is missing but the login flag is present.
    function hasSession() {
        if (localStorage.getItem('carryParcelAdminLoggedIn') && localStorage.getItem('carryParcelAdmin')) return true;
        if (!localStorage.getItem('carryParcelLoggedIn')) return false;
        var userData = localStorage.getItem('carryParcelUser');
        if (!userData) return true;
        try {
            var user = JSON.parse(userData);
            var role = user && user.role;
            return !role || role === 'user' || role === 'traveler' || role === 'sender';
        } catch (e) {
            return true;
        }
    }

    function boot() {
        var loggedIn = hasSession();
        document.querySelectorAll('[data-cta-auth]').forEach(function (el) {
            if (loggedIn) {
                el.setAttribute('href', el.getAttribute('data-cta-auth'));
            }
            // Logged-out visitors keep the page's default login/register href.
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
