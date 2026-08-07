// =========================================================
// TravelBuddy — Support Page
// Self-contained (does NOT load ../home/script.js) so its own Buddy AI
// instance below doesn't double up with the one on the Home page.
// =========================================================

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ============ DATA ============ */
const SP_CATS = {
    parcels:  { label: 'Parcels',              icon: 'fa-box' },
    trips:    { label: 'Travelers & Tracking',  icon: 'fa-route' },
    payments: { label: 'Payments',              icon: 'fa-wallet' },
    account:  { label: 'Account',               icon: 'fa-user' },
    safety:   { label: 'Safety',                icon: 'fa-shield-halved' },
    refunds:  { label: 'Refunds',               icon: 'fa-rotate-left' }
};

const SP_TOPICS = [
    { cat: 'parcels',  title: 'Sending a parcel',            desc: 'Posting a parcel, choosing a category, and editing details before a traveler accepts.', count: 9 },
    { cat: 'trips',    title: 'Travelers & live tracking',    desc: 'Adding a trip, matching with parcels, and watching a delivery move in real time.', count: 11 },
    { cat: 'payments', title: 'Payments & wallet',            desc: 'Accepted methods, escrow holds, receipts, and where your balance lives.', count: 8 },
    { cat: 'account',  title: 'Account & verification',       desc: 'Login issues, ID verification, and keeping your profile up to date.', count: 7 },
    { cat: 'safety',   title: 'Safety & trust',                desc: 'How travelers are verified, OTP handovers, and reporting a problem.', count: 6 },
    { cat: 'refunds',  title: 'Refunds & cancellations',      desc: 'Cancellation rules by stage, and how long refunds take to land.', count: 9 }
];

const SP_FAQS = [
    { cat:'parcels', q:'How do I send a parcel with TravelBuddy?', a:'Log in, open “Post a Parcel,” and add your pickup and destination details, then choose a parcel category. TravelBuddy shows matching travelers already heading your way — review one and confirm to lock in the delivery.' },
    { cat:'parcels', q:'What can I send, and what\u2019s not allowed?', a:'Common categories include documents, electronics, clothing, gifts, books, packaged food, and personal items. Illegal, dangerous, explosive, flammable, or undeclared items are never allowed, and travelers can review your parcel details before accepting.' },
    { cat:'parcels', q:'Can I edit a parcel after posting it?', a:'Yes — pickup, destination, and category can be edited freely until a traveler accepts the request. After that, changes should go through the traveler directly or through support if it\u2019s urgent.' },
    { cat:'parcels', q:'Does parcel weight or size affect price?', a:'Yes. Declaring accurate weight and size helps TravelBuddy match you with a traveler who has room for it, and it factors into the price shown before you confirm.' },
    { cat:'trips', q:'How do I find a traveler for my route?', a:'Enter your From and To locations plus a parcel category in the search bar on the Home page. TravelBuddy matches your request against travelers who already have an upcoming trip on that route.' },
    { cat:'trips', q:'How do I add a trip and earn as a traveler?', a:'Post an upcoming trip with your route and dates, then browse route-matched parcel requests. Choose what you\u2019re comfortable carrying, accept, complete the delivery, and your earnings post to your wallet.' },
    { cat:'trips', q:'How do I track my parcel live?', a:'Open your dashboard and select the active parcel — the tracking view shows its latest status and journey progress as the traveler moves.' },
    { cat:'trips', q:'What is the delivery OTP for?', a:'The receiver holds a one-time password that confirms successful handover. Only share it at the actual moment of delivery — support and travelers should never ask for it in advance.' },
    { cat:'trips', q:'My parcel tracking hasn\u2019t updated in a while — what should I do?', a:'Check live tracking first, since updates can lag slightly on longer routes. If it stays stuck or the delivery seems delayed, message the traveler through the in-app chat, and raise a ticket below if it doesn\u2019t resolve.' },
    { cat:'account', q:'I can\u2019t log in — what should I check first?', a:'Confirm you\u2019re using the email or number your account was created with, then use “Forgot password” on the login screen. Reset links and OTPs expire quickly, so request a fresh one if it\u2019s gone stale.' },
    { cat:'account', q:'How do I verify my profile?', a:'Upload a government ID during registration, or from Profile → Verification if you skipped it. A verified badge appears on your profile once it\u2019s approved, which builds trust with the other side of the match.' },
    { cat:'account', q:'Can I switch between sender and traveler roles?', a:'Yes — every TravelBuddy account can post parcels and add trips. Your profile shows both histories, so there\u2019s no separate account needed to switch roles.' },
    { cat:'payments', q:'What payment methods does TravelBuddy accept?', a:'Cards, UPI, net banking, and your TravelBuddy wallet balance, depending on your region. You\u2019ll see exactly what\u2019s available at checkout.' },
    { cat:'payments', q:'Why was I charged before my parcel was delivered?', a:'Payment is held securely (escrow-style) when you confirm a match, and only released to the traveler once the receiver confirms delivery with their OTP. This protects both sides of the transaction.' },
    { cat:'payments', q:'Where can I find a receipt or my wallet history?', a:'Open Dashboard → Wallet to see your balance and every transaction, or Dashboard → Payments for itemized receipts you can export.' },
    { cat:'safety', q:'How are travelers verified?', a:'Every traveler completes ID verification, and their trip history and ratings from past deliveries are visible on their profile before you match with them.' },
    { cat:'safety', q:'What if my parcel arrives lost or damaged?', a:'Keep photos of the parcel and any tracking or chat records. Report it through “Raise a ticket” below with your parcel ID — our team reviews the trip and delivery records to resolve it.' },
    { cat:'safety', q:'I feel unsafe about a match — what can I do?', a:'You\u2019re never obligated to confirm a match that feels wrong. Decline it, and if a traveler or sender is acting inappropriately, report their profile from the match screen so our safety team can review it.' },
    { cat:'refunds', q:'How do refunds work if a trip is cancelled?', a:'If a traveler cancels before pickup, you get a full refund to your wallet or original payment method. Cancellations after pickup follow a partial-refund scale shown in your parcel\u2019s cancellation policy.' },
    { cat:'refunds', q:'How long do refunds take to land?', a:'Wallet credit is instant. Refunds to your original card or bank account typically take 5–7 business days depending on your provider.' },
    { cat:'refunds', q:'Can I cancel a parcel I posted myself?', a:'Yes, free of charge any time before a traveler accepts it. Once accepted, check the cancellation policy on the parcel for any applicable fee.' }
];

/* ============ TOPIC CARDS ============ */
const topicsGrid = document.getElementById('spTopicsGrid');
if (topicsGrid) {
    SP_TOPICS.forEach(t => {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'card sp-reveal';
        el.dataset.cat = t.cat;
        el.innerHTML = `
            <i class="fa-solid ${SP_CATS[t.cat].icon}" aria-hidden="true"></i>
            <h3>${t.title}</h3>
            <p>${t.desc}</p>
            <span class="sp-card-count">${t.count} articles <i class="fa-solid fa-arrow-right"></i></span>
        `;
        el.addEventListener('click', () => { setActiveTab(t.cat); scrollToFaq(); });
        topicsGrid.appendChild(el);
    });
}

/* ============ FAQ RENDER ============ */
const faqList = document.getElementById('spFaqList');
function renderFaqs() {
    if (!faqList) return;
    faqList.innerHTML = '';
    SP_FAQS.forEach(f => {
        const item = document.createElement('div');
        item.className = 'faq-item';
        item.dataset.cat = f.cat;
        item.dataset.q = f.q.toLowerCase();
        item.dataset.a = f.a.toLowerCase();
        item.innerHTML = `
            <button class="faq-question" aria-expanded="false">
                <span>${f.q}</span>
                <span class="faq-toggle" aria-hidden="true"></span>
            </button>
            <div class="faq-answer"><div class="faq-answer-inner"><p>${f.a}</p></div></div>
        `;
        const btn = item.querySelector('.faq-question');
        btn.addEventListener('click', () => {
            const willOpen = !item.classList.contains('is-open');
            document.querySelectorAll('.faq-item').forEach(other => {
                other.classList.remove('is-open');
                other.querySelector('.faq-question')?.setAttribute('aria-expanded', 'false');
            });
            if (willOpen) {
                item.classList.add('is-open');
                btn.setAttribute('aria-expanded', 'true');
            }
        });
        faqList.appendChild(item);
    });
}
renderFaqs();

/* ============ FILTERING (tabs + search) ============ */
let spCurrentCat = 'all';
let spCurrentQuery = '';

function applyFilters() {
    let visible = 0;
    document.querySelectorAll('.faq-item').forEach(item => {
        const matchesCat = spCurrentCat === 'all' || item.dataset.cat === spCurrentCat;
        const matchesQuery = !spCurrentQuery || item.dataset.q.includes(spCurrentQuery) || item.dataset.a.includes(spCurrentQuery);
        const show = matchesCat && matchesQuery;
        item.classList.toggle('sp-hidden', !show);
        if (show) visible++;
    });
    document.getElementById('spFaqEmpty')?.classList.toggle('show', visible === 0);
}

function setActiveTab(cat) {
    spCurrentCat = cat;
    document.querySelectorAll('.sp-tab').forEach(t => t.classList.toggle('active', t.dataset.cat === cat));
    applyFilters();
}

document.getElementById('spTabs')?.addEventListener('click', e => {
    const btn = e.target.closest('.sp-tab');
    if (btn) setActiveTab(btn.dataset.cat);
});

document.getElementById('spChips')?.addEventListener('click', e => {
    const chip = e.target.closest('.sp-chip');
    if (!chip) return;
    setActiveTab(chip.dataset.cat);
    scrollToFaq();
});

function scrollToFaq() {
    document.getElementById('faq')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
}

const spSearchInput = document.getElementById('spSearchInput');
document.getElementById('spSearchForm')?.addEventListener('submit', e => {
    e.preventDefault();
    spCurrentQuery = spSearchInput.value.trim().toLowerCase();
    setActiveTab('all');
    scrollToFaq();
});
spSearchInput?.addEventListener('input', () => {
    spCurrentQuery = spSearchInput.value.trim().toLowerCase();
    applyFilters();
});

/* ============ SCROLL REVEAL ============ */
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, idx) => {
        if (entry.isIntersecting) {
            entry.target.style.transitionDelay = Math.min(idx % 6, 5) * 0.07 + 's';
            entry.target.classList.add('sp-in-view');
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.15 });
document.querySelectorAll('.sp-reveal').forEach(el => revealObserver.observe(el));

/* ============ COUNTERS ============ */
function animateCounters() {
    document.querySelectorAll('.sp-count').forEach(el => {
        const target = parseInt(el.dataset.count, 10);
        const suffix = el.dataset.suffix || '';
        if (reduceMotion) { el.textContent = target + suffix; return; }
        let cur = 0;
        const step = Math.max(1, Math.round(target / 36));
        const iv = setInterval(() => {
            cur += step;
            if (cur >= target) { cur = target; clearInterval(iv); }
            el.textContent = cur + suffix;
        }, 28);
    });
}
const statsEl = document.querySelector('.sp-stats');
if (statsEl) {
    const statsObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => { if (entry.isIntersecting) { animateCounters(); statsObserver.disconnect(); } });
    }, { threshold: 0.4 });
    statsObserver.observe(statsEl);
}

/* ============ ROUTE ANIMATION ============ */
const routeCard = document.querySelector('.sp-route-card');
if (routeCard) {
    const routeObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => entry.target.classList.toggle('sp-in-view', entry.isIntersecting));
    }, { threshold: 0.3 });
    routeObserver.observe(routeCard);
}

/* ============ TICKET FORM ============ */
const ticketForm = document.getElementById('spTicketForm');
const submitBtn = document.getElementById('spSubmitBtn');

function setFieldError(id, msg) {
    const field = document.getElementById(id);
    if (!field) return;
    field.classList.toggle('sp-error', !!msg);
    field.querySelector('.sp-field-msg').textContent = msg || '';
}

ticketForm?.addEventListener('submit', e => {
    e.preventDefault();
    let valid = true;

    const name = document.getElementById('tfName').value.trim();
    const email = document.getElementById('tfEmail').value.trim();
    const topic = document.getElementById('tfTopic').value;
    const message = document.getElementById('tfMsg').value.trim();

    if (!name) { setFieldError('fName', 'Enter your name'); valid = false; } else setFieldError('fName', '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFieldError('fEmail', 'Enter a valid email'); valid = false; } else setFieldError('fEmail', '');
    if (!topic) { setFieldError('fTopic', 'Choose a topic'); valid = false; } else setFieldError('fTopic', '');
    if (message.length < 10) { setFieldError('fMsg', 'Add a few more details (10+ characters)'); valid = false; } else setFieldError('fMsg', '');

    if (!valid) return;

    submitBtn.classList.add('sp-loading');
    submitBtn.disabled = true;

    setTimeout(() => {
        submitBtn.classList.remove('sp-loading');
        submitBtn.disabled = false;
        const ticket = 'TB-' + Math.floor(100000 + Math.random() * 899999);
        document.getElementById('spTicketNum').textContent = ticket;
        document.getElementById('spSuccess').classList.add('sp-show');
        ticketForm.reset();
        showToast(`Ticket ${ticket} submitted`);
    }, 1100);
});

/* ============ DIRECT CHANNELS ============ */
document.getElementById('spEmailChannel')?.addEventListener('click', e => {
    e.preventDefault();
    navigator.clipboard?.writeText('support@travelbuddy.com').catch(() => {});
    showToast('Email address copied');
});
document.getElementById('spLiveChatBtn')?.addEventListener('click', () => openBuddy());

/* ============ TOAST ============ */
let spToastTimer;
function showToast(msg) {
    const toast = document.getElementById('spToast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('sp-show');
    clearTimeout(spToastTimer);
    spToastTimer = setTimeout(() => toast.classList.remove('sp-show'), 2600);
}

/* ============ BUDDY AI — SUPPORT ASSISTANT ============ */
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

    let closeTimer;

    function setOpen(open) {
        clearTimeout(closeTimer);
        if (open) {
            panel.classList.add('is-open');
            launcher.classList.add('is-open');
            launcher.setAttribute('aria-expanded', 'true');
            panel.setAttribute('aria-hidden', 'false');
            if (notification) notification.classList.add('is-hidden');
            setTimeout(() => input.focus(), 350);
        } else {
            panel.classList.remove('is-open');
            launcher.classList.remove('is-open');
            launcher.setAttribute('aria-expanded', 'false');
            panel.setAttribute('aria-hidden', 'true');
        }
    }
    window.openBuddy = () => setOpen(true);

    function timeNow() {
        return new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit' }).format(new Date());
    }

    function addMessage(text, sender = 'bot') {
        const row = document.createElement('div');
        row.className = `buddy-message buddy-${sender}-message`;
        if (sender === 'bot') {
            const avatar = document.createElement('div');
            avatar.className = 'buddy-message-avatar';
            avatar.innerHTML = '<i class="fa-solid fa-headset" aria-hidden="true"></i>';
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

    function botReply(text) { showTyping(() => addMessage(text, 'bot')); }

    function goToTicket() {
        setOpen(false);
        setTimeout(() => document.getElementById('spRoute')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' }), 180);
    }

    function handleAction(action) {
        const asked = {
            track: 'Track my parcel',
            refund: 'What\u2019s my refund status?',
            payment: 'I have a payment issue',
            agent: 'Talk to a human'
        }[action] || 'Help me';
        addMessage(asked, 'user');

        const replies = {
            track: 'Open Dashboard \u2192 select the active parcel to see live tracking. If it hasn\u2019t updated in a while, message the traveler in-app, or raise a ticket and include your parcel ID so we can check it directly.',
            refund: 'Wallet refunds are instant; refunds to a card or bank account take 5\u20137 business days. Raise a ticket with your parcel ID below and I\u2019ll flag it for priority review.',
            payment: 'Most payment issues are a temporary hold that clears in a few days. If a charge still looks wrong after that, raise a ticket with your parcel or booking ID and our payments team will look into it.',
            agent: 'Connecting you with a human agent \u2014 the fastest way is the ticket form just below the chat. Fill it in and our team typically replies within 4 minutes.'
        };
        botReply(replies[action]);

        if (action === 'agent' || action === 'refund' || action === 'payment') {
            setTimeout(goToTicket, 1400);
        }
    }

    function answerQuestion(raw) {
        const q = raw.toLowerCase().replace(/[^\w\s₹-]/g, ' ').replace(/\s+/g, ' ').trim();

        const knowledge = [
            { keys: ['price','cost','charge','fee','how much','rate','cheap','expensive'], answer: 'Delivery cost depends on distance, parcel size or weight, urgency, and traveler availability. You\u2019ll see the final price before confirming a match.' },
            { keys: ['safe','safety','secure','trust','verified','verification','fraud','scam'], answer: 'TravelBuddy is built around verified travelers, escrow-protected payments, OTP delivery confirmation, ratings, and support for disputes.' },
            { keys: ['track','tracking','location','where is my parcel','parcel status','live status'], answer: 'For an active delivery, log in and open the parcel in your dashboard to see its latest tracking status and journey progress.' },
            { keys: ['traveler','traveller','find traveler','find traveller','match','matching'], answer: 'Enter your From and To locations plus a parcel category on the Home page, and TravelBuddy matches your request with travelers already going that way.' },
            { keys: ['send','post parcel','parcel request','ship','delivery request'], answer: 'To send a parcel: log in, add pickup and destination details, choose a parcel category, review matching travelers, and confirm the delivery.' },
            { keys: ['earn','earning','money','income','trip','carry parcel','become traveler'], answer: 'Travelers add an upcoming trip, browse route-matched parcel requests, choose what to carry, complete the delivery, and receive earnings in their wallet.' },
            { keys: ['otp','one time password','confirm delivery','delivery code'], answer: 'The receiver holds a one-time password used to confirm successful delivery. Only share it at the actual moment of handover \u2014 support never asks for it.' },
            { keys: ['payment','pay','failed payment','payment failed'], answer: 'Payment is held securely when you confirm a match and released to the traveler once delivery is confirmed with OTP. Failed charges usually clear within a few days.' },
            { keys: ['refund','money back'], answer: 'Wallet refunds are instant. Refunds to your original card or bank account take about 5\u20137 business days. Raise a ticket with your parcel ID if it\u2019s taking longer.' },
            { keys: ['how it works','how does travelbuddy work','process','steps','workflow'], answer: 'TravelBuddy works in five steps: Post Parcel \u2192 Find a Traveler \u2192 Confirm & Pay Securely \u2192 Track the Journey \u2192 Verify Delivery with OTP.' },
            { keys: ['login','sign in','cannot login','forgot password','password'], answer: 'Use the Login page to access your account. If you forgot your password, use the password recovery option on the login screen.' },
            { keys: ['register','signup','sign up','create account','new account'], answer: 'Choose Register from the navigation bar, create your account, and complete verification before using protected delivery features.' },
            { keys: ['document','documents','allowed parcel','what can i send','parcel category'], answer: 'Common categories include documents, electronics, clothing, gifts, books, packaged food, and personal items. Illegal or restricted items are never allowed.' },
            { keys: ['prohibited','restricted','illegal','not allowed','dangerous goods','weapon','drug'], answer: 'Never send illegal, dangerous, explosive, flammable, or undeclared items \u2014 travelers can review parcel details before accepting.' },
            { keys: ['weight','size','kg','kilogram','heavy','large parcel'], answer: 'Declare parcel size and weight accurately \u2014 it affects traveler matching, available space, and the price shown before you confirm.' },
            { keys: ['cancel','cancellation','cancel parcel','cancel booking'], answer: 'You can cancel free of charge before a traveler accepts. After that, check the cancellation policy shown on your parcel for any applicable fee or refund amount.' },
            { keys: ['delay','late','not delivered','delivery late'], answer: 'Check live tracking first. If it\u2019s stuck or clearly delayed, message the traveler in-app, and raise a ticket below if it doesn\u2019t resolve.' },
            { keys: ['lost','missing','damaged','broken'], answer: 'Keep photos and tracking or chat records, then raise a ticket with your parcel ID below \u2014 we\u2019ll review the trip and delivery records to resolve it.' },
            { keys: ['rating','review','stars','feedback'], answer: 'After a completed delivery, both sides can rate the experience \u2014 ratings help build trust and improve future matching.' },
            { keys: ['ticket','raise a ticket','open a ticket','complaint'], answer: 'Scroll down to \u201cLet\u2019s get this sorted together\u201d and fill in the form \u2014 you\u2019ll get a ticket number instantly and a reply in about 4 minutes on average.' },
            { keys: ['human','agent','real person','talk to someone','live agent'], answer: 'Happy to connect you \u2014 the fastest route is the ticket form just below this chat, or call +1 (800) 555-0142, available 24/7.' },
            { keys: ['hello','hi','hey','namaste','good morning','good afternoon','good evening'], answer: 'Hi! \ud83d\udc4b Ask me anything about a parcel, payment, tracking, refund, safety, or account issue \u2014 or ask to talk to a human.' },
            { keys: ['thank','thanks','thank you'], answer: 'You\u2019re welcome! \ud83d\ude0a Anything else I can help with?' },
            { keys: ['who are you','your name','what are you'], answer: 'I\u2019m Buddy AI, the TravelBuddy support assistant \u2014 here to help with parcels, tracking, payments, safety, refunds, and accounts.' }
        ];

        let best = null, bestScore = 0;
        knowledge.forEach(item => {
            let score = 0;
            item.keys.forEach(key => { if (q.includes(key)) score += key.split(' ').length + 1; });
            if (score > bestScore) { bestScore = score; best = item; }
        });

        if (best) return best.answer;
        if (q.split(' ').length <= 2) return `I\u2019m not fully sure what you mean by \u201c${raw}\u201d. Try adding a little detail \u2014 for example: \u201cwhy is my refund taking so long\u201d.`;
        return 'I can help with most TravelBuddy questions, but I may not have that one yet. Try rephrasing with details about your parcel, payment, tracking, account, or safety issue \u2014 or raise a ticket below.';
    }

    launcher.addEventListener('click', () => setOpen(!panel.classList.contains('is-open')));
    if (minimize) minimize.addEventListener('click', () => setOpen(false));

    document.querySelectorAll('[data-buddy-action]').forEach(button => {
        button.addEventListener('click', () => handleAction(button.dataset.buddyAction));
    });

    form.addEventListener('submit', event => {
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
})();
