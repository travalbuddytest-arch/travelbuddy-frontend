/**
 * TravelBuddy — Platform Notifications Oversight
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

export default function initNotifications() {
  const el = document.getElementById('notifications-list');
  if (!el) return;

  loadNotifications();
  wireEvents();
}

function wireEvents() {
  document.getElementById('refreshNotifications')?.addEventListener('click', loadNotifications);
  document.getElementById('notifTypeFilter')?.addEventListener('change', () => { currentPage = 1; loadNotifications(); });
  document.getElementById('notifReadFilter')?.addEventListener('change', () => { currentPage = 1; loadNotifications(); });
  document.getElementById('notifUserSearch')?.addEventListener('input', debounce(() => { currentPage = 1; loadNotifications(); }, 400));
}

async function loadNotifications() {
  const tbody = document.getElementById('notifications-list');
  const pagi = document.getElementById('notifPagination');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:#98a2b3">Loading notifications...</td></tr>`;

  try {
    const type = document.getElementById('notifTypeFilter')?.value || 'all';
    const isRead = document.getElementById('notifReadFilter')?.value || 'all';
    const search = document.getElementById('notifUserSearch')?.value.trim() || '';

    let url = `/api/admin/notifications?page=${currentPage}&limit=30`;
    if (type !== 'all') url += `&type=${type}`;
    if (isRead !== 'all') url += `&isRead=${isRead === 'read'}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    const data = await apiGet(url);
    const { notifications, total } = data;

    if (!notifications || notifications.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:#98a2b3">No notifications found.</td></tr>`;
      if (pagi) pagi.innerHTML = '';
      return;
    }

    tbody.innerHTML = notifications.map(n => `
      <tr>
        <td style="font-size:12px;color:var(--text-muted)">${formatDateShort(n.createdAt)}</td>
        <td>
          <strong style="display:block">${esc(n.recipient?.firstName)} ${esc(n.recipient?.lastName)}</strong>
          <small style="color:var(--text-faint)">${esc(n.recipient?.email)}</small>
        </td>
        <td><span class="status-tag info" style="text-transform:capitalize">${esc(n.type.replace(/_/g, ' '))}</span></td>
        <td style="font-size:13px;max-width:400px">${esc(n.text)}</td>
        <td>${n.read ? '<span class="status-tag active">Read</span>' : '<span class="status-tag muted">Unread</span>'}</td>
      </tr>
    `).join('');

    renderPagination(total, pagi);
  } catch (err) {
    console.warn('Notifications load failed:', err);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--danger)">Error loading data.</td></tr>`;
  }
}

function renderPagination(total, el) {
  if (!el) return;
  const totalPages = Math.ceil(total / 30);
  if (totalPages <= 1) { el.innerHTML = ''; return; }
  let html = '';
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="${i === currentPage ? 'active' : ''}" data-p="${i}">${i}</button>`;
  }
  el.innerHTML = html;
  el.querySelectorAll('button[data-p]').forEach(btn => btn.addEventListener('click', () => { currentPage = parseInt(btn.dataset.p); loadNotifications(); }));
}

function formatDateShort(d) { return d ? new Date(d).toLocaleString('en-IN') : '—'; }
function esc(s) { if (!s) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function debounce(fn, ms) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); }; }

window.initNotifications = initNotifications;
try { initNotifications(); } catch (e) { console.warn('notifications init failed', e); }
