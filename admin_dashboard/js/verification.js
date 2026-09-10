/**
 * TravelBuddy — KYC Verification Management
 * Interface for reviewing and approving/rejecting user ID documents.
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

async function apiPatch(url, body) {
  const token = localStorage.getItem('admin_token') || localStorage.getItem('travelBuddyAdminToken');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_ORIGIN}${url}`, { method: 'PATCH', headers, credentials: 'include', body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, data };
  return data;
}

let currentPage = 1;
let searchDebounce = null;

export default function initVerification() {
  const el = document.getElementById('verification-list');
  if (!el) return;

  wireEvents();
  loadVerifications();
}

function wireEvents() {
  document.getElementById('refreshVerification')?.addEventListener('click', loadVerifications);
  document.getElementById('verificationStatusFilter')?.addEventListener('change', () => {
    currentPage = 1;
    loadVerifications();
  });
  document.getElementById('verificationSearch')?.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      currentPage = 1;
      loadVerifications();
    }, 400);
  });
}

async function loadVerifications() {
  const tbody = document.getElementById('verification-list');
  const pagi = document.getElementById('verificationPagination');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:#98a2b3">Loading KYC submissions...</td></tr>`;

  try {
    const status = document.getElementById('verificationStatusFilter')?.value || 'pending';
    const search = document.getElementById('verificationSearch')?.value.trim() || '';

    let url = `/api/admin/users?page=${currentPage}&limit=20`;
    if (status !== 'all') url += `&verification=${encodeURIComponent(status)}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    const data = await apiGet(url);
    const { users, total } = data;

    if (!users || users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:#98a2b3">No verification requests found.</td></tr>`;
      if (pagi) pagi.innerHTML = '';
      return;
    }

    tbody.innerHTML = users.map(u => {
      const kyc = u.kyc || {};
      const gov = kyc.governmentId || { status: 'not_submitted' };
      const selfie = kyc.selfie || { status: 'not_submitted' };

      return `
        <tr>
          <td style="font-size:12px;color:var(--text-muted)">${formatDateShort(u.createdAt)}</td>
          <td>
            <strong style="display:block">${esc(u.firstName)} ${esc(u.lastName)}</strong>
            <small style="color:var(--text-faint)">${esc(u.email)}</small>
          </td>
          <td><span class="cell-sub">${esc(gov.type || 'ID Card')}</span></td>
          <td>${statusTag(gov.status)}</td>
          <td>${statusTag(selfie.status)}</td>
          <td>
            <div class="row-actions">
              <button class="btn-icon" title="View Documents" onclick="window.fetchUserDetail('${u._id}')"><i class="fa-solid fa-eye"></i></button>
              ${gov.status === 'pending' ? `
                <button class="btn-icon success" title="Approve ID" onclick="window.updateKyc('${u._id}', 'governmentId', 'verified')"><i class="fa-solid fa-check"></i></button>
                <button class="btn-icon danger" title="Reject ID" onclick="window.updateKyc('${u._id}', 'governmentId', 'rejected')"><i class="fa-solid fa-xmark"></i></button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    renderPagination(total, pagi);
  } catch (err) {
    console.warn('Failed to load verifications:', err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--danger)">Failed to load data.</td></tr>`;
  }
}

window.updateKyc = async (userId, field, status) => {
  const reason = status === 'rejected' ? prompt('Reason for rejection:') : 'Approved by admin';
  if (status === 'rejected' && reason === null) return;

  try {
    await apiPatch(`/api/admin/users/${userId}/verify`, { field, status, reason });
    window.showToast?.(`User ${field} ${status} successfully.`);
    loadVerifications();
  } catch (err) {
    alert(err.error || 'Failed to update verification status.');
  }
};

function statusTag(s) {
  const map = {
    verified: 'active',
    pending: 'warning',
    rejected: 'danger',
    not_submitted: 'muted'
  };
  const label = s ? s.replace(/_/g, ' ') : 'Not Submitted';
  return `<span class="status-tag ${map[s] || 'muted'}" style="text-transform:capitalize">${esc(label)}</span>`;
}

function renderPagination(total, el) {
  if (!el) return;
  const totalPages = Math.ceil(total / 20);
  if (totalPages <= 1) { el.innerHTML = ''; return; }

  let html = `<button ${currentPage <= 1 ? 'disabled' : ''} data-p="${currentPage - 1}">&lsaquo;</button>`;
  for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
    html += `<button class="${i === currentPage ? 'active' : ''}" data-p="${i}">${i}</button>`;
  }
  html += `<button ${currentPage >= totalPages ? 'disabled' : ''} data-p="${currentPage + 1}">&rsaquo;</button>`;
  el.innerHTML = html;

  el.querySelectorAll('button[data-p]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentPage = parseInt(btn.dataset.p);
      loadVerifications();
    });
  });
}

function formatDateShort(d) {
  return d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

window.initVerification = initVerification;
try { initVerification(); } catch (e) { console.warn('verification init failed', e); }
