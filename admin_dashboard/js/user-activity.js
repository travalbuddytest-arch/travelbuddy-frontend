/**
 * TravelBuddy — User Activity Dashboard
 * Real-time feed of all user actions across the platform.
 * Reuses the AuditLog endpoint with a User role filter.
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
let searchDebounce = null;

export default function initUserActivity() {
  const el = document.getElementById('activity-list');
  if (!el) return;

  wireEvents();
  loadActivity();
}

function wireEvents() {
  document.getElementById('refreshActivity')?.addEventListener('click', loadActivity);

  document.getElementById('activityActionFilter')?.addEventListener('change', () => {
    currentPage = 1;
    loadActivity();
  });

  document.getElementById('activityUserSearch')?.addEventListener('input', (e) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      currentPage = 1;
      loadActivity();
    }, 400);
  });

  document.getElementById('activityDateFrom')?.addEventListener('change', () => {
    currentPage = 1;
    loadActivity();
  });
}

async function loadActivity() {
  const tbody = document.getElementById('activity-list');
  const pagi = document.getElementById('activityPagination');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:#98a2b3">Loading activity...</td></tr>`;

  try {
    const action = document.getElementById('activityActionFilter')?.value || '';
    const search = document.getElementById('activityUserSearch')?.value.trim() || '';
    const dateFrom = document.getElementById('activityDateFrom')?.value || '';

    let url = `/api/admin/audit-logs?role=User&page=${currentPage}&limit=30`;
    if (action) url += `&action=${encodeURIComponent(action)}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (dateFrom) url += `&dateFrom=${encodeURIComponent(dateFrom)}`;

    const data = await apiGet(url);
    const { logs, total } = data;

    if (!logs || logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:#98a2b3">No activity logs found.</td></tr>`;
      if (pagi) pagi.innerHTML = '';
      return;
    }

    tbody.innerHTML = logs.map(log => `
      <tr>
        <td style="font-size:12px;color:var(--text-muted)">${formatDate(log.createdAt)}</td>
        <td>
          <strong style="display:block">${esc(log.performedByName || 'Unknown User')}</strong>
          <small class="cell-mono" style="font-size:10px;color:var(--text-faint)">${esc(log.performedBy || '')}</small>
        </td>
        <td><span class="status-tag info" style="text-transform:capitalize">${esc(log.action.replace(/_/g, ' '))}</span></td>
        <td style="font-size:13px">${esc(log.targetLabel || log.targetType)}</td>
        <td class="cell-mono" style="font-size:11px;color:var(--text-faint)">${esc(log.ipAddress || '—')}</td>
      </tr>
    `).join('');

    renderPagination(total, pagi);
  } catch (err) {
    console.warn('Failed to load user activity:', err);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--danger)">Failed to load data. <button class="retry-inline" onclick="loadActivity()">Retry</button></td></tr>`;
  }
}

function renderPagination(total, el) {
  if (!el) return;
  const totalPages = Math.ceil(total / 30);
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
      loadActivity();
    });
  });
}

function formatDate(d) {
  if (window.TravelBuddyDate) return window.TravelBuddyDate.formatDateTime(d);
  return d ? new Date(d).toLocaleString('en-IN') : '—';
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

window.initUserActivity = initUserActivity;
try { initUserActivity(); } catch (e) { console.warn('user-activity init failed', e); }
