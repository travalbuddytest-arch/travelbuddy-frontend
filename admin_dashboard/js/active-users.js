// Frontend/admin_dashboard/js/active-users.js
// ══════════════════════════════════════════════
// ACTIVE USERS — live view of who is on the platform right now, and a
// visit log of who's been active recently. Reuses the isOnline/lastSeenAt
// fields that already exist on the User model (kept fresh by login and the
// messaging-socket heartbeat) — no new tracking infra required.
// ══════════════════════════════════════════════

const API_ORIGIN = `${window.location.origin}`;
const PAGE_SIZE = 20;
const POLL_MS = 20000; // refresh live data every 20s while this page is open

let state = { page: 1, total: 0, search: '', filter: 'today', users: [] };
let pollTimer = null;

/* ── Helpers ───────────────────────────── */
const $ = (s, p) => (p || document).querySelector(s);
const $$ = (s, p) => [...(p || document).querySelectorAll(s)];
const esc = s => s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : '';
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—';
const timeAgo = d => { if(!d) return 'Never'; const m=Math.floor((Date.now()-new Date(d))/60000); if(m<1) return 'Just now'; if(m<60) return m+'m ago'; const h=Math.floor(m/60); if(h<24) return h+'h ago'; return Math.floor(h/24)+'d ago'; };
const avatarSrc = u => u.profilePhoto ? u.profilePhoto : `https://ui-avatars.com/api/?name=${encodeURIComponent((u.firstName||'')+' '+(u.lastName||''))}&background=eff6ff&color=1769ff&bold=true`;

async function api(url, opts = {}) {
  const token = localStorage.getItem('admin_token') || localStorage.getItem('travelBuddyAdminToken');
  const headers = { ...opts.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_ORIGIN}${url}`, { credentials: 'include', ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data;
  return data;
}

function animateCount(el, target) {
  if (!el) return;
  const suffix = el.dataset.suffix || '';
  const duration = 800;
  const start = parseInt(el.textContent.replace(/[^0-9]/g, '')) || 0;
  const diff = target - start;
  if (diff === 0) { el.textContent = target.toLocaleString('en-IN') + suffix; return; }
  const startTime = performance.now();
  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + diff * eased).toLocaleString('en-IN') + suffix;
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ══════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════ */
export default function initActiveUsers() {
  const panel = $('#au-panel');
  if (!panel) return;

  loadSummary();
  loadTimeline();
  loadList();

  $('#auRefreshBtn')?.addEventListener('click', () => { loadSummary(); loadTimeline(); loadList(); });

  let searchDebounce;
  $('#auSearch')?.addEventListener('input', (e) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => { state.search = e.target.value.trim(); state.page = 1; loadList(); }, 350);
  });

  $$('#auTabs .au-tab').forEach(tab => tab.addEventListener('click', () => applyFilter(tab.dataset.filter)));

  // Every KPI card is itself a shortcut into the table below: click (or
  // Enter/Space when focused) jumps straight to that filtered slice of data.
  $$('.au-kpi[data-filter]').forEach(card => {
    card.addEventListener('click', () => applyFilter(card.dataset.filter, true));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); applyFilter(card.dataset.filter, true); }
    });
  });

  // Live-refresh KPIs and the visit log periodically while the tab is open.
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => {
    if (!document.getElementById('au-panel')) { clearInterval(pollTimer); return; }
    loadSummary();
    if (state.filter === 'online' || state.filter === '15min') loadList();
  }, POLL_MS);
}

/* ══════════════════════════════════════════════
   KPI CARDS
   ══════════════════════════════════════════════ */
function applyFilter(filter, scrollToTable = false) {
  state.filter = filter;
  state.page = 1;
  $$('#auTabs .au-tab').forEach(t => t.classList.toggle('active', t.dataset.filter === filter));
  loadList();
  if (scrollToTable) {
    const wrap = $('#auTableWrap');
    wrap?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    wrap?.classList.remove('au-flash');
    // Force reflow so the flash animation can replay on repeated clicks.
    void wrap?.offsetWidth;
    wrap?.classList.add('au-flash');
  }
}

async function loadSummary() {
  try {
    const d = await api('/api/admin/active-users/summary');
    const map = {
      onlineNow: [d.onlineNow, 'Connected this instant'],
      activeLast15Min: [d.activeLast15Min, 'Recently browsing'],
      activeToday: [d.activeToday, 'Unique visitors'],
      activeThisWeek: [d.activeThisWeek, 'Weekly reach'],
      newLoginsToday: [d.newLoginsToday, 'Signed up + visited'],
      visitRatePct: [d.visitRatePct, `${(d.activeToday||0).toLocaleString('en-IN')} of ${(d.totalUsers||0).toLocaleString('en-IN')} users`],
    };
    $$('.au-kpi').forEach(card => {
      const key = card.dataset.kpi;
      const [val, sub] = map[key] || [0, '—'];
      card.classList.remove('skel');
      const strong = card.querySelector('strong');
      const small = card.querySelector('small');
      if (small) small.textContent = sub;
      animateCount(strong, val || 0);
    });
    const pill = $('#auLivePill');
    if (pill) pill.title = `Updated ${new Date(d.generatedAt).toLocaleTimeString('en-IN')}`;
  } catch (e) { console.warn('Active users summary load failed', e); }
}

/* ══════════════════════════════════════════════
   TIMELINE CHART (visits by hour, today)
   ══════════════════════════════════════════════ */
async function loadTimeline() {
  const holder = $('#auTimelineChart');
  if (!holder) return;
  try {
    const d = await api('/api/admin/active-users/timeline');
    const bars = d.timeline || [];
    const max = Math.max(1, ...bars.map(b => b.count));
    const nowHour = new Date().getHours();
    holder.innerHTML = `<div class="au-bars">${bars.map(b => {
      const h = Math.max(2, Math.round((b.count / max) * 100));
      const label = b.hour === 0 ? '12a' : b.hour < 12 ? `${b.hour}a` : b.hour === 12 ? '12p' : `${b.hour-12}p`;
      return `<div class="au-bar-col ${b.hour === nowHour ? 'now' : ''}" title="${label}: ${b.count} visits">
        <div class="au-bar" style="height:${h}%"></div>
        <span class="au-bar-label">${b.hour % 3 === 0 ? label : ''}</span>
      </div>`;
    }).join('')}</div>`;
  } catch (e) {
    console.warn('Active users timeline load failed', e);
    holder.innerHTML = `<div class="au-error-state"><i class="fa-solid fa-cloud-exclamation"></i> Failed to load timeline.</div>`;
  }
}

/* ══════════════════════════════════════════════
   VISIT LOG TABLE
   ══════════════════════════════════════════════ */
async function loadList() {
  const tbody = $('#auTableBody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="8" class="au-empty"><div class="au-skeleton-row"></div><div class="au-skeleton-row"></div><div class="au-skeleton-row"></div></td></tr>`;

  try {
    const p = new URLSearchParams({ page: state.page, limit: PAGE_SIZE, filter: state.filter });
    if (state.search) p.set('search', state.search);

    const data = await api(`/api/admin/active-users/list?${p}`);
    state.users = data.users || [];
    state.total = data.total || 0;
    renderList();
    renderPagination();
    const count = $('#auResultCount');
    if (count) count.textContent = `${state.total.toLocaleString('en-IN')} ${resultLabel(state.filter)}`;
  } catch (err) {
    console.warn('Active users list load failed', err);
    tbody.innerHTML = `<tr><td colspan="8"><div class="au-error-state"><i class="fa-solid fa-cloud-exclamation"></i> Failed to load active users.<br><button class="au-retry-inline" id="auRetry">Retry</button></div></td></tr>`;
    $('#auRetry')?.addEventListener('click', loadList);
    const count = $('#auResultCount'); if (count) count.textContent = 'Error';
  }
}

function resultLabel(filter) {
  const labels = { online: 'online now', '15min': 'active in last 15 min', today: "visits today", week: 'active this week', new: 'new users today', all: 'total visits' };
  return labels[filter] || 'visits';
}

function roleLabel(role) {
  return role === 'both' ? 'Both' : role === 'traveler' ? 'Traveler' : 'Sender';
}

function accountStatusPill(status) {
  if (status === 'blocked') return `<span class="au-status-pill blocked"><i class="fa-solid fa-circle"></i> Blocked</span>`;
  if (status === 'suspended') return `<span class="au-status-pill suspended"><i class="fa-solid fa-circle"></i> Suspended</span>`;
  return `<span class="au-status-pill active"><i class="fa-solid fa-circle"></i> Active</span>`;
}

function visitStatusPill(u) {
  if (u.isOnline) return `<span class="au-visit-pill online"><i class="fa-solid fa-circle"></i> Online</span>`;
  return `<span class="au-visit-pill offline">Last seen ${timeAgo(u.lastSeenAt)}</span>`;
}

function renderList() {
  const tbody = $('#auTableBody');
  if (!tbody) return;

  if (!state.users.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="au-empty-state"><i class="fa-solid fa-user-clock"></i><span>No visits recorded for this filter.</span></div></td></tr>`;
    return;
  }

  tbody.innerHTML = state.users.map(u => `
    <tr data-id="${u._id}">
      <td>
        <div class="au-user-cell">
          <img class="au-avatar" src="${avatarSrc(u)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
          <div><div class="name">${esc(u.firstName)} ${esc(u.lastName)}</div><div class="sub">${esc(u.travelerPublicId || u.senderPublicId || String(u._id).slice(-8).toUpperCase())}</div></div>
        </div>
      </td>
      <td><div>${esc(u.email)}</div><div class="au-mono">${esc(u.phone || '—')}</div></td>
      <td><span class="au-role-pill">${roleLabel(u.role)}</span></td>
      <td>${accountStatusPill(u.status)}</td>
      <td>${fmtDate(u.joinedAt)}</td>
      <td>${timeAgo(u.lastSeenAt)}</td>
      <td>${visitStatusPill(u)}</td>
      <td class="au-td-actions" onclick="event.stopPropagation()">
        <div class="au-row-actions">
          <button class="au-icon-btn" title="View Profile" data-action="view" data-id="${u._id}"><i class="fa-solid fa-eye"></i></button>
          <button class="au-icon-btn danger" title="${u.isOnline ? 'Force logout' : 'Already offline'}" data-action="logout" data-id="${u._id}" ${u.isOnline ? '' : 'disabled'}><i class="fa-solid fa-right-from-bracket"></i></button>
        </div>
      </td>
    </tr>`).join('');

  $$('#auTableBody [data-action]').forEach(btn => btn.addEventListener('click', () => handleRowAction(btn.dataset.action, btn.dataset.id)));
}

function handleRowAction(action, id) {
  if (action === 'view') {
    // Reuses the global User Detail Drawer already wired up in admin.js —
    // same profile view the Users page opens, so there's one source of
    // truth for "what a user looks like" instead of a second modal here.
    if (typeof window.fetchUserDetail === 'function') window.fetchUserDetail(id);
    return;
  }
  if (action === 'logout') return forceLogout(id);
}

async function forceLogout(id) {
  const user = state.users.find(u => u._id === id);
  const name = user ? `${user.firstName} ${user.lastName}`.trim() : 'this user';
  if (!confirm(`End ${name}'s session now? They'll be signed out immediately.`)) return;
  try {
    await api(`/api/admin/active-users/${id}/force-logout`, { method: 'POST' });
    toast(`${name} signed out.`);
    loadList(); loadSummary();
  } catch (e) {
    toast(e?.error || 'Could not end that session.', 'fa-circle-xmark');
  }
}

function toast(msg, icon = 'fa-circle-check') {
  // Lightweight toast, matching the pattern used on the Users page.
  let t = $('#auToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'auToast';
    t.className = 'au-toast';
    t.innerHTML = `<i class="fa-solid fa-circle-check"></i><span id="auToastMsg"></span>`;
    document.body.appendChild(t);
  }
  t.querySelector('i').className = `fa-solid ${icon}`;
  t.querySelector('span').textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

function renderPagination() {
  const el = $('#auPagination');
  if (!el) return;
  const totalPages = Math.max(1, Math.ceil(state.total / PAGE_SIZE));
  let html = `<button ${state.page <= 1 ? 'disabled' : ''} data-p="${state.page - 1}"><i class="fa-solid fa-chevron-left"></i></button>`;
  const start = Math.max(1, state.page - 2), end = Math.min(totalPages, state.page + 2);
  for (let i = start; i <= end; i++) html += `<button class="${i === state.page ? 'active' : ''}" data-p="${i}">${i}</button>`;
  html += `<button ${state.page >= totalPages ? 'disabled' : ''} data-p="${state.page + 1}"><i class="fa-solid fa-chevron-right"></i></button>`;
  el.innerHTML = html;
  $$('#auPagination button[data-p]').forEach(b => b.addEventListener('click', () => { state.page = Number(b.dataset.p); loadList(); }));
}

try { initActiveUsers(); } catch (e) { console.warn('active-users init failed', e); }
