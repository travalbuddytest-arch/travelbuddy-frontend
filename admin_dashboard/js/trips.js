const API_ORIGIN = APP_CONFIG.API_BASE_URL;

async function apiGet(url) {
  const token = localStorage.getItem('admin_token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API_ORIGIN}${url}`, { headers, credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, data };
  return data;
}

async function apiPatch(url, body) {
  const token = localStorage.getItem('admin_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_ORIGIN}${url}`, { method: 'PATCH', headers, credentials: 'include', body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, data };
  return data;
}

const $ = (sel) => document.querySelector(sel);

let currentTripPage = 1;
let tripSearchDebounce = null;

export function initTrips() {
  const el = document.getElementById('tripTableBody');
  if (!el) return;
  wireTripControls();
  loadTrips();
}

function wireTripControls() {
  $('#tripFilterStatus')?.addEventListener('change', () => {
    currentTripPage = 1;
    loadTrips();
  });

  $('#tripSearch')?.addEventListener('input', () => {
    clearTimeout(tripSearchDebounce);
    tripSearchDebounce = setTimeout(() => {
      currentTripPage = 1;
      loadTrips();
    }, 350);
  });
}

async function loadTrips() {
  const tableBody = document.getElementById('tripTableBody');
  const pagination = document.getElementById('tripPagination');
  if (!tableBody) return;

  tableBody.innerHTML = `<tr><td colspan="6" class="loading-cell">Loading trips...</td></tr>`;

  try {
    const status = $('#tripFilterStatus').value;
    const search = $('#tripSearch').value.trim();
    let url = `/api/admin/trips?page=${currentTripPage}&limit=20`;
    if (status !== 'all') url += `&status=${status}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    const data = await apiGet(url);
    const { trips, total } = data;

    if (!trips || trips.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" class="empty-cell">No trips found.</td></tr>`;
      if (pagination) pagination.innerHTML = '';
      return;
    }

    tableBody.innerHTML = trips.map(t => {
      const traveler = t.traveler || {};
      const statusClass = t.status === 'active' ? 'active' : t.status === 'cancelled' ? 'red' : 'muted';
      const travelDate = new Date(t.travelDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

      return `<tr>
        <td>
          <div style="display:flex;flex-direction:column">
            <b>${travelDate}</b>
            <span class="cell-sub" style="font-size:9px">Posted ${new Date(t.createdAt).toLocaleDateString()}</span>
          </div>
        </td>
        <td>
          <div style="display:flex;flex-direction:column">
            <b>${escHtml(traveler.firstName)} ${escHtml(traveler.lastName)}</b>
            <span class="cell-sub" style="font-size:9px">${escHtml(traveler.email)}</span>
          </div>
        </td>
        <td>
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-weight:600">${capitalize(t.fromCity)}</span>
            <i class="fa-solid fa-arrow-right" style="font-size:8px;color:#98a2b3"></i>
            <span style="font-weight:600">${capitalize(t.toCity)}</span>
          </div>
        </td>
        <td><span class="cell-sub">${t.capacityKg || 0} kg</span></td>
        <td><span class="status-tag ${statusClass}">${t.status}</span></td>
        <td>
          ${t.status === 'active' ?
            `<button class="wl-btn wl-btn-sm red" data-cancel-id="${t._id}">Cancel</button>` : '—'}
        </td>
      </tr>`;
    }).join('');

    tableBody.querySelectorAll('button[data-cancel-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to cancel this trip?')) return;
        try {
          await apiPatch(`/api/admin/trips/${btn.dataset.cancelId}/cancel`);
          window.showToast('Trip cancelled successfully');
          loadTrips();
        } catch (err) {
          window.showToast('Failed to cancel trip', 'error');
        }
      });
    });

    if (pagination) {
      const totalPages = Math.ceil(total / 20);
      let html = '';
      if (currentTripPage > 1) html += `<button data-p="${currentTripPage - 1}">&lsaquo; Prev</button>`;
      html += `<span class="pagi-info">Page ${currentTripPage} of ${totalPages}</span>`;
      if (currentTripPage < totalPages) html += `<button data-p="${currentTripPage + 1}">Next &rsaquo;</button>`;
      pagination.innerHTML = html;
      pagination.querySelectorAll('button').forEach(b => {
        b.addEventListener('click', () => {
          currentTripPage = parseInt(b.dataset.p, 10);
          loadTrips();
        });
      });
    }

  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="6" class="error-cell">Failed to load trips.</td></tr>`;
  }
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
function escHtml(s) { if (!s) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

initTrips();
