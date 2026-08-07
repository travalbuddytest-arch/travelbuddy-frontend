(function () {
  'use strict';

  const API_BASE = `${APP_CONFIG.API_BASE_URL}/api/travelroutes`;
  const { authHeaders, escapeHTML, formatDate, setButtonLoading } = window.TravelBuddy;

  const routePostForm = document.getElementById('postRouteForm');
  const routePostBtn = document.getElementById('routePostBtn');
  const myRouteList = document.getElementById('myRouteList');

  function renderMyRoutes(routes) {
    if (!myRouteList) return;

    if (!routes.length) {
      myRouteList.innerHTML = `<p class="empty-state"><i class="fa-solid fa-route"></i>You haven't posted a travel route yet.</p>`;
      return;
    }

    myRouteList.innerHTML = routes.map((r, i) => `
      <li class="parcel-card" style="animation-delay:${i * 0.05}s" data-id="${escapeHTML(r.id)}">
        <span class="route-pill">${escapeHTML(r.from)} <i class="fa-solid fa-arrow-right-long"></i> ${escapeHTML(r.to)}</span>
        <div class="parcel-body">
          <p class="parcel-title">${escapeHTML(r.notes || 'No notes added')}</p>
          <div class="parcel-meta">
            <span><i class="fa-regular fa-calendar"></i> ${formatDate(r.date)}</span>
          </div>
        </div>
        <button class="quick-delete-btn" data-cancel-id="${escapeHTML(r.id)}"><i class="fa-solid fa-ban"></i> Cancel</button>
      </li>
    `).join('');

    myRouteList.querySelectorAll('.quick-delete-btn').forEach((btn) => {
      btn.addEventListener('click', () => cancelRoute(btn.dataset.cancelId));
    });
  }

  async function loadMyRoutes() {
    if (myRouteList) {
      myRouteList.innerHTML = `<li class="skeleton-row"></li>`;
    }
    try {
      const res = await fetch(`${API_BASE}/mine`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) {
        window.showToast(data.error || 'Could not load your routes.', 'error');
        renderMyRoutes([]);
        return;
      }
      renderMyRoutes(data.routes || []);
    } catch (err) {
      console.error(err);
      window.showToast('Could not reach the server.', 'error');
      renderMyRoutes([]);
    }
  }

  async function cancelRoute(id) {
    if (!confirm('Cancel this route? Senders will no longer see you as a recommended traveler for it.')) return;
    try {
      const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE', headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) return window.showToast(data.error || 'Could not cancel route.', 'error');
      window.showToast(data.message || 'Route cancelled.', 'success');
      loadMyRoutes();
    } catch (err) {
      console.error(err);
      window.showToast('Could not reach the server.', 'error');
    }
  }

  if (routePostForm) {
    routePostForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const from = document.getElementById('routePostFrom').value.trim();
      const to = document.getElementById('routePostTo').value.trim();
      const date = document.getElementById('routePostDate').value;
      const notes = document.getElementById('routePostNotes').value.trim();

      if (!from || !to || !date) {
        window.showToast('Enter a route and travel date.', 'error');
        return;
      }
      if (from.toLowerCase() === to.toLowerCase()) {
        window.showToast('Starting point and destination cannot be the same.', 'error');
        return;
      }

      setButtonLoading(routePostBtn, true);
      try {
        const res = await fetch(API_BASE, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ from, to, date, notes }),
        });
        const data = await res.json();

        if (!res.ok) {
          window.showToast(data.error || 'Could not post route.', 'error');
          return;
        }

        routePostForm.reset();
        window.showToast(data.message || 'Route posted.', 'success');
        loadMyRoutes();
      } catch (err) {
        console.error(err);
        window.showToast('Could not reach the server.', 'error');
      } finally {
        setButtonLoading(routePostBtn, false);
      }
    });
  }

  loadMyRoutes();
})();
