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

    window.TBNav = {
        init: function() {
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
                // Remove old listeners to avoid duplicates
                var newToggle = menuToggle.cloneNode(true);
                menuToggle.parentNode.replaceChild(newToggle, menuToggle);
                menuToggle = newToggle;

                menuToggle.addEventListener('click', function () {
                    var isOpen = mainNav.classList.toggle('active');
                    menuToggle.classList.toggle('active', isOpen);
                    document.body.classList.toggle('nav-open', isOpen);
                    if (navOverlay) navOverlay.classList.toggle('active', isOpen);
                    menuToggle.setAttribute('aria-expanded', String(isOpen));
                });

                mainNav.querySelectorAll('a, button').forEach(function (link) {
                    if (link.id === 'homeUserTrigger') return;
                    link.addEventListener('click', closeMobileNav);
                });

                if (navOverlay) {
                    var newOverlay = navOverlay.cloneNode(true);
                    navOverlay.parentNode.replaceChild(newOverlay, navOverlay);
                    navOverlay = newOverlay;
                    navOverlay.addEventListener('click', closeMobileNav);
                }

                window.addEventListener('resize', function () {
                    if (window.innerWidth > 768) closeMobileNav();
                });
            }

            // ---- Shadow on scroll ----
            var navHeaderEl = document.querySelector('.tb-nav-header');
            var navShadowTicking = false;
            function updateNavShadow() {
                if (navHeaderEl) {
                    navHeaderEl.classList.toggle('is-scrolled', window.scrollY > 40);
                }
                navShadowTicking = false;
            }
            window.removeEventListener('scroll', updateNavShadow);
            window.addEventListener('scroll', function () {
                if (!navShadowTicking) {
                    navShadowTicking = true;
                    requestAnimationFrame(updateNavShadow);
                }
            }, { passive: true });

            // ---- Guest vs logged-in chip ----
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
                return (((user.firstName || '') + ' ' + (user.lastName || '')).trim()) || user.name || 'TravelBuddy';
            }
            function initials(name) {
                return name.split(/\s+/).filter(Boolean).slice(0, 2).map(function (p) { return p[0].toUpperCase(); }).join('') || 'TB';
            }
            function renderNavbarAvatar(avatarEl, user, name) {
                if (!avatarEl) return;
                var photo = user?.profilePhoto || '';
                avatarEl.style.backgroundImage = '';
                avatarEl.querySelectorAll('img.tb-profile-photo').forEach(function (img) { img.remove(); });
                if (photo) {
                    avatarEl.textContent = '';
                    var img = document.createElement('img');
                    img.className = 'tb-profile-photo';
                    var apiOrigin = window.APP_CONFIG?.API_BASE_URL || 'https://travelbuddy-backend-19l6.onrender.com';
                    var photoUrl = photo.startsWith('data:') || photo.startsWith('http')
                        ? photo
                        : (photo.startsWith('/') ? apiOrigin + photo : apiOrigin + '/' + photo);
                    img.src = photoUrl;
                    img.alt = 'Profile photo';
                    img.style.cssText = 'width:100%;height:100%;display:block;object-fit:cover;border-radius:inherit;';
                    img.onerror = function () {
                        img.remove();
                        avatarEl.style.overflow = '';
                        avatarEl.textContent = initials(name);
                    };
                    avatarEl.appendChild(img);
                    avatarEl.style.overflow = 'hidden';
                    avatarEl.classList.add('has-photo');
                } else {
                    avatarEl.style.overflow = '';
                    avatarEl.classList.remove('has-photo');
                    avatarEl.textContent = initials(name);
                }
            }

            function render(user) {
                var nameEl = document.getElementById('homeUserName');
                var avatarEl = document.getElementById('homeAvatar');
                var name = fullName(user);
                if (nameEl) nameEl.textContent = name;
                renderNavbarAvatar(avatarEl, user, name);
            }

            var isAdmin = Boolean(localStorage.getItem('travelBuddyAdmin'));
            var isUser = Boolean(localStorage.getItem('travelBuddyUser'));

            var navSupportLink = document.getElementById('navSupportLink');
            if (navSupportLink) {
                navSupportLink.hidden = !isAdmin && !isUser;
            }

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
                    if (document.getElementById('homeUserName')) document.getElementById('homeUserName').textContent = adminName;
                    var avatarEl = document.getElementById('homeAvatar');
                    renderNavbarAvatar(avatarEl, admin, adminName);
                    if (roleEl) roleEl.textContent = admin.role ? admin.role.charAt(0).toUpperCase() + admin.role.slice(1) : 'Admin';
                    if (dashboardLink) dashboardLink.href = '/admin_dashboard/html/admin.html';
                    if (dashboardLinkLabel) dashboardLinkLabel.textContent = 'Admin Dashboard';
                } else {
                    render(readUser());
                    if (roleEl) roleEl.textContent = 'Sender & Traveler';
                    if (dashboardLink) dashboardLink.href = '/user-dashboard/overview.html';
                    if (dashboardLinkLabel) dashboardLinkLabel.textContent = 'Dashboard';
                }
            }

            if (trigger) {
                var newTrigger = trigger.cloneNode(true);
                trigger.parentNode.replaceChild(newTrigger, trigger);
                trigger = newTrigger;
                trigger.addEventListener('click', function (event) {
                    event.stopPropagation();
                    var open = chip.classList.toggle('open');
                    trigger.setAttribute('aria-expanded', String(open));
                });
            }

            menu && menu.addEventListener('click', function (event) { event.stopPropagation(); });

            document.removeEventListener('click', window._tbNavClickHandler);
            window._tbNavClickHandler = function () {
                chip.classList.remove('open');
                trigger && trigger.setAttribute('aria-expanded', 'false');
            };
            document.addEventListener('click', window._tbNavClickHandler);

            document.addEventListener('keydown', function (event) {
                if (event.key === 'Escape') {
                    closeMobileNav();
                    chip.classList.remove('open');
                    trigger && trigger.setAttribute('aria-expanded', 'false');
                }
            });

            if (logoutBtn) {
                logoutBtn.addEventListener('click', function () {
                    if (localStorage.getItem('travelBuddyAdmin')) {
                        if (window.TravelBuddyAuth && typeof window.TravelBuddyAuth.logoutAdmin === 'function') {
                            window.TravelBuddyAuth.logoutAdmin().finally(function () { window.location.href = '/'; });
                        } else {
                            localStorage.removeItem('travelBuddyAdmin');
                            localStorage.removeItem('travelBuddyAdminToken');
                            window.location.href = '/';
                        }
                        return;
                    }
                    localStorage.removeItem('travelBuddyUser');
                    window.location.href = '/';
                });
            }

            var dashboardUrl = isAdmin ? '/admin_dashboard/html/admin.html' : '/user-dashboard/overview.html';
            profileBtn && profileBtn.addEventListener('click', function () { window.location.href = dashboardUrl; });
            settingsBtn && settingsBtn.addEventListener('click', function () { window.location.href = dashboardUrl; });
        }
    };

    // Auto-init if DOM is already ready
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        window.TBNav.init();
    } else {
        document.addEventListener('DOMContentLoaded', window.TBNav.init);
    }
})();
