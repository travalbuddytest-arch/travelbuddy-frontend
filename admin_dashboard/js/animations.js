/* ============================================================
   TravelBuddy Admin — small, safe animation helper.
   Adds a click ripple to every button on the dashboard (sidebar,
   header, cards, modals, lazy-loaded pages — all of it, since
   this listens on the document and works for buttons that don't
   exist yet). Purely visual: it never touches app logic or data.
   ============================================================ */
(function () {
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var rect = btn.getBoundingClientRect();
    // Buttons with static/relative positioning already; make sure ripple clips.
    var computed = window.getComputedStyle(btn);
    if (computed.position === 'static') btn.style.position = 'relative';
    if (computed.overflow !== 'hidden') btn.style.overflow = 'hidden';

    var size = Math.max(rect.width, rect.height);
    var ripple = document.createElement('span');
    ripple.className = 'tb-ripple';
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';

    btn.appendChild(ripple);
    window.setTimeout(function () {
      ripple.remove();
    }, 650);
  });
})();
