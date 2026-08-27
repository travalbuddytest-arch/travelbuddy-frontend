// =========================================================
// Shared Navbar/Footer include loader
// -----------------------------------------------------------------------
// Injects shared/navbar.html and shared/footer.html into every page so the
// markup lives in ONE place instead of being copy-pasted per page.
//
// IMPORTANT: this file must be included with a plain <script src="...">
// tag placed exactly where the old inline navbar/footer markup used to be
// (i.e. BEFORE the page's own script.js / support.js tag), and it must run
// synchronously so that by the time the page's own script runs,
// #mainNav / #menuToggle / #homeUserChip etc. already exist in the DOM
// (several existing scripts read these elements at top-level, not just
// inside DOMContentLoaded).
//
// Requires the page to be served over http(s):// (e.g. VS Code Live
// Server) — synchronous XHR to local files does not work from a
// file:// URL.
// =========================================================
(function () {
    'use strict';

    async function inject(placeholderId, url) {
        var el = document.getElementById(placeholderId);
        if (!el) return;

        try {
            const response = await fetch(url);
            if (response.ok) {
                const html = await response.text();
                el.outerHTML = html;

                // If this is the footer, we need to trigger any post-injection logic
                if (placeholderId === 'tbFooterInclude') {
                    // Re-apply fixes if needed
                    if (typeof applyHomeFooterAnchorFix === 'function') {
                        applyHomeFooterAnchorFix();
                    }
                }

                // Re-highlight active link after injection
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

    function getBasePath() {
        var scripts = document.getElementsByTagName('script');
        for (var i = 0; i < scripts.length; i++) {
            var src = scripts[i].getAttribute('src') || '';
            if (src.indexOf('nav-include.js') !== -1) {
                var prefix = src.substring(0, src.indexOf('nav-include.js'));
                return prefix || './';
            }
        }
        return '../shared/';
    }

    var basePath = getBasePath();
    var v = '4'; // Cache-buster version
    inject('tbNavbarInclude', basePath + 'navbar.html?v=' + v);

    // Premium Background Injection (Non-blocking)
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

        // Suble Parallax Effect (Desktop only)
        if (window.innerWidth > 1024 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            window.addEventListener('mousemove', (e) => {
                const x = (e.clientX / window.innerWidth - 0.5) * 10;
                const y = (e.clientY / window.innerHeight - 0.5) * 10;

                const orbs = bgEl.querySelectorAll('.tb-bg-orb');
                orbs.forEach((orb, i) => {
                    const factor = (i + 1) * 0.3;
                    orb.style.transform = `translate(${x * factor}px, ${y * factor}px)`;
                });
            });
        }
    }, 0);

    // Load shared assets for Security & AI
    function loadAsset(url, type) {
        if (type === 'css') {
            var link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = url;
            document.head.appendChild(link);
        } else {
            var script = document.createElement('script');
            script.src = url;
            script.defer = true;
            document.body.appendChild(script);
        }
    }

    loadAsset(basePath + 'toast.css', 'css');
    loadAsset(basePath + 'toast.js', 'js');
    loadAsset(basePath + 'ai-assistant.css', 'css');
    loadAsset(basePath + 'ai-assistant.js', 'js');

    window.TBInclude = {
        injectFooter: function () {
            inject('tbFooterInclude', basePath + 'footer.html?v=' + v);
        }
    };

    // On the Home page itself, keep the footer's "How It Works"/"Safety"
    // links as same-page anchor jumps (no full reload), exactly like the
    // original Home footer behaved. On every other page they stay as
    // cross-page links into the Home page's sections.
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
})();
