// =========================================================
// TravelBuddy — About Page
// =========================================================

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

/* The animated-counter block that used to live here was removed along with the
   statistics band. Every number it animated (cities covered, parcels delivered,
   percentage saved, average rating) was unverified, so the band is gone rather
   than replaced. There is no count-up behaviour left on this page. */
