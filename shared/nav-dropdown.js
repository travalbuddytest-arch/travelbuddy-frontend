// =========================================================
// TravelBuddy — Navbar Dropdown Menu Handler
// ---------------------------------------------------------
// Handles Help dropdown menu toggle and accessibility
// =========================================================
(function () {
    'use strict';

    function initDropdown() {
        var helpTrigger = document.getElementById('helpTrigger');
        var helpMenu = document.getElementById('helpMenu');
        var helpDropdown = document.getElementById('helpDropdown');

        if (!helpTrigger || !helpMenu) return;

        // Toggle dropdown on trigger click
        helpTrigger.addEventListener('click', function (e) {
            e.stopPropagation();
            var isExpanded = helpTrigger.getAttribute('aria-expanded') === 'true';
            helpTrigger.setAttribute('aria-expanded', !isExpanded);
        });

        // Close dropdown when clicking a menu item
        var menuItems = helpMenu.querySelectorAll('a');
        menuItems.forEach(function (item) {
            item.addEventListener('click', function () {
                helpTrigger.setAttribute('aria-expanded', 'false');
            });
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', function (e) {
            if (helpDropdown && !helpDropdown.contains(e.target)) {
                helpTrigger.setAttribute('aria-expanded', 'false');
            }
        });

        // Close dropdown on Escape key
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' || e.key === 'Esc') {
                helpTrigger.setAttribute('aria-expanded', 'false');
            }
        });

        // Close dropdown when mobile menu closes
        var menuToggle = document.getElementById('menuToggle');
        if (menuToggle) {
            menuToggle.addEventListener('click', function () {
                helpTrigger.setAttribute('aria-expanded', 'false');
            });
        }
    }

    // Wait for navbar to be injected before initializing dropdown
    if (document.getElementById('helpTrigger')) {
        initDropdown();
    } else {
        document.addEventListener('DOMContentLoaded', function () {
            setTimeout(initDropdown, 100);
        });
    }
})();
