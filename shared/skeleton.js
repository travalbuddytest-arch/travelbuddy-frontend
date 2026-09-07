/**
 * TravelBuddy — Skeleton Utility
 */
(function() {
  'use strict';

  const TEMPLATES = {
    text: (w = '100%') => `<div class="tb-skeleton tb-skeleton-text" style="width: ${w}"></div>`,
    title: (w = '60%') => `<div class="tb-skeleton tb-skeleton-title" style="width: ${w}"></div>`,
    circle: (s = '40px') => `<div class="tb-skeleton tb-skeleton-circle" style="width: ${s}; height: ${s}"></div>`,

    kpi: () => `
      <div class="tb-skeleton-kpi">
        <div class="tb-skeleton tb-skeleton-circle" style="width:46px; height:46px"></div>
        <div style="flex:1">
          <div class="tb-skeleton" style="width:40%; height:22px; border-radius:6px; margin-bottom:6px"></div>
          <div class="tb-skeleton" style="width:70%; height:14px; border-radius:4px"></div>
        </div>
      </div>
    `,

    'table-row': (cols = 4) => `
      <div class="tb-skeleton-table-row">
        ${Array(cols).fill(0).map(() => `<div class="tb-skeleton" style="flex:1; height:14px; border-radius:4px"></div>`).join('')}
      </div>
    `,

    'list-item': () => `
      <div class="tb-skeleton-list-item">
        <div class="tb-skeleton tb-skeleton-circle" style="width:34px; height:34px"></div>
        <div style="flex:1">
          <div class="tb-skeleton" style="width:60%; height:14px; border-radius:4px; margin-bottom:6px"></div>
          <div class="tb-skeleton" style="width:30%; height:10px; border-radius:3px"></div>
        </div>
      </div>
    `,

    card: () => `
      <div class="panel" style="padding:22px">
        <div class="tb-skeleton" style="width:100%; aspect-ratio:16/9; border-radius:12px; margin-bottom:16px"></div>
        <div class="tb-skeleton tb-skeleton-title"></div>
        <div class="tb-skeleton tb-skeleton-text"></div>
        <div class="tb-skeleton tb-skeleton-text" style="width:80%"></div>
      </div>
    `,

    'parcel-details': () => `
      <div class="details-head" style="margin-bottom:24px">
        <div class="tb-skeleton" style="width:200px; height:28px; margin-bottom:12px"></div>
        <div style="display:flex; gap:10px">
          <div class="tb-skeleton" style="width:80px; height:22px; border-radius:20px"></div>
          <div class="tb-skeleton" style="width:120px; height:22px; border-radius:20px"></div>
        </div>
      </div>
      <div class="panel-grid">
        <div class="panel">
          <div class="tb-skeleton-title" style="width:40%"></div>
          <div style="display:flex; flex-direction:column; gap:12px">
             ${Array(4).fill(0).map(() => `
               <div style="display:flex; justify-content:space-between">
                 <div class="tb-skeleton" style="width:30%; height:14px"></div>
                 <div class="tb-skeleton" style="width:40%; height:14px"></div>
               </div>
             `).join('')}
          </div>
        </div>
        <div class="panel">
          <div class="tb-skeleton-title" style="width:40%"></div>
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px">
            <div class="tb-skeleton tb-skeleton-circle" style="width:48px; height:48px"></div>
            <div style="flex:1">
              <div class="tb-skeleton" style="width:50%; height:16px; margin-bottom:6px"></div>
              <div class="tb-skeleton" style="width:30%; height:12px"></div>
            </div>
          </div>
          <div class="tb-skeleton" style="width:100%; height:44px; border-radius:8px"></div>
        </div>
      </div>
    `,

    tracking: () => `
      <div style="max-width:600px; margin:0 auto">
        <div class="tb-skeleton" style="width:100%; height:300px; border-radius:16px; margin-bottom:24px"></div>
        <div class="panel">
           <div class="tb-skeleton-title"></div>
           <div style="display:flex; flex-direction:column; gap:20px; padding:10px">
              ${Array(4).fill(0).map(() => `
                <div style="display:flex; gap:16px">
                  <div class="tb-skeleton tb-skeleton-circle" style="width:12px; height:12px; margin-top:4px"></div>
                  <div style="flex:1">
                    <div class="tb-skeleton" style="width:40%; height:14px; margin-bottom:4px"></div>
                    <div class="tb-skeleton" style="width:70%; height:10px"></div>
                  </div>
                </div>
              `).join('')}
           </div>
        </div>
      </div>
    `,

    map: () => `<div class="tb-skeleton-map tb-skeleton"></div>`
  };

  window.TravelBuddySkeleton = {
    render(type, count = 1, params = []) {
      const template = TEMPLATES[type];
      if (!template) return '';
      return Array(count).fill(0).map(() => template(...params)).join('');
    },

    show(container, type, count = 1, params = []) {
      const el = typeof container === 'string' ? document.querySelector(container) : container;
      if (!el) return;

      // Save original content if not already saved
      if (!el.dataset.skeletonOriginal) {
        el.dataset.skeletonOriginal = el.innerHTML;
      }

      el.setAttribute('aria-busy', 'true');
      el.innerHTML = this.render(type, count, params);
    },

    hide(container) {
      const el = typeof container === 'string' ? document.querySelector(container) : container;
      if (!el) return;

      el.removeAttribute('aria-busy');
      if (el.dataset.skeletonOriginal !== undefined) {
        el.innerHTML = el.dataset.skeletonOriginal;
        delete el.dataset.skeletonOriginal;
      }
    },

    /**
     * Replaces an image with a skeleton until it loads
     */
    handleImage(img) {
      if (img.complete) return;

      const parent = img.parentElement;
      if (!parent) return;

      const skeleton = document.createElement('div');
      skeleton.className = 'tb-skeleton tb-skeleton-rect';
      skeleton.style.position = 'absolute';
      skeleton.style.inset = '0';
      skeleton.style.zIndex = '2';

      // Ensure parent is positioned
      if (getComputedStyle(parent).position === 'static') {
        parent.style.position = 'relative';
      }

      parent.appendChild(skeleton);

      img.style.opacity = '0';
      img.style.transition = 'opacity 0.3s ease';

      const cleanup = () => {
        skeleton.style.opacity = '0';
        img.style.opacity = '1';
        setTimeout(() => skeleton.remove(), 300);
      };

      img.addEventListener('load', cleanup);
      img.addEventListener('error', cleanup);
    },

    init() {
       document.querySelectorAll('img[data-skeleton="true"]').forEach(img => this.handleImage(img));
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.TravelBuddySkeleton.init());
  } else {
    window.TravelBuddySkeleton.init();
  }
})();
