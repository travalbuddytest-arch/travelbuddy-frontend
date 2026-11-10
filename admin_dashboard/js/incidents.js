/**
 * TravelBuddy — Parcel Incidents & Theft Investigation
 * Specialized view for serious parcel problems.
 */

const API_ORIGIN = APP_CONFIG.API_BASE_URL;
let currentReports = [];

async function apiGet(url) {
  const headers = { 'X-CP-Admin-Request': 'true' };
  const res = await fetch(`${API_ORIGIN}${url}`, { headers, credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, data };
  return data;
}

async function apiPost(url, body) {
  const headers = {
    'Content-Type': 'application/json',
    'X-CP-Admin-Request': 'true'
  };
  const res = await fetch(`${API_ORIGIN}${url}`, { method: 'POST', headers, credentials: 'include', body: JSON.stringify(body) });
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
  document.getElementById('exportIncidentsBtn')?.addEventListener('click', exportSummaryPdf);

  const modal = document.getElementById('incidentModal');
  const createBtn = document.getElementById('createNewIncident');
  const closeBtn = document.getElementById('incidentModalClose');
  const cancelBtn = document.getElementById('incidentCancel');
  const form = document.getElementById('incidentForm');

  const openModal = () => modal?.classList.add('show');
  const closeModal = () => modal?.classList.remove('show');

  createBtn?.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const targetType = document.getElementById('incidentTargetType').value;
    const targetId = document.getElementById('incidentTargetId').value.trim();
    const reason = document.getElementById('incidentReason').value.trim();
    const description = document.getElementById('incidentDescription').value.trim();

    if (!reason) {
      if (window.showToast) window.showToast('Please enter an incident reason', 'error');
      return;
    }

    try {
      await apiPost('/api/admin/reports', { targetType, targetId, reason, description });
      if (window.showToast) window.showToast('Incident created successfully');
      form.reset();
      closeModal();
      loadIncidents();
    } catch (err) {
      if (window.showToast) window.showToast(err.data?.error || 'Could not create incident', 'error');
    }
  });
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
    currentReports = data.reports || [];

    if (!currentReports.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:#98a2b3">No active parcel incidents found.</td></tr>`;
      return;
    }

    tbody.innerHTML = currentReports.map(r => `
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
          <div class="row-actions" style="display:flex; gap:6px;">
            <button class="btn sm secondary" onclick="window.investigateParcel('${r.targetParcelId?._id}', '${r._id}')">Investigate</button>
            <button class="btn sm secondary" onclick="window.exportIncidentPdf('${r._id}')" title="Export PDF"><i class="fa-solid fa-file-pdf"></i></button>
          </div>
        </td>
      </tr>
    `).join('');

    updateSummary(currentReports);
  } catch (err) {
    console.warn('Failed to load incidents:', err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--danger)">Error loading data.</td></tr>`;
  }
}

window.investigateParcel = (parcelId, reportId) => {
  if (parcelId && parcelId !== 'undefined') {
    window.location.hash = `#live-tracking?id=${parcelId}`;
  } else {
    alert('Parcel ID missing from report. Checking full details...');
    if (typeof window.fetchUserDetail === 'function') {
      window.fetchUserDetail(reportId);
    }
  }
};

window.exportIncidentPdf = (reportId) => {
  const report = currentReports.find(r => String(r._id) === String(reportId));
  if (!report) return;

  try {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) { window.print(); return; }

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('CarryParcel Incident Investigation Report', 14, 20);
    doc.setFontSize(10);
    doc.text(`Report ID: ${report._id}`, 14, 30);
    doc.text(`Order ID: ${report.targetParcelId?.orderId || 'N/A'}`, 14, 38);
    doc.text(`Issue Type: ${report.reason}`, 14, 46);
    doc.text(`Status: ${report.status}`, 14, 54);
    doc.text(`Reported By: ${report.fromUser?.firstName || ''} ${report.fromUser?.lastName || ''} (${report.fromUser?.email || ''})`, 14, 62);
    doc.text(`Date Reported: ${new Date(report.createdAt).toLocaleString('en-IN')}`, 14, 70);
    doc.text(`Description:`, 14, 80);

    const splitDesc = doc.splitTextToSize(report.description || 'No detailed description provided.', 180);
    doc.text(splitDesc, 14, 88);

    doc.save(`incident_${report.targetParcelId?.orderId || report._id}.pdf`);
  } catch (err) {
    console.error('PDF export failed:', err);
    window.print();
  }
};

function exportSummaryPdf() {
  try {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) { window.print(); return; }

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('CarryParcel Active Incidents Summary', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated At: ${new Date().toLocaleString('en-IN')}`, 14, 28);
    doc.text(`Total Active Cases: ${currentReports.length}`, 14, 36);

    let y = 48;
    currentReports.forEach((r, idx) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(`${idx + 1}. [${r.status.toUpperCase()}] ${r.targetParcelId?.orderId || 'N/A'} — ${r.reason}`, 14, y);
      y += 8;
    });

    doc.save(`incidents_summary_${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (err) {
    console.error('Summary PDF export failed:', err);
    window.print();
  }
}

function updateSummary(reports) {
  const cards = document.querySelectorAll('.mini-card strong');
  if (cards.length < 3) return;
  cards[0].textContent = reports.filter(r => r.status === 'under_review' || r.status === 'open').length;
  cards[1].textContent = reports.filter(r => (r.reason || '').toLowerCase().includes('overdue')).length;
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
