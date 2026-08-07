/* ========================================
   Admin Dashboard JavaScript (formatted)
   ======================================== */

/* ---------- Configuration & Data ---------- */
const dashboardInfo = {
  command: ['Command Center', 'Live overview of your TravelBuddy platform'],
  operations: ['Live Operations', 'Monitor active parcel journeys in real time'],
  parcels: ['Parcel Control', 'Search, inspect and manage every parcel journey'],
  users: ['User Management', 'Complete user profiles, activity and account controls'],
  'active-users': ['Active Users', "Who's on TravelBuddy right now, and who visited recently"],
  cancellations: ['Parcel Outcomes', 'Deliveries and cancellations side by side — success rate, fees, revenue and reasons'],
  wallet: ['Wallet & Payments', 'Financial ledger, settlements and refunds'],
  messages: ['Users Activity', 'Every conversation on the platform — messages, calls and activity'],
  analytics: ['Analytics', 'Platform growth, performance and behavioral insights'],
  system: ['System Health', 'API, database, email and OTP monitoring'],
};

const infoCards = {
  parcels: [
    ['fa-box-open', 'Parcel 360°', 'Inspect the complete journey, users, payment, OTP events and timeline.'],
    ['fa-filter', 'Smart Filters', 'Filter by status, city, date, risk and payment type.'],
    ['fa-clock-rotate-left', 'Full Timeline', 'See every action and status change with exact timestamps.'],
  ],
  users: [
    ['fa-user-shield', 'User 360°', 'View account, parcels, wallet, ratings, disputes and activity.'],
    ['fa-user-lock', 'Account Controls', 'Warn, restrict, suspend or require verification.'],
    ['fa-chart-simple', 'Behavior Insights', 'Detect unusual cancellations and risky behavior.'],
  ],
  'active-users': [
    ['fa-circle-dot', 'Who\'s Online', 'See every user connected to TravelBuddy right now.'],
    ['fa-clock-rotate-left', 'Visit Log', 'Browse recent site visits sorted by most recent activity.'],
    ['fa-chart-line', 'Traffic Timeline', 'Spot when visits peak across the day.'],
  ],
  cancellations: [
    ['fa-circle-check', 'Delivery Success Rate', 'Compare delivered vs. cancelled outcomes over the last 30 days.'],
    ['fa-ban', 'Cancellation Overview', 'Monitor cancellations, actor and journey stage.'],
    ['fa-indian-rupee-sign', 'Revenue & Fee Intelligence', 'See delivered revenue, cancellation fees and platform share.'],
    ['fa-triangle-exclamation', 'Pattern Detection', 'Flag repeated or suspicious cancellations.'],
  ],
  wallet: [
    ['fa-book', 'Financial Ledger', 'Trace every rupee with reason and before/after balance.'],
    ['fa-money-bill-transfer', 'Settlements', 'Monitor pending, completed and failed settlements.'],
    ['fa-rotate-left', 'Refund Control', 'Controlled adjustments with mandatory reasons.'],
  ],
  analytics: [
    ['fa-arrow-trend-up', 'Growth Analytics', 'Track users, parcels, deliveries and revenue.'],
    ['fa-map-location-dot', 'Route Intelligence', 'Discover popular routes and demand gaps.'],
    ['fa-chart-pie', 'Marketplace Health', 'Compare acceptance, completion and cancellation rates.'],
  ],
  system: [
    ['fa-server', 'API Health', 'Monitor response time and backend availability.'],
    ['fa-database', 'Database Health', 'Track MongoDB connection and status.'],
    ['fa-envelope-circle-check', 'OTP & Email', 'Watch email delivery and OTP failures.'],
  ],
};

const statisticCards = [
  ['fa-users', 'Total Users', '12,847', '↑ 12.4% this month', 'users'],
  ['fa-circle-dot', 'Active Now', '438', 'Live users', 'active-users'],
  ['fa-box', 'Parcels Today', '284', '↑ 8.2% vs yesterday', 'parcels'],
  ['fa-truck-fast', 'Active Deliveries', '91', 'Currently moving', 'parcels'],
  ['fa-indian-rupee-sign', 'Platform Revenue', '₹84,620', '↑ 18.6% this month'],
  ['fa-triangle-exclamation', 'Needs Attention', '16', '4 critical issues'],
];

const activityFeed = [
  ['fa-box', 'New parcel posted', 'TB-48291 • Pune → Mumbai', 'Just now'],
  ['fa-person-walking-luggage', 'Traveler accepted parcel', 'TB-48274 • Traveler #TR-9201', '1 min'],
  ['fa-wallet', 'Wallet payment secured', '₹850 • Parcel TB-48266', '3 min'],
  ['fa-key', 'Pickup OTP verified', 'TB-48240 • Pickup confirmed', '5 min'],
  ['fa-truck-fast', 'Parcel entered transit', 'TB-48231 • Nashik → Pune', '8 min'],
  ['fa-circle-check', 'Delivery completed', 'TB-48198 • ₹1,240 settled', '12 min'],
];

const riskItems = [
  ['fa-wallet', 'Wallet settlement mismatch', 'Parcel TB-48291 • ₹1,250', 'Critical'],
  ['fa-clock', 'Delivery overdue by 4h', 'TB-38420 • Pune → Mumbai', 'High'],
  ['fa-key', '5 failed OTP attempts', 'User #US-9021 • 8 min ago', 'High'],
  ['fa-ban', 'Unusual cancellation pattern', '4 cancellations in 7 days', 'Medium'],
];

const journeyStats = [
  ['Waiting for traveler', 64],
  ['Accepted', 48],
  ['Pickup confirmed', 32],
  ['In transit', 91],
  ['Delivered today', 78],
];

const revenueData = [52, 76, 61, 88, 69, 94, 82];

const activeJourneys = [
  ['TB-48291', 'Pune → Mumbai', 76],
  ['TB-48274', 'Nashik → Pune', 48],
  ['TB-48266', 'Mumbai → Surat', 91],
  ['TB-48240', 'Nagpur → Pune', 35],
  ['TB-48231', 'Pune → Kolhapur', 64],
];

const searchData = [
  ['fa-box', 'TB-48291', 'Parcel • Pune → Mumbai • In transit'],
  ['fa-user', 'bhushan@example.com', 'User • 12 parcels • Active'],
  ['fa-shield-halved', 'DSP-0012', 'Dispute • High priority • Investigating'],
  ['fa-person-walking-luggage', 'TR-9201', 'Traveler • Trust score 92 • Verified'],
];

/* ---------- API Helpers ---------- */
const API_ORIGIN = `${window.location.origin}`;

async function apiGet(url) {
  const token = localStorage.getItem('admin_token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API_ORIGIN}${url}`, { headers, credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, data };
  return data;
}

async function apiPut(url, body) {
  const token = localStorage.getItem('admin_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_ORIGIN}${url}`, { method: 'PUT', headers, credentials: 'include', body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, data };
  return data;
}

async function fetchDashboardData() {
  return apiGet('/api/admin/dashboard');
}

/* ---------- DOM Elements ---------- */
const modal = document.getElementById('modal');
const openSearchButton = document.getElementById('openSearch');
const queryInput = document.getElementById('query');
const resultsContainer = document.getElementById('results');
const closeButton = document.getElementById('close');
const menuButton = document.getElementById('menu');
const sidebar = document.getElementById('side');
const overlay = document.getElementById('overlay');
const pageTitle = document.getElementById('title');
const pageSubtitle = document.getElementById('sub');
const toastBar = document.getElementById('toast');
const pageButtons = document.querySelectorAll('nav button');
const drawerEl = document.getElementById('userDrawer');
const drawerOverlay = document.getElementById('drawerOverlay');
const drawerBody = document.getElementById('drawerBody');
const drawerClose = document.getElementById('drawerClose');
const adminChip = document.getElementById('adminChip');
const adminMenu = document.getElementById('adminMenu');
const adminProfileBtn = document.getElementById('adminProfileBtn');
const adminSettingsBtn = document.getElementById('adminSettingsBtn');
const adminLogoutBtn = document.getElementById('adminLogoutBtn');

function getEl(id) {
  return document.getElementById(id);
}

/* ---------- Navigation State Persistence ----------
   Fixes: refreshing the dashboard (F5 / Ctrl+R) always dropped the admin
   back on Command Center, even if they were deep in Users, Parcels,
   Analytics, etc.

   How it works:
   - The active page id is the single source of truth for: sidebar
     highlight, page title/subtitle, which <section> is visible, the URL
     hash (#users, #parcels, ...) and sessionStorage.
   - sessionStorage (not localStorage) is used on purpose: it survives a
     refresh/reload of the tab (exactly the bug being fixed) but does not
     leak a stale "last page" into a brand new tab/window or a different
     admin session on a shared machine.
   - The URL hash is kept in sync via the History API (pushState on real
     navigation, replaceState on restore) so refreshing re-requests the
     same URL and the hash alone is enough to restore the page even if
     sessionStorage were ever unavailable (e.g. private browsing).
   - Every restore is validated against the actual set of known pages so a
     stale/tampered value can never point at a page that no longer exists;
     it safely falls back to Command Center instead. */
const NAV_STORAGE_KEY = 'travelBuddyAdminActivePage';
const NAV_SCROLL_KEY = 'travelBuddyAdminScrollPositions';
const NAV_SUBSTATE_PREFIX = 'travelBuddyAdminSubState:';
const VALID_PAGES = Object.keys(dashboardInfo);
const DEFAULT_PAGE = 'command';

function isValidPage(id) {
  return typeof id === 'string' && VALID_PAGES.includes(id) && !!document.getElementById(id);
}

function getSavedPage() {
  try {
    return sessionStorage.getItem(NAV_STORAGE_KEY);
  } catch {
    return null;
  }
}

function savePage(id) {
  try {
    sessionStorage.setItem(NAV_STORAGE_KEY, id);
  } catch {
    /* sessionStorage unavailable (e.g. private mode) — degrade gracefully, URL hash still works */
  }
}

function getScrollMap() {
  try {
    return JSON.parse(sessionStorage.getItem(NAV_SCROLL_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveScrollPosition(id, y) {
  try {
    const map = getScrollMap();
    map[id] = y;
    sessionStorage.setItem(NAV_SCROLL_KEY, JSON.stringify(map));
  } catch {
    /* non-fatal */
  }
}

function getScrollPosition(id) {
  const map = getScrollMap();
  return typeof map[id] === 'number' ? map[id] : 0;
}

// Small pub/sub other page modules (users.js, parcels.js, ...) can use to
// remember "sub-state" inside a page across a refresh — e.g. which drawer
// tab was open. Kept generic and page-scoped so any lazy-loaded page can
// opt in without admin.js needing to know its internals.
window.AdminNav = {
  getSubState(pageId) {
    try {
      const raw = sessionStorage.getItem(NAV_SUBSTATE_PREFIX + pageId);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  setSubState(pageId, data) {
    try {
      sessionStorage.setItem(NAV_SUBSTATE_PREFIX + pageId, JSON.stringify(data));
    } catch {
      /* non-fatal */
    }
  },
  clearSubState(pageId) {
    try {
      sessionStorage.removeItem(NAV_SUBSTATE_PREFIX + pageId);
    } catch {
      /* non-fatal */
    }
  },
};

function resolveInitialPage() {
  const fromHash = (location.hash || '').replace(/^#/, '').split('?')[0];
  if (isValidPage(fromHash)) return fromHash;
  const fromStorage = getSavedPage();
  if (isValidPage(fromStorage)) return fromStorage;
  return DEFAULT_PAGE;
}

let currentPageId = null;

/* Central place that actually switches the visible page. Used by sidebar
   clicks, KPI shortcuts, initial load and browser back/forward — so all of
   them stay in sync instead of each hand-rolling the same DOM toggles. */
function activatePage(id, { historyMode = 'push', restoreScroll = false } = {}) {
  if (!isValidPage(id)) id = DEFAULT_PAGE;
  if (!isValidPage(id)) return; // truly nothing to show; bail safely

  // Persist the scroll position of the page we're leaving before we switch.
  if (currentPageId && currentPageId !== id) {
    saveScrollPosition(currentPageId, window.scrollY || 0);
  }

  const activeBtn = document.querySelector('nav .active');
  const activePageEl = document.querySelector('.page.active');
  const btn = document.querySelector(`nav button[data-page="${id}"]`);
  const target = document.getElementById(id);
  if (!target) return;

  activeBtn?.classList.remove('active');
  activePageEl?.classList.remove('active');
  btn?.classList.add('active');
  target.classList.add('active');
  pageTitle.textContent = dashboardInfo[id][0];
  pageSubtitle.textContent = dashboardInfo[id][1];
  sidebar.classList.remove('open');
  overlay.classList.remove('show');

  if (target.dataset.loaded === 'false') {
    loadPageFragment(id, target);
  }

  currentPageId = id;
  savePage(id);

  if (historyMode !== 'none') {
    const url = `${location.pathname}${location.search}#${id}`;
    if (historyMode === 'replace') {
      history.replaceState({ page: id }, '', url);
    } else {
      history.pushState({ page: id }, '', url);
    }
  }

  if (restoreScroll) {
    // Wait a tick so lazy-loaded content (and its layout) is in the DOM
    // before we try to scroll to a saved position.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => window.scrollTo(0, getScrollPosition(id)));
    });
  } else {
    window.scrollTo(0, 0);
  }
}

function initializeScrollPersistence() {
  let saveTimer = null;
  window.addEventListener('scroll', () => {
    if (!currentPageId) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveScrollPosition(currentPageId, window.scrollY || 0), 150);
  }, { passive: true });

  // Safety net: also capture on unload in case the debounce timer above
  // didn't get to fire (e.g. the admin hits refresh mid-scroll).
  window.addEventListener('beforeunload', () => {
    if (currentPageId) saveScrollPosition(currentPageId, window.scrollY || 0);
  });
}

function initializeHistoryNavigation() {
  window.addEventListener('popstate', (e) => {
    const id = (e.state && e.state.page) || (location.hash || '').replace(/^#/, '') || DEFAULT_PAGE;
    activatePage(id, { historyMode: 'none', restoreScroll: true });
  });
}

/* ---------- Render Helpers ---------- */
function renderStatisticCards(data) {
  const kpisContainer = getEl('kpis');
  if (!kpisContainer) return;
  const items = data || statisticCards;
  kpisContainer.innerHTML = items
    .map(([icon, label, value, detail, page]) => `
      <article class="kpi${page ? ' kpi-clickable' : ''}"${page ? ` data-page-link="${page}" role="button" tabindex="0" title="View ${label}"` : ''}>
        <i class="ki fa-solid ${icon}"></i>
        <div>
          <span>${label}</span>
          <strong>${value}</strong>
          <small>${detail}</small>
        </div>
      </article>
    `)
    .join('');

  // Wire up clickable KPIs to jump to their related page
  kpisContainer.querySelectorAll('.kpi-clickable').forEach(card => {
    const go = () => {
      const id = card.dataset.pageLink;
      const btn = document.querySelector(`nav button[data-page="${id}"]`);
      btn?.click();
    };
    card.addEventListener('click', go);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
    });
  });
}

function renderActivityFeed(data) {
  const activityContainer = getEl('activity');
  if (!activityContainer) return;
  const items = data || activityFeed;
  activityContainer.innerHTML = items
    .map(([icon, title, desc, timeLabel]) => `
      <div class="activity">
        <i class="fa-solid ${icon}"></i>
        <div>
          <b>${title}</b>
          <p>${desc}</p>
        </div>
        <time>${timeLabel}</time>
      </div>
    `)
    .join('');
}

function renderRiskCards(data) {
  const risksContainer = getEl('risks');
  if (!risksContainer) return;
  const items = data || riskItems;
  risksContainer.innerHTML = items
    .map(([icon, title, desc, sev, orderId]) => `
      <div class="risk"${orderId ? ` data-order-id="${escHtml(orderId)}" title="View ${escHtml(orderId)} in Parcels" style="cursor:pointer"` : ''}>
        <i class="fa-solid ${icon}"></i>
        <div>
          <b>${title}</b>
          <p>${desc}</p>
        </div>
        <em class="sev-${sev ? sev.toLowerCase() : 'medium'}">${sev || 'Medium'}</em>
      </div>
    `)
    .join('');
}

// Switch to Parcels and pre-fill its search box with an order id. The
// Parcels fragment/script loads async (lazy-loaded + module script), so we
// poll briefly for #pcSearch to show up rather than assuming it's ready
// the instant the nav click fires.
function goToParcel(orderId) {
  const btn = document.querySelector('nav button[data-page="parcels"]');
  if (btn) btn.click();
  const trySearch = (attempts = 0) => {
    const input = document.getElementById('pcSearch');
    if (input) {
      input.value = orderId;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    } else if (attempts < 20) {
      setTimeout(() => trySearch(attempts + 1), 100);
    }
  };
  trySearch();
}

function renderJourneyDistribution(data) {
  const journeysContainer = getEl('journeys');
  if (!journeysContainer) return;
  const items = data || journeyStats;
  // Normalize bar widths to percentages — find max to compute relative
  const maxVal = Math.max(...items.map(([, v]) => v), 1);
  journeysContainer.innerHTML = items
    .map(([label, count]) => {
      const pct = Math.round((count / maxVal) * 100);
      return `
        <div>
          <span>${label} <b>${count}</b></span>
          <i><u style="--w:${pct}%"></u></i>
        </div>
      `;
    })
    .join('');
}

function renderRevenueChart(data) {
  const chartContainer = getEl('chart');
  if (!chartContainer) return;
  const items = data || revenueData;
  // data can be an array of percentages (old format) or an array of {day, amount, percent} (API format)
  const bars = Array.isArray(items) ? items.map(v => typeof v === 'number' ? v : (v.percent || 0)) : [];
  chartContainer.innerHTML = bars.map(v => `<i class="bar" style="height:${v}%"></i>`).join('');
}

function renderActiveJourneys(data) {
  const activeJourneysContainer = getEl('activeJourneys');
  if (!activeJourneysContainer) return;
  const items = data || activeJourneys;
  activeJourneysContainer.innerHTML = items
    .map(([id, route, prog]) => `
      <div class="jr">
        <b>${id}</b>
        <p>${route} • Live journey</p>
        <div class="progress"><i style="width:${Math.min(prog, 100)}%"></i></div>
      </div>
    `)
    .join('');
}

function renderOverviewCards() {
  Object.keys(infoCards).forEach(sectionId => {
    const el = document.getElementById(sectionId);
    if (!el) return;
    el.innerHTML = `
      <div class="intro">
        <h2>${dashboardInfo[sectionId][0]}</h2>
        <p>${dashboardInfo[sectionId][1]}</p>
      </div>
      <div class="cards">
        ${infoCards[sectionId].map(([icon, h, d]) => `
          <article class="card">
            <i class="fa-solid ${icon}"></i>
            <h3>${h}</h3>
            <p>${d}</p>
          </article>
        `).join('')}
      </div>
    `;
  });
}

/* ---------- Search Helpers ---------- */
let searchDebounce = null;

function openSearchModal() {
  modal.classList.add('show');
  // Show recent/default results on open
  if (resultsContainer) resultsContainer.innerHTML = '<div class="result" style="justify-content:center;color:#98a2b3;font-size:10px;">Type at least 2 characters to search</div>';
  setTimeout(() => queryInput?.focus(), 50);
}

function closeSearchModal() {
  modal.classList.remove('show');
  if (queryInput) queryInput.value = '';
}

async function renderSearchResults(q = '') {
  if (!resultsContainer) return;
  const query = String(q).trim();

  if (!query || query.length < 2) {
    resultsContainer.innerHTML = '<div class="result" style="justify-content:center;color:#98a2b3;font-size:10px;">Type at least 2 characters to search</div>';
    return;
  }

  // Show loading state
  resultsContainer.innerHTML = '<div class="result" style="justify-content:center;color:#98a2b3;font-size:10px;"><i class="fa-solid fa-spinner fa-spin" style="margin-right:6px"></i> Searching...</div>';

  try {
    const data = await apiGet(`/api/admin/search?q=${encodeURIComponent(query)}`);

    if (!data || data.total === 0) {
      resultsContainer.innerHTML = `<div class="result" style="justify-content:center;color:#98a2b3;font-size:10px;">No results for "${escHtml(query)}"</div>`;
      return;
    }

    // Build sections for each type that has results
    let html = '';

    if (data.parcels && data.parcels.length) {
      html += '<div class="search-section"><span class="search-section-label">Parcels</span></div>';
      html += data.parcels.map(p => `
        <div class="result" data-type="parcel" data-id="${escHtml(String(p._id || ''))}" data-order-id="${escHtml(String(p.orderId || ''))}">
          <i class="fa-solid ${p.icon || 'fa-box'}"></i>
          <div><b>${escHtml(p.label || p.orderId || '')}</b><span>${escHtml(p.subtitle || '')} • ${escHtml(p.detail || '')}</span></div>
        </div>
      `).join('');
    }

    if (data.users && data.users.length) {
      html += '<div class="search-section"><span class="search-section-label">Users</span></div>';
      html += data.users.map(u => `
        <div class="result" data-type="user" data-id="${escHtml(String(u._id || ''))}">
          <i class="fa-solid ${u.icon || 'fa-user'}"></i>
          <div><b>${escHtml(u.label || '')}</b><span>${escHtml(u.subtitle || '')}${u.detail ? ` • ${escHtml(u.detail)}` : ''}</span></div>
        </div>
      `).join('');
    }

    if (data.travelers && data.travelers.length) {
      html += '<div class="search-section"><span class="search-section-label">Travelers</span></div>';
      html += data.travelers.map(t => `
        <div class="result" data-type="traveler" data-id="${escHtml(String(t._id || ''))}">
          <i class="fa-solid ${t.icon || 'fa-person-walking-luggage'}"></i>
          <div><b>${escHtml(t.label || '')}</b><span>${escHtml(t.subtitle || '')}${t.detail ? ` • ${escHtml(t.detail)}` : ''}</span></div>
        </div>
      `).join('');
    }

    resultsContainer.innerHTML = html;

    // Add click handlers to result items
    resultsContainer.querySelectorAll('.result').forEach(el => {
      el.addEventListener('click', () => {
        const type = el.dataset.type;
        const id = el.dataset.id;
        if (type === 'parcel') {
          const orderId = el.dataset.orderId;
          closeSearchModal();
          if (orderId) goToParcel(orderId);
          else showToast('This parcel has no order ID to search for');
        } else if ((type === 'user' || type === 'traveler') && id) {
          closeSearchModal();
          fetchUserDetail(id);
        } else {
          showToast('Navigate to detail view');
          closeSearchModal();
        }
      });
    });
  } catch (err) {
    console.warn('Search failed:', err);
    resultsContainer.innerHTML = `
      <div class="result" style="justify-content:center;color:#f04438;font-size:10px;">
        <i class="fa-solid fa-cloud-exclamation" style="margin-right:6px"></i> Search failed.
        <button onclick="renderSearchResults('${escHtml(query)}')" class="retry-inline">Retry</button>
      </div>
    `;
  }
}

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(msg) { toastBar.textContent = msg; toastBar.classList.add('show'); setTimeout(() => toastBar.classList.remove('show'), 2000); }

/* ---------- User Detail Drawer ---------- */
function openDrawer() {
  drawerEl.classList.add('open');
  drawerOverlay.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeDrawer() {
  drawerEl.classList.remove('open');
  drawerOverlay.classList.remove('show');
  document.body.style.overflow = '';
}

async function fetchUserDetail(userId) {
  if (!drawerBody) return;
  drawerBody.innerHTML = '<div class="drawer-loading"><i class="fa-solid fa-spinner fa-spin" style="margin-right:6px"></i> Loading user details...</div>';
  openDrawer();

  try {
    const data = await apiGet(`/api/admin/users/${userId}`);
    renderUserDetail(data);
  } catch (err) {
    console.warn('Failed to load user detail:', err);
    drawerBody.innerHTML = `
      <div class="drawer-error">
        <i class="fa-solid fa-cloud-exclamation"></i> Could not load user details.
        <button onclick="fetchUserDetail('${userId}')" class="retry-inline">Retry</button>
      </div>
    `;
  }
}

function renderUserDetail(data) {
  if (!drawerBody || !data || !data.user) return;

  const u = data.user;
  const name = `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Unknown';
  const initials = (u.firstName?.[0] || '') + (u.lastName?.[0] || '');
  const statusColor = u.isOnline ? '#12b76a' : '#d0d5dd';

  let html = `
    <div class="dp-card">
      <div class="dp-avatar">${escHtml(initials || 'U')}</div>
      <div class="dp-info">
        <strong>${escHtml(name)}</strong>
        <span>${escHtml(u.email || '')}${u.phone ? ` • ${escHtml(u.phone)}` : ''}</span>
        <div class="dp-meta">
          <div class="dp-meta-item"><span>Wallet</span><strong>₹${(u.walletBalance || 0).toLocaleString()}</strong></div>
          <div class="dp-meta-item"><span>Rating</span><strong>${(u.rating || 0).toFixed(1)}</strong></div>
          <div class="dp-meta-item"><span>Status</span><strong style="color:${statusColor}">${u.isOnline ? 'Online' : 'Offline'}</strong></div>
          <div class="dp-meta-item"><span>Auth</span><strong>${escHtml(u.authProvider || 'local')}</strong></div>
        </div>
      </div>
    </div>
    <div class="drawer-section">
      <h3>Details</h3>
      <div class="detail-row"><span>User ID</span><span class="cell-mono">${escHtml(u._id || '')}</span></div>
      ${u.senderPublicId ? `<div class="detail-row"><span>Sender ID</span><span class="cell-mono">${escHtml(u.senderPublicId)}</span></div>` : ''}
      ${u.travelerPublicId ? `<div class="detail-row"><span>Traveler ID</span><span class="cell-mono">${escHtml(u.travelerPublicId)}</span></div>` : ''}
      <div class="detail-row"><span>Joined</span><span>${formatDate(u.createdAt)}</span></div>
      <div class="detail-row"><span>Last Seen</span><span>${u.lastSeenAt ? formatDate(u.lastSeenAt) : '—'}</span></div>
      <div class="detail-row"><span>Verified</span><span>${u.isVerified ? 'Yes' : 'No'}</span></div>
    </div>
  `;

  // Sent Parcels
  html += `<div class="drawer-section"><h3>Parcels Sent (${(data.sentParcels || []).length})</h3>`;
  if (data.sentParcels && data.sentParcels.length) {
    html += `<table class="drawer-table"><thead><tr><th>Order</th><th>Route</th><th>Status</th><th>Amount</th></tr></thead><tbody>`;
    html += data.sentParcels.map(p => `
      <tr>
        <td class="cell-mono">${escHtml(p.orderId || '—')}</td>
        <td>${escHtml(p.fromCity || '')} → ${escHtml(p.toCity || '')}</td>
        <td><span class="status-tag ${p.status === 'delivered' ? 'success' : p.status === 'cancelled' ? 'danger' : 'muted'}">${escHtml(p.status)}</span></td>
        <td class="cell-mono">₹${(p.price || 0).toLocaleString()}</td>
      </tr>
    `).join('');
    html += '</tbody></table>';
  } else {
    html += '<div class="drawer-empty">No parcels sent</div>';
  }
  html += '</div>';

  // Traveled Parcels
  html += `<div class="drawer-section"><h3>Parcels Delivered (${(data.travelerParcels || []).length})</h3>`;
  if (data.travelerParcels && data.travelerParcels.length) {
    html += `<table class="drawer-table"><thead><tr><th>Order</th><th>Route</th><th>Status</th><th>Earning</th></tr></thead><tbody>`;
    html += data.travelerParcels.map(p => `
      <tr>
        <td class="cell-mono">${escHtml(p.orderId || '—')}</td>
        <td>${escHtml(p.fromCity || '')} → ${escHtml(p.toCity || '')}</td>
        <td><span class="status-tag ${p.status === 'delivered' ? 'success' : p.status === 'cancelled' ? 'danger' : 'muted'}">${escHtml(p.status)}</span></td>
        <td class="cell-mono">₹${(p.travelerEarning || 0).toLocaleString()}</td>
      </tr>
    `).join('');
    html += '</tbody></table>';
  } else {
    html += '<div class="drawer-empty">No deliveries as traveler</div>';
  }
  html += '</div>';

  // Wallet
  const wallet = data.wallet || {};
  const summ = wallet.summary || {};
  html += `<div class="drawer-section">
    <h3>Wallet Activity</h3>
    <div style="display:flex;gap:8px;margin-bottom:10px;">
      <div class="dp-meta-item"><span>Credits</span><strong style="color:#12b76a">₹${(summ.totalCredits || 0).toLocaleString()}</strong></div>
      <div class="dp-meta-item"><span>Debits</span><strong style="color:#f04438">₹${(summ.totalDebits || 0).toLocaleString()}</strong></div>
      <div class="dp-meta-item"><span>Transactions</span><strong>${summ.txCount || 0}</strong></div>
    </div>`;
  if (wallet.transactions && wallet.transactions.length) {
    html += `<table class="drawer-table"><thead><tr><th>Date</th><th>Type</th><th>Direction</th><th>Amount</th></tr></thead><tbody>`;
    html += wallet.transactions.slice(0, 10).map(tx => `
      <tr>
        <td style="font-size:8px;color:#98a2b3">${new Date(tx.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
        <td style="font-size:8px">${escHtml(tx.type || '')}</td>
        <td><span class="status-tag ${tx.direction === 'credit' ? 'success' : tx.direction === 'debit' ? 'danger' : 'muted'}" style="font-size:7px;padding:1px 5px">${escHtml(tx.direction || '')}</span></td>
        <td class="cell-mono" style="color:${tx.direction === 'credit' ? '#12b76a' : tx.direction === 'debit' ? '#f04438' : 'inherit'}">₹${(tx.amount || 0).toLocaleString()}</td>
      </tr>
    `).join('');
    html += '</tbody></table>';
  } else {
    html += '<div class="drawer-empty">No wallet transactions</div>';
  }
  html += '</div>';

  drawerBody.innerHTML = html;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function updateDateLabel() {
  const dateLabel = getEl('date');
  if (dateLabel) {
    dateLabel.textContent = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }
}

/* ---------- Dashboard Data Loading ---------- */
function showDashboardSkeleton() {
  // Skeleton for KPI cards
  const kpisContainer = getEl('kpis');
  if (kpisContainer) {
    kpisContainer.innerHTML = Array(6).fill('').map(() => `
      <article class="kpi skel">
        <div class="ki skel-box"></div>
        <div>
          <span class="skel-line skel-w40"></span>
          <strong class="skel-line skel-w60 skel-h24"></strong>
          <small class="skel-line skel-w30"></small>
        </div>
      </article>
    `).join('');
  }
  // Skeleton for activity panel
  const act = document.getElementById('activity');
  if (act) {
    act.innerHTML = Array(5).fill('').map(() => `
      <div class="activity skel-row">
        <div class="skel-icon"></div>
        <div>
          <b class="skel-line skel-w50"></b>
          <p class="skel-line skel-w70"></p>
        </div>
        <div class="skel-line skel-w20"></div>
      </div>
    `).join('');
  }
  // Skeleton for risk panel
  const risk = document.getElementById('risks');
  if (risk) {
    risk.innerHTML = Array(3).fill('').map(() => `
      <div class="risk skel-row">
        <div class="skel-icon"></div>
        <div>
          <b class="skel-line skel-w55"></b>
          <p class="skel-line skel-w60"></p>
        </div>
        <div class="skel-badge"></div>
      </div>
    `).join('');
  }
  // Skeleton for journey distribution
  const jrn = document.getElementById('journeys');
  if (jrn) {
    jrn.innerHTML = Array(4).fill('').map(() => `
      <div>
        <span><span class="skel-line skel-w40"></span> <b class="skel-line skel-w10"></b></span>
        <i><u class="skel-bar"></u></i>
      </div>
    `).join('');
  }
  // Skeleton for chart
  const chart = document.getElementById('chart');
  if (chart) {
    chart.innerHTML = Array(7).fill('').map(() => `<i class="skel-chart-bar"></i>`).join('');
  }
}

function showDashboardError(err) {
  const msg = (err && (err.data && err.data.error || err.message)) || 'Dashboard data unavailable';
  // Replace all panels with a centered error card
  const kpisContainer = getEl('kpis');
  if (kpisContainer) {
    kpisContainer.innerHTML = `
      <div class="dashboard-error" style="grid-column:1/-1;text-align:center;padding:40px 20px;background:#fff;border:1px solid #fee4e2;border-radius:14px;">
        <i class="fa-solid fa-cloud-exclamation" style="font-size:32px;color:#f04438;margin-bottom:12px;"></i>
        <h3 style="margin:0 0 6px;font-size:15px;">Could not load dashboard</h3>
        <p style="font-size:11px;color:#667085;margin:0 0 16px;">${msg}</p>
        <button onclick="loadCommandData()" class="retry-btn" style="background:#1769ff;color:#fff;border:0;border-radius:8px;padding:8px 18px;font-weight:600;font-size:11px;cursor:pointer;">
          <i class="fa-solid fa-arrows-rotate"></i> Retry
        </button>
      </div>
    `;
  }
  // Hide skeleton in other panels
  ['activity', 'risks', 'journeys', 'chart'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<p style="font-size:10px;color:#98a2b3;padding:12px;">Unable to load data at this time.</p>';
  });
}

function renderRealDashboardData(data) {
  if (!data) return;
  const { stats, trends, journeyDistribution, revenueByDay, activity, risks, activeJourneys } = data;

  // Update the revenue total in the panel header
  const moneySpan = document.querySelector('.lower .money');
  if (moneySpan && stats) {
    moneySpan.textContent = `₹${(stats.platformRevenue || 0).toLocaleString()}`;
  }

  // Build KPI card data
  const kpiData = [
    ['fa-users', 'Total Users', (stats.totalUsers || 0).toLocaleString(), (trends && trends.usersGrowth != null) ? `↑ ${trends.usersGrowth}% this month` : 'No data', 'users'],
    ['fa-circle-dot', 'Active Now', (stats.activeNow || 0).toLocaleString(), 'Live users', 'active-users'],
    ['fa-box', 'Parcels Today', (stats.parcelsToday || 0).toLocaleString(), (trends && trends.parcelsGrowth != null) ? `↑ ${trends.parcelsGrowth}% vs yesterday` : 'No data', 'parcels'],
    ['fa-truck-fast', 'Active Deliveries', (stats.activeDeliveries || 0).toLocaleString(), 'Currently moving', 'parcels'],
    ['fa-indian-rupee-sign', 'Platform Revenue', `₹${(stats.platformRevenue || 0).toLocaleString()}`, (trends && trends.revenueGrowth != null) ? `↑ ${trends.revenueGrowth}% this month` : 'No data'],
    ['fa-triangle-exclamation', 'Needs Attention', (stats.needsAttention || 0).toString(), (stats.needsAttention > 0) ? `${stats.needsAttention > 5 ? 'Critical issues' : 'Needs review'}` : 'All clear'],
  ];
  renderStatisticCards(kpiData);

  // Activity feed
  if (activity && activity.length) {
    renderActivityFeed(activity.map(a => [a.icon, a.title, a.description, a.timeLabel]));
  } else {
    renderActivityFeed([['fa-circle-info', 'No recent activity', 'Waiting for platform events', '—']]);
  }

  // Risk queue
  if (risks && risks.length) {
    renderRiskCards(risks.map(r => [r.icon, r.title, r.description, r.severity, r.orderId]));
  } else {
    const riskParent = document.getElementById('risks');
    if (riskParent) riskParent.innerHTML = '<p style="font-size:10px;color:#12b76a;padding:12px;"><i class="fa-solid fa-circle-check"></i> No issues detected</p>';
  }

  // Journey distribution
  if (journeyDistribution) {
    const jData = [
      ['Waiting for traveler', journeyDistribution.pending || 0],
      ['Accepted', journeyDistribution.accepted || 0],
      ['Pickup confirmed', journeyDistribution.pickup_confirmed || 0],
      ['In transit', journeyDistribution.in_transit || 0],
      ['Delivered today', stats.deliveredToday || 0],
    ];
    renderJourneyDistribution(jData);
  }

  // Revenue chart
  if (revenueByDay && revenueByDay.length) {
    renderRevenueChart(revenueByDay);
    // Update day labels
    const daysContainer = document.querySelector('.days');
    if (daysContainer) {
      daysContainer.innerHTML = revenueByDay.map(d => `<span>${d.day}</span>`).join('');
    }
  }

  // Active journeys
  if (activeJourneys && activeJourneys.length) {
    renderActiveJourneys(activeJourneys.map(j => [j.orderId, j.route, j.progress]));
  } else {
    const activeJourneysContainer = getEl('activeJourneys');
    if (activeJourneysContainer) activeJourneysContainer.innerHTML = '<p style="font-size:10px;color:#98a2b3;padding:8px;">No active journeys right now.</p>';
  }
}

async function loadCommandData() {
  updateDateLabel();
  showDashboardSkeleton();

  try {
    const data = await fetchDashboardData();
    renderRealDashboardData(data);
  } catch (err) {
    console.warn('Dashboard fetch failed:', err);
    showDashboardError(err);
  }
}

/* ---------- Navigation & Events ---------- */
function initializeNavigation() {
  pageButtons.forEach(btn => btn.addEventListener('click', () => {
    activatePage(btn.dataset.page, { historyMode: 'push', restoreScroll: false });
  }));
}

function initializeSidebarToggle() {
  menuButton?.addEventListener('click', () => { sidebar.classList.add('open'); overlay.classList.add('show'); });
  overlay?.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('show'); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar?.classList.contains('open')) {
      sidebar.classList.remove('open');
      overlay.classList.remove('show');
    }
  });
}

function initializeSearch() {
  openSearchButton?.addEventListener('click', openSearchModal);
  closeButton?.addEventListener('click', closeSearchModal);
  // Tap-outside-to-close: the "ESC" chip is a small target and means nothing
  // on a touch device with no keyboard, so give mobile users a way to
  // dismiss the modal by tapping the backdrop, same as the other modals.
  modal?.addEventListener('click', (e) => { if (e.target === modal) closeSearchModal(); });
  queryInput?.addEventListener('input', (e) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => renderSearchResults(e.target.value), 250);
  });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openSearchModal(); }
    if (e.key === 'Escape') {
      if (drawerEl?.classList.contains('open')) { closeDrawer(); return; }
      if (modal?.classList.contains('show')) closeSearchModal();
    }
  });
}

function initializeInteractions() {
  document.addEventListener('click', (e) => {
    const risk = e.target.closest('.risk');
    if (risk) {
      const orderId = risk.dataset.orderId;
      if (orderId) goToParcel(orderId);
      else showToast('Demo action opened');
      return;
    }
    const card = e.target.closest('.card');
    if (card) showToast('Demo action opened');
  });

  // Refresh button lives inside the lazy-loaded command.html fragment, so
  // use delegation rather than binding once at startup (the element may
  // not exist yet, or may be re-created on re-render).
  document.addEventListener('click', (e) => {
    if (e.target.closest('#refreshCommand')) {
      if (typeof loadCommandData === 'function') loadCommandData();
      showToast('Dashboard refreshed');
    }
  });
}

function initializeAdminMenu() {
  if (!adminChip || !adminMenu) return;

  adminChip.addEventListener('click', (e) => {
    // Don't toggle when clicking an item inside the already-open menu;
    // let its own handler run and close the menu afterwards.
    if (e.target.closest('.admin-menu')) return;
    adminMenu.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!adminChip.contains(e.target)) adminMenu.classList.remove('open');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') adminMenu.classList.remove('open');
  });

  adminProfileBtn?.addEventListener('click', () => {
    adminMenu.classList.remove('open');
    openAdminProfileModal('photo');
  });

  adminSettingsBtn?.addEventListener('click', () => {
    adminMenu.classList.remove('open');
    openAdminProfileModal('security');
  });

  adminLogoutBtn?.addEventListener('click', () => {
    adminMenu.classList.remove('open');
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('travelBuddyAdminToken');
    // BUG FIX: 'travelBuddyAdmin' (used by the shared navbar on Home/Support/
    // About to decide whether to show the admin chip) was never cleared here.
    // Logging out from inside the admin dashboard left it behind, so those
    // pages kept showing "Super Admin" as still logged in.
    localStorage.removeItem('travelBuddyAdmin');
    window.location.href = '../../login/login.html';
  });
}

/* ---------- Lazy page loader (simple) ---------- */
async function loadPageFragment(id, targetEl) {
  try {
    const resp = await fetch(`./${id}.html`, { cache: 'no-store' });
    if (!resp.ok) throw new Error('Not found');
    const html = await resp.text();
    targetEl.innerHTML = html;
    // BUG FIX (critical): browsers do NOT execute <script> elements inserted via
    // innerHTML. Every fragment has `<script type="module" src="../js/{page}.js">`
    // which means the JS logic (fetching real data from the backend, populating
    // tables, rendering charts, etc.) never ran — all 10 lazy-loaded sections
    // appeared as empty shells with skeleton loaders that never resolved.
    // Fix: extract every <script> from the injected HTML and replace it with a
    // freshly created <script> element that the browser WILL execute.
    targetEl.querySelectorAll('script').forEach(function (oldScript) {
      var newScript = document.createElement('script');
      // Copy all attributes (typically type="module" and src="...")
      for (var i = 0; i < oldScript.attributes.length; i++) {
        var attr = oldScript.attributes[i];
        newScript.setAttribute(attr.name, attr.value);
      }
      // Copy inline code (none of the current fragments use this, but stay safe)
      if (oldScript.textContent) newScript.textContent = oldScript.textContent;
      oldScript.parentNode.replaceChild(newScript, oldScript);
    });
    targetEl.dataset.loaded = 'true';
    if (id === 'command') {
      loadCommandData();
    }
  } catch (err) {
    // Fallback: render overview cards for sections without fragment
    if (id === 'command') {
      targetEl.innerHTML = `
        <div class="welcome"><div><h2>Good evening, Admin 👋</h2><p>Here is what is happening across TravelBuddy right now.</p></div><span id="date"></span></div>
        <div class="kpis" id="kpis"></div>
        <div class="grid"><article class="panel"><div class="head"><div><h3>Live Activity</h3><p>Real-time platform events</p></div><span class="live-tag">● LIVE</span></div><div id="activity"></div></article><article class="panel"><div class="head"><div><h3>Attention Required</h3><p>Prioritized by risk level</p></div><a>View queue</a></div><div id="risks"></div></article></div>
        <div class="grid lower"><article class="panel"><div class="head"><div><h3>Parcel Journey Overview</h3><p>Current parcel distribution</p></div><select><option>Today</option></select></div><div class="journeys" id="journeys"></div></article><article class="panel"><div class="head"><div><h3>Revenue Snapshot</h3><p>Last 7 days</p></div><strong class="money">₹—</strong></div><div class="chart" id="chart"></div><div class="days"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div></article></div>
        <div class="grid lower" style="grid-template-columns:1fr;"><article class="panel"><div class="head"><div><h3>Active Journeys</h3><p>Currently in-progress deliveries</p></div></div><div id="activeJourneys"></div></article></div>
      `;
      targetEl.dataset.loaded = 'true';
      loadCommandData();
    } else {
      targetEl.innerHTML = `<div class="panel"><div class="head"><h3>${dashboardInfo[id][0]}</h3></div><p>${dashboardInfo[id][1]}</p><div class="cards"></div></div>`;
      targetEl.dataset.loaded = 'true';
      renderOverviewCards();
    }
  }
}

/* ---------- Initialize Drawer ---------- */
function initializeDrawer() {
  drawerClose?.addEventListener('click', closeDrawer);
  drawerOverlay?.addEventListener('click', closeDrawer);
}

/* ---------- Admin Profile / Settings Modal ---------- */
function initials(name) {
  return String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || 'AD';
}

function fullAdminName(admin) {
  return `${admin.firstName || ''} ${admin.lastName || ''}`.trim() || admin.name || 'Admin';
}

function renderAdminAvatar(el, admin, name) {
  if (!el) return;
  if (admin.profilePhoto) {
    el.textContent = '';
    el.style.backgroundImage = `url(${admin.profilePhoto})`;
    el.classList.add('has-photo');
  } else {
    el.style.backgroundImage = '';
    el.classList.remove('has-photo');
    el.textContent = initials(name);
  }
}

function resizeAdminPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const size = 320;
        const c = document.createElement('canvas');
        c.width = size; c.height = size;
        const ctx = c.getContext('2d');
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2, sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function initAdminProfileModal() {
  const overlay = document.getElementById('adminProfileModal');
  if (!overlay) return;
  const closeBtn = document.getElementById('adminProfileClose');
  const tabs = overlay.querySelectorAll('[data-admin-tab]');
  const panels = {
    photo: document.getElementById('adminPhotoPanel'),
    details: document.getElementById('adminDetailsPanel'),
    security: document.getElementById('adminSecurityPanel'),
  };

  function setTab(tab) {
    tabs.forEach((b) => b.classList.toggle('active', b.dataset.adminTab === tab));
    Object.entries(panels).forEach(([key, el]) => el && el.classList.toggle('hidden', key !== tab));
  }

  function getStoredAdmin() {
    return window.ADMIN || (() => { try { return JSON.parse(localStorage.getItem('travelBuddyAdmin') || '{}'); } catch { return {}; } })();
  }

  function persistAdmin(admin) {
    window.ADMIN = admin;
    localStorage.setItem('travelBuddyAdmin', JSON.stringify(admin));
  }

  function populate() {
    const admin = getStoredAdmin();
    const name = fullAdminName(admin);
    renderAdminAvatar(document.getElementById('adminProfileAvatar'), admin, name);
    renderAdminAvatar(document.getElementById('adminPhotoPreview'), admin, name);
    const photoActionText = document.getElementById('adminPhotoActionText');
    const removePhotoBtn = document.getElementById('adminRemovePhoto');
    if (photoActionText) photoActionText.textContent = admin.profilePhoto ? 'Change Photo' : 'Add Photo';
    if (removePhotoBtn) removePhotoBtn.hidden = !admin.profilePhoto;
    document.getElementById('adminProfileEmailText').textContent = admin.email || 'Signed in admin';
    document.getElementById('adminFirstName').value = admin.firstName || '';
    document.getElementById('adminLastName').value = admin.lastName || '';
    document.getElementById('adminProfileEmailInput').value = admin.email || '';
    document.getElementById('adminProfileRole').value = admin.role ? admin.role.charAt(0).toUpperCase() + admin.role.slice(1) : 'Admin';
  }

  function refreshSidebarChip(admin) {
    const name = fullAdminName(admin);
    const adminSpan = document.querySelector('.admin > span');
    const nameNode = document.querySelector('.admin b');
    if (adminSpan) adminSpan.textContent = initials(name);
    if (nameNode) nameNode.textContent = name;
  }

  window.openAdminProfileModal = function (tab = 'photo') {
    populate();
    setTab(tab);
    overlay.classList.add('show');
  };
  function closeModal() { overlay.classList.remove('show'); }
  closeBtn?.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.classList.contains('show')) closeModal(); });
  tabs.forEach((btn) => btn.addEventListener('click', () => setTab(btn.dataset.adminTab)));

  async function savePhoto(profilePhoto) {
    const current = getStoredAdmin();
    const data = await apiPut('/api/admin/profile', {
      firstName: current.firstName || 'Admin',
      lastName: current.lastName || '',
      profilePhoto,
    });
    persistAdmin(data.admin);
    refreshSidebarChip(data.admin);
    populate();
  }

  document.getElementById('adminProfilePhotoInput')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('Please choose an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { showToast('Choose an image smaller than 5 MB.'); return; }
    try {
      await savePhoto(await resizeAdminPhoto(file));
      showToast('Photo updated');
    } catch (err) {
      showToast(err?.data?.error || 'Could not save photo.');
    }
    e.target.value = '';
  });

  document.getElementById('adminRemovePhoto')?.addEventListener('click', async () => {
    try {
      await savePhoto('');
      showToast('Photo removed');
    } catch (err) {
      showToast(err?.data?.error || 'Could not remove photo.');
    }
  });

  document.getElementById('adminProfileForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const firstName = document.getElementById('adminFirstName').value.trim();
    const lastName = document.getElementById('adminLastName').value.trim();
    if (!firstName || !lastName) { showToast('First name and last name are required.'); return; }
    const current = getStoredAdmin();
    try {
      const data = await apiPut('/api/admin/profile', { firstName, lastName, profilePhoto: current.profilePhoto || '' });
      persistAdmin(data.admin);
      refreshSidebarChip(data.admin);
      populate();
      showToast('Profile updated successfully');
    } catch (err) {
      showToast(err?.data?.error || 'Could not update profile.');
    }
  });

  document.getElementById('adminPasswordForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('adminCurrentPassword').value;
    const newPassword = document.getElementById('adminNewPassword').value;
    if (!currentPassword || !newPassword) { showToast('Enter current and new password.'); return; }
    if (newPassword.length < 8) { showToast('New password must be at least 8 characters.'); return; }
    try {
      await apiPut('/api/admin/profile/password', { currentPassword, newPassword });
      e.currentTarget.reset();
      showToast('Password changed successfully');
    } catch (err) {
      showToast(err?.data?.error || 'Could not change password.');
    }
  });
}

initAdminProfileModal();

/* ---------- Sidebar live badge + notification bell ----------
   One persistent connection to the /admin Socket.IO namespace, opened at
   dashboard load, does two jobs:
   1. admin:stats -> keeps the "Live Operations" sidebar count current.
   2. admin:alert -> the same events postParcel.js already emits for the
      Operations activity feed (delivered, pickup confirmed, cancelled,
      etc.) now also feed the notification bell.
   Note: if the admin opens the Operations page, that page opens its own
   separate socket too — so two connections can be open at once. Harmless,
   just not maximally efficient; worth consolidating later if it matters.

   Bell state is kept in memory only (resets on page reload / not shared
   across admins). If you want it to persist and survive refresh, the
   Notification model + notifyUser service already built for the user
   dashboard could be extended to admins instead — this is the quick,
   already-flowing-data version. */
const bellAlerts = [];
const BELL_MAX = 20;

function timeAgoShort(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - +new Date(iso);
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function renderBellMenu() {
  const list = document.getElementById('bellMenuList');
  if (!list) return;
  if (!bellAlerts.length) {
    list.innerHTML = '<div class="bell-empty">You\'re all caught up.</div>';
    return;
  }
  list.innerHTML = bellAlerts.map(a => {
    const sevClass = a.severity === 'high' ? 'sev-high' : a.severity === 'warning' ? 'sev-warning' : '';
    const iconMap = { delivered: 'fa-circle-check', pickup_confirmed: 'fa-key', cancelled: 'fa-ban', otp_failures: 'fa-key', fraud_risk: 'fa-shield-halved', payment_failed: 'fa-credit-card' };
    const icon = iconMap[a.type] || 'fa-circle-info';
    return `
      <div class="bell-item ${sevClass}">
        <i class="fa-solid ${icon}"></i>
        <div>
          <b>${escHtml(a.title || 'Update')}</b>
          <p>${escHtml(a.description || '')}</p>
        </div>
        <span>${timeAgoShort(a.timestamp)}</span>
      </div>
    `;
  }).join('');
}

function updateBellDot() {
  const dot = document.getElementById('bellDot');
  if (dot) dot.hidden = bellAlerts.length === 0;
}

function addBellAlert(alert) {
  bellAlerts.unshift(alert);
  if (bellAlerts.length > BELL_MAX) bellAlerts.length = BELL_MAX;
  updateBellDot();
  renderBellMenu();
}

function initBellDropdown() {
  const wrap = document.getElementById('bellWrap');
  const btn = document.getElementById('bellBtn');
  const menu = document.getElementById('bellMenu');
  const clearBtn = document.getElementById('bellClearBtn');
  if (!wrap || !btn || !menu) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('open');
    if (menu.classList.contains('open')) {
      // Opening the panel counts as "seen" — clear the unread dot,
      // but keep the list itself until the admin clears it.
      const dot = document.getElementById('bellDot');
      if (dot) dot.hidden = true;
    }
  });

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) menu.classList.remove('open');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') menu.classList.remove('open');
  });

  clearBtn?.addEventListener('click', () => {
    bellAlerts.length = 0;
    renderBellMenu();
    updateBellDot();
  });
}

function initAdminLiveSocket() {
  const opsBadge = document.getElementById('opsSidebarBadge');
  if (typeof io === 'undefined') return;
  const token = localStorage.getItem('admin_token');
  if (!token) return;

  const liveSocket = io(`${window.location.origin}/admin`, {
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  liveSocket.on('admin:stats', (stats) => {
    if (opsBadge && stats && stats.totalActive != null) opsBadge.textContent = stats.totalActive;
  });

  liveSocket.on('admin:alert', (alert) => {
    addBellAlert(alert);
  });

  liveSocket.on('connect_error', () => {
    if (opsBadge) opsBadge.textContent = '—';
  });
}

/* ---------- Initialize Dashboard ---------- */
function initializeDashboard() {
  // Restore whichever page the admin was last on (URL hash first, then
  // sessionStorage), instead of always forcing Command Center. Falls back
  // to Command Center on first visit or if the saved page no longer exists.
  const startPage = resolveInitialPage();
  activatePage(startPage, { historyMode: 'replace', restoreScroll: true });

  initializeNavigation();
  initializeSidebarToggle();
  initializeSearch();
  initializeInteractions();
  initializeDrawer();
  initializeAdminMenu();
  initBellDropdown();
  initAdminLiveSocket();
  initializeHistoryNavigation();
  initializeScrollPersistence();
}

initializeDashboard();
