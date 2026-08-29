const API_ORIGIN = APP_CONFIG.API_BASE_URL;

const searchInput = document.getElementById('searchInput');
const initialContent = document.getElementById('initialContent');
const resultsContent = document.getElementById('resultsContent');
const resultsList = document.getElementById('resultsList');
const recentList = document.getElementById('recentList');
const recentSection = document.getElementById('recentSearchesSection');
const loadingState = document.getElementById('loadingState');
const emptyState = document.getElementById('emptyState');
const clearAllBtn = document.getElementById('clearAllBtn');

let searchDebounce = null;

async function apiGet(url) {
  const token = localStorage.getItem('travelBuddyToken');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API_ORIGIN}${url}`, { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, data };
  return data;
}

async function apiPost(url, body) {
  const token = localStorage.getItem('travelBuddyToken');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_ORIGIN}${url}`, { method: 'POST', headers, body: JSON.stringify(body) });
  return res.json();
}

async function apiDelete(url) {
  const token = localStorage.getItem('travelBuddyToken');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API_ORIGIN}${url}`, { method: 'DELETE', headers });
  return res.json();
}

async function loadRecentSearches() {
  try {
    const data = await apiGet('/api/search/recent');
    if (data.recent && data.recent.length > 0) {
      recentSection.style.display = 'block';
      recentList.innerHTML = data.recent.map(item => `
        <div class="recent-item" onclick="setSearchQuery('${item.query}')">
          <i class="fa-solid fa-clock-rotate-left"></i>
          <span>${escapeHTML(item.query)}</span>
          <button onclick="event.stopPropagation(); deleteRecent('${item._id}')"><i class="fa-solid fa-xmark"></i></button>
        </div>
      `).join('');
    } else {
      recentSection.style.display = 'none';
    }
  } catch (err) {
    console.warn('History load failed');
  }
}

window.setSearchQuery = (q) => {
  searchInput.value = q;
  performSearch(q);
};

window.deleteRecent = async (id) => {
  await apiDelete(`/api/search/recent/${id}`);
  loadRecentSearches();
};

clearAllBtn.addEventListener('click', async () => {
  await apiDelete('/api/search/recent');
  loadRecentSearches();
});

searchInput.addEventListener('input', (e) => {
  const q = e.target.value.trim();
  clearTimeout(searchDebounce);

  if (q.length < 2) {
    showInitial();
    return;
  }

  searchDebounce = setTimeout(() => performSearch(q), 300);
});

async function performSearch(q) {
  showLoading();
  try {
    const data = await apiGet(`/api/search?q=${encodeURIComponent(q)}`);
    showResults(data.results, q);

    // Save to history (don't await)
    apiPost('/api/search/recent', { query: q });
  } catch (err) {
    console.error('Search failed', err);
    showInitial();
  }
}

function showResults(results, query) {
  loadingState.style.display = 'none';
  const { parcels = [], travelerRoutes = [] } = results;

  if (parcels.length === 0 && travelerRoutes.length === 0) {
    initialContent.style.display = 'none';
    resultsContent.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  initialContent.style.display = 'none';
  resultsContent.style.display = 'block';

  let html = '';

  if (parcels.length > 0) {
    html += '<h4 style="margin: 20px 0 10px; color: #667085;">Available Parcels</h4>';
    html += parcels.map(p => `
      <div class="result-card" onclick="window.location.href='track.html?id=${p._id}'">
        <div class="result-type">Parcel • ${escapeHTML(p.category || 'General')}</div>
        <div class="result-title">${escapeHTML(p.description || 'No description')}</div>
        <div class="result-subtitle">${escapeHTML(p.fromCity)} → ${escapeHTML(p.toCity)} • ${formatPaise(p.price)}</div>
      </div>
    `).join('');
  }

  if (travelerRoutes.length > 0) {
    html += '<h4 style="margin: 20px 0 10px; color: #667085;">Traveler Routes</h4>';
    html += travelerRoutes.map(r => `
      <div class="result-card" onclick="window.location.href='pickup.html?from=${encodeURIComponent(r.fromCity)}&to=${encodeURIComponent(r.toCity)}'">
        <div class="result-type">Traveler</div>
        <div class="result-title">Heading to ${escapeHTML(titleCase(r.toCity))}</div>
        <div class="result-subtitle">From: ${escapeHTML(titleCase(r.fromCity))} • Date: ${new Date(r.travelDate).toLocaleDateString()}</div>
      </div>
    `).join('');
  }

  resultsList.innerHTML = html;
}

function showInitial() {
  loadingState.style.display = 'none';
  emptyState.style.display = 'none';
  resultsContent.style.display = 'none';
  initialContent.style.display = 'block';
  loadRecentSearches();
}

function showLoading() {
  initialContent.style.display = 'none';
  resultsContent.style.display = 'none';
  emptyState.style.display = 'none';
  loadingState.style.display = 'block';
}

function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatPaise(p) {
  return '₹' + ((p || 0) / 100).toLocaleString('en-IN');
}

function titleCase(s) {
  return s.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}

// Chips click
document.querySelectorAll('.pop-chip').forEach(btn => {
  btn.addEventListener('click', () => setSearchQuery(btn.textContent));
});

// Initial History
loadRecentSearches();

const urlParams = new URLSearchParams(window.location.search);
const initialQuery = urlParams.get('q');
if (initialQuery) {
  searchInput.value = initialQuery;
  performSearch(initialQuery);
} else {
  searchInput.focus();
}
