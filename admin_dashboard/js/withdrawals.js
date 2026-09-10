/**
 * TravelBuddy — Financial Withdrawals Management
 */

const API_ORIGIN = APP_CONFIG.API_BASE_URL;

async function apiGet(url) {
  const token = localStorage.getItem('admin_token') || localStorage.getItem('travelBuddyAdminToken');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API_ORIGIN}${url}`, { headers, credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, data };
  return data;
}

let currentPage = 1;

export default function initWithdrawals() {
  const el = document.getElementById('withdrawals-list');
  if (!el) return;

  loadWithdrawals();
  wireEvents();
}

function wireEvents() {
  document.getElementById('refreshWithdrawals')?.addEventListener('click', loadWithdrawals);
  document.getElementById('withdrawalStatusFilter')?.addEventListener('change', () => {
    currentPage = 1;
    loadWithdrawals();
  });
}

async function loadWithdrawals() {
  const tbody = document.getElementById('withdrawals-list');
  const pagi = document.getElementById('withdrawalPagination');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:#98a2b3">Loading requests...</td></tr>`;

  try {
    const status = document.getElementById('withdrawalStatusFilter')?.value || 'pending';
    let url = `/api/admin/withdrawals?page=${currentPage}&limit=20`;
    if (status !== 'all') url += `&status=${status}`;

    const data = await apiGet(url);
    const { withdrawals, total } = data;

    if (!withdrawals || withdrawals.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:#98a2b3">No withdrawal requests found.</td></tr>`;
      if (pagi) pagi.innerHTML = '';
      return;
    }

    tbody.innerHTML = withdrawals.map(w => `
      <tr>
        <td style="font-size:12px;color:var(--text-muted)">${formatDateShort(w.createdAt)}</td>
        <td><strong class="cell-mono">${esc(w.withdrawalId)}</strong></td>
        <td>
          <strong style="display:block">${esc(w.user?.firstName)} ${esc(w.user?.lastName)}</strong>
          <small style="color:var(--text-faint)">${esc(w.user?.email)}</small>
        </td>
        <td><strong style="color:var(--text-main)">${fmtPaise(w.amount)}</strong></td>
        <td><span class="cell-sub">${esc(w.method)}</span></td>
        <td>${statusTag(w.status)}</td>
        <td>
          <div class="row-actions">
            <button class="btn sm secondary" onclick="window.fetchUserDetail('${w.user?._id}')">Review User</button>
            ${w.status === 'pending' ? `
              <button class="btn sm success" onclick="window.processWithdrawal('${w._id}', 'complete')">Approve</button>
              <button class="btn sm danger" onclick="window.processWithdrawal('${w._id}', 'reject')">Reject</button>
            ` : ''}
          </div>
        </td>
      </tr>
    `).join('');

    renderPagination(total, pagi);
  } catch (err) {
    console.warn('Withdrawals load failed:', err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--danger)">Error loading data.</td></tr>`;
  }
}

window.processWithdrawal = async (withdrawalId, action) => {
  const note = prompt(`Enter ${action} reason/note:`, action === 'complete' ? 'Processed via Bank Transfer' : 'Invalid bank details');
  if (note === null) return;

  try {
    const url = action === 'complete' ? '/api/withdraw/admin/complete' : '/api/withdraw/admin/reject';
    const body = action === 'complete' ? { withdrawalId, utr: note } : { withdrawalId, reason: note };

    await apiPost(url, body);
    window.showToast?.(`Withdrawal ${withdrawalId} ${action === 'complete' ? 'completed' : 'rejected'}.`);
    loadWithdrawals();
  } catch (err) {
    alert(err.error || 'Action failed.');
  }
};

async function apiPost(url, body) {
  const token = localStorage.getItem('admin_token') || localStorage.getItem('travelBuddyAdminToken');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_ORIGIN}${url}`, { method: 'POST', headers, credentials: 'include', body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, data };
  return data;
}

function statusTag(s) {
  const map = { completed: 'active', pending: 'warning', rejected: 'danger', processing: 'info' };
  return `<span class="status-tag ${map[s] || 'muted'}" style="text-transform:capitalize">${esc(s)}</span>`;
}

function fmtPaise(p) {
  return '₹' + ((p || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

function renderPagination(total, el) {
  if (!el) return;
  const totalPages = Math.ceil(total / 20);
  if (totalPages <= 1) { el.innerHTML = ''; return; }
  let html = '';
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="${i === currentPage ? 'active' : ''}" data-p="${i}">${i}</button>`;
  }
  el.innerHTML = html;
  el.querySelectorAll('button[data-p]').forEach(btn => btn.addEventListener('click', () => { currentPage = parseInt(btn.dataset.p); loadWithdrawals(); }));
}

function formatDateShort(d) { return d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'; }
function esc(s) { if (!s) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

window.initWithdrawals = initWithdrawals;
try { initWithdrawals(); } catch (e) { console.warn('withdrawals init failed', e); }
