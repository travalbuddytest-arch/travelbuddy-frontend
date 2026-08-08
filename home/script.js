// =========================
// Travel Buddy Landing Page
// =========================

// =========================
// Preserve Scroll Position on Refresh (no flash)
// =========================

// Save scroll position continuously
window.addEventListener('scroll', () => {
    sessionStorage.setItem('scrollPosition', window.scrollY.toString());
});

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

window.addEventListener("scroll", () => {

    const header = document.querySelector("header");

    if (window.scrollY > 40) {

        header.style.boxShadow =
        "0 8px 30px rgba(0,0,0,.12)";

    } else {

        header.style.boxShadow =
        "0 2px 12px rgba(0,0,0,.08)";

    }

});

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
// Buddy AI Homepage Chatbot
// =========================
(function () {
    const launcher = document.getElementById('buddyLauncher');
    const panel = document.getElementById('buddyChatPanel');
    const minimize = document.getElementById('buddyMinimize');
    const notification = document.getElementById('buddyNotification');
    const messages = document.getElementById('buddyMessages');
    const form = document.getElementById('buddyChatForm');
    const input = document.getElementById('buddyInput');
    const typing = document.getElementById('buddyTyping');

    if (!launcher || !panel || !messages || !form || !input) return;

    const routes = {
        login: '../login/login.html',
        about: '../about/about.html'
    };

    let closeTimer;

    function setOpen(open) {
        clearTimeout(closeTimer);

        if (open) {
            panel.classList.remove('is-closing');
            panel.classList.add('is-open');
            launcher.classList.add('is-open');
            launcher.closest('.buddy-chatbot').classList.add('has-open-chat');
            launcher.setAttribute('aria-expanded', 'true');
            panel.setAttribute('aria-hidden', 'false');

            if (notification) notification.classList.add('is-hidden');
            setTimeout(() => input.focus(), 420);
        } else {
            panel.classList.remove('is-open');
            panel.classList.add('is-closing');
            launcher.classList.remove('is-open');
            launcher.closest('.buddy-chatbot').classList.remove('has-open-chat');
            launcher.setAttribute('aria-expanded', 'false');
            panel.setAttribute('aria-hidden', 'true');

            closeTimer = setTimeout(() => {
                panel.classList.remove('is-closing');
            }, 480);
        }
    }

    function timeNow() {
        return new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit' }).format(new Date());
    }

    function addMessage(text, sender = 'bot') {
        const row = document.createElement('div');
        row.className = `buddy-message buddy-${sender}-message`;

        if (sender === 'bot') {
            const avatar = document.createElement('div');
            avatar.className = 'buddy-message-avatar';
            avatar.innerHTML = '<i class="fa-solid fa-paper-plane" aria-hidden="true"></i>';
            row.appendChild(avatar);
        }

        const bubble = document.createElement('div');
        bubble.className = 'buddy-bubble';
        const p = document.createElement('p');
        p.textContent = text;
        const stamp = document.createElement('span');
        stamp.className = 'buddy-time';
        stamp.textContent = timeNow();
        bubble.append(p, stamp);
        row.appendChild(bubble);
        messages.appendChild(row);
        messages.scrollTop = messages.scrollHeight;
    }

    function showTyping(callback) {
        if (typing) typing.classList.add('is-visible');
        setTimeout(() => {
            if (typing) typing.classList.remove('is-visible');
            callback();
        }, 650);
    }

    function botReply(text) {
        showTyping(() => addMessage(text, 'bot'));
    }

    function scrollToSection(selector, fallbackText) {
        const section = document.querySelector(selector);
        if (section) {
            setOpen(false);
            setTimeout(() => section.scrollIntoView({ behavior: 'smooth', block: 'start' }), 180);
        } else {
            botReply(fallbackText);
        }
    }

    function handleAction(action) {
        const replies = {
            send: 'I can help you start a parcel request. I’ll take you to login so you can post pickup, destination, and parcel details.',
            track: 'Live tracking is available after login for active deliveries. Open your dashboard and choose the active parcel to see its journey.',
            traveler: 'Use the route search above to enter From, To, and parcel category. You can then find travelers heading your way.',
            how: 'TravelBuddy works in five steps: post your parcel, find a verified traveler, confirm and pay securely, track the journey, and verify delivery with OTP.'
        };

        addMessage({
            send: 'I want to send a parcel',
            track: 'Track my parcel',
            traveler: 'Find a traveler',
            how: 'How does TravelBuddy work?'
        }[action] || 'Help me', 'user');

        botReply(replies[action] || 'How can I help you with TravelBuddy?');

        if (action === 'send') setTimeout(() => { window.location.href = routes.login; }, 1300);
        if (action === 'traveler') setTimeout(() => scrollToSection('.parcel-search-section', replies.traveler), 900);
        if (action === 'how') setTimeout(() => scrollToSection('.workflow', replies.how), 1100);
    }

    function answerQuestion(raw) {
        const q = raw.toLowerCase().replace(/[^\w\s₹-]/g, ' ').replace(/\s+/g, ' ').trim();

        const knowledge = [
            { keys: ['price','cost','charge','fee','how much','rate','cheap','expensive'], answer: 'Delivery cost can depend on distance, parcel size or weight, urgency, route demand, and traveler availability. The sender should see the final price before confirming.' },
            { keys: ['safe','safety','secure','trust','verified','verification','fraud','scam'], answer: 'TravelBuddy is designed around verified users, protected payments, parcel and trip records, OTP delivery confirmation, ratings, and support for disputes.' },
            { keys: ['track','tracking','location','where is my parcel','parcel status','live status'], answer: 'For an active delivery, log in and open the parcel in your dashboard to view its latest tracking status and journey progress.' },
            { keys: ['traveler','traveller','find traveler','find traveller','match','matching'], answer: 'Enter your From and To locations plus parcel category. TravelBuddy can match your request with travelers already going in the same direction.' },
            { keys: ['send','post parcel','parcel request','ship','delivery request'], answer: 'To send a parcel: log in, add pickup and destination details, choose the parcel category, review matching travelers, select one, and confirm the delivery.' },
            { keys: ['earn','earning','money','income','trip','carry parcel','become traveler'], answer: 'Travelers can add an upcoming trip, discover route-matched parcel requests, choose what they want to carry, complete delivery, and receive earnings.' },
            { keys: ['otp','one time password','confirm delivery','delivery code'], answer: 'The receiver uses a one-time password to confirm successful delivery. The OTP should only be shared at the time of actual handover.' },
            { keys: ['payment','pay','refund','money back','failed payment','payment failed'], answer: 'The intended payment flow protects the transaction during delivery and releases payment after successful confirmation. Failed payments, refunds, and disputes should be handled through the payment and support flow.' },
            { keys: ['how it works','how does travelbuddy work','process','steps','workflow'], answer: 'TravelBuddy works in five steps: Post Parcel → Find a Traveler → Confirm & Pay Securely → Track the Journey → Verify Delivery with OTP.' },
            { keys: ['login','sign in','cannot login','forgot password','password'], answer: 'Use the Login page to access your account. If you forgot your password, use the password recovery option on the login screen.' },
            { keys: ['register','signup','sign up','create account','new account'], answer: 'Choose Register from the navigation bar, create your account, and complete the required verification before using protected delivery features.' },
            { keys: ['google login','google account','gmail'], answer: 'If Google sign-in is enabled on your login page, choose the Google option and select the account linked to your TravelBuddy profile.' },
            { keys: ['phone','mobile number','change number','otp not received'], answer: 'Check the country code and phone number, wait briefly, then use resend OTP if available. If it still does not arrive, use the support option.' },
            { keys: ['document','documents','allowed parcel','what can i send','parcel category'], answer: 'Common categories include documents, electronics, clothing, gifts, books, packaged food, personal items, and other permitted items. Restricted or illegal items should never be accepted.' },
            { keys: ['prohibited','restricted','illegal','not allowed','dangerous goods','weapon','drug'], answer: 'Do not send illegal, dangerous, explosive, flammable, restricted, or undeclared items. Travelers should be able to review parcel details before accepting.' },
            { keys: ['electronics','laptop','mobile','phone parcel'], answer: 'Electronics may require careful packaging and accurate declaration. Use protective packaging and clearly provide the item details before matching with a traveler.' },
            { keys: ['food','packaged food','medicine','medical'], answer: 'Only suitable and permitted items should be sent. Perishable food and medicines may need special handling or legal restrictions, so the platform should verify eligibility before booking.' },
            { keys: ['weight','size','kg','kilogram','heavy','large parcel'], answer: 'Parcel size and weight should be declared accurately because they can affect traveler matching, available luggage space, and delivery price.' },
            { keys: ['pickup','pick up','collection'], answer: 'Pickup details are added when posting a parcel. The sender and matched traveler can then follow the confirmed handover process.' },
            { keys: ['destination','drop','dropoff','drop off','receiver'], answer: 'Add the correct destination and receiver details when posting the parcel. Delivery should only be confirmed after the parcel reaches the intended receiver.' },
            { keys: ['cancel','cancellation','cancel parcel','cancel booking'], answer: 'Cancellation availability can depend on the delivery stage. Check the parcel details in your dashboard; if a traveler is already assigned or payment is processed, cancellation rules may apply.' },
            { keys: ['delay','late','not delivered','delivery late'], answer: 'Check live tracking first. If the parcel is delayed or stops updating, contact the traveler through the approved communication flow and use support if needed.' },
            { keys: ['lost','missing','damaged','broken'], answer: 'Keep parcel photos, delivery records, and tracking details. Report a lost or damaged parcel through support so the case can be reviewed using the recorded trip and delivery information.' },
            { keys: ['contact traveler','call traveler','message traveler','chat traveler'], answer: 'Communication with a matched traveler should happen through the platform’s approved contact or chat flow so important delivery details remain connected to the trip.' },
            { keys: ['rating','review','stars','feedback'], answer: 'After a completed delivery, both users can rate their experience. Ratings help build trust and improve future matching decisions.' },
            { keys: ['support','help','contact us','complaint','problem','issue'], answer: 'I can help with common questions here. For account-specific, payment, safety, or delivery disputes, use TravelBuddy Support so the team can review the relevant records.' },
            { keys: ['same day','today','urgent','fast','delivery time','how long'], answer: 'Delivery time depends on route and traveler availability. TravelBuddy is designed to make route-based delivery faster by matching parcels with people already traveling that way.' },
            { keys: ['city','pune','mumbai','available area','service area','where available'], answer: 'Availability depends on active travelers and routes. Enter your From and To locations to check whether matching travelers are available for that journey.' },
            { keys: ['business','shop','seller','company'], answer: 'Businesses can use TravelBuddy to post parcel requests and find route-matched travelers, especially for suitable local or urgent deliveries.' },
            { keys: ['privacy','data','personal information'], answer: 'Personal and delivery information should be handled only for account, matching, payment, tracking, safety, and support purposes according to the platform’s privacy policy.' },
            { keys: ['hello','hi','hey','namaste','good morning','good afternoon','good evening'], answer: 'Hi! 👋 Ask me anything about TravelBuddy—sending parcels, travelers, tracking, pricing, safety, payments, OTP, cancellations, delivery issues, accounts, or earning while traveling.' },
            { keys: ['thank','thanks','thank you'], answer: 'You’re welcome! 😊 Ask me another TravelBuddy question anytime.' },
            { keys: ['who are you','your name','what are you'], answer: 'I’m Buddy AI, the TravelBuddy website assistant. I help users understand parcel delivery, traveler matching, tracking, payments, safety, and account flows.' }
        ];

        let best = null;
        let bestScore = 0;

        knowledge.forEach(item => {
            let score = 0;
            item.keys.forEach(key => {
                if (q.includes(key)) score += key.split(' ').length + 1;
            });
            if (score > bestScore) {
                bestScore = score;
                best = item;
            }
        });

        if (best) return best.answer;

        if (q.split(' ').length <= 2)
            return `I’m not fully sure what you mean by “${raw}”. Try adding a little more detail—for example: “How do I cancel a parcel?” or “Why is my OTP not coming?”`;

        return 'I can answer many TravelBuddy-related questions, but I may not have enough information for that one yet. Please rephrase it with details about your parcel, trip, payment, tracking, account, safety, cancellation, or delivery issue.';
    }

    launcher.addEventListener('click', () => setOpen(!panel.classList.contains('is-open')));
    if (minimize) minimize.addEventListener('click', () => setOpen(false));

    document.querySelectorAll('[data-buddy-action]').forEach(button => {
        button.addEventListener('click', () => handleAction(button.dataset.buddyAction));
    });

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const value = input.value.trim();
        if (!value) return;
        addMessage(value, 'user');
        input.value = '';
        botReply(answerQuestion(value));
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && panel.classList.contains('is-open')) setOpen(false);
    });

    // Automatically welcome first-time visitors after 20 seconds.
    // sessionStorage prevents the popup from reopening on every page refresh in the same tab.
    if (!sessionStorage.getItem('buddyAutoWelcomeShown')) {
        setTimeout(() => {
            if (!panel.classList.contains('is-open')) {
                setOpen(true);
                sessionStorage.setItem('buddyAutoWelcomeShown', 'true');

                setTimeout(() => {
                    addMessage('How can I help you today? 😊 You can ask me anything about TravelBuddy.', 'bot');
                }, 700);
            }
        }, 20000);
    }
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
        return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || 'Travel Buddy';
    }
    function initials(name) {
        return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('') || 'TB';
    }
    function render(user) {
        const name = fullName(user);
        document.getElementById('homeUserName').textContent = name;
        document.getElementById('homeAvatar').textContent = initials(name);
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
        document.getElementById('homeUserName').textContent = fullName(admin) || (admin.name || 'Admin');
        document.getElementById('homeAvatar').textContent = (fullName(admin) && fullName(admin).split(/\s+/).map(p=>p[0]).slice(0,2).join('')) || 'AD';
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
    const getName = (u) => `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.name || 'Travel Buddy';
    const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0,2).map(x => x[0].toUpperCase()).join('') || 'TB';
    const authHeaders = () => ({ 'Content-Type':'application/json', Authorization:`Bearer ${localStorage.getItem(isAdminLoggedIn ? 'travelBuddyAdminToken' : 'travelBuddyToken') || ''}` });


    function renderAvatar(el, user, name) {
      if (!el) return;
      if (user.profilePhoto) {
        el.textContent='';
        // Handle both data URLs and regular URLs
        const photoUrl = user.profilePhoto.startsWith('data:') ? user.profilePhoto : 
                        (user.profilePhoto.startsWith('http') ? user.profilePhoto :
                        (user.profilePhoto.startsWith('/') ? `${API_ORIGIN}${user.profilePhoto}` : user.profilePhoto));
        el.style.backgroundImage=`url(${photoUrl})`;
        el.classList.add('has-photo');
      } else {
        el.style.backgroundImage='';
        el.classList.remove('has-photo');
        el.textContent=initials(name);
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