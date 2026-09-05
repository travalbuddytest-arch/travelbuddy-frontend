/**
 * =====================================================================
 * TravelBuddy — Shared Collapsible Sidebar Controller & Tooltip Manager
 * =====================================================================
 * Handles desktop collapse/expand, localStorage preference persistence,
 * keyboard accessibility, and non-clipping floating tooltips.
 */
(function () {
  'use strict';

  // Floating tooltip singleton element
  var tooltipEl = null;

  function getTooltipEl() {
    if (!tooltipEl) {
      tooltipEl = document.getElementById('tbSidebarTooltip');
      if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.id = 'tbSidebarTooltip';
        tooltipEl.className = 'tb-sidebar-tooltip';
        tooltipEl.setAttribute('role', 'tooltip');
        tooltipEl.setAttribute('aria-hidden', 'true');
        document.body.appendChild(tooltipEl);
      }
    }
    return tooltipEl;
  }

  function showTooltip(target, text) {
    if (!text || window.innerWidth <= 900) return;
    var tt = getTooltipEl();
    tt.textContent = text;
    tt.classList.add('visible');
    tt.setAttribute('aria-hidden', 'false');

    var targetRect = target.getBoundingClientRect();
    var ttRect = tt.getBoundingClientRect();

    var top = targetRect.top + (targetRect.height - ttRect.height) / 2;
    var left = targetRect.right + 10;

    // Viewport vertical clamping
    if (top < 10) top = 10;
    if (top + ttRect.height > window.innerHeight - 10) {
      top = window.innerHeight - ttRect.height - 10;
    }

    tt.style.top = Math.round(top) + 'px';
    tt.style.left = Math.round(left) + 'px';
  }

  function hideTooltip() {
    if (tooltipEl) {
      tooltipEl.classList.remove('visible');
      tooltipEl.setAttribute('aria-hidden', 'true');
    }
  }

  function getItemLabel(item) {
    if (item.dataset && item.dataset.tooltip) {
      return item.dataset.tooltip.trim();
    }
    var title = item.getAttribute('title');
    if (title && title.trim()) {
      return title.trim();
    }
    var aria = item.getAttribute('aria-label');
    if (aria && aria.trim()) {
      return aria.trim();
    }
    // Try to find a span that is not a badge
    var span = item.querySelector('span:not(.nav-badge)');
    if (span && span.textContent.trim()) {
      return span.textContent.trim();
    }
    // Fallback: clone and remove nested badges/icons
    var clone = item.cloneNode(true);
    var removeEls = clone.querySelectorAll('i, svg, .nav-badge, em');
    for (var i = 0; i < removeEls.length; i++) {
      removeEls[i].remove();
    }
    return clone.textContent.trim();
  }

  function initTooltipSystem(sidebar, navItemSelector, collapsedClass) {
    function handleEnter(e) {
      var target = e.target.closest(navItemSelector) || e.target.closest('.sidebar-toggle');
      if (!target || !sidebar.contains(target)) return;

      var isCollapsed = document.body.classList.contains(collapsedClass);
      var isToggle = target.classList.contains('sidebar-toggle');

      // Only show tooltip for nav items if sidebar is collapsed.
      // Toggle button always shows tooltip on desktop.
      if (!isCollapsed && !isToggle) return;
      if (window.innerWidth <= 900) return;

      var text = isToggle
        ? (isCollapsed ? 'Expand sidebar' : 'Collapse sidebar')
        : getItemLabel(target);

      if (text) {
        showTooltip(target, text);
      }
    }

    function handleLeave(e) {
      var target = e.target.closest(navItemSelector) || e.target.closest('.sidebar-toggle');
      if (target) {
        hideTooltip();
      }
    }

    sidebar.addEventListener('mouseenter', handleEnter, true);
    sidebar.addEventListener('mouseleave', handleLeave, true);
    sidebar.addEventListener('focusin', handleEnter, true);
    sidebar.addEventListener('focusout', handleLeave, true);
    window.addEventListener('scroll', hideTooltip, { passive: true });
  }

  /**
   * Initialize a collapsible sidebar instance.
   */
  function init(options) {
    var sidebarId = options.sidebarId;
    var toggleBtnId = options.toggleBtnId;
    var storageKey = options.storageKey;
    var navItemSelector = options.navItemSelector || '.nav-item, nav button';
    var collapsedClass = options.collapsedClass || 'sidebar-collapsed';

    var sidebar = document.getElementById(sidebarId);
    var toggleBtn = document.getElementById(toggleBtnId);
    if (!sidebar || !toggleBtn) return null;

    function isDesktop() {
      return window.innerWidth > 900;
    }

    function getStoredPreference() {
      try {
        return localStorage.getItem(storageKey) === 'true';
      } catch (e) {
        return false;
      }
    }

    function setStoredPreference(val) {
      try {
        localStorage.setItem(storageKey, val ? 'true' : 'false');
      } catch (e) {}
    }

    function updateToggleUI(collapsed) {
      toggleBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      var label = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
      toggleBtn.setAttribute('aria-label', label);
      toggleBtn.setAttribute('title', label);
      toggleBtn.dataset.tooltip = label;

      var icon = toggleBtn.querySelector('i');
      if (icon) {
        if (collapsed) {
          icon.classList.remove('fa-chevron-left');
          icon.classList.add('fa-chevron-right');
        } else {
          icon.classList.remove('fa-chevron-right');
          icon.classList.add('fa-chevron-left');
        }
      }
    }

    function applyState(collapsed, save) {
      if (isDesktop()) {
        document.body.classList.toggle(collapsedClass, collapsed);
        document.documentElement.classList.toggle(collapsedClass, collapsed);
      } else {
        document.body.classList.remove(collapsedClass);
        document.documentElement.classList.remove(collapsedClass);
      }

      updateToggleUI(collapsed && isDesktop());
      if (save) setStoredPreference(collapsed);
      hideTooltip();

      // Dispatch resize event so charts, maps, and tables reflow smoothly
      setTimeout(function () {
        window.dispatchEvent(new Event('resize'));
      }, 290);
    }

    function toggle() {
      var currentlyCollapsed = document.body.classList.contains(collapsedClass);
      applyState(!currentlyCollapsed, true);
    }

    // Apply initial state based on stored preference
    var initialPref = isDesktop() && getStoredPreference();
    applyState(initialPref, false);

    // Toggle button click listener
    toggleBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggle();
    });

    // Handle responsive resize between desktop & mobile
    var resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (!isDesktop()) {
          document.body.classList.remove(collapsedClass);
          document.documentElement.classList.remove(collapsedClass);
          hideTooltip();
        } else {
          var pref = getStoredPreference();
          document.body.classList.toggle(collapsedClass, pref);
          document.documentElement.classList.toggle(collapsedClass, pref);
          updateToggleUI(pref);
        }
      }, 120);
    });

    // Initialize tooltip system
    initTooltipSystem(sidebar, navItemSelector, collapsedClass);

    return {
      toggle: toggle,
      applyState: applyState,
      isCollapsed: function () {
        return document.body.classList.contains(collapsedClass);
      }
    };
  }

  window.TravelBuddySidebarCollapse = {
    init: init,
    showTooltip: showTooltip,
    hideTooltip: hideTooltip
  };
})();
