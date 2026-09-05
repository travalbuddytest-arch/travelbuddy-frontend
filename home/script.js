// =========================
// TravelBuddy Landing Page
// =========================

// =========================
// Preserve Scroll Position on Refresh (no flash)
// =========================

// Save scroll position continuously
// PERF FIX: writing to sessionStorage is synchronous and relatively slow.
// Doing it on every single 'scroll' event (which can fire dozens of times
// per animation frame) was the main cause of scroll jank/lag site-wide.
// We now throttle the write to at most once per animation frame via a
// requestAnimationFrame "ticking" flag, so the expensive write happens
// ~60 times/sec at most instead of hundreds of times/sec.
let __scrollSaveTicking = false;
function __saveScrollPosition() {
    sessionStorage.setItem('scrollPosition', window.scrollY.toString());
    __scrollSaveTicking = false;
}
window.addEventListener('scroll', () => {
    if (!__scrollSaveTicking) {
        __scrollSaveTicking = true;
        requestAnimationFrame(__saveScrollPosition);
    }
}, { passive: true });

window.addEventListener('beforeunload', () => {
    sessionStorage.setItem('scrollPosition', window.scrollY.toString());
});

// Restore scroll position instantly (no animation), then reveal the page
document.addEventListener('DOMContentLoaded', () => {
    const savedScroll = sessionStorage.getItem('scrollPosition');

    if (savedScroll !== null) {
        document.documentElement.style.scrollBehavior = 'auto';

        // Force the browser to apply the style change before scrolling
        requestAnimationFrame(() => {
            window.scrollTo(0, parseInt(savedScroll, 10));

            requestAnimationFrame(() => {
                document.documentElement.style.scrollBehavior = '';
                document.documentElement.style.visibility = 'visible';
            });
        });
    } else {
        document.documentElement.style.visibility = 'visible';
    }
});




// =========================
// Mobile Menu Toggle
// =========================

const menuToggle = document.getElementById("menuToggle");
const mainNav = document.getElementById("mainNav");
const navOverlay = document.getElementById("navOverlay");

function closeMobileNav(){
    menuToggle.classList.remove("active");
    mainNav.classList.remove("active");
    document.body.classList.remove("nav-open");
    if (navOverlay) navOverlay.classList.remove("active");
    menuToggle.setAttribute("aria-expanded", "false");
}

if (menuToggle && mainNav) {

    menuToggle.addEventListener("click", () => {

        const isOpen = mainNav.classList.toggle("active");
        menuToggle.classList.toggle("active", isOpen);
        document.body.classList.toggle("nav-open", isOpen);
        if (navOverlay) navOverlay.classList.toggle("active", isOpen);
        menuToggle.setAttribute("aria-expanded", String(isOpen));

    });

    // Close the menu whenever a nav link or button (e.g. Register) is clicked.
    // Exception: the profile chip trigger only opens its own dropdown menu -
    // it must NOT also collapse the mobile nav panel, since the dropdown it's
    // opening lives inside that same panel (closing it hid the dropdown
    // before the user ever saw it, which looked like "nothing happens" on
    // mobile when tapping the Admin/user profile chip).
    mainNav.querySelectorAll("a, button").forEach(link => {
        if (link.id === "homeUserTrigger") return;
        link.addEventListener("click", closeMobileNav);
    });

    // Close the menu when the dark overlay is tapped
    if (navOverlay) {
        navOverlay.addEventListener("click", closeMobileNav);
    }

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeMobileNav();
    });

    // Close the menu automatically if the viewport grows back to desktop size
    window.addEventListener("resize", () => {
        if (window.innerWidth > 768) closeMobileNav();
    });

}

// Keep the drawer closable even if the navbar markup is injected after this
// script captures its initial element references.
window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const currentMenuToggle = document.getElementById("menuToggle");
    const currentMainNav = document.getElementById("mainNav");
    const currentNavOverlay = document.getElementById("navOverlay");
    currentMenuToggle?.classList.remove("active");
    currentMainNav?.classList.remove("active");
    currentNavOverlay?.classList.remove("active");
    document.body.classList.remove("nav-open");
    currentMenuToggle?.setAttribute("aria-expanded", "false");
});

// Smooth scrolling for navigation
document.querySelectorAll("nav a").forEach(link => {

    link.addEventListener("click", function(e){

        const href = this.getAttribute("href");

        // Smooth scroll only for section links
        if(href.startsWith("#")){

            e.preventDefault();

            document.querySelector(href).scrollIntoView({
                behavior:"smooth"
            });

        }

    });

});

// =========================
// Scroll Reveal Animation
// =========================

const observer = new IntersectionObserver((entries) => {

    entries.forEach(entry => {

        if (entry.isIntersecting) {

            entry.target.classList.add('show');
            observer.unobserve(entry.target);

        }

    });

}, {
    threshold: 0.2
});

const revealSelectors = [
    '.tb-hero-content', '.tb-hero-visual',
    '.card', '.step', '.flow', '.way-card',
    '.post-text', '.post-image',
    '.get-text', '.get-image',
    '.reach-text', '.reach-image',
    '.trusted-text', '.trusted-image',
    '.affordable-text', '.affordable-image',
    '.delivered-text', '.delivered-image',
    '.features h2', '.workflow h2', '.trust-orbit h2', '.safety-orbit-img', '.platform-ways h2',
    '.safety-content h2', '.safety-item',
    '.smart-matching-heading', '.route-card',
    '.about-image', '.about-content h4',
    '.about-content h1', '.about-content p',
    '.about-tag',
    '.faq-heading', '.faq-item'
];

document.querySelectorAll(revealSelectors.join(','))
.forEach((el, groupIndex) => {

    el.classList.add('hidden');

    // Small stagger so items in the same row/grid don't all pop at once
    const siblingIndex = Array.prototype.indexOf.call(el.parentElement ? el.parentElement.children : [], el);
    const delay = Math.min(siblingIndex, 4) * 0.08;
    el.style.transitionDelay = `${delay}s`;

    observer.observe(el);

});

// Workflow connector lines use their own scaleX animation (defined in CSS),
// so they're revealed with a lighter-touch observer that only adds "show".
const lineObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('show');
            lineObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.3 });

document.querySelectorAll('.line').forEach(line => lineObserver.observe(line));



// =========================
// Navbar Shadow on Scroll (handled by shared/nav-basic-behavior.js)
// =========================

// =========================
// Fade-in CSS Helper
// =========================

const style = document.createElement("style");

style.innerHTML = `

.hidden{

opacity:0;

transform:translateY(40px);

transition:all .8s ease;

}

.show{

opacity:1;

transform:translateY(0);

}

`;

document.head.appendChild(style);


// =========================
// Smart Route Matching Animation
// =========================

const smartMatchingSection = document.getElementById('smartMatching');

if (smartMatchingSection) {
    const smartMatchingObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            entry.target.classList.toggle('is-visible', entry.isIntersecting);
        });
    }, { threshold: 0.18 });

    smartMatchingObserver.observe(smartMatchingSection);
}



// =========================

(function () {
    const section = document.getElementById('whyChoose');
    if (!section || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const cards = section.querySelectorAll('.why-card');
    const backdrop = section.querySelector('.why-hover-backdrop');
    let activeCard = null;
    let closeTimer = null;

    function openCard(card) {
        clearTimeout(closeTimer);

        if (activeCard && activeCard !== card) {
            activeCard.classList.remove('is-center-zoom');
        }

        activeCard = card;
        card.classList.add('is-center-zoom');
        if (backdrop) backdrop.classList.add('is-active');
    }

    function scheduleClose(card) {
        clearTimeout(closeTimer);
        closeTimer = setTimeout(() => {
            if (activeCard === card) {
                card.classList.remove('is-center-zoom');
                if (backdrop) backdrop.classList.remove('is-active');
                activeCard = null;
            }
        }, 140);
    }

    cards.forEach(card => {
        card.addEventListener('mouseenter', () => openCard(card));
        card.addEventListener('mouseleave', () => scheduleClose(card));
    });

    window.addEventListener('scroll', () => {
        if (activeCard) {
            activeCard.classList.remove('is-center-zoom');
            if (backdrop) backdrop.classList.remove('is-active');
            activeCard = null;
        }
    }, { passive: true });
})();







// =========================
// FAQ Accordion
// =========================
(function () {
    const faqItems = document.querySelectorAll('.faq-item');
    if (!faqItems.length) return;

    faqItems.forEach(item => {
        const button = item.querySelector('.faq-question');
        if (!button) return;

        button.addEventListener('click', () => {
            const willOpen = !item.classList.contains('is-open');

            // Keep the section clean: only one answer open at a time.
            faqItems.forEach(otherItem => {
                otherItem.classList.remove('is-open');
                const otherButton = otherItem.querySelector('.faq-question');
                if (otherButton) otherButton.setAttribute('aria-expanded', 'false');
            });

            if (willOpen) {
                item.classList.add('is-open');
                button.setAttribute('aria-expanded', 'true');
            }
        });
    });
})();



// =========================
// Testimonials Slider
// =========================
(function initTestimonials() {
    const track = document.getElementById('testimonialSlider');
    const dots = document.querySelectorAll('#sliderDots .dot');
    const cards = document.querySelectorAll('.testimonial-card');

    if (!track || !cards.length) return;

    let currentIndex = 0;

    function goToSlide(index) {
        currentIndex = index;
        track.style.transform = `translateX(-${index * 100}%)`;

        cards.forEach((card, i) => card.classList.toggle('active', i === index));
        dots.forEach((dot, i) => dot.classList.toggle('active', i === index));
    }

    dots.forEach((dot, i) => {
        dot.addEventListener('click', () => goToSlide(i));
    });

    // Auto slide
    setInterval(() => {
        let next = (currentIndex + 1) % cards.length;
        goToSlide(next);
    }, 5000);
})();

// =========================
// Newsletter Form
// =========================
(function initNewsletter() {
    const form = document.getElementById('newsletterForm');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = form.querySelector('input').value;
        if (email) {
            window.showToast('Thank you for joining our community!', 'success');
            form.reset();
        }
    });
})();




function resolveAppUrl(relativePath) {
    const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
    if (window.location.protocol === 'file:') {
        return cleanPath;
    }
    const pathName = window.location.pathname;
    if (pathName.includes('/Frontend/')) {
        const base = pathName.substring(0, pathName.indexOf('/Frontend/') + 10);
        return base + cleanPath;
    }
    return '/' + cleanPath;
}

function checkIsUserLoggedIn() {
    try {
        const token = localStorage.getItem('travelBuddyToken') || localStorage.getItem('travelBuddyAdminToken') || localStorage.getItem('admin_token');
        const user = localStorage.getItem('travelBuddyUser') || localStorage.getItem('travelBuddyAdmin') || localStorage.getItem('admin_user');

        const hasToken = token && token !== 'null' && token !== 'undefined' && String(token).trim().length > 10;
        const hasUser = user && user !== 'null' && user !== 'undefined' && user !== '{}';

        return !!(hasToken || hasUser);
    } catch (e) {
        return false;
    }
}

function checkIsAdminLoggedIn() {
    try {
        const admin = localStorage.getItem('travelBuddyAdmin') || localStorage.getItem('travelBuddyAdminToken') || localStorage.getItem('admin_token');
        const user = localStorage.getItem('travelBuddyAdmin') || localStorage.getItem('admin_user');
        const hasAdmin = Boolean(admin) && admin !== 'null' && admin !== 'undefined';
        const hasUser = Boolean(user) && user !== 'null' && user !== 'undefined';
        return hasAdmin || hasUser;
    } catch (e) {
        return false;
    }
}

// =========================
// Home auth routing + dashboard-matched profile modal
// =========================
(function initHomeAuthenticatedExperience() {
    const API_ORIGIN = APP_CONFIG.API_BASE_URL;
    
    const isLoggedIn = checkIsUserLoggedIn();
    const isAdminLoggedIn = checkIsAdminLoggedIn();

    const dashboardUrl = resolveAppUrl(isAdminLoggedIn ? 'admin_dashboard/html/admin.html' : 'user-dashboard/overview.html');
    const loginUrl = resolveAppUrl('login/login.html');

    // Main action buttons on the public home page become session-aware.
    // Logged in -> dashboard. Logged out -> login.
    document.querySelectorAll('a.primary-btn:not([data-auth-routing="false"]), a.tb-btn-primary:not([data-auth-routing="false"])').forEach((link) => {
        link.href = isLoggedIn ? dashboardUrl : loginUrl;
    });

    const profileBtn = document.getElementById('homeProfileBtn');
    const settingsBtn = document.getElementById('homeSettingsBtn');
    if (!isLoggedIn || (!profileBtn && !settingsBtn)) return;

    // profile/settings modals logic continues below...
})();

function tbRenderAvatar(el, user, fallback) {
  if (!el) return;
  el.querySelectorAll('img.tb-profile-photo').forEach(img => img.remove());
  if (user && user.profilePhoto) {
    el.textContent = '';
    const img = document.createElement('img');
    img.className = 'tb-profile-photo';
    img.src = user.profilePhoto;
    img.alt = 'Profile photo';
    img.style.cssText = 'width:100%;height:100%;display:block;object-fit:cover;border-radius:inherit;';
    el.appendChild(img);
  } else if (fallback) {
    el.textContent = fallback;
  }
}

(function initHeroQuickActions() {
    // Use event delegation for better reliability
    document.addEventListener('click', function(e) {
        const card = e.target.closest('.tb-action-card');
        if (!card) return;

        e.preventDefault();
        e.stopPropagation();

        // Fresh login check
        const loggedIn = checkIsUserLoggedIn();
        const actionKey = card.getAttribute('data-action') || card.dataset.action;

        const loginUrl = resolveAppUrl('login/login.html');
        const routes = {
            search: resolveAppUrl('user-dashboard/search.html'),
            pick: resolveAppUrl('user-dashboard/pickup.html'),
            deliver: resolveAppUrl('user-dashboard/parcels.html?role=traveler&filter=active')
        };

        const targetUrl = routes[actionKey];

        if (loggedIn && targetUrl) {
            window.location.href = targetUrl;
        } else {
            window.location.href = loginUrl;
        }
    });
})();

(function initAppPromotionBanner() {
    const mobileBanner = document.getElementById('mobileAppBanner');
    const closeBtn = document.getElementById('closeMobileBanner');
    const DISMISSED_KEY = 'travelbuddy_app_banner_dismissed';

    if (!mobileBanner || !closeBtn) return;

    // Check if dismissed previously
    const isDismissed = localStorage.getItem(DISMISSED_KEY) === 'true';

    function updateVisibility() {
        if (!isDismissed && window.innerWidth <= 768) {
            mobileBanner.hidden = false;
        } else {
            mobileBanner.hidden = true;
        }
    }

    // Initial check
    updateVisibility();

    // Listen for resize to show/hide appropriately
    window.addEventListener('resize', updateVisibility);

    // Handle close action
    closeBtn.addEventListener('click', () => {
        mobileBanner.style.transition = 'transform 0.4s ease';
        mobileBanner.style.transform = 'translateY(100%)';

        setTimeout(() => {
            mobileBanner.hidden = true;
            localStorage.setItem(DISMISSED_KEY, 'true');
        }, 400);
    });
})();

