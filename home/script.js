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
// Reset Parcel Search Fields on Page Show
// (prevents stale input values from browser bfcache
// when user navigates to login and comes back)
// =========================

window.addEventListener('pageshow', () => {
    const fromInput = document.getElementById('fromInput');
    const toInput = document.getElementById('toInput');
    const parcelType = document.getElementById('parcelType');

    if (fromInput) fromInput.value = '';
    if (toInput) toInput.value = '';
    if (parcelType) parcelType.value = '';
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
// Trust Feature Orbit
// =========================

(function(){

    const ring = document.getElementById("orbitRing");
    const linesG = document.getElementById("orbitLines");

    if (!ring || !linesG) return;

    const features = [
        { icon:"fa-solid fa-lock", label:"Secure Payment" },
        { icon:"fa-solid fa-shield-halved", label:"Payment Guarantee" },
        { icon:"fa-solid fa-key", label:"Delivery OTP" },
        { icon:"fa-solid fa-headset", label:"Dispute Support" },
        { icon:"fa-solid fa-box-open", label:"Parcel Protection" },
        { icon:"fa-solid fa-clipboard-list", label:"Delivery Record" },
        { icon:"fa-solid fa-star", label:"User Ratings" },
        { icon:"fa-solid fa-rotate-left", label:"Refund Process" },
        { icon:"fa-solid fa-receipt", label:"Digital Receipt" },
        { icon:"fa-solid fa-chart-line", label:"Earnings History" },
        { icon:"fa-solid fa-gift", label:"Loyalty Rewards" }
    ];

    const n = features.length;
    const radiusPct = 40;
    const hubRadiusPct = 10.5;
    const iconRadiusPct = 4.5;

    features.forEach((feature, i) => {

        const angleDeg = (360 / n) * i - 90;
        const angleRad = angleDeg * Math.PI / 180;
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);

        const x = 50 + radiusPct * cosA;
        const y = 50 + radiusPct * sinA;
        const x1 = 50 + hubRadiusPct * cosA;
        const y1 = 50 + hubRadiusPct * sinA;
        const x2 = 50 + (radiusPct - iconRadiusPct) * cosA;
        const y2 = 50 + (radiusPct - iconRadiusPct) * sinA;

        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", x1);
        line.setAttribute("y1", y1);
        line.setAttribute("x2", x2);
        line.setAttribute("y2", y2);
        linesG.appendChild(line);

        const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dot.setAttribute("cx", x1);
        dot.setAttribute("cy", y1);
        dot.setAttribute("r", "0.8");
        linesG.appendChild(dot);

        const node = document.createElement("div");
        node.className = "orbit-node";
        node.style.top = y + "%";
        node.style.left = x + "%";
        node.style.animationDelay = `0s, ${i * 0.08}s`;

        const iconWrap = document.createElement("div");
        iconWrap.className = "orbit-icon";
        iconWrap.innerHTML = `<i class="${feature.icon}" aria-hidden="true"></i>`;

        const label = document.createElement("span");
        label.className = "orbit-label";
        label.textContent = feature.label;

        node.appendChild(iconWrap);
        node.appendChild(label);
        ring.appendChild(node);

    });

})();

// =========================
// 3D Hero Interaction
// =========================
(function initHero3D() {
    const heroVisual = document.querySelector('.hero-visual');
    const parcel = document.getElementById('heroParcel');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    if (!heroVisual || !parcel || window.innerWidth < 992 || !hasFinePointer || prefersReducedMotion) return;

    heroVisual.addEventListener('mousemove', (e) => {
        const rect = heroVisual.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = (y - centerY) / 10;
        const rotateY = (centerX - x) / 10;

        parcel.style.transform = `rotateX(${rotateX - 20}deg) rotateY(${rotateY + 25}deg)`;
    });

    heroVisual.addEventListener('mouseleave', () => {
        parcel.style.transform = `rotateX(-20deg) rotateY(25deg)`;
    });
})();

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
    '.card', '.step', '.flow', '.way-card',
    '.parcel-search-text', '.parcel-search-card',
    '.post-text', '.post-image',
    '.get-text', '.get-image',
    '.reach-text', '.reach-image',
    '.trusted-text', '.trusted-image',
    '.affordable-text', '.affordable-image',
    '.delivered-text', '.delivered-image',
    '.features h2', '.workflow h2', '.trust-orbit h2', '.orbit-wrap', '.platform-ways h2',
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
// Hero Title Animation
// =========================

const words = [
    "DELIVERY ASAP",
    "SEND FASTER",
    "FIND TRAVELLERS",
    "SHIP SMART"
];

let wordIndex = 0;
let charIndex = 0;
let isDeleting = false;

const typing = document.getElementById("typing");

function type() {

    const currentWord = words[wordIndex];

    if (!isDeleting) {
        typing.innerHTML =
            currentWord.substring(0, charIndex) +
            '<span class="cursor">|</span>';

        charIndex++;

        if (charIndex > currentWord.length) {
            isDeleting = true;
            setTimeout(type, 1500); // Pause before deleting
            return;
        }

    } else {
        typing.innerHTML =
            currentWord.substring(0, charIndex) +
            '<span class="cursor">|</span>';

        charIndex--;

        if (charIndex < 0) {
            isDeleting = false;
            wordIndex = (wordIndex + 1) % words.length;
            charIndex = 0;
        }
    }

    setTimeout(type, isDeleting ? 80 : 150);
}

// Only run the typing animation on pages that actually have #typing
// (this file is now shared with pages like about.html)
if (typing) {
    type();
}
// =========================
// Navbar Shadow on Scroll
// =========================
// PERF FIX: this used to re-query the DOM for <header> and write an inline
// style on every scroll event (forces style recalc every tick = jank).
// Now: query once, toggle a class instead of writing style strings, and
// throttle to one update per animation frame.

const __navHeaderEl = document.querySelector("header");
let __navShadowTicking = false;

function __updateNavShadow() {
    if (__navHeaderEl) {
        __navHeaderEl.classList.toggle("is-scrolled", window.scrollY > 40);
    }
    __navShadowTicking = false;
}

window.addEventListener("scroll", () => {
    if (!__navShadowTicking) {
        __navShadowTicking = true;
        requestAnimationFrame(__updateNavShadow);
    }
}, { passive: true });

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
// Live Activity Ticker
// =========================
(function initTicker() {
    const ticker = document.getElementById('liveTicker');
    if (!ticker) return;

    const activities = [
        { icon: 'fa-box', text: 'New parcel posted: Mumbai → Pune', highlight: 'Just now' },
        { icon: 'fa-user-check', text: 'Traveler matched: Delhi → Jaipur', highlight: '2 mins ago' },
        { icon: 'fa-circle-check', text: 'Delivery confirmed: Bangalore → Chennai', highlight: 'Success' },
        { icon: 'fa-shield-halved', text: 'Verified traveler joined in Kolkata', highlight: 'New' },
        { icon: 'fa-route', text: 'Active journey: Hyderabad → Goa', highlight: 'Live' },
        { icon: 'fa-sack-dollar', text: 'Traveler earned ₹450: Pune → Mumbai', highlight: 'Completed' }
    ];

    // Double the items for seamless loop
    const content = [...activities, ...activities].map(item => `
        <div class="ticker-item">
            <i class="fa-solid ${item.icon}" aria-hidden="true"></i>
            ${item.text} <span>• ${item.highlight}</span>
        </div>
    `).join('');

    ticker.innerHTML = content;
})();

// =========================
// Price Estimator Logic
// =========================
(function initPriceEstimator() {
    const fromInput = document.getElementById('fromInput');
    const toInput = document.getElementById('toInput');
    const estBox = document.getElementById('priceEstimator');
    const estValue = document.getElementById('estPriceValue');

    if (!fromInput || !toInput || !estBox) return;

    const updateEstimate = () => {
        const from = fromInput.value.trim();
        const to = toInput.value.trim();

        if (from.length > 2 && to.length > 2) {
            // Simplified calculation: length of both names as a seed
            const distanceFactor = (from.length + to.length) % 10;
            const estimatedPrice = 150 + (distanceFactor * 45);

            estValue.textContent = `₹${estimatedPrice}`;
            estBox.classList.remove('hidden');
        } else {
            estBox.classList.add('hidden');
        }
    };

    fromInput.addEventListener('input', updateEstimate);
    toInput.addEventListener('input', updateEstimate);
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




// =========================
// Logged-in Home Navigation
// =========================
(function initLoggedInHomeNavigation() {
    
    const guestActions = document.getElementById('guestNavActions');
    const chip = document.getElementById('homeUserChip');
    const trigger = document.getElementById('homeUserTrigger');
    const menu = document.getElementById('homeUserMenu');
    const logoutBtn = document.getElementById('homeLogoutBtn');
    if (!guestActions || !chip) return;

    function readUser() {
        try { return JSON.parse(localStorage.getItem('travelBuddyUser') || '{}'); }
        catch (_) { return {}; }
    }
    function readAdmin() {
        try { return JSON.parse(localStorage.getItem('travelBuddyAdmin') || '{}'); }
        catch (_) { return {}; }
    }
    function fullName(user) {
        return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || 'TravelBuddy';
    }
    function initials(name) {
        return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('') || 'TB';
    }
    function renderNavbarAvatar(avatarEl, user, name) {
        if (!avatarEl) return;
        const photo = user?.profilePhoto || '';
        avatarEl.style.backgroundImage = '';
        avatarEl.querySelectorAll('img.tb-profile-photo').forEach(img => img.remove());
        if (photo) {
            avatarEl.textContent = '';
            const img = document.createElement('img');
            img.className = 'tb-profile-photo';
            const apiOrigin = window.APP_CONFIG?.API_BASE_URL || 'https://travelbuddy-backend-19l6.onrender.com';
            const photoUrl = photo.startsWith('data:') || photo.startsWith('http') 
                ? photo 
                : (photo.startsWith('/') ? apiOrigin + photo : apiOrigin + '/' + photo);
            img.src = photoUrl;
            img.alt = 'Profile photo';
            img.style.cssText = 'width:100%;height:100%;display:block;object-fit:cover;border-radius:inherit;';
            img.onerror = () => {
                img.remove();
                avatarEl.style.overflow = '';
                avatarEl.textContent = initials(name);
            };
            avatarEl.appendChild(img);
            avatarEl.style.overflow = 'hidden';
            avatarEl.classList.add('has-photo');
        } else {
            avatarEl.style.overflow = '';
            avatarEl.classList.remove('has-photo');
            avatarEl.textContent = initials(name);
        }
    }

    function render(user) {
        const name = fullName(user);
        const nameEl = document.getElementById('homeUserName');
        if (nameEl) nameEl.textContent = name;
        const avatarEl = document.getElementById('homeAvatar');
        renderNavbarAvatar(avatarEl, user, name);
    }

    // Role-aware detection: admin session stored separately from user session.
    const isAdmin = Boolean(localStorage.getItem('travelBuddyAdmin'));
    const isUser = Boolean(localStorage.getItem('travelBuddyUser'));

    if (!isAdmin && !isUser) {
        guestActions.hidden = false;
        chip.hidden = true;
        return;
    }

    guestActions.hidden = true;
    chip.hidden = false;
    const roleEl = document.getElementById('homeUserRole');
    const dashboardLink = document.getElementById('homeDashboardLink');
    const dashboardLinkLabel = document.getElementById('homeDashboardLinkLabel');
    if (isAdmin) {
        const admin = readAdmin();
        const adminName = fullName(admin) || (admin.name || 'Admin');
        const nameEl = document.getElementById('homeUserName');
        if (nameEl) nameEl.textContent = adminName;
        const avatarEl = document.getElementById('homeAvatar');
        renderNavbarAvatar(avatarEl, admin, adminName);
        // Admin accounts aren't senders/travelers — label them correctly and
        // send "Dashboard" to the admin control center instead of the
        // regular user dashboard.
        if (roleEl) roleEl.textContent = admin.role ? admin.role.charAt(0).toUpperCase() + admin.role.slice(1) : 'Admin';
        if (dashboardLink) dashboardLink.href = '../admin_dashboard/html/admin.html';
        if (dashboardLinkLabel) dashboardLinkLabel.textContent = 'Admin Dashboard';
    } else {
        render(readUser());
        if (roleEl) roleEl.textContent = 'Sender & Traveler';
        if (dashboardLink) dashboardLink.href = '../user-dashboard/overview.html';
        if (dashboardLinkLabel) dashboardLinkLabel.textContent = 'Dashboard';
    }

    trigger?.addEventListener('click', (event) => {
        event.stopPropagation();
        const open = chip.classList.toggle('open');
        trigger.setAttribute('aria-expanded', String(open));
    });
    menu?.addEventListener('click', event => event.stopPropagation());
    document.addEventListener('click', () => {
        chip.classList.remove('open');
        trigger?.setAttribute('aria-expanded', 'false');
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            chip.classList.remove('open');
            trigger?.setAttribute('aria-expanded', 'false');
        }
    });
    logoutBtn?.addEventListener('click', () => {
        if (localStorage.getItem('travelBuddyAdmin')) {
            // admin logout
            if (window.TravelBuddyAuth && typeof window.TravelBuddyAuth.logoutAdmin === 'function') {
                window.TravelBuddyAuth.logoutAdmin().finally(()=>{ window.location.href = 'index.html'; });
            } else {
                localStorage.removeItem('travelBuddyAdmin');
                localStorage.removeItem('travelBuddyAdminToken');
                window.location.href = 'index.html';
            }
            return;
        }
        localStorage.removeItem('travelBuddyUser');
        window.location.href = 'index.html';
    });

    // Refresh the name from the backend when possible, while keeping the home page usable offline.
    // BUG FIX: this call used to send `headers: {}` — with NO Authorization
    // header at all. /api/auth/me always requires a token, so it 401'd on
    // every single page load, and the .catch below then wiped
    // travelBuddyUser from localStorage and switched the navbar back to
    // Login/Register — even though the user was still properly logged in.
    // That's why the profile chip would show for a moment and then flip
    // back to "Login / Register" a second later. Sending the real Bearer
    // token (the same one login.js and common.js already save) fixes it.
    // prefer admin token when present so the /api/auth/me check validates the right session
    const homeNavToken = localStorage.getItem('travelBuddyAdminToken') || localStorage.getItem('travelBuddyToken');
    fetch(`${APP_CONFIG.API_BASE_URL}/api/auth/me`, {
        headers: homeNavToken ? { Authorization: `Bearer ${homeNavToken}` } : {},
    })
        .then(async response => {
            if (response.status === 401) throw new Error('unauthorized');
            if (!response.ok) return null;
            return response.json();
        })
        .then(data => {
            if (!data?.user) return;
            // store to the appropriate slot depending on token used
            if (localStorage.getItem('travelBuddyAdminToken')) {
                localStorage.setItem('travelBuddyAdmin', JSON.stringify(data.user));
            } else {
                localStorage.setItem('travelBuddyUser', JSON.stringify(data.user));
                render(data.user);
            }
        })
        .catch(error => {
            if (error.message === 'unauthorized') {
                if (localStorage.getItem('travelBuddyAdminToken')) {
                    localStorage.removeItem('travelBuddyAdmin');
                    localStorage.removeItem('travelBuddyAdminToken');
                }
                localStorage.removeItem('travelBuddyUser');
                localStorage.removeItem('travelBuddyToken');
                guestActions.hidden = false;
                chip.hidden = true;
            }
        });
})();

// =========================
// Home auth routing + dashboard-matched profile modal
// =========================
(function initHomeAuthenticatedExperience() {
    const API_ORIGIN = APP_CONFIG.API_BASE_URL;
    
    const isUserLoggedIn = Boolean(localStorage.getItem('travelBuddyUser'));
    const isAdminLoggedIn = Boolean(localStorage.getItem('travelBuddyAdmin'));
    const isLoggedIn = isUserLoggedIn || isAdminLoggedIn;
    const dashboardUrl = isAdminLoggedIn ? '../admin_dashboard/html/admin.html' : '../user-dashboard/overview.html';
    const loginUrl = '../login/login.html';

    // Main action buttons on the public home page become session-aware.
    // Logged in -> dashboard. Logged out -> login.
    document.querySelectorAll('a.primary-btn').forEach((link) => {
        link.href = isLoggedIn ? dashboardUrl : loginUrl;
    });

    const profileBtn = document.getElementById('homeProfileBtn');
    const settingsBtn = document.getElementById('homeSettingsBtn');
    if (!isLoggedIn || (!profileBtn && !settingsBtn)) return;

    // Admins are stored under a separate localStorage key/shape (see
    // toSafeAdmin() in routes/auth.js) — no `phone` field, and profile
    // updates/password changes go through /api/admin/... instead of
    // /api/auth/me... . getProfile()/authHeaders() below branch on
    // isAdminLoggedIn so the rest of this modal's code (populate, save,
    // change password) works identically for both roles.
    const getUser = () => { try { return JSON.parse(localStorage.getItem('travelBuddyUser') || '{}'); } catch { return {}; } };
    const getAdmin = () => { try { return JSON.parse(localStorage.getItem('travelBuddyAdmin') || '{}'); } catch { return {}; } };
    const getProfile = () => isAdminLoggedIn ? getAdmin() : getUser();
    const getName = (u) => `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.name || 'TravelBuddy';
    const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0,2).map(x => x[0].toUpperCase()).join('') || 'TB';
    const authHeaders = () => ({ 'Content-Type':'application/json', Authorization:`Bearer ${localStorage.getItem(isAdminLoggedIn ? 'travelBuddyAdminToken' : 'travelBuddyToken') || ''}` });


    function renderAvatar(el, user, name) {
      if (!el) return;
      const photo = user?.profilePhoto || '';
      el.style.backgroundImage = '';
      el.querySelectorAll('img.tb-profile-photo').forEach(img => img.remove());
      if (photo) {
        el.textContent = '';
        const img = document.createElement('img');
        img.className = 'tb-profile-photo';
        const photoUrl = photo.startsWith('data:') ? photo : 
                        (photo.startsWith('http') ? photo :
                        (photo.startsWith('/') ? `${API_ORIGIN}${photo}` : `${API_ORIGIN}/${photo}`));
        img.src = photoUrl;
        img.alt = 'Profile photo';
        img.style.cssText = 'width:100%;height:100%;display:block;object-fit:cover;border-radius:inherit;';
        img.onerror = () => {
          img.remove();
          el.style.overflow = '';
          el.textContent = initials(name);
        };
        el.appendChild(img);
        el.style.overflow = 'hidden';
        el.classList.add('has-photo');
      } else {
        el.style.overflow = '';
        el.classList.remove('has-photo');
        el.textContent = initials(name);
      }
    }
    function syncHomeAvatars(user) { const name=getName(user); renderAvatar(document.getElementById('homeAvatar'),user,name); renderAvatar(document.getElementById('homeModalAvatar'),user,name); }
    function resizePhoto(file) { return new Promise((resolve,reject)=>{ const reader=new FileReader(); reader.onerror=reject; reader.onload=()=>{ const img=new Image(); img.onerror=reject; img.onload=()=>{ const size=320, c=document.createElement('canvas'); c.width=size;c.height=size; const ctx=c.getContext('2d'); const side=Math.min(img.width,img.height), sx=(img.width-side)/2, sy=(img.height-side)/2; ctx.drawImage(img,sx,sy,side,side,0,0,size,size); resolve(c.toDataURL('image/jpeg',.82)); }; img.src=reader.result; }; reader.readAsDataURL(file); }); }
    async function saveHomePhoto(profilePhoto) {
        const u = getProfile();
        const endpoint = isAdminLoggedIn ? '/api/admin/profile' : '/api/auth/me';
        const payload = isAdminLoggedIn
            ? { firstName: u.firstName || 'Admin', lastName: u.lastName || '', profilePhoto }
            : { firstName: u.firstName || 'Travel', lastName: u.lastName || 'Buddy', phone: u.phone || '', profilePhoto };
        const r = await fetch(`${API_ORIGIN}${endpoint}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(payload) });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Could not save profile photo.');
        const saved = isAdminLoggedIn ? d.admin : d.user;
        localStorage.setItem(isAdminLoggedIn ? 'travelBuddyAdmin' : 'travelBuddyUser', JSON.stringify(saved));
        syncHomeAvatars(saved);
        populate();
        return saved;
    }
    async function handleHomePhoto(e) {
      const file=e.target.files?.[0];
      if(!file) return;
      
      // Validate file type - only JPG/JPEG/PNG allowed
      const validMimes = ['image/jpeg', 'image/png'];
      const validExts = ['.jpg', '.jpeg', '.png'];
      const hasValidMime = validMimes.includes(file.type);
      const hasValidExt = validExts.some(ext => file.name.toLowerCase().endsWith(ext));
      
      if (!hasValidMime || !hasValidExt) {
        alert('Invalid image format. Please upload a JPG, JPEG, or PNG image.');
        e.target.value='';
        return;
      }
      
      if(file.size>5*1024*1024) {
        alert('Image is too large. Please select an image smaller than 5 MB.');
        e.target.value='';
        return;
      }
      
      try {
        await saveHomePhoto(await resizePhoto(file));
      } catch(err) {
        alert(err.message);
      }
      e.target.value='';
    }
    async function removeHomePhoto() { try { await saveHomePhoto(''); } catch(err) { alert(err.message); } const input=document.getElementById('homeProfilePhotoInput'); if(input) input.value=''; }

    function ensureModal() {
        if (document.getElementById('homeProfileOverlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'homeProfileOverlay';
        overlay.className = 'home-profile-overlay hidden';
        overlay.innerHTML = `
          <div class="home-profile-modal" role="dialog" aria-modal="true" aria-labelledby="homeProfileTitle">
            <button class="home-profile-close" id="homeProfileClose" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
            <div class="home-profile-head">
              <div class="home-profile-avatar" id="homeModalAvatar">TB</div>
              <div><h2 id="homeProfileTitle">My Profile</h2><p id="homeModalEmail">Signed in user</p></div>
            </div>
            <div class="home-profile-tabs">
              <button class="home-profile-tab active" type="button" data-home-tab="profile">Profile</button>
              <button class="home-profile-tab" type="button" data-home-tab="details">Details</button>
              <button class="home-profile-tab" type="button" data-home-tab="settings">Settings</button>
            </div>
            <section class="home-profile-panel home-photo-only" id="homeProfilePanel">
              <div class="home-photo-focus">
                <div class="home-profile-avatar home-profile-avatar-large" id="homePhotoPreview">TB</div>
                <div class="home-photo-actions"><label class="home-photo-btn" for="homeProfilePhotoInput"><i class="fa-solid fa-camera"></i><span id="homePhotoActionText">Add Photo</span></label><input id="homeProfilePhotoInput" type="file" accept="image/jpeg,image/png" hidden><button type="button" class="home-photo-remove" id="homeRemovePhoto"><i class="fa-solid fa-trash-can"></i> Remove Photo</button></div>
                <p class="home-photo-help">Your photo is saved to your TravelBuddy account and used in your profile avatar.</p>
              </div>
            </section>
            <section class="home-profile-panel hidden" id="homeDetailsPanel">
              <form class="home-profile-form" id="homeProfileForm">
                <div class="home-profile-row"><div class="home-profile-field"><label for="homeFirstName">First Name</label><input id="homeFirstName" required></div><div class="home-profile-field"><label for="homeLastName">Last Name</label><input id="homeLastName" required></div></div>
                <div class="home-profile-field"><label for="homeProfileEmail">Email</label><input id="homeProfileEmail" type="email" disabled></div>
                <div class="home-profile-field" id="homeProfilePhoneField"><label for="homeProfilePhone">Mobile Number</label><input id="homeProfilePhone" type="tel"></div>
                <button class="home-profile-save" type="submit"><i class="fa-solid fa-floppy-disk"></i> Save Profile</button>
              </form>
            </section>
            <section class="home-profile-panel hidden" id="homeSettingsPanel">
              <form class="home-profile-form" id="homePasswordForm">
                <div class="home-profile-field"><label for="homeCurrentPassword">Current Password</label><input id="homeCurrentPassword" type="password" autocomplete="current-password"></div>
                <div class="home-profile-field"><label for="homeNewPassword">New Password</label><input id="homeNewPassword" type="password" autocomplete="new-password"></div>
                <button class="home-profile-save" type="submit"><i class="fa-solid fa-key"></i> Change Password</button>
              </form>
              <div class="home-profile-danger"><button class="home-profile-logout" id="homeModalLogout" type="button"><i class="fa-solid fa-arrow-right-from-bracket"></i> Log out</button></div>
            </section>
          </div>`;
        document.body.appendChild(overlay);
        document.getElementById('homeProfileClose').onclick = closeModal;
        overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
        overlay.querySelectorAll('[data-home-tab]').forEach(btn => btn.addEventListener('click', () => setTab(btn.dataset.homeTab)));
        document.getElementById('homeProfileForm').addEventListener('submit', saveProfile);
        document.getElementById('homePasswordForm').addEventListener('submit', changePassword);
        document.getElementById('homeModalLogout').addEventListener('click', logout);
        document.getElementById('homeProfilePhotoInput').addEventListener('change', handleHomePhoto);
        document.getElementById('homeRemovePhoto').addEventListener('click', removeHomePhoto);
    }
    function populate() {
        const u = getProfile(), name = getName(u);
        renderAvatar(document.getElementById('homeModalAvatar'), u, name);
        renderAvatar(document.getElementById('homePhotoPreview'), u, name);
        const photoActionText=document.getElementById('homePhotoActionText');
        const removePhotoButton=document.getElementById('homeRemovePhoto');
        if(photoActionText) photoActionText.textContent=u.profilePhoto?'Change Photo':'Add Photo';
        if(removePhotoButton) removePhotoButton.hidden=!u.profilePhoto;
        document.getElementById('homeProfileTitle').textContent = isAdminLoggedIn ? 'My Profile (Admin)' : 'My Profile';
        document.getElementById('homeModalEmail').textContent = u.email || 'No email available';
        document.getElementById('homeFirstName').value = u.firstName || '';
        document.getElementById('homeLastName').value = u.lastName || '';
        document.getElementById('homeProfileEmail').value = u.email || '';
        const phoneField = document.getElementById('homeProfilePhoneField');
        if (isAdminLoggedIn) {
            if (phoneField) phoneField.hidden = true;
        } else {
            if (phoneField) phoneField.hidden = false;
            document.getElementById('homeProfilePhone').value = u.phone || '';
        }
    }
    function setTab(tab) {
        document.querySelectorAll('[data-home-tab]').forEach(b => b.classList.toggle('active', b.dataset.homeTab === tab));
        document.getElementById('homeProfilePanel').classList.toggle('hidden', tab !== 'profile');
        document.getElementById('homeDetailsPanel').classList.toggle('hidden', tab !== 'details');
        document.getElementById('homeSettingsPanel').classList.toggle('hidden', tab !== 'settings');
    }
    function openModal(tab='profile') { ensureModal(); populate(); setTab(tab); document.getElementById('homeProfileOverlay').classList.remove('hidden'); }
    function closeModal() { document.getElementById('homeProfileOverlay')?.classList.add('hidden'); }
    function logout() {
        if (isAdminLoggedIn) {
            if (window.TravelBuddyAuth && typeof window.TravelBuddyAuth.logoutAdmin === 'function') {
                window.TravelBuddyAuth.logoutAdmin().finally(() => { window.location.href = loginUrl; });
            } else {
                localStorage.removeItem('travelBuddyAdmin');
                localStorage.removeItem('travelBuddyAdminToken');
                window.location.href = loginUrl;
            }
            return;
        }
        localStorage.removeItem('travelBuddyToken');
        localStorage.removeItem('travelBuddyUser');
        window.location.href = loginUrl;
    }
    async function saveProfile(e) {
        e.preventDefault();
        const current = getProfile();
        const firstName = homeFirstName.value.trim();
        const lastName = homeLastName.value.trim();
        if (!firstName || !lastName) return alert('First name and last name are required.');
        const endpoint = isAdminLoggedIn ? '/api/admin/profile' : '/api/auth/me';
        const payload = isAdminLoggedIn
            ? { firstName, lastName, profilePhoto: current.profilePhoto || '' }
            : { firstName, lastName, phone: homeProfilePhone.value.trim(), profilePhoto: current.profilePhoto || '' };
        try {
            const r = await fetch(`${API_ORIGIN}${endpoint}`, {method:'PUT',headers:authHeaders(),body:JSON.stringify(payload)}); const d = await r.json();
            if (!r.ok) return alert(d.error || 'Could not update profile.');
            const saved = isAdminLoggedIn ? d.admin : d.user;
            localStorage.setItem(isAdminLoggedIn ? 'travelBuddyAdmin' : 'travelBuddyUser', JSON.stringify(saved));
            populate();
            const name=getName(saved); document.getElementById('homeUserName').textContent=name; renderAvatar(document.getElementById('homeAvatar'), saved, name);
            alert('Profile updated successfully.');
        } catch { alert('Could not reach the server.'); }
    }
    async function changePassword(e) {
        e.preventDefault(); const currentPassword=homeCurrentPassword.value, newPassword=homeNewPassword.value;
        if (!currentPassword || !newPassword) return alert('Enter current and new password.');
        if (newPassword.length < 8) return alert('New password must be at least 8 characters.');
        const endpoint = isAdminLoggedIn ? '/api/admin/profile/password' : '/api/auth/me/password';
        try {
            const r=await fetch(`${API_ORIGIN}${endpoint}`,{method:'PUT',headers:authHeaders(),body:JSON.stringify({currentPassword,newPassword})}); const d=await r.json();
            if (!r.ok) return alert(d.error || 'Could not change password.'); e.currentTarget.reset(); alert('Password changed successfully.');
        } catch { alert('Could not reach the server.'); }
    }
    syncHomeAvatars(getProfile());
    profileBtn?.addEventListener('click', () => { document.getElementById('homeUserChip')?.classList.remove('open'); openModal('profile'); });
    settingsBtn?.addEventListener('click', () => { document.getElementById('homeUserChip')?.classList.remove('open'); openModal('settings'); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
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
