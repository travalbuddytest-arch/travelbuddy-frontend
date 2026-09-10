/**
 * TravelBuddy — System Audit Logs
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

export default function initAuditLogs() {
  const el = document.getElementById('audit-list');
  if (!el) return;

  loadAuditLogs();
  wireEvents();
}

function wireEvents() {
  document.getElementById('refreshAudit')?.addEventListener('click', loadAuditLogs);
  document.getElementById('auditRoleFilter')?.addEventListener('change', () => { currentPage = 1; loadAuditLogs(); });
  document.getElementById('auditDateFrom')?.addEventListener('change', () => { currentPage = 1; loadAuditLogs(); });
  document.getElementById('auditDateTo')?.addEventListener('change', () => { currentPage = 1; loadAuditLogs(); });
  document.getElementById('auditActionSearch')?.addEventListener('input', debounce(() => { currentPage = 1; loadAuditLogs(); }, 400));
}

async function loadAuditLogs() {
  const tbody = document.getElementById('audit-list');
  const pagi = document.getElementById('auditPagination');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:#98a2b3">Loading audit trail...</td></tr>`;

  try {
    const role = document.getElementById('auditRoleFilter')?.value || 'Admin';
    const search = document.getElementById('auditActionSearch')?.value.trim() || '';
    const dateFrom = document.getElementById('auditDateFrom')?.value || '';
    const dateTo = document.getElementById('auditDateTo')?.value || '';

    let url = `/api/admin/audit-logs?page=${currentPage}&limit=30`;
    if (role !== 'all') url += `&role=${role}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (dateFrom) url += `&dateFrom=${encodeURIComponent(dateFrom)}`;
    if (dateTo) url += `&dateTo=${encodeURIComponent(dateTo)}`;

    const data = await apiGet(url);
    const { logs, total } = data;

    if (!logs || logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:#98a2b3">No audit logs found.</td></tr>`;
      if (pagi) pagi.innerHTML = '';
      return;
    }

    tbody.innerHTML = logs.map(log => `
      <tr>
        <td style="font-size:11px;color:var(--text-muted)">${formatDate(log.createdAt)}</td>
        <td>
          <strong style="display:block;font-size:12px">${esc(log.performedByName)}</strong>
          <small class="status-tag sm ${log.performedByModel === 'Admin' ? 'info' : 'muted'}">${log.performedByModel}</small>
        </td>
        <td><strong style="font-size:12px;text-transform:uppercase">${esc(log.action)}</strong></td>
        <td style="font-size:12px">
          ${esc(log.targetType)}: <strong>${esc(log.targetLabel)}</strong>
          ${log.newValue ? `<br><small style="color:var(--text-faint)">New: ${JSON.stringify(log.newValue).slice(0, 50)}...</small>` : ''}
        </td>
        <td class="cell-mono" style="font-size:10px;color:var(--text-faint)">
          ${esc(log.ipAddress)}
          <br>${esc(truncate(log.userAgent, 40))}
        </td>
      </tr>
    `).join('');

    renderPagination(total, pagi);
  } catch (err) {
    console.warn('Audit logs load failed:', err);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--danger)">Error loading audit trail.</td></tr>`;
  }
}

function renderPagination(total, el) {
  if (!el) return;
  const totalPages = Math.ceil(total / 30);
  if (totalPages <= 1) { el.innerHTML = ''; return; }
  let html = '';
  for (let i = 1; i <= Math.min(totalPages, 10); i++) {
    html += `<button class="${i === currentPage ? 'active' : ''}" data-p="${i}">${i}</button>`;
  }
  if (totalPages > 10) html += '<span>...</span>';
  el.innerHTML = html;
  el.querySelectorAll('button[data-p]').forEach(btn => btn.addEventListener('click', () => { currentPage = parseInt(btn.dataset.p); loadAuditLogs(); }));
}

function formatDate(d) {
  if (window.TravelBuddyDate) return window.TravelBuddyDate.formatDateTime(d);
  return d ? new Date(d).toLocaleString('en-IN') : '—';
}
function truncate(s, n) { return s && s.length > n ? s.slice(0, n) + '...' : s; }
function esc(s) { if (!s) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function debounce(fn, ms) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); }; }

window.initAuditLogs = initAuditLogs;
try { initAuditLogs(); } catch (e) { console.warn('audit-logs init failed', e); }
