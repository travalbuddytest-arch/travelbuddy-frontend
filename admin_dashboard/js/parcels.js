// Frontend/admin_dashboard/js/parcels.js
// ══════════════════════════════════════════════
// PARCEL COMMAND CENTER — Full Implementation
// ══════════════════════════════════════════════

const API_ORIGIN = APP_CONFIG.API_BASE_URL;
const PAGE_SIZE = 20;

/* ── State ─────────────────────────────── */
let state = {
  page: 1, total: 0, search: '', sort: 'newest',
  filters: { status: 'all', priority: 'all', category: 'all', payment: 'all', from: '', to: '', dateFrom: '', dateTo: '' },
  selected: new Set(), parcels: [], stats: null,
  filtersVisible: false, analyticsVisible: false, auditVisible: false,
};

/* ── Helpers ───────────────────────────── */
const $ = (s, p) => (p || document).querySelector(s);
const $$ = (s, p) => [...(p || document).querySelectorAll(s)];
const esc = s => s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : '';
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—';
const fmtDateTime = d => d ? new Date(d).toLocaleString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
const fmtMoney = n => '₹' + ((n||0)/100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const timeAgo = d => { if(!d) return '—'; const m=Math.floor((Date.now()-new Date(d))/60000); if(m<1) return 'Just now'; if(m<60) return m+'m'; const h=Math.floor(m/60); if(h<24) return h+'h'; return Math.floor(h/24)+'d'; };

async function api(url, opts={}) {
  const token = localStorage.getItem('admin_token') || localStorage.getItem('travelBuddyAdminToken');
  const headers = { ...opts.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch(`${API_ORIGIN}${url}`, { credentials:'include', ...opts, headers });
  if (url.includes('/export')) {
    if (!res.ok) throw new Error('Export failed');
    return res;
  }
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw data;
  return data;
}

function toast(msg, icon='fa-circle-check') {
  const t = $('#pcToast'), m = $('#pcToastMsg');
  if(t) { t.querySelector('i').className=`fa-solid ${icon}`; m.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2500); }
}

/* ── Animate count-up ──────────────────── */
function animateCount(el, target, prefix='', suffix='') {
  const duration = 800;
  const start = parseInt(el.textContent.replace(/[^0-9]/g,'')) || 0;
  const diff = target - start;
  if (diff === 0) { el.textContent = prefix + target.toLocaleString('en-IN') + suffix; return; }
  const startTime = performance.now();
  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + diff * eased);
    el.textContent = prefix + current.toLocaleString('en-IN') + suffix;
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ══════════════════════════════════════════════
   KPI CARDS
   ══════════════════════════════════════════════ */
async function loadStats() {
  try {
    const data = await api('/api/admin/parcels/stats');
    state.stats = data;
    renderKPIs(data);
  } catch(e) { console.warn('Stats load failed', e); }
}

function renderKPIs(d) {
  const kpis = $$('.pc-kpi');
  const total = d.totalParcels || 0;
  const values = [
    total,
    d.statusCounts?.pending || 0,
    d.statusCounts?.accepted || 0,
    d.statusCounts?.pickup_confirmed || 0,
    d.statusCounts?.in_transit || 0,
    d.deliveredToday || 0,
    d.statusCounts?.cancelled || 0,
    d.revenueToday || 0,
    d.successRate || 0,
    d.avgDeliveryTimeHours || 0,
  ];
  const subtitles = [
    'All time parcels',
    `${d.todayCounts?.pending||0} today`,
    `${d.monthCounts?.accepted||0} this month`,
    `${d.monthCounts?.pickup_confirmed||0} this month`,
    `${d.monthCounts?.in_transit||0} this month`,
    `${d.deliveredMonth||0} this month`,
    d.cancellationRate ? `${d.cancellationRate}% rate` : '—',
    `₹${(d.revenueMonth||0).toLocaleString('en-IN')} this month`,
    d.deliveredTotal ? `${d.deliveredTotal} delivered` : '—',
    d.avgParcelValue ? `Avg value ${fmtMoney(d.avgParcelValue)}` : '—',
  ];

  kpis.forEach((kpi, i) => {
    kpi.classList.remove('skel');
    const countEl = kpi.querySelector('.pc-count');
    const smallEl = kpi.querySelector('small');
    if (!countEl) return;
    const val = values[i] || 0;
    const isRevenue = i === 7;
    const isRate = i === 8;
    const isTime = i === 9;
    const prefix = isRevenue ? '₹' : '';
    const suffix = isRate ? '%' : isTime ? 'h' : '';
    animateCount(countEl, val, prefix, suffix);
    if (smallEl) smallEl.textContent = subtitles[i] || '';
  });

  // KPI click handlers
  kpis.forEach(kpi => {
    kpi.onclick = () => {
      const status = kpi.dataset.status;
      if (status && status !== 'all') {
        $('#pcFilterStatus').value = status;
        state.filters.status = status;
        state.page = 1;
        loadParcels();
      }
    };
  });
}

/* ══════════════════════════════════════════════
   PARCEL TABLE
   ══════════════════════════════════════════════ */
function buildQuery() {
  const p = new URLSearchParams();
  p.set('page', state.page);
  p.set('limit', PAGE_SIZE);
  if (state.search) p.set('search', state.search);
  if (state.filters.status !== 'all') p.set('status', state.filters.status);
  if (state.filters.priority !== 'all') p.set('priority', state.filters.priority);
  if (state.filters.category !== 'all') p.set('category', state.filters.category);
  if (state.filters.payment !== 'all') p.set('payment', state.filters.payment);
  if (state.filters.from) p.set('from', state.filters.from);
  if (state.filters.to) p.set('to', state.filters.to);
  if (state.filters.dateFrom) p.set('dateFrom', state.filters.dateFrom);
  if (state.filters.dateTo) p.set('dateTo', state.filters.dateTo);
  p.set('sort', state.sort);
  return p.toString();
}

async function loadParcels() {
  const tbody = $('#pcTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="16" class="pc-loading-cell"><div class="pc-skeleton-row"></div><div class="pc-skeleton-row"></div><div class="pc-skeleton-row"></div></td></tr>';

  try {
    const data = await api(`/api/admin/parcels?${buildQuery()}`);
    state.parcels = data.parcels || [];
    state.total = data.total || 0;
    state.selected.clear();
    updateBulkBar();
    renderTable();
    renderPagination();
    const countEl = $('#pcResultCount');
    if (countEl) countEl.textContent = `${state.total} parcels`;
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="16" class="pc-empty"><i class="fa-solid fa-cloud-exclamation"></i> Failed to load parcels. <button class="pc-btn pc-btn-sm" onclick="loadParcels()">Retry</button></td></tr>`;
    console.warn('Load parcels failed:', e);
  }
}

function renderTable() {
  const tbody = $('#pcTableBody');
  if (!tbody) return;
  if (state.parcels.length === 0) {
    tbody.innerHTML = '<tr><td colspan="16" class="pc-empty"><i class="fa-solid fa-box-open" style="font-size:24px;display:block;margin-bottom:8px;opacity:0.3"></i>No parcels found</td></tr>';
    return;
  }
  tbody.innerHTML = state.parcels.map(p => {
    const sender = p.sender ? `${esc(p.sender.firstName||'')} ${esc(p.sender.lastName||'')}`.trim() || '—' : '—';
    const traveler = p.acceptedBy ? `${esc(p.acceptedBy.firstName||'')} ${esc(p.acceptedBy.lastName||'')}`.trim() || '—' : '—';
    const statusCls = { pending:'pc-st-pending', accepted:'pc-st-accepted', pickup_confirmed:'pc-st-pickup', in_transit:'pc-st-transit', delivered:'pc-st-delivered', cancelled:'pc-st-cancelled' }[p.status] || '';
    const statusLabel = { pending:'Pending', accepted:'Accepted', pickup_confirmed:'Pickup', in_transit:'In Transit', delivered:'Delivered', cancelled:'Cancelled' }[p.status] || p.status;
    const prioCls = { urgent:'pc-prio-urgent', critical:'pc-prio-critical', high_value:'pc-prio-high', fragile:'pc-prio-fragile', medical:'pc-prio-medical', express:'pc-prio-express', medium:'pc-prio-medium' }[p.priority] || '';
    const payCls = { unpaid:'pc-pay-unpaid', held:'pc-pay-held', released:'pc-pay-released', refunded:'pc-pay-refunded' }[p.paymentStatus] || '';
    const progress = { pending:10, accepted:25, pickup_confirmed:50, in_transit:75, delivered:100, cancelled:0 }[p.status] || 0;
    const health = p.healthScore ?? 100;
    const healthCls = health >= 70 ? 'pc-health-good' : health >= 40 ? 'pc-health-warn' : 'pc-health-bad';
    const selected = state.selected.has(p._id);
    return `<tr class="${selected?'pc-row-selected':''}" data-id="${p._id}">
      <td class="pc-td-check"><input type="checkbox" class="pc-row-check" data-id="${p._id}" ${selected?'checked':''} aria-label="Select parcel"></td>
      <td class="pc-td-id"><span class="pc-mono">${esc(p.orderId||'—')}</span></td>
      <td><span class="pc-cat">${esc(p.category||'general')}</span></td>
      <td class="pc-td-user">${sender}</td>
      <td class="pc-td-user">${traveler}</td>
      <td class="pc-td-city">${esc(cap(p.fromCity||''))}</td>
      <td class="pc-td-city">${esc(cap(p.toCity||''))}</td>
      <td class="pc-td-num">${p.weight||'—'}${p.weightUnit?' '+p.weightUnit:''}</td>
      <td class="pc-td-price">${fmtMoney(p.price)}</td>
      <td><span class="pc-prio ${prioCls}">${esc(p.priority||'normal')}</span></td>
      <td><span class="pc-pay ${payCls}">${esc(p.paymentStatus||'unpaid')}</span></td>
      <td><div class="pc-progress"><div class="pc-progress-bar" style="width:${progress}%"></div></div></td>
      <td><span class="pc-status ${statusCls}">${statusLabel}</span></td>
      <td><span class="pc-health ${healthCls}">${health}</span></td>
      <td class="pc-td-date">${fmtDate(p.createdAt)}</td>
      <td class="pc-td-actions">
        <button class="pc-action-btn pc-action-view" data-action="view" data-id="${p._id}" title="View" aria-label="View parcel"><i class="fa-solid fa-eye"></i></button>
        <button class="pc-action-btn pc-action-edit" data-action="edit" data-id="${p._id}" title="Edit Status" aria-label="Edit parcel status"><i class="fa-solid fa-pen"></i></button>
        <button class="pc-action-btn pc-action-timeline" data-action="timeline" data-id="${p._id}" title="Timeline" aria-label="View timeline"><i class="fa-solid fa-timeline"></i></button>
        <button class="pc-action-btn pc-action-notes" data-action="notes" data-id="${p._id}" title="Add Note" aria-label="Add note"><i class="fa-solid fa-note-sticky"></i></button>
        <button class="pc-action-btn pc-action-notify" data-action="notify" data-id="${p._id}" title="Notify" aria-label="Send notification"><i class="fa-solid fa-bell"></i></button>
      </td>
    </tr>`;
  }).join('');
}

/* ── Pagination ─────────────────────────── */
function renderPagination() {
  const el = $('#pcPagination');
  if (!el) return;
  const pages = Math.ceil(state.total / PAGE_SIZE);
  if (pages <= 1) { el.innerHTML = ''; return; }
  let h = '';
  if (state.page > 1) h += `<button data-p="1" aria-label="First page">&laquo;</button><button data-p="${state.page-1}" aria-label="Previous page">&lsaquo;</button>`;
  for (let i = Math.max(1, state.page-2); i <= Math.min(pages, state.page+2); i++) {
    h += `<button data-p="${i}" class="${i===state.page?'active':''}">${i}</button>`;
  }
  if (state.page < pages) h += `<button data-p="${state.page+1}" aria-label="Next page">&rsaquo;</button><button data-p="${pages}" aria-label="Last page">&raquo;</button>`;
  el.innerHTML = h;
  $$('.pc-pagination button', el).forEach(b => b.onclick = () => { state.page = parseInt(b.dataset.p); loadParcels(); });
}

/* ══════════════════════════════════════════════
   DETAIL DRAWER
   ══════════════════════════════════════════════ */
async function openDrawer(parcelId) {
  const overlay = $('#pcDrawerOverlay');
  const drawer = $('#pcDrawer');
  const body = $('#pcDrawerBody');
  const title = $('#pcDrawerTitle');
  if (!body) return;
  overlay.classList.remove('hidden');
  drawer.classList.add('open');
  body.innerHTML = '<div class="pc-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading parcel details…</div>';
  // Remember the open parcel so a browser refresh can reopen the same
  // detail drawer instead of just landing back on the bare Parcels list.
  window.AdminNav?.setSubState('parcels', { parcelId });

  try {
    const data = await api(`/api/admin/parcels/detail/${parcelId}`);
    const p = data.parcel;
    const txns = data.walletTransactions || [];
    if (title) title.textContent = `Parcel ${p.orderId || ''}`;
    body.innerHTML = renderDrawerContent(p, txns);
    // Wire up drawer actions
    wireDrawerActions(p);
  } catch(e) {
    body.innerHTML = '<div class="pc-empty"><i class="fa-solid fa-cloud-exclamation"></i> Could not load parcel details.</div>';
  }
}

function closeDrawer() {
  $('#pcDrawerOverlay')?.classList.add('hidden');
  $('#pcDrawer')?.classList.remove('open');
  window.AdminNav?.clearSubState('parcels');
}

function renderDrawerContent(p, txns) {
  const sender = p.sender || {};
  const traveler = p.acceptedBy || {};
  const senderName = `${sender.firstName||''} ${sender.lastName||''}`.trim() || '—';
  const travelerName = `${traveler.firstName||''} ${traveler.lastName||''}`.trim() || '—';
  const statusLabel = { pending:'Pending', accepted:'Accepted', pickup_confirmed:'Pickup Confirmed', in_transit:'In Transit', delivered:'Delivered', cancelled:'Cancelled' }[p.status] || p.status;
  const healthCls = (p.healthScore||100) >= 70 ? 'pc-health-good' : (p.healthScore||100) >= 40 ? 'pc-health-warn' : 'pc-health-bad';

  let h = `
  <div class="pc-drawer-section">
    <div class="pc-drawer-kpis">
      <div class="pc-drawer-kpi"><span>Status</span><span class="pc-status pc-st-${p.status}">${statusLabel}</span></div>
      <div class="pc-drawer-kpi"><span>Health</span><span class="pc-health ${healthCls}">${p.healthScore||100}</span></div>
      <div class="pc-drawer-kpi"><span>Price</span><strong>${fmtMoney(p.price)}</strong></div>
      <div class="pc-drawer-kpi"><span>Weight</span><strong>${p.weight||'—'} ${p.weightUnit||'kg'}</strong></div>
    </div>
  </div>`;

  // Quick actions — full lifecycle status transitions
  const isActive = p.status !== 'delivered' && p.status !== 'cancelled';
  const canPickup = p.status === 'accepted';
  const canTransit = p.status === 'pickup_confirmed';
  const canDeliver = p.status === 'in_transit';
  h += `<div class="pc-drawer-section pc-drawer-actions">
    <button class="pc-btn pc-btn-sm pc-btn-success" data-drawer-action="approve" data-id="${p._id}" ${p.status!=='pending'?'disabled':''}><i class="fa-solid fa-check"></i> Approve</button>
    <button class="pc-btn pc-btn-sm pc-btn-info" data-drawer-action="pickup" data-id="${p._id}" ${!canPickup?'disabled':''}><i class="fa-solid fa-hand-holding-box"></i> Pickup</button>
    <button class="pc-btn pc-btn-sm pc-btn-primary" data-drawer-action="transit" data-id="${p._id}" ${!canTransit?'disabled':''}><i class="fa-solid fa-truck-fast"></i> Transit</button>
    <button class="pc-btn pc-btn-sm pc-btn-success" data-drawer-action="deliver" data-id="${p._id}" ${!canDeliver?'disabled':''}><i class="fa-solid fa-circle-check"></i> Deliver</button>
    <button class="pc-btn pc-btn-sm pc-btn-danger" data-drawer-action="cancel" data-id="${p._id}" ${!isActive?'disabled':''}><i class="fa-solid fa-ban"></i> Cancel</button>
    <button class="pc-btn pc-btn-sm" data-drawer-action="timeline" data-id="${p._id}"><i class="fa-solid fa-timeline"></i> Timeline</button>
    <button class="pc-btn pc-btn-sm" data-drawer-action="notes" data-id="${p._id}"><i class="fa-solid fa-note-sticky"></i> Note</button>
  </div>`;

  // Parcel info
  h += `<div class="pc-drawer-section"><h4>Parcel Information</h4>
    <div class="pc-detail-grid">
      <div class="pc-detail-row"><span>Order ID</span><span class="pc-mono">${esc(p.orderId||'—')}</span></div>
      <div class="pc-detail-row"><span>Category</span><span>${esc(p.category||'general')}</span></div>
      <div class="pc-detail-row"><span>Priority</span><span class="pc-prio pc-prio-${p.priority||'normal'}">${esc(p.priority||'normal')}</span></div>
      <div class="pc-detail-row"><span>Description</span><span>${esc(p.description||'—')}</span></div>
      <div class="pc-detail-row"><span>Created</span><span>${fmtDateTime(p.createdAt)}</span></div>
      <div class="pc-detail-row"><span>Updated</span><span>${fmtDateTime(p.updatedAt)}</span></div>
      ${p.dimensions?.length?`<div class="pc-detail-row"><span>Dimensions</span><span>${p.dimensions.length}×${p.dimensions.width}×${p.dimensions.height} ${p.dimensions.unit||'cm'}</span></div>`:''}
      ${p.vehicleType?`<div class="pc-detail-row"><span>Vehicle</span><span>${esc(p.vehicleType)}</span></div>`:''}
      ${p.isFragile?'<div class="pc-detail-row"><span>Fragile</span><span class="pc-tag pc-tag-warn">Yes</span></div>':''}
      ${p.isExpress?'<div class="pc-detail-row"><span>Express</span><span class="pc-tag pc-tag-info">Yes</span></div>':''}
    </div>
  </div>`;

  // Sender info
  h += `<div class="pc-drawer-section"><h4>Sender</h4>
    <div class="pc-detail-grid">
      <div class="pc-detail-row"><span>Name</span><span>${esc(senderName)}</span></div>
      <div class="pc-detail-row"><span>Email</span><span>${esc(sender.email||'—')}</span></div>
      <div class="pc-detail-row"><span>Phone</span><span>${esc(sender.phone||'—')}</span></div>
      <div class="pc-detail-row"><span>Wallet</span><span>${fmtMoney(sender.walletBalance)}</span></div>
      <div class="pc-detail-row"><span>Rating</span><span>⭐ ${(sender.rating||0).toFixed(1)}</span></div>
    </div>
  </div>`;

  // Traveller info
  if (travelerName !== '—') {
    h += `<div class="pc-drawer-section"><h4>Traveller</h4>
      <div class="pc-detail-grid">
        <div class="pc-detail-row"><span>Name</span><span>${esc(travelerName)}</span></div>
        <div class="pc-detail-row"><span>Email</span><span>${esc(traveler.email||'—')}</span></div>
        <div class="pc-detail-row"><span>Phone</span><span>${esc(traveler.phone||'—')}</span></div>
        <div class="pc-detail-row"><span>Rating</span><span>⭐ ${(traveler.rating||0).toFixed(1)} (${traveler.ratingCount||0} reviews)</span></div>
        <div class="pc-detail-row"><span>Earnings</span><span>${fmtMoney(p.travelerEarning)}</span></div>
      </div>
    </div>`;
  }

  // Route
  h += `<div class="pc-drawer-section"><h4>Route</h4>
    <div class="pc-route-visual">
      <div class="pc-route-point"><i class="fa-solid fa-circle-dot"></i><div><strong>${esc(cap(p.fromCity||''))}</strong><small>${esc(p.fromAddress||'')}</small></div></div>
      <div class="pc-route-line"><div class="pc-route-progress" style="width:${p.progress||0}%"></div></div>
      <div class="pc-route-point"><i class="fa-solid fa-location-dot"></i><div><strong>${esc(cap(p.toCity||''))}</strong><small>${esc(p.toAddress||'')}</small></div></div>
    </div>
  </div>`;

  // Payment
  h += `<div class="pc-drawer-section"><h4>Payment</h4>
    <div class="pc-detail-grid">
      <div class="pc-detail-row"><span>Status</span><span class="pc-pay pc-pay-${p.paymentStatus}">${esc(p.paymentStatus)}</span></div>
      <div class="pc-detail-row"><span>Method</span><span>${esc(p.paymentMethod||'wallet')}</span></div>
      <div class="pc-detail-row"><span>Held Amount</span><span>${fmtMoney(p.heldAmount)}</span></div>
      <div class="pc-detail-row"><span>Traveller Earning</span><span>${fmtMoney(p.travelerEarning)}</span></div>
      <div class="pc-detail-row"><span>Platform Commission</span><span>${fmtMoney(p.platformCommission)}</span></div>
      ${p.cancellationFee?`<div class="pc-detail-row"><span>Cancellation Fee</span><span class="pc-text-danger">${fmtMoney(p.cancellationFee)}</span></div>`:''}
    </div>
  </div>`;

  // OTP
  if (p.journeyOtp && p.journeyOtp.purpose) {
    h += `<div class="pc-drawer-section"><h4>OTP</h4>
      <div class="pc-detail-grid">
        <div class="pc-detail-row"><span>Purpose</span><span>${esc(p.journeyOtp.purpose)}</span></div>
        <div class="pc-detail-row"><span>Attempts</span><span class="${p.journeyOtp.attempts>=3?'pc-text-danger':''}">${p.journeyOtp.attempts||0}</span></div>
        <div class="pc-detail-row"><span>Expires</span><span>${fmtDateTime(p.journeyOtp.expiresAt)}</span></div>
      </div>
    </div>`;
  }

  // Insurance
  if (p.isInsured) {
    h += `<div class="pc-drawer-section"><h4>Insurance</h4>
      <div class="pc-detail-grid">
        <div class="pc-detail-row"><span>Insured</span><span class="pc-tag pc-tag-success">Yes</span></div>
        <div class="pc-detail-row"><span>Coverage</span><span>${fmtMoney(p.insuranceAmount)}</span></div>
        <div class="pc-detail-row"><span>Provider</span><span>${esc(p.insuranceProvider||'—')}</span></div>
        <div class="pc-detail-row"><span>Claim Status</span><span>${esc(p.insuranceClaimStatus||'none')}</span></div>
      </div>
    </div>`;
  }

  // Admin notes
  h += `<div class="pc-drawer-section"><h4>Admin Notes</h4>`;
  if (p.adminNotes && p.adminNotes.length) {
    h += p.adminNotes.map(n => `<div class="pc-note"><div class="pc-note-meta"><strong>${esc(n.adminName||'Admin')}</strong><span>${fmtDateTime(n.createdAt)}</span></div><p>${esc(n.note)}</p></div>`).join('');
  } else {
    h += '<div class="pc-empty-sm">No notes yet</div>';
  }
  h += `<div class="pc-note-form"><textarea id="pcNoteInput" placeholder="Add a note…" rows="2"></textarea><button class="pc-btn pc-btn-sm pc-btn-primary" data-drawer-action="save-note" data-id="${p._id}">Save Note</button></div></div>`;

  // Wallet transactions
  if (txns.length > 0) {
    h += `<div class="pc-drawer-section"><h4>Wallet Transactions</h4>
      <div class="pc-txn-list">${txns.map(tx => `<div class="pc-txn"><div><strong>${esc(tx.type||'')}</strong><small>${esc(tx.description||'')}</small></div><div><span class="pc-pay pc-pay-${tx.status}">${esc(tx.status)}</span><span class="${tx.direction==='credit'?'pc-text-success':'pc-text-danger'}">${tx.direction==='credit'?'+':'-'}${fmtMoney(tx.amount)}</span></div></div>`).join('')}</div>
    </div>`;
  }

  // Fraud score
  if (p.fraudScore > 0) {
    h += `<div class="pc-drawer-section"><h4>Fraud Assessment</h4>
      <div class="pc-detail-grid">
        <div class="pc-detail-row"><span>Risk Score</span><span class="pc-health ${p.fraudScore>=30?'pc-health-bad':p.fraudScore>=15?'pc-health-warn':'pc-health-good'}">${p.fraudScore}/100</span></div>
        ${p.fraudFlags?.length?`<div class="pc-detail-row"><span>Flags</span><span>${p.fraudFlags.map(f=>`<span class="pc-tag pc-tag-warn">${esc(f)}</span>`).join(' ')}</span></div>`:''}
      </div>
    </div>`;
  }

  return h;
}

function wireDrawerActions(p) {
  $$('[data-drawer-action]').forEach(btn => {
    btn.onclick = async () => {
      const action = btn.dataset.drawerAction;
      const id = btn.dataset.id;
      if (action === 'timeline') { openTimelineModal(id); return; }
      if (action === 'notes') { $('#pcNoteInput')?.focus(); return; }
      if (action === 'save-note') {
        const input = $('#pcNoteInput');
        const note = input?.value?.trim();
        if (!note) return toast('Enter a note', 'fa-exclamation-triangle');
        try {
          await api(`/api/admin/parcels/${id}/notes`, { method:'POST', body:{ note } });
          toast('Note added');
          input.value = '';
          openDrawer(id);
        } catch(e) { toast(e.error||'Failed', 'fa-exclamation-triangle'); }
        return;
      }
      const statusMap = {
        approve: { s: 'accepted', label: 'approved' },
        pickup: { s: 'pickup_confirmed', label: 'pickup confirmed' },
        transit: { s: 'in_transit', label: 'in transit' },
        deliver: { s: 'delivered', label: 'delivered' },
        cancel: { s: 'cancelled', label: 'cancelled' },
      };
      const actionDef = statusMap[action];
      if (actionDef) {
        let reason = '';
        if (action === 'cancel') {
          reason = prompt('Cancellation reason:');
          if (reason === null) return;
        }
        // Disable button to prevent double-click
        btn.disabled = true;
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        try {
          await api(`/api/admin/parcels/status/${id}`, { method:'PUT', body:{ status: actionDef.s, reason } });
          toast(action === 'cancel' ? 'Parcel cancelled — email sent to sender & traveler' : `Parcel ${actionDef.label}`);
          closeDrawer(); loadParcels(); loadStats();
        } catch(e) {
          toast(e.error||'Failed', 'fa-exclamation-triangle');
          btn.disabled = false;
          btn.innerHTML = originalHTML;
        }
        return;
      }
    };
  });
}

/* ══════════════════════════════════════════════
   TIMELINE MODAL
   ══════════════════════════════════════════════ */
async function openTimelineModal(parcelId) {
  const overlay = $('#pcTimelineOverlay');
  const body = $('#pcTimelineBody');
  overlay.classList.remove('hidden');
  body.innerHTML = '<div class="pc-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading timeline…</div>';
  try {
    const data = await api(`/api/admin/parcels/timeline/${parcelId}`);
    const events = data.timeline || [];
    body.innerHTML = events.map((e, i) => {
      const cls = e.status === 'delivered' ? 'pc-tl-success' : e.status === 'cancelled' ? 'pc-tl-danger' : '';
      return `<div class="pc-tl-item ${cls}">
        <div class="pc-tl-dot"><i class="fa-solid ${e.icon||'fa-circle'}"></i></div>
        <div class="pc-tl-content">
          <div class="pc-tl-header"><strong>${esc(e.label)}</strong><span>${fmtDateTime(e.timestamp)}</span></div>
          <div class="pc-tl-meta">By: ${esc(e.by||'')} (${esc(e.role||'')})</div>
          ${e.note?`<div class="pc-tl-note">${esc(e.note)}</div>`:''}
        </div>
      </div>`;
    }).join('');
  } catch(e) { body.innerHTML = '<div class="pc-empty">Failed to load timeline.</div>'; }
}

function closeTimeline() { $('#pcTimelineOverlay')?.classList.add('hidden'); }

/* ══════════════════════════════════════════════
   ANALYTICS
   ══════════════════════════════════════════════ */
async function loadAnalytics() {
  try {
    const [analytics, insights] = await Promise.all([
      api('/api/admin/parcels/analytics'),
      api('/api/admin/parcels/insights'),
    ]);
    renderAnalytics(analytics);
    renderInsights(insights.insights || []);
  } catch(e) { console.warn('Analytics load failed', e); }
}

function renderAnalytics(d) {
  // Daily chart
  const daily = d.dailyParcels || [];
  if (daily.length) {
    const max = Math.max(...daily.map(x=>x.count), 1);
    const chartEl = $('#pcChartDaily');
    if (chartEl) chartEl.innerHTML = daily.map(x => {
      const h = Math.round((x.count/max)*100);
      return `<div class="pc-chart-bar-wrap" title="${x._id}: ${x.count} parcels"><div class="pc-chart-bar" style="height:${h}%"></div><span>${x._id.slice(5)}</span></div>`;
    }).join('');
  }

  // Categories
  const cats = d.categoryDist || [];
  if (cats.length) {
    const catEl = $('#pcChartCategory');
    if (catEl) catEl.innerHTML = cats.map(c => `<div class="pc-cat-row"><span>${esc(cap(c._id||'general'))}</span><div class="pc-cat-bar"><div style="width:${Math.round((c.count/(cats[0].count||1))*100)}%"></div></div><strong>${c.count}</strong></div>`).join('');
  }

  // Routes
  const routes = d.topRoutes || [];
  if (routes.length) {
    const routeEl = $('#pcChartRoutes');
    if (routeEl) routeEl.innerHTML = routes.map(r => `<div class="pc-route-row"><span>${esc(cap(r._id?.from||''))} → ${esc(cap(r._id?.to||''))}</span><strong>${r.count}</strong></div>`).join('');
  }

  // Travellers
  const travs = d.topTravellers || [];
  if (travs.length) {
    const travEl = $('#pcChartTravellers');
    if (travEl) travEl.innerHTML = travs.map(t => `<div class="pc-trav-row"><span>${esc(t.name||'Unknown')}</span><span>${t.deliveries} deliveries</span><strong>${fmtMoney(t.revenue)}</strong></div>`).join('');
  }

  // Peak hours
  const hours = d.peakHours || [];
  if (hours.length) {
    const maxH = Math.max(...hours.map(x=>x.count), 1);
    const peakEl = $('#pcChartPeak');
    if (peakEl) peakEl.innerHTML = hours.map(x => `<div class="pc-chart-bar-wrap" title="${x._id}:00 - ${x.count} parcels"><div class="pc-chart-bar pc-chart-bar-blue" style="height:${Math.round((x.count/maxH)*100)}%"></div><span>${x._id}h</span></div>`).join('');
  }
}

function renderInsights(insights) {
  const el = $('#pcInsights');
  if (!el) return;
  if (!insights.length) { el.innerHTML = '<div class="pc-empty-sm">No insights available</div>'; return; }
  el.innerHTML = insights.map(i => `<div class="pc-insight pc-insight-${i.severity}"><i class="fa-solid ${i.icon}"></i><div><strong>${esc(i.title)}</strong><span>${esc(i.detail)}</span></div></div>`).join('');
}

/* ══════════════════════════════════════════════
   AUDIT LOG
   ══════════════════════════════════════════════ */
async function loadAuditLog() {
  try {
    const data = await api('/api/admin/audit-logs?limit=50');
    const el = $('#pcAuditList');
    if (!el) return;
    if (!data.logs?.length) { el.innerHTML = '<div class="pc-empty-sm">No audit entries</div>'; return; }
    el.innerHTML = data.logs.map(l => `<div class="pc-audit-item">
      <div class="pc-audit-icon"><i class="fa-solid fa-${l.action.includes('cancel')?'ban':l.action.includes('delete')?'trash':l.action.includes('assign')?'user-plus':'circle-info'}"></i></div>
      <div><strong>${esc(l.action.replace(/_/g,' '))}</strong><span>${esc(l.performedByName||'Admin')}</span><small>${esc(l.targetLabel||'')}</small></div>
      <time>${timeAgo(l.createdAt)}</time>
    </div>`).join('');
  } catch(e) { console.warn('Audit log failed', e); }
}

/* ══════════════════════════════════════════════
   BULK ACTIONS
   ══════════════════════════════════════════════ */
function updateBulkBar() {
  const bar = $('#pcBulkBar');
  const count = $('#pcBulkCount');
  if (!bar) return;
  if (state.selected.size > 0) {
    bar.classList.remove('hidden');
    if (count) count.textContent = `${state.selected.size} selected`;
  } else {
    bar.classList.add('hidden');
  }
}

async function bulkAction(action) {
  const ids = [...state.selected];
  if (!ids.length) return;
  let reason = '';
  if (action === 'cancel') { reason = prompt('Cancellation reason:'); if (reason === null) return; }
  if (action === 'delete' && !confirm(`Delete ${ids.length} parcels permanently?`)) return;
  try {
    const data = await api('/api/admin/parcels/bulk-action', { method:'POST', body:{ ids, action, reason } });
    toast(`${action} completed: ${data.results?.success||0} success`);
    state.selected.clear();
    updateBulkBar();
    loadParcels();
    loadStats();
  } catch(e) { toast(e.error||'Bulk action failed', 'fa-exclamation-triangle'); }
}

/* ══════════════════════════════════════════════
   EXPORT
   ══════════════════════════════════════════════ */
async function exportCSV() {
  try {
    const params = new URLSearchParams();
    if (state.filters.status !== 'all') params.set('status', state.filters.status);
    if (state.filters.dateFrom) params.set('dateFrom', state.filters.dateFrom);
    if (state.filters.dateTo) params.set('dateTo', state.filters.dateTo);
    const res = await fetch(`${API_ORIGIN}/api/admin/parcels/export?${params}`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')||''}` }
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `parcels-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast('Export downloaded');
  } catch(e) { toast('Export failed', 'fa-exclamation-triangle'); }
}

/* ══════════════════════════════════════════════
   EVENT WIRING
   ══════════════════════════════════════════════ */
export default function initParcels() {
  // Search
  let debounce;
  $('#pcSearch')?.addEventListener('input', e => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { state.search = e.target.value; state.page = 1; loadParcels(); }, 300);
  });

  // Sort
  $('#pcSortSelect')?.addEventListener('change', e => { state.sort = e.target.value; state.page = 1; loadParcels(); });

  // Filter toggle
  $('#pcFilterToggle')?.addEventListener('click', () => {
    state.filtersVisible = !state.filtersVisible;
    $('#pcFilters')?.classList.toggle('hidden', !state.filtersVisible);
  });

  // Filter changes
  ['pcFilterStatus','pcFilterPriority','pcFilterCategory','pcFilterPayment'].forEach(id => {
    $(`#${id}`)?.addEventListener('change', e => {
      const key = id.replace('pcFilter','').toLowerCase();
      state.filters[key] = e.target.value;
      state.page = 1; loadParcels();
    });
  });
  ['pcFilterFrom','pcFilterTo','pcFilterDateFrom','pcFilterDateTo'].forEach(id => {
    $(`#${id}`)?.addEventListener('input', e => {
      const key = id.replace('pcFilter','').toLowerCase();
      state.filters[key] = e.target.value;
      clearTimeout(debounce);
      debounce = setTimeout(() => { state.page = 1; loadParcels(); }, 500);
    });
  });

  // Clear filters
  $('#pcClearFilters')?.addEventListener('click', () => {
    state.filters = { status:'all', priority:'all', category:'all', payment:'all', from:'', to:'', dateFrom:'', dateTo:'' };
    ['pcFilterStatus','pcFilterPriority','pcFilterCategory','pcFilterPayment'].forEach(id => { const el = $(`#${id}`); if(el) el.value = 'all'; });
    ['pcFilterFrom','pcFilterTo','pcFilterDateFrom','pcFilterDateTo'].forEach(id => { const el = $(`#${id}`); if(el) el.value = ''; });
    state.page = 1; loadParcels();
  });

  // Refresh
  $('#pcRefreshBtn')?.addEventListener('click', () => { loadParcels(); loadStats(); toast('Refreshed'); });

  // Export
  $('#pcExportBtn')?.addEventListener('click', exportCSV);

  // Select all
  $('#pcSelectAll')?.addEventListener('change', e => {
    if (e.target.checked) { state.parcels.forEach(p => state.selected.add(p._id)); }
    else { state.selected.clear(); }
    renderTable(); updateBulkBar();
  });

  // Table delegation
  $('#pcTableBody')?.addEventListener('click', e => {
    // Checkbox
    const check = e.target.closest('.pc-row-check');
    if (check) {
      const id = check.dataset.id;
      if (check.checked) state.selected.add(id); else state.selected.delete(id);
      check.closest('tr')?.classList.toggle('pc-row-selected', check.checked);
      updateBulkBar();
      return;
    }
    // Action buttons
    const btn = e.target.closest('[data-action]');
    if (btn) {
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === 'view') openDrawer(id);
      else if (action === 'timeline') openTimelineModal(id);
      else if (action === 'edit') openDrawer(id);
      else if (action === 'notes') { openDrawer(id); setTimeout(()=>$('#pcNoteInput')?.focus(), 300); }
      else if (action === 'notify') {
        const msg = prompt('Notification message:');
        if (msg) api(`/api/admin/parcels/${id}/notify`, { method:'POST', body:{ message:msg } }).then(()=>toast('Notification sent')).catch(()=>toast('Failed','fa-exclamation-triangle'));
      }
      return;
    }
    // Row click -> open drawer
    const row = e.target.closest('tr[data-id]');
    if (row && !e.target.closest('button') && !e.target.closest('input')) openDrawer(row.dataset.id);
  });

  // Bulk actions
  $$('[data-bulk]').forEach(btn => btn.addEventListener('click', () => bulkAction(btn.dataset.bulk)));
  $('#pcBulkDeselect')?.addEventListener('click', () => { state.selected.clear(); updateBulkBar(); renderTable(); });

  // Drawer close
  $('#pcDrawerClose')?.addEventListener('click', closeDrawer);
  $('#pcDrawerOverlay')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeDrawer(); });
  $('#pcDrawerTimeline')?.addEventListener('click', () => {
    const id = $('#pcDrawerBody')?.querySelector('[data-drawer-action]')?.dataset?.id;
    if (id) openTimelineModal(id);
  });

  // Timeline close
  $('#pcTimelineClose')?.addEventListener('click', closeTimeline);
  $('#pcTimelineOverlay')?.addEventListener('click', e => { if(e.target===e.currentTarget) closeTimeline(); });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey||e.metaKey) && e.key === 'k') { e.preventDefault(); $('#pcSearch')?.focus(); }
    if (e.key === 'Escape') { closeDrawer(); closeTimeline(); }
  });

  // Initial load
  loadStats();
  loadParcels();

  // Restore a previously-open parcel detail drawer if the page was
  // reloaded while one was open, instead of always landing back on the
  // bare parcels list after a refresh.
  const savedDrawer = window.AdminNav?.getSubState('parcels');
  if (savedDrawer?.parcelId) openDrawer(savedDrawer.parcelId);
}

// Auto-init
try { initParcels(); } catch(e) { console.warn('parcels init failed', e); }
