(function () {
  'use strict';

  const API_BASE = `${window.TravelBuddy.API_ORIGIN}/api/postparcel`;
  const { authHeaders, escapeHTML, formatDate, setButtonLoading } = window.TravelBuddy;

  const routeForm = document.getElementById('routeSearchForm');
  const routeSearchBtn = document.getElementById('routeSearchBtn');
  const pickupResults = document.getElementById('pickupResults');
  const pickupEmpty = document.getElementById('pickupEmpty');
  const resultCount = document.getElementById('resultCount');

  function setEmptyState(message, icon) {
    if (!pickupEmpty) return;
    pickupEmpty.classList.remove('hidden');
    pickupEmpty.innerHTML = `<i class="fa-solid ${icon || 'fa-box-open'}"></i>${escapeHTML(message)}`;
  }

  function renderPickupResults(results) {
    if (!pickupResults) return;

    if (!results.length) {
      pickupResults.innerHTML = '';
      setEmptyState('No parcels found on this route yet. Check back soon!');
      if (resultCount) resultCount.textContent = '';
      return;
    }

    if (pickupEmpty) pickupEmpty.classList.add('hidden');
    if (resultCount) resultCount.textContent = `${results.length} match${results.length > 1 ? 'es' : ''}`;

    pickupResults.innerHTML = results.map((p, i) => `
      <li class="parcel-card" style="animation-delay:${i * 0.06}s">
        <span class="route-pill">${escapeHTML(p.from)} <i class="fa-solid fa-arrow-right-long"></i> ${escapeHTML(p.to)}</span>
        <div class="parcel-body">
          <p class="parcel-title">${escapeHTML(p.desc)}</p>
          <div class="parcel-meta">
            <span><i class="fa-solid fa-user"></i> ${escapeHTML(p.sender)}</span>
            <span><i class="fa-solid fa-weight-hanging"></i> ${escapeHTML(p.weight)}kg</span>
            <span><i class="fa-solid fa-indian-rupee-sign"></i>${escapeHTML(p.price)}</span>
            <span><i class="fa-regular fa-calendar"></i> ${formatDate(p.date)}</span>
          </div>
        </div>
        <button class="accept-btn" data-id="${escapeHTML(p.id)}">Accept</button>
      </li>
    `).join('');

    pickupResults.querySelectorAll('.accept-btn').forEach((btn) => {
      btn.addEventListener('click', () => acceptParcel(btn));
    });
  }

  async function acceptParcel(btn) {
    const id = btn.dataset.id;
    btn.disabled = true;
    btn.textContent = 'Accepting...';

    try {
      const res = await fetch(`${API_BASE}/${id}/accept`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();

      if (!res.ok) {
        window.showToast(data.error || 'Could not accept parcel.', 'error');
        btn.disabled = false;
        btn.textContent = 'Accept';
        return;
      }

      btn.textContent = 'Accepted';
      btn.closest('.parcel-card')?.classList.add('is-accepted');
      window.showToast('Parcel accepted. You can track the journey from Track Parcel.', 'success');
    } catch (err) {
      console.error(err);
      window.showToast('Could not reach the server.', 'error');
      btn.disabled = false;
      btn.textContent = 'Accept';
    }
  }

  if (routeForm) {
    routeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const from = document.getElementById('routeFrom').value.trim();
      const to = document.getElementById('routeTo').value.trim();

      if (!from || !to) {
        window.showToast('Enter both a starting point and a destination.', 'error');
        return;
      }

      setButtonLoading(routeSearchBtn, true);
      if (pickupResults) {
        pickupResults.innerHTML = `
          <li class="skeleton-row"></li>
          <li class="skeleton-row"></li>
          <li class="skeleton-row"></li>
        `;
      }
      if (pickupEmpty) pickupEmpty.classList.add('hidden');
      if (resultCount) resultCount.textContent = 'Searching...';

      try {
        const params = new URLSearchParams({ from, to });
        const res = await fetch(`${API_BASE}/search?${params}`, { headers: authHeaders() });
        const data = await res.json();

        if (!res.ok) {
          window.showToast(data.error || 'Search failed.', 'error');
          pickupResults.innerHTML = '';
          if (resultCount) resultCount.textContent = '';
          setEmptyState('Search failed. Please try again.', 'fa-triangle-exclamation');
          return;
        }

        renderPickupResults(data.parcels || []);
      } catch (err) {
        console.error(err);
        window.showToast('Could not reach the server.', 'error');
        pickupResults.innerHTML = '';
        if (resultCount) resultCount.textContent = '';
        setEmptyState('Could not reach the server. Please try again.', 'fa-wifi');
      } finally {
        setButtonLoading(routeSearchBtn, false);
      }
    });
  }
})();
