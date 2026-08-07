// =========================================================
// Shared navbar behavior for pages that do NOT already load home/script.js
// (currently only used by Support).
//
// Home and About must NOT include this file — they already get identical
// behavior (mobile menu, scroll shadow, guest/login chip, logout) from
// home/script.js, which is left completely untouched by this refactor.
//
// Must load AFTER shared/nav-include.js (so #mainNav etc. already exist)
// and after shared/auth-cookie-client.js (for window.TravelBuddyAuth).
// =========================================================
(function () {
    'use strict';

    // ---- Mobile menu toggle ----
    var menuToggle = document.getElementById('menuToggle');
    var mainNav = document.getElementById('mainNav');
    var navOverlay = document.getElementById('navOverlay');

    function closeMobileNav() {
        if (menuToggle) menuToggle.classList.remove('active');
        if (mainNav) mainNav.classList.remove('active');
        document.body.classList.remove('nav-open');
        if (navOverlay) navOverlay.classList.remove('active');
        if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
    }

    if (menuToggle && mainNav) {
        menuToggle.addEventListener('click', function () {
            var isOpen = mainNav.classList.toggle('active');
            menuToggle.classList.toggle('active', isOpen);
            document.body.classList.toggle('nav-open', isOpen);
            if (navOverlay) navOverlay.classList.toggle('active', isOpen);
            menuToggle.setAttribute('aria-expanded', String(isOpen));
        });

        mainNav.querySelectorAll('a, button').forEach(function (link) {
            // The profile chip trigger only opens its own dropdown - it must
            // not also collapse the mobile nav panel that dropdown lives in
            // (see home/script.js for the full explanation of this bug).
            if (link.id === 'homeUserTrigger') return;
            link.addEventListener('click', closeMobileNav);
        });

        if (navOverlay) navOverlay.addEventListener('click', closeMobileNav);

        window.addEventListener('resize', function () {
            if (window.innerWidth > 768) closeMobileNav();
        });
    }

    // ---- Shadow on scroll ----
    window.addEventListener('scroll', function () {
        var header = document.querySelector('.tb-nav-header');
        if (!header) return;
        header.style.boxShadow = window.scrollY > 40
            ? '0 8px 30px rgba(0,0,0,.12)'
            : '0 2px 12px rgba(0,0,0,.08)';
    });

    // ---- Guest vs logged-in chip (same logic/logic source as home/script.js) ----
    var guestActions = document.getElementById('guestNavActions');
    var chip = document.getElementById('homeUserChip');
    var trigger = document.getElementById('homeUserTrigger');
    var menu = document.getElementById('homeUserMenu');
    var logoutBtn = document.getElementById('homeLogoutBtn');
    var profileBtn = document.getElementById('homeProfileBtn');
    var settingsBtn = document.getElementById('homeSettingsBtn');

    if (!guestActions || !chip) return;

    function readUser() {
        try { return JSON.parse(localStorage.getItem('travelBuddyUser') || '{}'); }
        catch (e) { return {}; }
    }
    function readAdmin() {
        try { return JSON.parse(localStorage.getItem('travelBuddyAdmin') || '{}'); }
        catch (e) { return {}; }
    }
    function fullName(user) {
        return (((user.firstName || '') + ' ' + (user.lastName || '')).trim()) || user.name || 'Travel Buddy';
    }
    function initials(name) {
        return name.split(/\s+/).filter(Boolean).slice(0, 2).map(function (p) { return p[0].toUpperCase(); }).join('') || 'TB';
    }
    function render(user) {
        var nameEl = document.getElementById('homeUserName');
        var avatarEl = document.getElementById('homeAvatar');
        var name = fullName(user);
        if (nameEl) nameEl.textContent = name;
        if (avatarEl) avatarEl.textContent = initials(name);
    }

    var isAdmin = Boolean(localStorage.getItem('travelBuddyAdmin'));
    var isUser = Boolean(localStorage.getItem('travelBuddyUser'));

    if (!isAdmin && !isUser) {
        guestActions.hidden = false;
        chip.hidden = true;
    } else {
        guestActions.hidden = true;
        chip.hidden = false;
        var roleEl = document.getElementById('homeUserRole');
        var dashboardLink = document.getElementById('homeDashboardLink');
        var dashboardLinkLabel = document.getElementById('homeDashboardLinkLabel');
        if (isAdmin) {
            var admin = readAdmin();
            var adminName = fullName(admin) || admin.name || 'Admin';
            document.getElementById('homeUserName').textContent = adminName;
            document.getElementById('homeAvatar').textContent = initials(adminName) || 'AD';
            // Admin accounts aren't senders/travelers — label them correctly and
            // send "Dashboard" to the admin control center instead of the
            // regular user dashboard.
            if (roleEl) roleEl.textContent = admin.role ? admin.role.charAt(0).toUpperCase() + admin.role.slice(1) : 'Admin';
            if (dashboardLink) dashboardLink.href = '../admin_dashboard/html/admin.html';
            if (dashboardLinkLabel) dashboardLinkLabel.textContent = 'Admin Dashboard';
        } else {
            render(readUser());
            if (roleEl) roleEl.textContent = 'Sender & Traveler';
            if (dashboardLink) dashboardLink.href = '../user-dashboard/overview.html';
            if (dashboardLinkLabel) dashboardLinkLabel.textContent = 'Dashboard';
        }
    }

    trigger && trigger.addEventListener('click', function (event) {
        event.stopPropagation();
        var open = chip.classList.toggle('open');
        trigger.setAttribute('aria-expanded', String(open));
    });
    menu && menu.addEventListener('click', function (event) { event.stopPropagation(); });
    document.addEventListener('click', function () {
        chip.classList.remove('open');
        trigger && trigger.setAttribute('aria-expanded', 'false');
    });
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            chip.classList.remove('open');
            trigger && trigger.setAttribute('aria-expanded', 'false');
        }
    });

    logoutBtn && logoutBtn.addEventListener('click', function () {
        if (localStorage.getItem('travelBuddyAdmin')) {
            if (window.TravelBuddyAuth && typeof window.TravelBuddyAuth.logoutAdmin === 'function') {
                window.TravelBuddyAuth.logoutAdmin().finally(function () { window.location.href = '../home/index.html'; });
            } else {
                localStorage.removeItem('travelBuddyAdmin');
                localStorage.removeItem('travelBuddyAdminToken');
                window.location.href = '../home/index.html';
            }
            return;
        }
        localStorage.removeItem('travelBuddyUser');
        window.location.href = '../home/index.html';
    });

    // This page has no profile/settings modal (unlike Home), so send the
    // user to their dashboard instead of doing nothing.
    // BUG FIX: this used to be hardcoded to the user dashboard even when an
    // admin was logged in. The user dashboard's auth guard has no admin
    // session to check against, so it immediately bounced the admin back to
    // the login page - "My Profile"/"Settings" looked completely broken for
    // admins. Route based on which account is actually logged in instead.
    var dashboardUrl = isAdmin ? '../admin_dashboard/html/admin.html' : '../user-dashboard/overview.html';
    profileBtn && profileBtn.addEventListener('click', function () { window.location.href = dashboardUrl; });
    settingsBtn && settingsBtn.addEventListener('click', function () { window.location.href = dashboardUrl; });
})();
