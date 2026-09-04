// =========================================================
// Shared Navbar/Footer include loader (Hybrid Version)
// -----------------------------------------------------------------------
// This script handles the "Hybrid" approach:
// 1. If the page already has hardcoded HTML with data-v="6", it SKIPS injection
//    to avoid layout shift and wasted network requests.
// 2. It then ensures the behavior (JS) is initialized.
// 3. If HTML is missing or outdated, it fetches and injects it.
// =========================================================
(function () {
    'use strict';

    var CURRENT_NAV_V = '7';
    var CURRENT_FOOTER_V = '6';
    var CURRENT_V = CURRENT_NAV_V;
    var basePath = '/shared/';

    async function inject(placeholderId, url, type) {
        var el = document.getElementById(placeholderId);
        if (!el) return;

        var targetVersion = (type === 'footer') ? CURRENT_FOOTER_V : CURRENT_NAV_V;

        // Find existing component: either nested inside el or as an immediate sibling
        var existing = (type === 'navbar')
            ? (el.querySelector('.tb-nav-header') || (el.nextElementSibling && el.nextElementSibling.classList.contains('tb-nav-header') ? el.nextElementSibling : null))
            : (el.querySelector('.site-footer') || (el.nextElementSibling && el.nextElementSibling.classList.contains('site-footer') ? el.nextElementSibling : null));

        // Check if already hardcoded with correct version
        if (existing && existing.getAttribute('data-v') === targetVersion) {
            // console.log('[nav-include] skipping injection for', type, '- version match');
            if (type === 'navbar' && window.TBNav && typeof window.TBNav.init === 'function') {
                window.TBNav.init();
            }
            highlightActiveLink();
            return;
        }

        try {
            const response = await fetch(url + '?v=' + targetVersion);
            if (response.ok) {
                const html = await response.text();

                // If an outdated existing navbar/footer was a sibling outside el, clean it up to avoid duplicates
                if (existing && !el.contains(existing)) {
                    if (type === 'navbar') {
                        var nextSib = existing.nextElementSibling;
                        if (nextSib && (nextSib.id === 'navOverlay' || nextSib.classList.contains('nav-overlay'))) {
                            nextSib.remove();
                        }
                    }
                    existing.remove();
                }

                el.outerHTML = html;

                if (type === 'navbar') {
                    if (window.TBNav && typeof window.TBNav.init === 'function') {
                        window.TBNav.init();
                    }
                }

                if (type === 'footer') {
                    if (typeof applyHomeFooterAnchorFix === 'function') {
                        applyHomeFooterAnchorFix();
                    }
                }

                highlightActiveLink();
            }
        } catch (e) {
            console.error('[nav-include] failed to load', url, e);
        }
    }

    function highlightActiveLink() {
        var currentPage = document.body.getAttribute('data-page');
        if (currentPage) {
            var links = document.querySelectorAll('#mainNav a[data-page]');
            for (var i = 0; i < links.length; i++) {
                if (links[i].getAttribute('data-page') === currentPage) {
                    links[i].classList.add('active');
                }
            }
        }
    }

    // Load shared assets for Security & AI
    function loadAsset(url, type) {
        if (type === 'css') {
            if (!document.querySelector(`link[href="${url}"]`)) {
                var link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = url;
                document.head.appendChild(link);
            }
        } else {
            if (!document.querySelector(`script[src="${url}"]`)) {
                var script = document.createElement('script');
                script.src = url;
                script.defer = true;
                document.body.appendChild(script);
            }
        }
    }

    // Initialize Navbar
    inject('tbNavbarInclude', basePath + 'public-navbar.html', 'navbar');

    // Global App Promotion Banner
    function initAppPromoBanner() {
        var DISMISSED_KEY = 'travelbuddy_app_promo_dismissed';
        var ALLOWED_PAGES = ['home', 'about', 'support', 'contact'];
        var currentPage = document.body.getAttribute('data-page');

        if (localStorage.getItem(DISMISSED_KEY) === 'true') return;
        if (ALLOWED_PAGES.indexOf(currentPage) === -1) return;

        loadAsset(basePath + 'app-promo-bar.css', 'css');

        var installUrl = (currentPage === 'home') ? '#appPromotionSection' : '/index.html#appPromotionSection';

        var bannerHtml = `
            <div class="tb-app-promo-bar" id="appPromoBanner">
                <div class="tb-promo-content">
                    <div class="tb-promo-icon" aria-hidden="true">
                        <i class="fa-solid fa-gift"></i>
                    </div>
                    <div class="tb-promo-text">
                        <span class="tb-promo-title">🎉 Post Your First 2 Parcels for FREE!</span>
                        <span class="tb-promo-subtitle">Download the TravelBuddy App and unlock your free parcel posts.</span>
                    </div>
                    <div class="tb-promo-actions">
                        <a href="${installUrl}" class="tb-promo-install-btn">Install App</a>
                        <button type="button" class="tb-promo-close" id="closeAppPromo" aria-label="Close app promotion">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('afterbegin', bannerHtml);
        document.body.classList.add('has-app-promo-bar');

        var closeBtn = document.getElementById('closeAppPromo');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                var banner = document.getElementById('appPromoBanner');
                if (banner) banner.remove();
                document.body.classList.remove('has-app-promo-bar');
                localStorage.setItem(DISMISSED_KEY, 'true');
            });
        }
    }

    // Run after a short delay to ensure body is ready
    setTimeout(initAppPromoBanner, 0);

    // Premium Background Injection
    setTimeout(function injectBackground() {
        if (document.querySelector('.tb-bg-system')) return;
        const bgEl = document.createElement('div');
        bgEl.className = 'tb-bg-system';
        bgEl.innerHTML = `
            <div class="tb-bg-layer-base"></div>
            <div class="tb-bg-orb tb-bg-orb-1"></div>
            <div class="tb-bg-orb tb-bg-orb-2"></div>
            <div class="tb-bg-orb tb-bg-orb-3"></div>
            <svg class="tb-bg-route-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path d="M-10,50 Q25,20 50,50 T110,50" fill="none" stroke-width="0.05" />
                <path d="M-10,30 Q30,60 60,30 T110,30" fill="none" stroke-width="0.03" />
            </svg>
            <div class="tb-bg-shape" style="width:100px; height:100px; top:20%; left:10%; border-width:0.5px;"></div>
            <div class="tb-bg-shape" style="width:150px; height:150px; bottom:15%; right:20%; border-width:0.3px; border-style:dashed;"></div>
        `;
        document.body.prepend(bgEl);
    }, 0);

    loadAsset(basePath + 'toast.css', 'css');
    loadAsset(basePath + 'toast.js', 'js');
    loadAsset(basePath + 'ai-assistant.css', 'css');
    loadAsset(basePath + 'ai-assistant.js', 'js');
    loadAsset(basePath + 'nav-dropdown.js', 'js');
    loadAsset(basePath + 'nav-basic-behavior.js', 'js');

    window.TBInclude = {
        injectFooter: function () {
            inject('tbFooterInclude', basePath + 'footer.html', 'footer');
        }
    };

    function applyHomeFooterAnchorFix() {
        var currentPage = document.body.getAttribute('data-page');
        if (currentPage !== 'home') return;
        var homeFooterLinks = document.querySelectorAll(
            '.footer-column a[href$="index.html#how-it-works"], .footer-column a[href$="index.html#safety"]'
        );
        for (var j = 0; j < homeFooterLinks.length; j++) {
            var href = homeFooterLinks[j].getAttribute('href');
            if (href.indexOf('#') !== -1) {
                var hash = href.split('#')[1];
                homeFooterLinks[j].setAttribute('href', '#' + hash);
            }
        }
    }
})();
