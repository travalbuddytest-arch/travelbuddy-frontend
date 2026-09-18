// =========================================================
// TravelBuddy — Support Page (Public Informational)
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

const SP_FAQS = [
    { cat:'parcels', q:'How do I send a parcel with CarryParcel?', a:'Log in, open “Post a Parcel,” and add your pickup and destination details, then choose a parcel category. CarryParcel shows matching travelers already heading your way — review one and confirm to lock in the delivery.' },
    { cat:'parcels', q:'What can I send, and what\u2019s not allowed?', a:'Common categories include documents, electronics, clothing, gifts, books, packaged food, and personal items. Illegal, dangerous, explosive, flammable, or undeclared items are never allowed, and travelers can review your parcel details before accepting.' },
    { cat:'parcels', q:'Can I edit a parcel after posting it?', a:'Yes — pickup, destination, and category can be edited freely until a traveler accepts the request. After that, changes should go through the traveler directly or through support if it\u2019s urgent.' },
    { cat:'parcels', q:'Does parcel weight or size affect price?', a:'Yes. Declaring accurate weight and size helps TravelBuddy match you with a traveler who has room for it, and it factors into the price shown before you confirm.' },
    { cat:'trips', q:'How do I find a traveler for my route?', a:'Enter your From and To locations plus a parcel category in the search bar on the Home page. CarryParcel matches your request against travelers who already have an upcoming trip on that route.' },
    { cat:'trips', q:'How do I add a trip and earn as a traveler?', a:'Post an upcoming trip with your route and dates, then browse route-matched parcel requests. Choose what you\u2019re comfortable carrying, accept, complete the delivery, and your earnings post to your wallet.' },
    { cat:'trips', q:'How do I track my parcel live?', a:'Open your dashboard and select the active parcel — the tracking view shows its latest status and journey progress as the traveler moves.' },
    { cat:'trips', q:'What is the delivery OTP for?', a:'The receiver holds a one-time password that confirms successful handover. Only share it at the actual moment of delivery — support and travelers should never ask for it in advance.' },
    { cat:'trips', q:'My parcel tracking hasn\u2019t updated in a while — what should I do?', a:'Check live tracking first, since updates can lag slightly on longer routes. If it stays stuck or the delivery seems delayed, message the traveler through the in-app chat, and raise a ticket below if it doesn\u2019t resolve.' },
    { cat:'account', q:'I can\u2019t log in — what should I check first?', a:'Confirm you\u2019re using the email or number your account was created with, then use “Forgot password” on the login screen. Reset links and OTPs expire quickly, so request a fresh one if it\u2019s gone stale.' },
    { cat:'account', q:'How do I verify my profile?', a:'Upload a government ID during registration, or from Profile → Verification if you skipped it. A verified badge appears on your profile once it\u2019s approved, which builds trust with the other side of the match.' },
    { cat:'account', q:'Can I switch between sender and traveler roles?', a:'Yes — every CarryParcel account can post parcels and add trips. Your profile shows both histories, so there\u2019s no separate account needed to switch roles.' },
    { cat:'payments', q:'What payment methods does CarryParcel accept?', a:'Cards, UPI, net banking, and your CarryParcel wallet balance, depending on your region. You\u2019ll see exactly what\u2019s available at checkout.' },
    { cat:'payments', q:'Why was I charged before my parcel was delivered?', a:'Payment is held securely when you confirm a match, and only released to the traveler once the receiver confirms delivery with their OTP. This protects both sides of the transaction.' },
    { cat:'payments', q:'Where can I find a receipt or my wallet history?', a:'Open Dashboard → Wallet to see your balance and every transaction, or Dashboard → Payments for itemized receipts you can export.' },
    { cat:'safety', q:'How are travelers verified?', a:'Every traveler completes ID verification, and their trip history and ratings from past deliveries are visible on their profile before you match with them.' },
    { cat:'safety', q:'What if my parcel arrives lost or damaged?', a:'Keep photos of the parcel and any tracking or chat records. Report it through “Raise a ticket” below with your parcel ID — our team reviews the trip and delivery records to resolve it.' },
    { cat:'safety', q:'I feel unsafe about a match — what can I do?', a:'You\u2019re never obligated to confirm a match that feels wrong. Decline it, and if a traveler or sender is acting inappropriately, report their profile from the match screen so our safety team can review it.' },
    { cat:'refunds', q:'How do refunds work if a trip is cancelled?', a:'If a traveler cancels before pickup, you get a full refund to your wallet or original payment method. Cancellations after pickup follow a partial-refund scale shown in your parcel\u2019s cancellation policy.' },
    { cat:'refunds', q:'How long do refunds take to land?', a:'Wallet credit is instant. Refunds to your original card or bank account typically take 5–7 business days depending on your provider.' },
    { cat:'refunds', q:'Can I cancel a parcel I posted myself?', a:'Yes, free of charge any time before a traveler accepts it. Once accepted, check the cancellation policy on the parcel for any applicable fee.' }
];

/* ============ FAQ RENDER ============ */
const faqList = document.getElementById('spFaqList');
function renderFaqs() {
    if (!faqList) return;
    faqList.innerHTML = '';

    const renderItem = (f) => {
        const item = document.createElement('div');
        item.className = 'faq-item';
        item.dataset.cat = f.cat;
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
        return item;
    };

    if (spCurrentCat === 'all' && !spCurrentQuery) {
        const cats = [...new Set(SP_FAQS.map(f => f.cat))];
        cats.forEach(catKey => {
            const catFaqs = SP_FAQS.filter(f => f.cat === catKey);
            if (catFaqs.length === 0) return;

            const header = document.createElement('h3');
            header.className = 'faq-category-header';
            header.textContent = SP_CATS[catKey]?.label || catKey;
            faqList.appendChild(header);

            catFaqs.forEach(f => faqList.appendChild(renderItem(f)));
        });
    } else {
        SP_FAQS.forEach(f => {
            const matchesCat = spCurrentCat === 'all' || f.cat === spCurrentCat;
            const matchesQuery = !spCurrentQuery || f.q.toLowerCase().includes(spCurrentQuery) || f.a.toLowerCase().includes(spCurrentQuery);
            if (matchesCat && matchesQuery) {
                faqList.appendChild(renderItem(f));
            }
        });
    }

    const visibleCount = faqList.querySelectorAll('.faq-item').length;
    document.getElementById('spFaqEmpty')?.classList.toggle('show', visibleCount === 0);
}

/* ============ FILTERING (tabs + search) ============ */
let spCurrentCat = 'all';
let spCurrentQuery = '';

function setActiveTab(cat) {
    spCurrentCat = cat;
    document.querySelectorAll('.sp-tab').forEach(t => t.classList.toggle('active', t.dataset.cat === cat));
    renderFaqs();
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
    renderFaqs();
});

/* ============ AUTH-AWARE REDIRECTION ============ */
function handleGetHelp() {
    const token = localStorage.getItem('travelBuddyToken');
    const dashboardSupportUrl = '/user-dashboard/support.html';

    if (token) {
        // User is logged in, send directly to dashboard support
        window.location.href = dashboardSupportUrl;
    } else {
        // User is logged out, send to login with redirect back to support
        window.location.href = `/login/login.html?redirect=${encodeURIComponent(dashboardSupportUrl)}`;
    }
}

document.querySelectorAll('.get-help-cta').forEach(btn => {
    btn.addEventListener('click', handleGetHelp);
});

/* ============ DIRECT CHANNELS ============ */
document.getElementById('spLiveChatBtn')?.addEventListener('click', () => {
    if (window.TBAiAssistant) window.TBAiAssistant.open();
});

/* ============ INITIALIZE ============ */
renderFaqs();

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
