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

    function fetchSync(url) {
        try {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, false); // synchronous by design — see note above
            xhr.send(null);
            if (xhr.status === 200 || xhr.status === 0) return xhr.responseText;
        } catch (e) {
            console.error('[nav-include] failed to load', url, e);
        }
        return '';
    }

    function inject(placeholderId, url) {
        var el = document.getElementById(placeholderId);
        if (!el) return;
        var html = fetchSync(url);
        if (html) {
            el.outerHTML = html;
        } else {
            console.error('[nav-include] empty response for', url, '— navbar/footer will be missing. Are you running this via a local web server (not file://)?');
        }
    }

    inject('tbNavbarInclude', '../shared/navbar.html');

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

    loadAsset('../shared/toast.css', 'css');
    loadAsset('../shared/toast.js', 'js');
    loadAsset('../shared/ai-assistant.css', 'css');
    loadAsset('../shared/ai-assistant.js', 'js');

    window.TBInclude = {
        injectFooter: function () {
            inject('tbFooterInclude', '../shared/footer.html');
            applyHomeFooterAnchorFix();
        }
    };

    var currentPage = document.body.getAttribute('data-page');

    // Highlight the active nav link for the current page
    if (currentPage) {
        var links = document.querySelectorAll('#mainNav a[data-page]');
        for (var i = 0; i < links.length; i++) {
            if (links[i].getAttribute('data-page') === currentPage) {
                links[i].classList.add('active');
            }
        }
    }

    // On the Home page itself, keep the footer's "How It Works"/"Safety"
    // links as same-page anchor jumps (no full reload), exactly like the
    // original Home footer behaved. On every other page they stay as
    // cross-page links into the Home page's sections.
    function applyHomeFooterAnchorFix() {
        if (currentPage !== 'home') return;
        var homeFooterLinks = document.querySelectorAll(
            '.footer-column a[href$="index.html#how-it-works"], .footer-column a[href$="index.html#safety"]'
        );
        for (var j = 0; j < homeFooterLinks.length; j++) {
            var hash = homeFooterLinks[j].getAttribute('href').split('#')[1];
            homeFooterLinks[j].setAttribute('href', '#' + hash);
        }
    }
})();
