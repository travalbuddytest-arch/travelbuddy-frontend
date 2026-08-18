// Frontend/admin_dashboard/js/users.js
// ══════════════════════════════════════════════
// USERS MANAGEMENT — Full Implementation
// ══════════════════════════════════════════════

const API_ORIGIN = APP_CONFIG.API_BASE_URL;
const PAGE_SIZE = 20;

/* ── State ─────────────────────────────── */
let state = {
  page: 1, total: 0, search: '',
  filters: { role: 'all', status: 'all', verification: 'all', hasReports: 'all', dateFrom: '', dateTo: '', minWallet: '', minRating: '' },
  selected: new Set(), users: [],
  filtersVisible: false, analyticsVisible: false, riskVisible: false,
  currentUserId: null, currentTab: 'overview',
};

/* ── Helpers ───────────────────────────── */
const $ = (s, p) => (p || document).querySelector(s);
const $$ = (s, p) => [...(p || document).querySelectorAll(s)];
const esc = s => s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : '';
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—';
const fmtDateTime = d => d ? new Date(d).toLocaleString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
const fmtMoney = n => '₹' + (n||0).toLocaleString('en-IN');
const timeAgo = d => { if(!d) return 'Never'; const m=Math.floor((Date.now()-new Date(d))/60000); if(m<1) return 'Just now'; if(m<60) return m+'m ago'; const h=Math.floor(m/60); if(h<24) return h+'h ago'; return Math.floor(h/24)+'d ago'; };
const initials = u => `${(u.firstName||'?')[0]||''}${(u.lastName||'')[0]||''}`.toUpperCase();
const avatarSrc = u => u.profilePhoto ? u.profilePhoto : `https://ui-avatars.com/api/?name=${encodeURIComponent((u.firstName||'')+' '+(u.lastName||''))}&background=eff6ff&color=1769ff&bold=true`;

async function api(url, opts = {}) {
  const token = localStorage.getItem('admin_token') || localStorage.getItem('travelBuddyAdminToken');
  const headers = { ...opts.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body && typeof opts.body === 'object') {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch(`${API_ORIGIN}${url}`, { credentials: 'include', ...opts, headers });
  if (url.includes('/export')) {
    if (!res.ok) throw new Error('Export failed');
    return res;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data;
  return data;
}

function toast(msg, icon = 'fa-circle-check') {
  const t = $('#usToast'), m = $('#usToastMsg');
  if (t) { t.querySelector('i').className = `fa-solid ${icon}`; m.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2800); }
}

function animateCount(el, target) {
  if (!el) return;
  const duration = 800;
  const start = parseInt(el.textContent.replace(/[^0-9]/g, '')) || 0;
  const diff = target - start;
  if (diff === 0) { el.textContent = target.toLocaleString('en-IN'); return; }
  const startTime = performance.now();
  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + diff * eased).toLocaleString('en-IN');
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ══════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════ */
export default function initUsers() {
  const panel = $('#users-panel');
  if (!panel) return;

  loadKPIs();
  loadUsers();

  $('#usRefreshBtn')?.addEventListener('click', () => { loadKPIs(); loadUsers(); toast('Refreshed'); });

  // Search (debounced)
  let debounce;
  $('#usSearch')?.addEventListener('input', (e) => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { state.search = e.target.value; state.page = 1; loadUsers(); }, 300);
  });

  // Filter toggle
  $('#usFilterToggle')?.addEventListener('click', () => {
    state.filtersVisible = !state.filtersVisible;
    $('#usFilters')?.classList.toggle('hidden', !state.filtersVisible);
  });

  // Analytics toggle
  $('#usAnalyticsToggle')?.addEventListener('click', () => {
    state.analyticsVisible = !state.analyticsVisible;
    $('#usAnalytics')?.classList.toggle('hidden', !state.analyticsVisible);
    if (state.analyticsVisible) loadAnalytics();
  });

  // High risk toggle
  $('#usRiskShowBtn')?.addEventListener('click', () => { $('#usRiskPanel')?.classList.remove('hidden'); loadHighRisk(); });
  $('#usRiskToggle')?.addEventListener('click', () => $('#usRiskPanel')?.classList.add('hidden'));

  // Filters change
  ['usFilterRole', 'usFilterStatus', 'usFilterVerification', 'usFilterReports', 'usFilterDateFrom', 'usFilterDateTo', 'usFilterMinWallet', 'usFilterMinRating'].forEach(id => {
    $(`#${id}`)?.addEventListener('change', applyFiltersFromForm);
  });
  $('#usClearFilters')?.addEventListener('click', () => {
    state.filters = { role: 'all', status: 'all', verification: 'all', hasReports: 'all', dateFrom: '', dateTo: '', minWallet: '', minRating: '' };
    ['usFilterRole','usFilterStatus','usFilterVerification','usFilterReports'].forEach(id => { const el = $(`#${id}`); if (el) el.value = 'all'; });
    ['usFilterDateFrom','usFilterDateTo','usFilterMinWallet','usFilterMinRating'].forEach(id => { const el = $(`#${id}`); if (el) el.value = ''; });
    state.page = 1; loadUsers();
  });

  // Export menu
  $('#usExportBtn')?.addEventListener('click', (e) => { e.stopPropagation(); $('#usExportMenu')?.classList.toggle('hidden'); });
  document.addEventListener('click', () => $('#usExportMenu')?.classList.add('hidden'));
  $$('#usExportMenu button').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); exportUsers(b.dataset.format); $('#usExportMenu')?.classList.add('hidden'); }));

  // Add user (no admin-side user-creation flow exists — users self-register)
  $('#usAddUserBtn')?.addEventListener('click', () => toast('Users self-register through the app — there is no manual "add user" flow yet.', 'fa-circle-info'));

  // Select all
  $('#usSelectAll')?.addEventListener('change', (e) => {
    if (e.target.checked) state.users.forEach(u => state.selected.add(u._id));
    else state.selected.clear();
    renderUsers();
  });

  // Bulk actions
  $$('#usBulkBar [data-bulk]').forEach(btn => btn.addEventListener('click', () => handleBulkAction(btn.dataset.bulk)));
  $('#usBulkDeselect')?.addEventListener('click', () => { state.selected.clear(); renderUsers(); });

  // Modal
  $('#usModalClose')?.addEventListener('click', closeModal);
  $('#usModalOverlay')?.addEventListener('click', (e) => { if (e.target.id === 'usModalOverlay') closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#usModalOverlay')?.classList.contains('hidden')) closeModal(); });

  // Restore a previously-open user profile drawer (and its active tab) if
  // the page was reloaded while one was open, instead of always landing
  // back on the bare list after a refresh.
  const savedDrawer = window.AdminNav?.getSubState('users');
  if (savedDrawer?.userId) openModal(savedDrawer.userId, savedDrawer.tab || 'overview');
}

function applyFiltersFromForm() {
  state.filters.role = $('#usFilterRole')?.value || 'all';
  state.filters.status = $('#usFilterStatus')?.value || 'all';
  state.filters.verification = $('#usFilterVerification')?.value || 'all';
  state.filters.hasReports = $('#usFilterReports')?.value || 'all';
  state.filters.dateFrom = $('#usFilterDateFrom')?.value || '';
  state.filters.dateTo = $('#usFilterDateTo')?.value || '';
  state.filters.minWallet = $('#usFilterMinWallet')?.value || '';
  state.filters.minRating = $('#usFilterMinRating')?.value || '';
  state.page = 1;
  loadUsers();
}

/* ══════════════════════════════════════════════
   KPI CARDS
   ══════════════════════════════════════════════ */
async function loadKPIs() {
  try {
    const d = await api('/api/admin/users/kpis');
    const map = {
      total: [d.totalUsers, `+${d.newThisWeek || 0} this week`],
      active: [d.onlineUsers, 'Online now'],
      verified: [d.verifiedPct + '%', `${d.verifiedUsers || 0} verified users`],
      travelers: [d.travelerCount, 'Total travelers'],
      senders: [d.sendersCount, 'Total senders'],
      suspended: [d.suspendedUsers, 'Suspended + blocked'],
    };
    $$('.us-kpi').forEach(card => {
      const key = card.dataset.kpi;
      const [val, sub] = map[key] || [0, '—'];
      card.classList.remove('skel');
      const strong = card.querySelector('strong');
      const small = card.querySelector('small');
      if (small) small.textContent = sub;
      if (typeof val === 'number') animateCount(strong, val);
      else if (strong) strong.textContent = val;
    });
  } catch (e) { console.warn('KPI load failed', e); }
}

/* ══════════════════════════════════════════════
   USERS TABLE
   ══════════════════════════════════════════════ */
async function loadUsers() {
  const tbody = $('#usTableBody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="16" class="us-empty"><div class="us-skeleton-row"></div><div class="us-skeleton-row"></div><div class="us-skeleton-row"></div></td></tr>`;

  try {
    const p = new URLSearchParams({ page: state.page, limit: PAGE_SIZE });
    if (state.search) p.set('search', state.search);
    const f = state.filters;
    if (f.role !== 'all') p.set('role', f.role);
    if (f.status !== 'all') p.set('status', f.status);
    if (f.verification !== 'all') p.set('verification', f.verification);
    if (f.hasReports !== 'all') p.set('hasReports', f.hasReports);
    if (f.dateFrom) p.set('dateFrom', f.dateFrom);
    if (f.dateTo) p.set('dateTo', f.dateTo);
    if (f.minWallet) p.set('minWallet', f.minWallet);
    if (f.minRating) p.set('minRating', f.minRating);

    const data = await api(`/api/admin/users?${p}`);
    state.users = data.users || [];
    state.total = data.total || 0;
    renderUsers();
    renderPagination();
    const count = $('#usResultCount');
    if (count) count.textContent = `${state.total.toLocaleString('en-IN')} users`;
  } catch (err) {
    console.warn('Users load failed', err);
    tbody.innerHTML = `<tr><td colspan="16"><div class="us-error-state"><i class="fa-solid fa-cloud-exclamation"></i> Failed to load users.<br><button class="us-retry-inline" id="usRetry">Retry</button></div></td></tr>`;
    $('#usRetry')?.addEventListener('click', loadUsers);
    const count = $('#usResultCount'); if (count) count.textContent = 'Error';
  }
}

function verifyBadge(status, label) {
  const icons = { verified: 'fa-check', pending: 'fa-clock', rejected: 'fa-xmark', not_submitted: 'fa-minus' };
  return `<span class="us-vbadge ${status}" title="${label}: ${status.replace('_',' ')}"><i class="fa-solid ${icons[status] || 'fa-minus'}"></i></span>`;
}

function statusPill(u) {
  if (u.status === 'blocked') return `<span class="us-status-pill blocked"><i class="fa-solid fa-circle"></i> Blocked</span>`;
  if (u.status === 'suspended') return `<span class="us-status-pill suspended"><i class="fa-solid fa-circle"></i> Suspended</span>`;
  if (u.isOnline) return `<span class="us-status-pill online"><i class="fa-solid fa-circle"></i> Online</span>`;
  return `<span class="us-status-pill offline"><i class="fa-solid fa-circle"></i> Offline</span>`;
}

function renderUsers() {
  const tbody = $('#usTableBody');
  if (!tbody) return;

  if (!state.users.length) {
    tbody.innerHTML = `<tr><td colspan="16"><div class="us-empty-state"><i class="fa-solid fa-users-slash"></i><span>No users match these filters.</span></div></td></tr>`;
    return;
  }

  tbody.innerHTML = state.users.map(u => {
    const role = u.isTraveler && u.isSender ? 'Both' : u.isTraveler ? 'Traveler' : 'Sender';
    const v = u.verification || {};
    const checked = state.selected.has(u._id) ? 'checked' : '';
    return `
      <tr data-id="${u._id}">
        <td class="us-td-check" onclick="event.stopPropagation()"><input type="checkbox" class="us-row-check" data-id="${u._id}" ${checked}></td>
        <td>
          <div class="us-user-cell">
            <img class="us-avatar" src="${avatarSrc(u)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
            <div><div class="name">${esc(u.firstName)} ${esc(u.lastName)}</div><div class="sub">Joined ${fmtDate(u.createdAt)}</div></div>
          </div>
        </td>
        <td class="us-mono">${esc(u.travelerPublicId || u.senderPublicId || String(u._id).slice(-8).toUpperCase())}</td>
        <td><div>${esc(u.email)}</div><div class="us-mono">${esc(u.phone || '—')}</div></td>
        <td><span class="us-role-pill">${role}</span></td>
        <td><div class="us-verify-badges">${verifyBadge(v.email ? 'verified' : 'not_submitted', 'Email')}${verifyBadge(v.phone ? 'verified' : 'not_submitted', 'Phone')}${verifyBadge(v.governmentId, 'Govt ID')}${verifyBadge(v.selfie, 'Selfie')}${verifyBadge(v.address, 'Address')}</div></td>
        <td>${fmtMoney(u.walletBalance)}</td>
        <td>${u.parcelCount || 0}</td>
        <td>${u.travelerDeliveryCount || 0}</td>
        <td>${u.completedCount ?? '—'}</td>
        <td>${u.cancelledCount || 0}</td>
        <td><span class="us-rating"><i class="fa-solid fa-star"></i> ${(u.rating || 0).toFixed(1)}</span></td>
        <td><span class="us-reports-badge ${u.reportCount ? 'has-reports' : ''}">${u.reportCount || 0}</span></td>
        <td>${timeAgo(u.lastSeenAt)}</td>
        <td>${statusPill(u)}</td>
        <td class="us-td-actions" onclick="event.stopPropagation()">
          <div class="us-row-actions">
            <button class="us-icon-btn" title="View Profile" data-action="view" data-id="${u._id}"><i class="fa-solid fa-eye"></i></button>
            ${u.status === 'active'
              ? `<button class="us-icon-btn" title="Suspend" data-action="suspend" data-id="${u._id}"><i class="fa-solid fa-ban"></i></button>`
              : `<button class="us-icon-btn" title="Activate" data-action="activate" data-id="${u._id}"><i class="fa-solid fa-circle-check"></i></button>`}
            <button class="us-icon-btn danger" title="Delete" data-action="delete" data-id="${u._id}"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>`;
  }).join('');

  // Row click -> open modal
  $$('#usTableBody tr[data-id]').forEach(tr => tr.addEventListener('click', () => openModal(tr.dataset.id)));

  // Row checkboxes
  $$('.us-row-check').forEach(cb => cb.addEventListener('change', () => {
    if (cb.checked) state.selected.add(cb.dataset.id); else state.selected.delete(cb.dataset.id);
    updateBulkBar();
  }));

  // Row actions
  $$('#usTableBody [data-action]').forEach(btn => btn.addEventListener('click', () => handleRowAction(btn.dataset.action, btn.dataset.id)));

  updateBulkBar();
}

function updateBulkBar() {
  const bar = $('#usBulkBar');
  const count = $('#usBulkCount');
  if (!bar) return;
  bar.classList.toggle('hidden', state.selected.size === 0);
  if (count) count.textContent = `${state.selected.size} selected`;
  const allBox = $('#usSelectAll');
  if (allBox) allBox.checked = state.users.length > 0 && state.users.every(u => state.selected.has(u._id));
}

function renderPagination() {
  const el = $('#usPagination');
  if (!el) return;
  const totalPages = Math.max(1, Math.ceil(state.total / PAGE_SIZE));
  let html = `<button ${state.page <= 1 ? 'disabled' : ''} data-p="${state.page - 1}"><i class="fa-solid fa-chevron-left"></i></button>`;
  const start = Math.max(1, state.page - 2), end = Math.min(totalPages, state.page + 2);
  for (let i = start; i <= end; i++) html += `<button class="${i === state.page ? 'active' : ''}" data-p="${i}">${i}</button>`;
  html += `<button ${state.page >= totalPages ? 'disabled' : ''} data-p="${state.page + 1}"><i class="fa-solid fa-chevron-right"></i></button>`;
  el.innerHTML = html;
  $$('#usPagination button[data-p]').forEach(b => b.addEventListener('click', () => { state.page = Number(b.dataset.p); loadUsers(); }));
}

/* ══════════════════════════════════════════════
   ROW / BULK ACTIONS
   ══════════════════════════════════════════════ */
async function handleRowAction(action, id) {
  if (action === 'view') return openModal(id);
  if (action === 'suspend') return changeStatus(id, 'suspended');
  if (action === 'activate') return changeStatus(id, 'active');
  if (action === 'delete') return deleteUser(id);
}

async function changeStatus(id, status) {
  let reason = '';
  if (status === 'suspended') reason = prompt('Reason for suspension (optional):') || '';
  try {
    await api(`/api/admin/users/${id}/status`, { method: 'PATCH', body: { status, reason } });
    toast(`User ${status}.`);
    loadUsers(); loadKPIs();
  } catch (e) { toast(e?.data?.error || e?.error || 'Could not update status.', 'fa-circle-xmark'); }
}

async function deleteUser(id) {
  if (!confirm('Delete this user? Their history is preserved but the account will be deactivated.')) return;
  try {
    await api(`/api/admin/users/${id}`, { method: 'DELETE' });
    toast('User deleted.');
    loadUsers(); loadKPIs();
  } catch (e) { toast(e?.data?.error || e?.error || 'Could not delete user.', 'fa-circle-xmark'); }
}

async function handleBulkAction(action) {
  if (!state.selected.size) return;
  const ids = [...state.selected];
  let reason, message;
  if (action === 'suspend') reason = prompt('Reason for bulk suspension (optional):') || '';
  if (action === 'notify') { message = prompt('Notification message:'); if (!message) return; }
  if (action === 'delete' && !confirm(`Delete ${ids.length} users?`)) return;

  try {
    const data = await api('/api/admin/users/bulk-action', { method: 'POST', body: { ids, action, reason, message } });
    toast(`Bulk ${action}: ${data.results.success} succeeded, ${data.results.failed} failed.`);
    state.selected.clear();
    loadUsers(); loadKPIs();
  } catch (e) { toast(e?.data?.error || e?.error || 'Bulk action failed.', 'fa-circle-xmark'); }
}

async function exportUsers(format) {
  try {
    const res = await api(`/api/admin/users/export?format=${format}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-export-${new Date().toISOString().slice(0, 10)}.${format === 'excel' ? 'xls' : 'csv'}`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast('Export downloaded.');
  } catch (e) { toast('Export failed.', 'fa-circle-xmark'); }
}

/* ══════════════════════════════════════════════
   HIGH RISK USERS
   ══════════════════════════════════════════════ */
async function loadHighRisk() {
  const list = $('#usRiskList');
  if (!list) return;
  list.innerHTML = `<div class="us-skeleton-row"></div><div class="us-skeleton-row"></div>`;
  try {
    const data = await api('/api/admin/users/high-risk');
    if (!data.users.length) { list.innerHTML = `<div class="us-empty-note"><i class="fa-solid fa-shield-check"></i> No high-risk users detected right now.</div>`; return; }
    const flagLabels = { high_cancellation_rate: 'High cancellation', multiple_complaints: 'Multiple complaints', has_complaints: 'Has complaints', previously_actioned: 'Previously actioned', rejected_verification: 'Rejected KYC' };
    list.innerHTML = data.users.map(u => `
      <div class="us-risk-item" data-id="${u._id}">
        <img src="${avatarSrc(u)}" alt="">
        <span class="name">${esc(u.firstName)} ${esc(u.lastName)}</span>
        <div class="flags">${u.riskFlags.map(f => `<span class="us-risk-flag">${flagLabels[f] || f}</span>`).join('')}</div>
        <span class="us-risk-score">${u.riskScore}</span>
      </div>`).join('');
    $$('#usRiskList .us-risk-item').forEach(el => el.addEventListener('click', () => openModal(el.dataset.id)));
  } catch (e) { list.innerHTML = `<div class="us-empty-note">Could not load high-risk users.</div>`; }
}

/* ══════════════════════════════════════════════
   ANALYTICS
   ══════════════════════════════════════════════ */
async function loadAnalytics() {
  try {
    const d = await api('/api/admin/users/analytics');
    renderBarChart('#usChartDaily', d.dailyRegistrations.map(r => ({ label: r.date.slice(5), value: r.count })));
    renderBarChart('#usChartMonthly', d.monthlyGrowth.map(r => ({ label: r.month.slice(5), value: r.count })));

    const roleTotal = Object.values(d.roleDistribution).reduce((a, b) => a + b, 0) || 1;
    renderDistribution('#usChartRoles', [
      ['Senders only', d.roleDistribution.sendersOnly], ['Travelers only', d.roleDistribution.travelersOnly], ['Both', d.roleDistribution.both],
    ], roleTotal);

    const vTotal = Object.values(d.verificationDistribution).reduce((a, b) => a + b, 0) || 1;
    renderDistribution('#usChartVerification', Object.entries(d.verificationDistribution).map(([k, v]) => [cap(k.replace('_', ' ')), v]), vTotal);

    const aTotal = d.activeVsInactive.active + d.activeVsInactive.inactive || 1;
    renderDistribution('#usChartActive', [['Active (30d)', d.activeVsInactive.active], ['Inactive', d.activeVsInactive.inactive]], aTotal);

    $('#usTopTravelers').innerHTML = d.topTravelers.length ? d.topTravelers.map((t, i) => `<div class="us-top-row"><span class="rank">${i + 1}</span><span class="name">${esc(t.name)}</span><span class="metric">${t.deliveries} deliveries</span></div>`).join('') : `<div class="us-empty-note">No completed deliveries yet.</div>`;
    $('#usTopSenders').innerHTML = d.topSenders.length ? d.topSenders.map((t, i) => `<div class="us-top-row"><span class="rank">${i + 1}</span><span class="name">${esc(t.name)}</span><span class="metric">${t.parcels} parcels</span></div>`).join('') : `<div class="us-empty-note">No parcels posted yet.</div>`;
  } catch (e) { console.warn('Analytics load failed', e); }
}

function renderBarChart(sel, points) {
  const el = $(sel);
  if (!el) return;
  if (!points.length) { el.innerHTML = `<div class="us-empty-note">No data yet.</div>`; return; }
  const max = Math.max(...points.map(p => p.value), 1);
  el.innerHTML = points.map(p => `<div class="us-chart-bar-wrap"><div class="us-chart-bar" style="height:${Math.max(4, (p.value / max) * 100)}%" title="${p.label}: ${p.value}"></div><span>${p.label}</span></div>`).join('');
}

function renderDistribution(sel, rows, total) {
  const el = $(sel);
  if (!el) return;
  el.innerHTML = rows.map(([label, val]) => `
    <div class="us-dist-row">
      <span class="label">${esc(label)}</span>
      <span class="bar-bg"><span class="bar-fill" style="width:${Math.round((val / total) * 100)}%"></span></span>
      <span class="val">${val}</span>
    </div>`).join('');
}

/* ══════════════════════════════════════════════
   USER PROFILE MODAL
   ══════════════════════════════════════════════ */
async function openModal(id, initialTab = 'overview') {
  state.currentUserId = id;
  state.currentTab = initialTab;
  $('#usModalOverlay')?.classList.remove('hidden');
  $('#usModalBody').innerHTML = `<div class="us-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading profile…</div>`;
  document.body.style.overflow = 'hidden';
  // Remember the open drawer + tab (per page, in sessionStorage) so a
  // browser refresh can reopen the same user profile instead of just
  // landing back on the bare Users list.
  window.AdminNav?.setSubState('users', { userId: id, tab: initialTab });
  await loadModalData(id, initialTab);
}

function closeModal() {
  $('#usModalOverlay')?.classList.add('hidden');
  document.body.style.overflow = '';
  state.currentUserId = null;
  window.AdminNav?.clearSubState('users');
}

let modalCache = null;

async function loadModalData(id, initialTab = 'overview') {
  try {
    const data = await api(`/api/admin/users/${id}`);
    modalCache = data;
    renderModal(data, initialTab);
  } catch (e) {
    $('#usModalBody').innerHTML = `<div class="us-error-state"><i class="fa-solid fa-cloud-exclamation"></i> Could not load this profile.<br><button class="us-retry-inline" id="usModalRetry">Retry</button></div>`;
    $('#usModalRetry')?.addEventListener('click', () => loadModalData(id, initialTab));
  }
}

const TABS = [
  ['overview', 'Overview', 'fa-id-card'],
  ['activity', 'Activity', 'fa-timeline'],
  ['parcels', 'Parcels', 'fa-box'],
  ['payments', 'Payments', 'fa-wallet'],
  ['verification', 'Verification', 'fa-shield-halved'],
  ['documents', 'Documents', 'fa-file-lines'],
  ['reports', 'Reports', 'fa-triangle-exclamation'],
  ['notes', 'Admin Notes', 'fa-note-sticky'],
];

function renderModal(data, initialTab = 'overview') {
  const u = data.user;
  const role = (u.senderPublicId && u.travelerPublicId) ? 'Both' : u.travelerPublicId ? 'Traveler' : 'Sender';
  const body = $('#usModalBody');
  body.innerHTML = `
    <div class="us-profile-header">
      <img class="us-profile-avatar" src="${avatarSrc(u)}" alt="">
      <div>
        <h2 class="us-profile-name">${esc(u.firstName)} ${esc(u.lastName)}</h2>
        <div class="us-profile-meta">
          <span class="us-role-pill">${role}</span>
          ${statusPill({ ...u })}
          <span class="us-status-tag ${u.verification.governmentId}">${cap(u.verification.governmentId.replace('_',' '))}</span>
          ${u.riskScore > 0 ? `<span class="us-status-tag rejected"><i class="fa-solid fa-triangle-exclamation"></i> Risk ${u.riskScore}</span>` : ''}
        </div>
      </div>
      <div class="us-profile-stats">
        <div class="us-profile-stat"><strong>${(u.rating || 0).toFixed(1)}</strong><span>RATING</span></div>
        <div class="us-profile-stat"><strong>${fmtMoney(u.walletBalance)}</strong><span>WALLET</span></div>
        <div class="us-profile-stat"><strong>${fmtDate(u.createdAt)}</strong><span>MEMBER SINCE</span></div>
      </div>
    </div>

    <div class="us-quick-actions">
      ${u.status === 'active'
        ? `<button class="us-btn us-btn-sm us-btn-warning" data-qa="suspend"><i class="fa-solid fa-ban"></i> Suspend</button>`
        : `<button class="us-btn us-btn-sm us-btn-success" data-qa="activate"><i class="fa-solid fa-circle-check"></i> Activate</button>`}
      ${u.status !== 'blocked' ? `<button class="us-btn us-btn-sm us-btn-danger" data-qa="block"><i class="fa-solid fa-user-slash"></i> Block</button>` : ''}
      <button class="us-btn us-btn-sm us-btn-danger" data-qa="delete"><i class="fa-solid fa-trash"></i> Delete</button>
      <a class="us-btn us-btn-sm" href="mailto:${esc(u.email)}"><i class="fa-solid fa-envelope"></i> Email User</a>
      ${u.phone ? `<a class="us-btn us-btn-sm" href="tel:${esc(u.phone)}"><i class="fa-solid fa-phone"></i> Call User</a>` : ''}
    </div>

    <div class="us-tabs">
      ${TABS.map(([id, label, icon]) => `<button class="us-tab ${id === initialTab ? 'active' : ''}" data-tab="${id}"><i class="fa-solid ${icon}"></i> ${label}</button>`).join('')}
    </div>

    <div class="us-tab-content">
      <div class="us-tab-panel ${initialTab === 'overview' ? 'active' : ''}" data-panel="overview">${renderOverviewTab(data)}</div>
      <div class="us-tab-panel ${initialTab === 'activity' ? 'active' : ''}" data-panel="activity">${renderActivityTab(data)}</div>
      <div class="us-tab-panel ${initialTab === 'parcels' ? 'active' : ''}" data-panel="parcels">${renderParcelsTab(data)}</div>
      <div class="us-tab-panel ${initialTab === 'payments' ? 'active' : ''}" data-panel="payments">${renderPaymentsTab(data)}</div>
      <div class="us-tab-panel ${initialTab === 'verification' ? 'active' : ''}" data-panel="verification">${renderVerificationTab(data)}</div>
      <div class="us-tab-panel ${initialTab === 'documents' ? 'active' : ''}" data-panel="documents">${renderDocumentsTab(data)}</div>
      <div class="us-tab-panel ${initialTab === 'reports' ? 'active' : ''}" data-panel="reports">${renderReportsTab(data)}</div>
      <div class="us-tab-panel ${initialTab === 'notes' ? 'active' : ''}" data-panel="notes">${renderNotesTab(data)}</div>
    </div>
  `;

  // Tab switching
  $$('.us-tab', body).forEach(btn => btn.addEventListener('click', () => {
    $$('.us-tab', body).forEach(b => b.classList.remove('active'));
    $$('.us-tab-panel', body).forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $(`.us-tab-panel[data-panel="${btn.dataset.tab}"]`, body)?.classList.add('active');
    state.currentTab = btn.dataset.tab;
    window.AdminNav?.setSubState('users', { userId: u._id, tab: btn.dataset.tab });
  }));

  // Quick actions
  $$('[data-qa]', body).forEach(btn => btn.addEventListener('click', () => handleQuickAction(btn.dataset.qa, u._id)));

  // Verification approve/reject buttons
  $$('[data-verify-field]', body).forEach(btn => btn.addEventListener('click', () => setVerification(u._id, btn.dataset.verifyField, btn.dataset.verifyStatus)));

  // Notes form
  $('#usNoteSubmit', body)?.addEventListener('click', () => submitNote(u._id));
}

function renderOverviewTab(data) {
  const u = data.user;
  return `
    <div class="us-section-title"><i class="fa-solid fa-id-card"></i> Personal Details</div>
    <div class="us-info-grid">
      <div class="us-info-item"><label>Full Name</label><div>${esc(u.firstName)} ${esc(u.lastName)}</div></div>
      <div class="us-info-item"><label>Email</label><div>${esc(u.email)}</div></div>
      <div class="us-info-item"><label>Phone</label><div>${esc(u.phone || '—')}</div></div>
      <div class="us-info-item"><label>Registered Via</label><div>${esc(cap(u.authProvider || 'local'))}</div></div>
      <div class="us-info-item"><label>Registration Date</label><div>${fmtDate(u.createdAt)}</div></div>
      <div class="us-info-item"><label>Last Active</label><div>${timeAgo(u.lastSeenAt)}</div></div>
    </div>

    <div class="us-section-title"><i class="fa-solid fa-shield"></i> Account Information</div>
    <div class="us-info-grid">
      <div class="us-info-item"><label>User ID</label><div class="us-mono">${esc(u.travelerPublicId || u.senderPublicId || String(u._id))}</div></div>
      <div class="us-info-item"><label>Sender ID</label><div class="us-mono">${esc(u.senderPublicId || '—')}</div></div>
      <div class="us-info-item"><label>Traveler ID</label><div class="us-mono">${esc(u.travelerPublicId || '—')}</div></div>
      <div class="us-info-item"><label>Account Status</label><div>${esc(cap(u.status))}</div></div>
      ${u.statusReason ? `<div class="us-info-item"><label>Status Reason</label><div>${esc(u.statusReason)}</div></div>` : ''}
    </div>

    <div class="us-section-title"><i class="fa-solid fa-gauge-high"></i> Performance</div>
    <div class="us-perf-grid">
      <div class="us-perf-card"><div class="val">${(u.rating || 0).toFixed(1)} ★</div><div class="lbl">Overall Rating</div></div>
      <div class="us-perf-card"><div class="val">${data.performance.completionRate ?? '—'}${data.performance.completionRate !== null ? '%' : ''}</div><div class="lbl">Completion Rate</div></div>
      <div class="us-perf-card"><div class="val">${data.performance.cancellationRate}%</div><div class="lbl">Cancellation Rate</div></div>
      <div class="us-perf-card"><div class="val">${data.performance.postedParcels}</div><div class="lbl">Posted Parcels</div></div>
      <div class="us-perf-card"><div class="val">${data.performance.acceptedDeliveries}</div><div class="lbl">Accepted Deliveries</div></div>
      <div class="us-perf-card"><div class="val">${data.performance.completedDeliveries}</div><div class="lbl">Completed Deliveries</div></div>
      <div class="us-perf-card"><div class="val">${data.performance.cancelledDeliveries}</div><div class="lbl">Cancelled</div></div>
      <div class="us-perf-card"><div class="val">${data.performance.inTransit}</div><div class="lbl">In Transit</div></div>
    </div>
  `;
}

function renderActivityTab(data) {
  if (!data.timeline.length) return `<div class="us-empty-note">No recent activity recorded.</div>`;
  const icons = { parcel_posted: 'fa-box', parcel_cancelled: 'fa-ban', parcel_delivered: 'fa-circle-check', delivery_accepted: 'fa-truck', wallet_credit: 'fa-arrow-down', wallet_debit: 'fa-arrow-up', wallet_hold: 'fa-lock', wallet_system: 'fa-gear' };
  return data.timeline.map(t => `
    <div class="us-tl-item">
      <div class="us-tl-dot"><i class="fa-solid ${icons[t.type] || 'fa-circle'}"></i></div>
      <div class="us-tl-content"><strong>${esc(t.label)}</strong><span>${fmtDateTime(t.at)}</span></div>
    </div>`).join('');
}

function renderParcelsTab(data) {
  const rows = (list, roleLabel) => list.map(p => `
    <tr>
      <td class="us-mono">${esc(p.orderId)}</td>
      <td>${esc(p.fromCity)} → ${esc(p.toCity)}</td>
      <td>${cap(p.status.replace('_',' '))}</td>
      <td>${fmtMoney(p.price)}</td>
      <td>${esc(p[roleLabel] || '—')}</td>
      <td>${fmtDate(p.createdAt)}</td>
    </tr>`).join('');
  const sent = data.sentParcels || [], acc = data.travelerParcels || [];
  return `
    <div class="us-section-title"><i class="fa-solid fa-box-open"></i> Posted Parcels (as Sender)</div>
    ${sent.length ? `<table class="us-mini-table"><thead><tr><th>Order</th><th>Route</th><th>Status</th><th>Price</th><th>Traveler</th><th>Created</th></tr></thead><tbody>${rows(sent, 'traveler')}</tbody></table>` : `<div class="us-empty-note">No parcels posted yet.</div>`}
    <div class="us-section-title"><i class="fa-solid fa-truck"></i> Accepted Deliveries (as Traveler)</div>
    ${acc.length ? `<table class="us-mini-table"><thead><tr><th>Order</th><th>Route</th><th>Status</th><th>Earning</th><th>Sender</th><th>Created</th></tr></thead><tbody>${rows(acc, 'sender')}</tbody></table>` : `<div class="us-empty-note">No deliveries accepted yet.</div>`}
  `;
}

function renderPaymentsTab(data) {
  const w = data.wallet;
  const txns = w.transactions || [];
  return `
    <div class="us-perf-grid" style="margin-bottom:20px;">
      <div class="us-perf-card"><div class="val">${fmtMoney(data.user.walletBalance)}</div><div class="lbl">Wallet Balance</div></div>
      <div class="us-perf-card"><div class="val">${fmtMoney(w.summary.totalCredits)}</div><div class="lbl">Total Credits</div></div>
      <div class="us-perf-card"><div class="val">${fmtMoney(w.summary.totalDebits)}</div><div class="lbl">Total Debits</div></div>
      <div class="us-perf-card"><div class="val">${w.summary.txCount}</div><div class="lbl">Transactions</div></div>
    </div>
    <div class="us-section-title"><i class="fa-solid fa-receipt"></i> Recent Transactions</div>
    ${txns.length ? `<table class="us-mini-table"><thead><tr><th>Type</th><th>Direction</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>
      ${txns.map(t => `<tr><td>${cap(t.type.replace(/_/g,' '))}</td><td>${cap(t.direction)}</td><td>${fmtMoney(t.amount)}</td><td>${cap(t.status)}</td><td>${fmtDateTime(t.createdAt)}</td></tr>`).join('')}
    </tbody></table>` : `<div class="us-empty-note">No wallet transactions yet.</div>`}
  `;
}

function renderVerificationTab(data) {
  const u = data.user;
  const v = u.verification;
  const row = (icon, label, field, status, editable) => `
    <div class="us-verify-row">
      <div class="icon"><i class="fa-solid ${icon}"></i></div>
      <div class="label">${label}</div>
      <span class="us-status-tag ${status}">${cap(status.replace('_',' '))}</span>
      ${editable ? `
        <div class="actions">
          <button class="us-icon-btn" title="Approve" data-verify-field="${field}" data-verify-status="verified"><i class="fa-solid fa-check"></i></button>
          <button class="us-icon-btn danger" title="Reject" data-verify-field="${field}" data-verify-status="rejected"><i class="fa-solid fa-xmark"></i></button>
        </div>` : ''}
    </div>`;
  return `
    <div class="us-verify-list">
      ${row('fa-envelope', 'Email Verification', 'email', 'verified', false)}
      ${row('fa-phone', 'Phone Verification', 'phone', 'verified', false)}
      ${row('fa-id-card', 'Government ID', 'governmentId', v.governmentId, true)}
      ${row('fa-face-smile', 'Selfie Verification', 'selfie', v.selfie, true)}
      ${row('fa-location-dot', 'Address Verification', 'address', v.address, true)}
    </div>
    <p style="font-size:11.5px;color:var(--us-text-muted);margin-top:14px;">Email and phone are verified automatically at registration via OTP. Government ID, selfie, and address require the user to upload a document (see Documents tab) before they can be reviewed.</p>
  `;
}

function renderDocumentsTab(data) {
  const docs = data.documents || [];
  const labels = { governmentId: 'Government ID', addressProof: 'Address Proof', drivingLicense: 'Driving License', passport: 'Passport', vehicleRC: 'Vehicle RC', insurance: 'Insurance', selfie: 'Selfie' };
  if (!docs.length) return `<div class="us-empty-note"><i class="fa-solid fa-file-circle-xmark"></i><br>No documents uploaded by this user yet.</div>`;
  return `<div class="us-doc-grid">${docs.map(d => `
    <a class="us-doc-card" href="${esc(d.url)}" target="_blank" rel="noopener">
      <img src="${esc(d.url)}" alt="${labels[d.type] || d.type}" onerror="this.style.display='none'">
      <div class="meta"><div class="type">${labels[d.type] || d.type}</div><div class="status">${cap(d.status)} · ${fmtDate(d.uploadedAt)}</div></div>
    </a>`).join('')}</div>`;
}

function renderReportsTab(data) {
  const reports = data.reports || [];
  if (!reports.length) return `<div class="us-empty-note"><i class="fa-solid fa-shield-check"></i><br>No complaints have been filed against this user.</div>`;
  return reports.map(r => `
    <div class="us-report-item ${r.status !== 'open' ? 'resolved' : ''}">
      <div class="reason">${esc(r.reason)} <span class="us-status-tag ${r.status === 'open' ? 'pending' : 'verified'}" style="margin-left:8px;">${cap(r.status)}</span></div>
      ${r.description ? `<div class="desc">${esc(r.description)}</div>` : ''}
      <div class="meta">Filed ${fmtDateTime(r.createdAt)}</div>
    </div>`).join('');
}

function renderNotesTab(data) {
  const notes = data.adminNotes || [];
  return `
    <div class="us-note-form">
      <textarea id="usNoteInput" placeholder="Add a private note visible only to admins…"></textarea>
      <button class="us-btn us-btn-primary" id="usNoteSubmit"><i class="fa-solid fa-paper-plane"></i></button>
    </div>
    <div id="usNotesList">
      ${notes.length ? notes.map(n => `<div class="us-note-item">${esc(n.note)}<div class="meta">— ${esc(n.adminName || 'Admin')}, ${fmtDateTime(n.createdAt)}</div></div>`).join('') : `<div class="us-empty-note">No admin notes yet.</div>`}
    </div>
  `;
}

async function handleQuickAction(action, id) {
  if (action === 'suspend') { await changeStatus(id, 'suspended'); return loadModalData(id); }
  if (action === 'activate') { await changeStatus(id, 'active'); return loadModalData(id); }
  if (action === 'block') {
    if (!confirm('Block this user? They will be signed out immediately.')) return;
    await changeStatus(id, 'blocked'); return loadModalData(id);
  }
  if (action === 'delete') {
    if (!confirm('Delete this user?')) return;
    await deleteUser(id); closeModal();
  }
}

async function setVerification(id, field, status) {
  try {
    await api(`/api/admin/users/${id}/verify`, { method: 'PATCH', body: { field, status } });
    toast(`${cap(field.replace(/([A-Z])/g, ' $1'))} marked ${status}.`);
    loadModalData(id); loadUsers(); loadKPIs();
  } catch (e) { toast(e?.data?.error || 'Could not update verification.', 'fa-circle-xmark'); }
}

async function submitNote(id) {
  const input = $('#usNoteInput');
  const note = input?.value?.trim();
  if (!note) return;
  try {
    await api(`/api/admin/users/${id}/notes`, { method: 'POST', body: { note } });
    input.value = '';
    toast('Note added.');
    loadModalData(id);
  } catch (e) { toast('Could not add note.', 'fa-circle-xmark'); }
}

try { initUsers(); } catch (e) { console.warn('users init failed', e); }
