// =========================================================
// TravelBuddy — About Page
// =========================================================

const abReduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ============ SCROLL REVEAL ============ */
const abRevealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, idx) => {
        if (entry.isIntersecting) {
            entry.target.style.transitionDelay = Math.min(idx % 6, 5) * 0.07 + 's';
            entry.target.classList.add('ab-in-view');
            abRevealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.15 });
document.querySelectorAll('.ab-reveal').forEach(el => abRevealObserver.observe(el));

/* ============ ANIMATED COUNTERS ============ */
function abAnimateCounters() {
    document.querySelectorAll('.ab-count').forEach(el => {
        const target = parseFloat(el.dataset.count);
        const suffix = el.dataset.suffix || '';
        const decimals = parseInt(el.dataset.decimal || '0', 10);

        if (abReduceMotion) { el.textContent = target.toFixed(decimals) + suffix; return; }

        let cur = 0;
        const steps = 36;
        const increment = target / steps;
        let step = 0;
        const iv = setInterval(() => {
            step++;
            cur += increment;
            if (step >= steps) { cur = target; clearInterval(iv); }
            el.textContent = cur.toFixed(decimals) + suffix;
        }, 28);
    });
}

const abStatsEl = document.querySelector('.ab-stats');
if (abStatsEl) {
    const abStatsObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => { if (entry.isIntersecting) { abAnimateCounters(); abStatsObserver.disconnect(); } });
    }, { threshold: 0.4 });
    abStatsObserver.observe(abStatsEl);
}
