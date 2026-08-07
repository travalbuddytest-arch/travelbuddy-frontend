(function () {
  'use strict';

  const API_BASE = `${APP_CONFIG.API_BASE_URL}/api/postparcel`;
  const { authHeaders, escapeHTML, formatDate, setButtonLoading } = window.TravelBuddy;

  let myParcelsCache = [];

  const postForm = document.getElementById('postParcelForm');
  const postSubmitBtn = document.getElementById('postSubmitBtn');
  const modalOverlay = document.getElementById('parcelModalOverlay');
  const modalClose = document.getElementById('parcelModalClose');
  const editForm = document.getElementById('editParcelForm');
  const saveParcelBtn = document.getElementById('saveParcelBtn');
  const deleteParcelBtn = document.getElementById('deleteParcelBtn');
  const walletTopupOverlay = document.getElementById('walletTopupOverlay');
  const walletTopupClose = document.getElementById('walletTopupClose');
  const walletTopupCancel = document.getElementById('walletTopupCancel');
  const walletTopupProceed = document.getElementById('walletTopupProceed');
  let pendingTopupAmount = 0;

  function statusLabel(status) {
    const labels = {
      pending: 'Pending',
      accepted: 'Request Accepted',
      pickup_confirmed: 'Pickup Confirmed',
      in_transit: 'In Transit',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
    };
    return escapeHTML(labels[status] || status || 'Pending');
  }

  const DELETE_WINDOW_MS = 2 * 60 * 60 * 1000;
  let timerTicker = null;

  function deleteTimeLeft(parcel) {
    return Math.max(0, new Date(parcel.createdAt).getTime() + DELETE_WINDOW_MS - Date.now());
  }

  function formatCountdown(ms) {
    const total = Math.ceil(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const sec = total % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  }

  function renderMyParcels(parcels) {
    myParcelsCache = parcels;
    const list = document.getElementById('myParcelList');
    if (!list) return;
    if (timerTicker) clearInterval(timerTicker);

    if (!parcels.length) {
      list.innerHTML = `<p class="empty-state"><i class="fa-solid fa-box-open"></i>You haven't posted any parcels yet.</p>`;
      return;
    }

    list.innerHTML = parcels.map((p, i) => {
      const canDelete = p.status === 'pending' || p.status === 'accepted';
      const accepted = p.acceptedBy;
      return `<li class="parcel-card ${accepted ? 'is-accepted' : ''}" tabindex="0" style="animation-delay:${i * 0.05}s" data-id="${escapeHTML(p.id)}">
        <div class="parcel-card-main">
          <span class="route-pill">${escapeHTML(p.from)} <i class="fa-solid fa-arrow-right-long"></i> ${escapeHTML(p.to)}</span>
          <div class="parcel-body"><p class="parcel-title">${escapeHTML(p.desc)}</p><div class="parcel-meta">
            <span><i class="fa-solid fa-weight-hanging"></i> ${escapeHTML(p.weight)}kg</span><span><i class="fa-solid fa-indian-rupee-sign"></i>${escapeHTML(p.price)}</span><span><i class="fa-regular fa-calendar"></i> ${formatDate(p.date)}</span>
          </div></div><span class="tag tag--${escapeHTML(p.status || 'pending')}">${statusLabel(p.status)}</span>
        </div>
        ${accepted ? `<button class="accepted-user-btn" data-profile-id="${escapeHTML(p.id)}"><i class="fa-solid fa-circle-user"></i><span>Accepted by <strong>${escapeHTML(accepted.fullName)}</strong></span><i class="fa-solid fa-chevron-right"></i></button>` : ''}
        ${canDelete ? `<div class="delete-window"><span><i class="fa-solid fa-ban"></i> ${p.status === 'accepted' ? '10% cancellation fee applies' : 'Free cancellation before acceptance'}</span><button class="quick-delete-btn" data-delete-id="${escapeHTML(p.id)}"><i class="fa-solid fa-ban"></i> Cancel Parcel</button></div>` : ''}
      </li>`;
    }).join('');

    list.querySelectorAll('.parcel-card').forEach((card) => card.addEventListener('click', (e) => { if (!e.target.closest('button')) openParcelModal(card.dataset.id); }));
    list.querySelectorAll('.quick-delete-btn').forEach((btn) => btn.addEventListener('click', () => deleteParcel(btn.dataset.deleteId)));
    list.querySelectorAll('.accepted-user-btn').forEach((btn) => btn.addEventListener('click', () => showTravelerProfile(btn.dataset.profileId, btn.closest('.parcel-card'))));
    timerTicker = setInterval(() => {
      let expired = false;
      list.querySelectorAll('.delete-countdown').forEach((el) => {
        const left = Math.max(0, new Date(el.dataset.created).getTime() + DELETE_WINDOW_MS - Date.now());
        el.textContent = formatCountdown(left);
        if (!left) expired = true;
      });
      if (expired) loadMyParcels();
    }, 1000);
  }

  async function deleteParcel(id) {
    const parcel = myParcelsCache.find((p) => String(p.id) === String(id));
    if (!parcel) return;
    if (!['pending','accepted'].includes(parcel.status)) {
      return window.showToast('Cancellation is not allowed after pickup.', 'error');
    }
    const fee = parcel.status === 'accepted' ? Number(parcel.price || 0) * 0.10 : 0;
    const message = parcel.status === 'accepted'
      ? `A traveler has accepted this parcel. Cancelling now will charge 10% (Rs. ${fee.toFixed(2)}). Continue?`
      : 'Cancel this parcel? No fee will be charged before traveler acceptance.';
    if (!confirm(message)) return;
    const cancelButtons = document.querySelectorAll(`[data-delete-id="${CSS.escape(String(id))}"]`);
    cancelButtons.forEach((button) => { button.disabled = true; button.dataset.oldHtml = button.innerHTML; button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cancelling…'; });
    try {
      const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE', headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) return window.showToast(data.error || 'Could not delete parcel.', 'error');
      window.showToast(data.message || 'Parcel cancelled.', 'success'); closeParcelModal(); loadMyParcels();
    } catch (err) { console.error(err); window.showToast('Could not reach the server.', 'error'); }
    finally {
      cancelButtons.forEach((button) => { button.disabled = false; button.innerHTML = button.dataset.oldHtml || 'Cancel Parcel'; delete button.dataset.oldHtml; });
    }
  }

  async function showTravelerProfile(parcelId, parcelCard) {
    try {
      const res = await fetch(`${API_BASE}/${parcelId}/accepted-traveler-profile`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) return window.showToast(data.error || 'Could not load traveler profile.', 'error');
      const t = data.traveler;

      document.querySelector('.traveler-profile-overlay')?.remove();
      const panel = document.createElement('div');
      panel.className = 'traveler-profile-overlay';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      panel.setAttribute('aria-label', 'Accepted traveler profile');
      panel.innerHTML = `<div class="traveler-profile-card"><button class="traveler-profile-close" aria-label="Close traveler profile">−</button><div class="traveler-avatar">${escapeHTML(t.fullName.split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase())}</div><h2>${escapeHTML(t.fullName)}</h2>${t.isVerified ? '<span class="verified-badge"><i class="fa-solid fa-circle-check"></i> Verified traveler</span>' : ''}<div class="profile-stats"><div><strong>${Number(t.rating).toFixed(1)} ★</strong><span>Rating</span></div><div><strong>${escapeHTML(t.accuracy)}%</strong><span>Accuracy</span></div><div><strong>${escapeHTML(t.parcelsPostedAsSender)}</strong><span>Parcels posted</span></div><div><strong>${escapeHTML(t.parcelsDeliveredAsTraveler)}</strong><span>Parcels delivered</span></div></div></div>`;

      document.body.appendChild(panel);
      document.body.classList.add('traveler-profile-open');
      const closeProfile = () => { panel.remove(); document.body.classList.remove('traveler-profile-open'); document.removeEventListener('keydown', onEscape); };
      const onEscape = (event) => { if (event.key === 'Escape') closeProfile(); };
      panel.querySelector('.traveler-profile-close').addEventListener('click', closeProfile);
      panel.addEventListener('click', (event) => { if (event.target === panel) closeProfile(); });
      document.addEventListener('keydown', onEscape);
      panel.querySelector('.traveler-profile-close').focus();
    } catch (err) { console.error(err); window.showToast('Could not reach the server.', 'error'); }
  }

  function formatRupees(value) {
    return `Rs. ${Number(value || 0).toFixed(2)}`;
  }

  function showWalletTopup(data) {
    pendingTopupAmount = Number(data.shortage || 0);
    document.getElementById('walletTopupMessage').textContent =
      data.error || `Add ${formatRupees(pendingTopupAmount)} to your wallet before posting this parcel.`;
    document.getElementById('walletCurrentBalance').textContent = formatRupees(data.walletBalance);
    document.getElementById('walletShortageAmount').textContent = formatRupees(pendingTopupAmount);
    walletTopupOverlay?.classList.remove('hidden');
  }

  function closeWalletTopup() {
    walletTopupOverlay?.classList.add('hidden');
  }

  function handlePostError(data) {
    if (data && data.code === 'INSUFFICIENT_WALLET') {
      showWalletTopup(data);
      return;
    }
    window.showToast(data.error || 'Could not post parcel.', 'error');
  }


  function showOrderSuccess(parcel) {
    const orderId = parcel?.orderId;
    if (!orderId) return;
    document.querySelector('.order-success-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'order-success-overlay';
    overlay.innerHTML = `<div class="order-success-card" role="dialog" aria-modal="true" aria-labelledby="orderSuccessTitle">
      <div class="order-success-icon"><i class="fa-solid fa-check"></i></div>
      <h2 id="orderSuccessTitle">Parcel Posted Successfully</h2>
      <p>Your parcel is live. We are now searching for a traveler heading toward your destination.</p>
      <div class="order-id-box"><small>Your Order ID</small><strong>${escapeHTML(orderId)}</strong></div>
      <span class="order-success-status">Searching for Traveler</span>
      <div class="order-success-actions">
        <button class="order-secondary" id="copyOrderIdBtn"><i class="fa-regular fa-copy"></i> Copy Order ID</button>
        <a class="order-primary" href="track.html?orderId=${encodeURIComponent(orderId)}">Track Parcel</a>
        <button class="order-secondary" id="viewMyParcelsBtn">View My Parcels</button>
        <a class="order-secondary" href="overview.html">Dashboard</a>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    document.getElementById('copyOrderIdBtn')?.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(orderId); window.showToast('Order ID copied.', 'success'); }
      catch { window.prompt('Copy your Order ID:', orderId); }
    });
    document.getElementById('viewMyParcelsBtn')?.addEventListener('click', () => {
      overlay.remove(); document.getElementById('myParcelList')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  }

  function renderRouteRecommendations(recommendations) {
    const panel = document.getElementById('routeRecommendationsPanel');
    const list = document.getElementById('routeRecommendationsList');
    if (!panel || !list) return;

    // Persistent panel: reloaded from the server on every page load, and
    // stays visible for as long as a match exists - not just once, right
    // after posting - until the traveler's travel date passes.
    if (!recommendations || !recommendations.length) {
      panel.classList.add('hidden');
      list.innerHTML = '';
      return;
    }

    list.innerHTML = recommendations.map((r, i) => `
      <li class="route-match-card" style="animation-delay:${i * 0.05}s" data-route-id="${escapeHTML(r.id)}" data-traveler-id="${escapeHTML(r.travelerId)}" data-parcel-id="${escapeHTML(r.parcelId)}" tabindex="0" role="button" aria-label="View ${escapeHTML(r.travelerName)}'s traveler profile">
        <div class="route-match-info">
          <span class="route-pill">${escapeHTML(r.from)} <i class="fa-solid fa-arrow-right-long"></i> ${escapeHTML(r.to)}</span>
          <p class="parcel-title">${escapeHTML(r.travelerName)}</p>
          <div class="parcel-meta">
            <span><i class="fa-regular fa-calendar"></i> ${formatDate(r.date)}</span>
            ${r.notes ? `<span><i class="fa-regular fa-note-sticky"></i> ${escapeHTML(r.notes)}</span>` : ''}
          </div>
        </div>
        <button class="accept-btn message-traveler-btn" data-traveler-id="${escapeHTML(r.travelerId)}" data-parcel-id="${escapeHTML(r.parcelId)}">
          <i class="fa-solid fa-message"></i> Message
        </button>
      </li>
    `).join('');

    list.querySelectorAll('.message-traveler-btn').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        messageTraveler(btn, btn.dataset.parcelId);
      });
    });

    list.querySelectorAll('.route-match-card').forEach((card) => {
      card.addEventListener('click', () => showRouteTravelerProfile(card.dataset.routeId));
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          showRouteTravelerProfile(card.dataset.routeId);
        }
      });
    });

    panel.classList.remove('hidden');
  }

  async function showRouteTravelerProfile(routeId) {
    if (!routeId) return;
    try {
      const res = await fetch(`${API_BASE}/recommendations/${routeId}/profile`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) return window.showToast(data.error || 'Could not load traveler profile.', 'error');
      const t = data.traveler;
      const r = data.route;

      document.querySelector('.traveler-profile-overlay')?.remove();
      const panel = document.createElement('div');
      panel.className = 'traveler-profile-overlay';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      panel.setAttribute('aria-label', 'Traveler profile');
      panel.innerHTML = `<div class="traveler-profile-card">
        <button class="traveler-profile-close" aria-label="Close traveler profile">−</button>
        <div class="traveler-avatar">${escapeHTML(t.fullName.split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase())}</div>
        <h2>${escapeHTML(t.fullName)}</h2>
        ${t.isVerified ? '<span class="verified-badge"><i class="fa-solid fa-circle-check"></i> Verified traveler</span>' : ''}
        <div class="route-pill route-pill--modal">${escapeHTML(r.from)} <i class="fa-solid fa-arrow-right-long"></i> ${escapeHTML(r.to)}</div>
        <div class="parcel-meta parcel-meta--modal">
          <span><i class="fa-regular fa-calendar"></i> ${formatDate(r.date)}</span>
          ${r.notes ? `<span><i class="fa-regular fa-note-sticky"></i> ${escapeHTML(r.notes)}</span>` : ''}
        </div>
        <div class="profile-stats">
          <div><strong>${Number(t.rating).toFixed(1)} ★</strong><span>Rating</span></div>
          <div><strong>${escapeHTML(t.accuracy)}%</strong><span>Accuracy</span></div>
          <div><strong>${escapeHTML(t.parcelsPostedAsSender)}</strong><span>Parcels posted</span></div>
          <div><strong>${escapeHTML(t.parcelsDeliveredAsTraveler)}</strong><span>Parcels delivered</span></div>
        </div>
        <button class="accept-btn message-traveler-btn traveler-profile-message-btn" data-traveler-id="${escapeHTML(t.id)}">
          <i class="fa-solid fa-message"></i> Message
        </button>
      </div>`;

      document.body.appendChild(panel);
      document.body.classList.add('traveler-profile-open');
      const closeProfile = () => { panel.remove(); document.body.classList.remove('traveler-profile-open'); document.removeEventListener('keydown', onEscape); };
      const onEscape = (event) => { if (event.key === 'Escape') closeProfile(); };
      panel.querySelector('.traveler-profile-close').addEventListener('click', closeProfile);
      panel.addEventListener('click', (event) => { if (event.target === panel) closeProfile(); });
      document.addEventListener('keydown', onEscape);
      const messageBtn = panel.querySelector('.traveler-profile-message-btn');
      const originalCard = document.querySelector(`.route-match-card[data-route-id="${CSS.escape(routeId)}"]`);
      messageBtn?.addEventListener('click', () => {
        messageTraveler(messageBtn, originalCard?.dataset.parcelId);
      });
      panel.querySelector('.traveler-profile-close').focus();
    } catch (err) {
      console.error(err);
      window.showToast('Could not reach the server.', 'error');
    }
  }

  async function messageTraveler(btn, parcelId) {
    const travelerId = btn.dataset.travelerId;
    if (!parcelId || !travelerId) return;
    btn.disabled = true;
    const oldHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Opening...';

    try {
      const res = await fetch(`${APP_CONFIG.API_BASE_URL}/api/messages/start`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ parcelId, travelerId }),
      });
      const data = await res.json();

      if (!res.ok) {
        window.showToast(data.error || 'Could not start conversation.', 'error');
        btn.disabled = false;
        btn.innerHTML = oldHtml;
        return;
      }

      window.location.href = `messages.html?parcel=${encodeURIComponent(parcelId)}`;
    } catch (err) {
      console.error(err);
      window.showToast('Could not reach the server.', 'error');
      btn.disabled = false;
      btn.innerHTML = oldHtml;
    }
  }

  async function loadRouteRecommendations() {
    try {
      const res = await fetch(`${API_BASE}/recommendations`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) return;
      renderRouteRecommendations(data.recommendations || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadMyParcels() {
    const list = document.getElementById('myParcelList');
    if (list) {
      list.innerHTML = `
        <li class="skeleton-row"></li>
        <li class="skeleton-row"></li>
        <li class="skeleton-row"></li>
      `;
    }

    try {
      const res = await fetch(`${API_BASE}/my-parcels`, { headers: authHeaders() });
      const data = await res.json();

      if (!res.ok) {
        window.showToast(data.error || 'Could not load your parcels.', 'error');
        renderMyParcels([]);
        return;
      }

      renderMyParcels(data.parcels || []);
    } catch (err) {
      console.error(err);
      window.showToast('Could not reach the server.', 'error');
      renderMyParcels([]);
    }
  }

  if (postForm) {
    postForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const from = document.getElementById('postFrom').value.trim();
      const to = document.getElementById('postTo').value.trim();
      const desc = document.getElementById('postDesc').value.trim();
      const weight = document.getElementById('postWeight').value;
      const price = document.getElementById('postPrice').value;
      const date = document.getElementById('postDate').value;

      const weightNumber = Number(weight);
      const priceNumber = Number(price);
      const selectedDate = new Date(`${date}T00:00:00`);
      const today = new Date(); today.setHours(0,0,0,0);

      if (!from || !to || !desc || !weight || !price || !date) {
        window.showToast('Please fill in all fields.', 'error');
        return;
      }
      if (from.toLowerCase() === to.toLowerCase()) {
        window.showToast('Pickup and destination locations cannot be the same.', 'error');
        return;
      }
      if (!Number.isFinite(weightNumber) || weightNumber < 0.1 || !Number.isFinite(priceNumber) || priceNumber <= 0) {
        window.showToast('Enter a valid weight and price greater than zero.', 'error');
        return;
      }
      if (Number.isNaN(selectedDate.getTime()) || selectedDate < today) {
        window.showToast('Pickup date cannot be in the past.', 'error');
        return;
      }

      setButtonLoading(postSubmitBtn, true);
      renderRouteRecommendations([]);

      try {
        const res = await fetch(`${API_BASE}/post`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ from, to, desc, weight, price, date }),
        });
        const data = await res.json();

        if (!res.ok) {
          handlePostError(data);
          return;
        }

        postForm.reset();
        window.showToast(data.message || 'Parcel posted! Travelers on this route will be notified.', 'success');
        showOrderSuccess(data.parcel);
        loadRouteRecommendations();
        loadMyParcels();
      } catch (err) {
        console.error(err);
        window.showToast('Could not reach the server.', 'error');
      } finally {
        setButtonLoading(postSubmitBtn, false);
      }
    });
  }

  function openParcelModal(id) {
    const parcel = myParcelsCache.find((p) => String(p.id) === String(id));
    if (!parcel || !modalOverlay) return;

    const editable = parcel.status === 'pending';
    editForm.querySelectorAll('input:not([type=hidden])').forEach((input) => { input.disabled = !editable; });
    saveParcelBtn.style.display = editable ? '' : 'none';
    deleteParcelBtn.style.display = ['pending','accepted'].includes(parcel.status) ? '' : 'none';

    document.getElementById('editParcelId').value = parcel.id;
    document.getElementById('editFrom').value = parcel.from;
    document.getElementById('editTo').value = parcel.to;
    document.getElementById('editDesc').value = parcel.desc;
    document.getElementById('editWeight').value = parcel.weight;
    document.getElementById('editPrice').value = parcel.price;
    const parsedDate = new Date(parcel.date);
    document.getElementById('editDate').value = Number.isNaN(parsedDate.getTime())
      ? ''
      : parsedDate.toISOString().slice(0, 10);

    modalOverlay.classList.remove('hidden');
    document.getElementById('editFrom').focus();
  }

  function closeParcelModal() {
    if (modalOverlay) modalOverlay.classList.add('hidden');
  }

  if (modalClose) modalClose.addEventListener('click', closeParcelModal);
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeParcelModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeParcelModal();
  });

  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('editParcelId').value;
      const from = document.getElementById('editFrom').value.trim();
      const to = document.getElementById('editTo').value.trim();
      const desc = document.getElementById('editDesc').value.trim();
      const weight = document.getElementById('editWeight').value;
      const price = document.getElementById('editPrice').value;
      const date = document.getElementById('editDate').value;

      if (!from || !to || !desc || !weight || !price || !date) {
        window.showToast('Please fill in all fields.', 'error');
        return;
      }

      setButtonLoading(saveParcelBtn, true);

      try {
        const res = await fetch(`${API_BASE}/${id}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({ from, to, desc, weight, price, date }),
        });
        const data = await res.json();

        if (!res.ok) {
          handlePostError(data);
          return;
        }

        window.showToast('Parcel updated.', 'success');
        closeParcelModal();
        loadMyParcels();
      } catch (err) {
        console.error(err);
        window.showToast('Could not reach the server.', 'error');
      } finally {
        setButtonLoading(saveParcelBtn, false);
      }
    });
  }

  if (deleteParcelBtn) {
    deleteParcelBtn.addEventListener('click', () => deleteParcel(document.getElementById('editParcelId').value));
  }

  [walletTopupClose, walletTopupCancel].forEach((button) => {
    button?.addEventListener('click', closeWalletTopup);
  });
  walletTopupOverlay?.addEventListener('click', (e) => {
    if (e.target === walletTopupOverlay) closeWalletTopup();
  });
  walletTopupProceed?.addEventListener('click', () => {
    if (pendingTopupAmount > 0) {
      sessionStorage.setItem('travelBuddyTopupAmount', String(pendingTopupAmount));
    }
    window.location.href = `payments.html${pendingTopupAmount > 0 ? `?topup=${encodeURIComponent(pendingTopupAmount)}` : ''}`;
  });

  loadMyParcels();
  loadRouteRecommendations();
})();
