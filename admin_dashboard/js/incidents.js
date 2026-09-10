/**
 * TravelBuddy — Parcel Incidents & Theft Investigation
 * Specialized view for serious parcel problems.
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

export default function initIncidents() {
  const el = document.getElementById('incidents-list');
  if (!el) return;

  loadIncidents();
  wireEvents();
}

function wireEvents() {
  document.getElementById('incidentStatusFilter')?.addEventListener('change', loadIncidents);
  document.getElementById('incidentSearch')?.addEventListener('input', debounce(loadIncidents, 400));
}

async function loadIncidents() {
  const tbody = document.getElementById('incidents-list');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:#98a2b3">Searching for incidents...</td></tr>`;

  try {
    const status = document.getElementById('incidentStatusFilter')?.value || 'open';
    const search = document.getElementById('incidentSearch')?.value.trim() || '';

    // Fetch reports targeting parcels
    let url = `/api/admin/reports?targetType=parcel&status=${status}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    const data = await apiGet(url);
    const reports = data.reports || [];

    if (!reports.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:#98a2b3">No active parcel incidents found.</td></tr>`;
      return;
    }

    tbody.innerHTML = reports.map(r => `
      <tr>
        <td style="font-size:12px;color:var(--text-muted)">${formatDateShort(r.createdAt)}</td>
        <td><strong class="cell-mono">${esc(r.targetParcelId?.orderId || '—')}</strong></td>
        <td><span class="status-tag danger">${esc(r.reason)}</span></td>
        <td>
          <div style="font-size:12px">Sender: ${esc(r.fromUser?.firstName || '—')}</div>
          <div style="font-size:11px;color:var(--text-faint)">Target: ${esc(r.targetUserId?.firstName || 'Traveler Unknown')}</div>
        </td>
        <td style="font-size:11px;color:var(--text-muted)">Investigate to view map</td>
        <td>${statusTag(r.status)}</td>
        <td>
          <div class="row-actions">
            <button class="btn sm secondary" onclick="window.investigateParcel('${r.targetParcelId?._id}', '${r._id}')">Investigate</button>
          </div>
        </td>
      </tr>
    `).join('');

    updateSummary(reports);
  } catch (err) {
    console.warn('Failed to load incidents:', err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--danger)">Error loading data.</td></tr>`;
  }
}

window.investigateParcel = (parcelId, reportId) => {
  // Navigation strategy: Jump to Live Tracking and pre-select the parcel
  if (parcelId && parcelId !== 'undefined') {
    window.location.hash = `#live-tracking?id=${parcelId}`;
    // admin.js will handle the hash change and page activation
  } else {
    alert('Parcel ID missing from report. Checking full details...');
    window.fetchUserDetail(reportId); // Generic fallback
  }
};

function updateSummary(reports) {
  const cards = document.querySelectorAll('.mini-card strong');
  if (cards.length < 3) return;
  cards[0].textContent = reports.filter(r => r.status === 'under_review').length;
  cards[1].textContent = reports.filter(r => r.reason.toLowerCase().includes('overdue')).length;
  cards[2].textContent = reports.filter(r => r.status === 'resolved').length;
}

function statusTag(s) {
  const map = { open: 'danger', under_review: 'warning', resolved: 'active', dismissed: 'muted' };
  return `<span class="status-tag ${map[s] || 'muted'}" style="text-transform:capitalize">${esc(s.replace(/_/g, ' '))}</span>`;
}

function formatDateShort(d) {
  return d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function debounce(fn, ms) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
}

window.initIncidents = initIncidents;
try { initIncidents(); } catch (e) { console.warn('incidents init failed', e); }
