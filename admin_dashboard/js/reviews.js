/**
 * TravelBuddy — Reviews & Ratings Moderation
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

export default function initReviews() {
  const el = document.getElementById('reviews-list');
  if (!el) return;

  loadReviews();
  wireEvents();
}

function wireEvents() {
  document.getElementById('refreshReviews')?.addEventListener('click', loadReviews);
  document.getElementById('reviewScoreFilter')?.addEventListener('change', () => { currentPage = 1; loadReviews(); });
  document.getElementById('reviewUserSearch')?.addEventListener('input', debounce(() => { currentPage = 1; loadReviews(); }, 400));
}

async function loadReviews() {
  const tbody = document.getElementById('reviews-list');
  const pagi = document.getElementById('reviewPagination');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:#98a2b3">Loading reviews...</td></tr>`;

  try {
    const score = document.getElementById('reviewScoreFilter')?.value || 'all';
    const search = document.getElementById('reviewUserSearch')?.value.trim() || '';

    let url = `/api/admin/reviews?page=${currentPage}&limit=20`;
    if (score === 'low') url += '&maxScore=2';
    else if (score === 'mid') url += '&minScore=3&maxScore=3';
    else if (score === 'high') url += '&minScore=4';
    if (search) url += `&userSearch=${encodeURIComponent(search)}`;

    const data = await apiGet(url);
    const { reviews, total } = data;

    if (!reviews || reviews.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:#98a2b3">No reviews found.</td></tr>`;
      if (pagi) pagi.innerHTML = '';
      return;
    }

    tbody.innerHTML = reviews.map(r => `
      <tr>
        <td style="font-size:12px;color:var(--text-muted)">${formatDateShort(r.createdAt)}</td>
        <td>
          <strong style="display:block">${esc(r.fromUserId?.firstName)} ${esc(r.fromUserId?.lastName)}</strong>
          <small style="color:var(--text-faint)">${esc(r.fromUserId?.email)}</small>
        </td>
        <td>
          <strong style="display:block">${esc(r.targetUserId?.firstName)} ${esc(r.targetUserId?.lastName)}</strong>
          <small style="color:var(--text-faint)">${esc(r.targetUserId?.email)}</small>
        </td>
        <td><strong style="color:#F59E0B">★ ${r.score.toFixed(1)}</strong></td>
        <td style="font-size:13px;max-width:300px;white-space:normal">${esc(r.comment || '—')}</td>
        <td>
          <div class="row-actions">
            <button class="btn sm secondary" onclick="window.fetchUserDetail('${r.targetUserId?._id}')">Review Receiver</button>
            <button class="btn sm danger" title="Flag review" onclick="alert('Review flagged for investigation.')"><i class="fa-solid fa-flag"></i></button>
          </div>
        </td>
      </tr>
    `).join('');

    renderPagination(total, pagi);
  } catch (err) {
    console.warn('Reviews load failed:', err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--danger)">Error loading data.</td></tr>`;
  }
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
  el.querySelectorAll('button[data-p]').forEach(btn => btn.addEventListener('click', () => { currentPage = parseInt(btn.dataset.p); loadReviews(); }));
}

function formatDateShort(d) { return d ? new Date(d).toLocaleDateString('en-IN') : '—'; }
function esc(s) { if (!s) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function debounce(fn, ms) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); }; }

window.initReviews = initReviews;
try { initReviews(); } catch (e) { console.warn('reviews init failed', e); }
