/**
 * TravelBuddy — Reports & Disputes Management
 */

const API_ORIGIN = APP_CONFIG.API_BASE_URL;

async function apiGet(url) {
  const headers = { 'X-CP-Admin-Request': 'true' };
  const res = await fetch(`${API_ORIGIN}${url}`, { headers, credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, data };
  return data;
}

async function apiPatch(url, body) {
  const headers = {
    'Content-Type': 'application/json',
    'X-CP-Admin-Request': 'true'
  };
  const res = await fetch(`${API_ORIGIN}${url}`, { method: 'PATCH', headers, credentials: 'include', body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, data };
  return data;
}

let currentPage = 1;
let currentReports = [];
let activeReport = null;

export default function initReportsDisputes() {
  const el = document.getElementById('disputes-list');
  if (!el) return;

  loadDisputes();
  wireEvents();
}

function wireEvents() {
  document.getElementById('refreshDisputes')?.addEventListener('click', loadDisputes);
  document.getElementById('disputeStatusFilter')?.addEventListener('change', () => { currentPage = 1; loadDisputes(); });
  document.getElementById('disputeTypeFilter')?.addEventListener('change', () => { currentPage = 1; loadDisputes(); });

  const modal = document.getElementById('reportResolveModal');
  const closeBtn = document.getElementById('reportResolveClose');
  const cancelBtn = document.getElementById('reportResolveCancel');
  const form = document.getElementById('reportResolveForm');

  const closeModal = () => modal?.classList.remove('show');
  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeReport) return;
    const status = document.getElementById('reportResolveStatus').value;
    const adminNotes = document.getElementById('reportResolveNotes').value.trim();

    try {
      await apiPatch(`/api/admin/reports/${activeReport._id}`, { status, adminNotes });
      if (window.showToast) window.showToast('Report updated successfully');
      closeModal();
      loadDisputes();
    } catch (err) {
      if (window.showToast) window.showToast('Failed to update report', 'error');
    }
  });
}

window.openReportResolveModal = function(reportId) {
  const r = currentReports.find(item => String(item._id) === String(reportId));
  if (!r) return;
  activeReport = r;

  const modal = document.getElementById('reportResolveModal');
  const body = document.getElementById('reportResolveBody');
  const statusSelect = document.getElementById('reportResolveStatus');
  const notesInput = document.getElementById('reportResolveNotes');

  if (statusSelect) statusSelect.value = r.status === 'open' ? 'resolved' : r.status;
  if (notesInput) notesInput.value = r.adminNotes || '';

  if (body) {
    const reporter = r.fromUser ? `${r.fromUser.firstName || ''} ${r.fromUser.lastName || ''}`.trim() : 'Unknown';
    body.innerHTML = `
      <div style="font-size:12px; margin-bottom: 8px;"><strong>Reporter:</strong> ${esc(reporter)} (${esc(r.fromUser?.email || '')})</div>
      <div style="font-size:12px; margin-bottom: 8px;"><strong>Type:</strong> <span class="status-tag info">${esc(r.targetType)}</span> ${r.targetParcelId?.orderId ? `(${esc(r.targetParcelId.orderId)})` : ''}</div>
      <div style="font-size:12px; margin-bottom: 8px;"><strong>Reason:</strong> ${esc(r.reason)}</div>
      ${r.description ? `<div style="font-size:11px; color:#64748b; background:#f8fafc; padding:8px; border-radius:6px; margin-bottom:8px;">${esc(r.description)}</div>` : ''}
    `;
  }

  modal?.classList.add('show');
};

async function loadDisputes() {
  const tbody = document.getElementById('disputes-list');
  const pagi = document.getElementById('disputePagination');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:#98a2b3">Loading cases...</td></tr>`;

  try {
    const status = document.getElementById('disputeStatusFilter')?.value || 'open';
    const type = document.getElementById('disputeTypeFilter')?.value || 'all';

    let url = `/api/admin/reports?page=${currentPage}&limit=20&status=${status}`;
    if (type !== 'all') url += `&targetType=${type}`;

    const data = await apiGet(url);
    currentReports = data.reports || [];
    const { total } = data;

    if (!currentReports || currentReports.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:#98a2b3">No reports or disputes found.</td></tr>`;
      if (pagi) pagi.innerHTML = '';
      return;
    }

    tbody.innerHTML = currentReports.map(r => `
      <tr>
        <td style="font-size:12px;color:var(--text-muted)">${formatDateShort(r.createdAt)}</td>
        <td>
          <strong style="display:block">${esc(r.fromUser?.firstName)} ${esc(r.fromUser?.lastName)}</strong>
          <small style="color:var(--text-faint)">${esc(r.fromUser?.email)}</small>
        </td>
        <td>
          <span class="status-tag info" style="text-transform:capitalize">${esc(r.targetType)}</span>
          ${r.targetParcelId?.orderId ? `<small style="display:block;color:var(--text-muted);margin-top:4px">${esc(r.targetParcelId.orderId)}</small>` : ''}
        </td>
        <td style="font-size:13px">${esc(r.reason)}</td>
        <td>${statusTag(r.status)}</td>
        <td>
          <div class="row-actions">
            <button class="btn sm secondary" onclick="window.fetchUserDetail('${r.fromUser?._id}')">Reporter</button>
            <button class="btn sm secondary" onclick="window.fetchUserDetail('${r.targetUserId?._id || r.targetParcelId?.sender}')">Target</button>
            <button class="btn sm primary" onclick="window.openReportResolveModal('${r._id}')">Resolve</button>
          </div>
        </td>
      </tr>
    `).join('');

    renderPagination(total, pagi);
  } catch (err) {
    console.warn('Disputes load failed:', err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--danger)">Error loading data.</td></tr>`;
  }
}

function statusTag(s) {
  const map = { open: 'danger', under_review: 'warning', resolved: 'active', dismissed: 'muted' };
  return `<span class="status-tag ${map[s] || 'muted'}" style="text-transform:capitalize">${esc(s.replace(/_/g, ' '))}</span>`;
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
  el.querySelectorAll('button[data-p]').forEach(btn => btn.addEventListener('click', () => { currentPage = parseInt(btn.dataset.p); loadDisputes(); }));
}

function formatDateShort(d) { return d ? new Date(d).toLocaleDateString('en-IN') : '—'; }
function esc(s) { if (!s) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

window.initReportsDisputes = initReportsDisputes;
try { initReportsDisputes(); } catch (e) { console.warn('reports-disputes init failed', e); }
