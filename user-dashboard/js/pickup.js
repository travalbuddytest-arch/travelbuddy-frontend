(function () {
  'use strict';

  const { API_ORIGIN, authHeaders, escapeHTML, formatDate, formatPaise, statusBadge, setButtonLoading } = window.TravelBuddy;
  const API_BASE = `${API_ORIGIN}/api/postparcel`;

  // Tab Elements
  const tabDeliveriesBtn = document.getElementById('tabDeliveriesBtn');
  const tabFindBtn = document.getElementById('tabFindBtn');
  const tabRoutesBtn = document.getElementById('tabRoutesBtn');
  const sectionDeliveries = document.getElementById('sectionDeliveries');
  const sectionFind = document.getElementById('sectionFind');
  const sectionRoutes = document.getElementById('sectionRoutes');

  // Delivery Tasks Elements
  const activeDeliveriesBadge = document.getElementById('activeDeliveriesBadge');
  const deliveriesLoadingState = document.getElementById('deliveriesLoadingState');
  const deliveriesEmptyState = document.getElementById('deliveriesEmptyState');
  const deliveriesList = document.getElementById('deliveriesList');
  const refreshDeliveriesBtn = document.getElementById('refreshDeliveriesBtn');
  const emptyFindParcelsBtn = document.getElementById('emptyFindParcelsBtn');

  // Search Route Elements
  const routeForm = document.getElementById('routeSearchForm');
  const routeSearchBtn = document.getElementById('routeSearchBtn');
  const pickupResults = document.getElementById('pickupResults');
  const pickupEmpty = document.getElementById('pickupEmpty');
  const resultCount = document.getElementById('resultCount');

  // OTP Modal Elements
  const taskOtpModal = document.getElementById('taskOtpModal');
  const taskOtpModalClose = document.getElementById('taskOtpModalClose');
  const taskOtpTitle = document.getElementById('taskOtpTitle');
  const taskOtpSub = document.getElementById('taskOtpSub');
  const taskOtpInput = document.getElementById('taskOtpInput');
  const taskSubmitOtpBtn = document.getElementById('taskSubmitOtpBtn');

  // State
  let activeDeliveries = [];
  let currentActiveParcelId = null;
  let currentOtpPurpose = 'pickup';

  // ---------------- Tabs ----------------
  function switchTab(tabKey) {
    [tabDeliveriesBtn, tabFindBtn, tabRoutesBtn].forEach(b => b?.classList.remove('active'));
    [sectionDeliveries, sectionFind, sectionRoutes].forEach(s => s?.classList.add('hidden'));

    if (tabKey === 'find') {
      tabFindBtn?.classList.add('active');
      sectionFind?.classList.remove('hidden');
    } else if (tabKey === 'routes') {
      tabRoutesBtn?.classList.add('active');
      sectionRoutes?.classList.remove('hidden');
    } else {
      tabDeliveriesBtn?.classList.add('active');
      sectionDeliveries?.classList.remove('hidden');
      loadActiveDeliveries();
    }
  }

  tabDeliveriesBtn?.addEventListener('click', () => switchTab('deliveries'));
  tabFindBtn?.addEventListener('click', () => switchTab('find'));
  tabRoutesBtn?.addEventListener('click', () => switchTab('routes'));
  emptyFindParcelsBtn?.addEventListener('click', () => switchTab('find'));

  // ---------------- Active Deliveries ----------------
  async function loadActiveDeliveries() {
    if (deliveriesLoadingState) deliveriesLoadingState.classList.remove('hidden');
    if (deliveriesEmptyState) deliveriesEmptyState.classList.add('hidden');
    if (deliveriesList) deliveriesList.innerHTML = '';

    try {
      const res = await fetch(`${API_BASE}/tracking`, { headers: authHeaders() });
      const data = await res.json();

      if (!res.ok) {
        window.showToast(data.error || 'Failed to load deliveries.', 'error');
        return;
      }

      // Filter to parcels where user is the traveler and status is active
      const allTracking = data.parcels || [];
      activeDeliveries = allTracking.filter(p => p.role === 'traveler' && p.status !== 'cancelled' && p.status !== 'delivered');

      if (activeDeliveriesBadge) {
        activeDeliveriesBadge.textContent = activeDeliveries.length;
      }

      renderActiveDeliveries();
    } catch (err) {
      console.error(err);
      window.showToast('Could not reach the server.', 'error');
    } finally {
      if (deliveriesLoadingState) deliveriesLoadingState.classList.add('hidden');
    }
  }

  function renderActiveDeliveries() {
    if (!deliveriesList) return;

    if (!activeDeliveries.length) {
      deliveriesList.innerHTML = '';
      if (deliveriesEmptyState) deliveriesEmptyState.classList.remove('hidden');
      return;
    }

    if (deliveriesEmptyState) deliveriesEmptyState.classList.add('hidden');

    deliveriesList.innerHTML = activeDeliveries.map((p) => {
      const isAwaitingPickup = ['accepted', 'pickup_point_pending', 'pickup_point_selected'].includes(p.status);
      const isCollected = p.status === 'pickup_confirmed';
      const isInTransit = ['in_transit', 'delivery_point_pending', 'delivery_point_selected'].includes(p.status);

      const grossPrice = Number(p.price || 0);
      const earning = p.travelerEarning ? Number(p.travelerEarning) : Math.round(grossPrice * 0.9);
      const displayEarning = formatPaise(earning > 1000 ? earning : earning * 100);

      let actionButtons = '';
      if (isAwaitingPickup) {
        actionButtons = `
          <button type="button" class="btn-primary" data-action="verify-pickup-otp" data-id="${escapeHTML(p.id)}">
            <i class="fa-solid fa-key"></i> Verify Pickup PIN
          </button>
          <a href="track.html?id=${encodeURIComponent(p.id)}&action=scan" class="btn-ghost" style="text-decoration:none;">
            <i class="fa-solid fa-camera"></i> Scan Sender QR
          </a>
        `;
      } else if (isCollected) {
        actionButtons = `
          <button type="button" class="btn-primary" data-action="start-journey" data-id="${escapeHTML(p.id)}">
            <i class="fa-solid fa-truck-fast"></i> Start Delivery Journey
          </button>
        `;
      } else if (isInTransit) {
        actionButtons = `
          <button type="button" class="btn-primary" data-action="verify-delivery-otp" data-id="${escapeHTML(p.id)}">
            <i class="fa-solid fa-circle-check"></i> Verify Delivery PIN
          </button>
          <a href="track.html?id=${encodeURIComponent(p.id)}&action=scan" class="btn-ghost" style="text-decoration:none;">
            <i class="fa-solid fa-camera"></i> Scan Recipient QR
          </a>
        `;
      }

      return `
        <div class="pickup-task-card" data-id="${escapeHTML(p.id)}">
          <div class="pickup-task-head">
            <div>
              <span style="font-family:monospace; font-weight:700; color:var(--primary); font-size:13px; margin-right:8px;">${escapeHTML(p.parcelNumber || p.id)}</span>
              ${statusBadge(p.status)}
            </div>
            <span style="font-weight:800; font-size:15px; color:var(--success);">
              Earnings: ${displayEarning}
            </span>
          </div>

          <div>
            <div style="font-size:15px; font-weight:700; color:var(--text-main); margin-bottom:4px;">
              ${escapeHTML(p.fromCity)} <i class="fa-solid fa-arrow-right-long" style="color:var(--primary); margin:0 6px;"></i> ${escapeHTML(p.toCity)}
            </div>
            <p style="font-size:13.5px; color:var(--text-muted); margin:0 0 6px;">${escapeHTML(p.description)}</p>
            <div style="display:flex; gap:16px; font-size:12px; color:var(--text-faint); flex-wrap:wrap;">
              <span><i class="fa-solid fa-weight-hanging"></i> ${escapeHTML(String(p.weight))} kg</span>
              <span><i class="fa-regular fa-calendar"></i> Pickup: ${formatDate(p.pickupDate || p.createdAt)}</span>
              <span><i class="fa-solid fa-user"></i> Sender: ${escapeHTML(p.sender?.displayName || 'Sender')}</span>
            </div>
          </div>

          <div class="pickup-task-actions">
            ${actionButtons}
            <a href="messages.html" class="btn-ghost" style="text-decoration:none;">
              <i class="fa-solid fa-comment-dots"></i> Chat Sender
            </a>
            <a href="parcel-details.html?id=${encodeURIComponent(p.id)}" class="link-btn" style="margin-left:auto;">
              Full Details <i class="fa-solid fa-chevron-right"></i>
            </a>
          </div>
        </div>
      `;
    }).join('');

    // Attach Task Button Actions
    deliveriesList.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (action === 'verify-pickup-otp') {
          openTaskOtpModal(id, 'pickup');
        } else if (action === 'verify-delivery-otp') {
          openTaskOtpModal(id, 'delivery');
        } else if (action === 'start-journey') {
          startJourney(id);
        }
      });
    });
  }

  async function startJourney(id) {
    try {
      window.showToast('Starting journey...', 'info');
      const res = await fetch(`${API_BASE}/tracking/${encodeURIComponent(id)}/actions/start-journey`, {
        method: 'POST',
        headers: authHeaders()
      });
      const data = await res.json();
      if (!res.ok) {
        window.showToast(data.error || 'Failed to start journey.', 'error');
        return;
      }
      window.showToast('Journey started! Parcel is now In Transit.', 'success');
      loadActiveDeliveries();
    } catch (err) {
      console.error(err);
      window.showToast('Network error while starting journey.', 'error');
    }
  }

  function openTaskOtpModal(id, purpose) {
    currentActiveParcelId = id;
    currentOtpPurpose = purpose;
    taskOtpTitle.textContent = purpose === 'pickup' ? 'Verify Pickup Handover' : 'Verify Delivery Completion';
    taskOtpSub.textContent = `Ask the ${purpose === 'pickup' ? 'sender' : 'recipient'} for the 6-digit verification PIN and enter it below.`;
    taskOtpInput.value = '';
    taskOtpModal.classList.remove('hidden');
    taskOtpInput.focus();
  }

  if (taskSubmitOtpBtn) {
    taskSubmitOtpBtn.addEventListener('click', async () => {
      const pin = taskOtpInput.value.trim();
      if (pin.length !== 6) {
        window.showToast('Please enter a valid 6-digit PIN.', 'warning');
        return;
      }

      setButtonLoading(taskSubmitOtpBtn, true, 'Verifying...');
      try {
        const res = await fetch(`${API_BASE}/tracking/${encodeURIComponent(currentActiveParcelId)}/otp/${currentOtpPurpose}/verify`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ otp: pin })
        });
        const data = await res.json();

        if (!res.ok) {
          window.showToast(data.error || 'Incorrect verification PIN.', 'error');
          return;
        }

        window.showToast(`${currentOtpPurpose === 'pickup' ? 'Pickup' : 'Delivery'} verified successfully!`, 'success');
        taskOtpModal.classList.add('hidden');
        loadActiveDeliveries();
      } catch (err) {
        console.error(err);
        window.showToast('Could not reach the server.', 'error');
      } finally {
        setButtonLoading(taskSubmitOtpBtn, false);
      }
    });
  }

  if (taskOtpModalClose) {
    taskOtpModalClose.addEventListener('click', () => taskOtpModal.classList.add('hidden'));
  }

  refreshDeliveriesBtn?.addEventListener('click', loadActiveDeliveries);

  // ---------------- Find Parcels on Route ----------------
  function renderPickupResults(results) {
    if (!pickupResults) return;

    if (!results.length) {
      pickupResults.innerHTML = '';
      if (pickupEmpty) {
        pickupEmpty.classList.remove('hidden');
        pickupEmpty.innerHTML = '<i class="fa-solid fa-box-open"></i> No available parcels found on this route right now. Check back soon or post your travel route!';
      }
      if (resultCount) resultCount.textContent = '';
      return;
    }

    if (pickupEmpty) pickupEmpty.classList.add('hidden');
    if (resultCount) resultCount.textContent = `${results.length} match${results.length > 1 ? 'es' : ''} available`;

    pickupResults.innerHTML = results.map((p, i) => {
      const grossPrice = Number(p.price || 0);
      const earningRupees = Math.round(grossPrice * 0.9);

      return `
        <li class="parcel-card" style="animation-delay:${i * 0.05}s">
          <span class="route-pill">${escapeHTML(p.from)} <i class="fa-solid fa-arrow-right-long"></i> ${escapeHTML(p.to)}</span>
          <div class="parcel-body">
            <p class="parcel-title">${escapeHTML(p.desc)}</p>
            <div class="parcel-meta">
              <span><i class="fa-solid fa-user"></i> ${escapeHTML(p.sender)}</span>
              <span><i class="fa-solid fa-weight-hanging"></i> ${escapeHTML(String(p.weight))}kg</span>
              <span class="price-highlight"><i class="fa-solid fa-indian-rupee-sign"></i>${escapeHTML(String(grossPrice))}</span>
              <span><i class="fa-regular fa-calendar"></i> ${formatDate(p.date)}</span>
            </div>
            <div class="earning-info">
              <span class="earning-label">Your Earning:</span>
              <span class="earning-value">₹${earningRupees}</span>
              <small>(after 10% platform fee)</small>
            </div>
          </div>
          <button class="accept-btn" data-id="${escapeHTML(p.id)}">Accept &amp; Carry</button>
        </li>
      `;
    }).join('');

    pickupResults.querySelectorAll('.accept-btn').forEach((btn) => {
      btn.addEventListener('click', () => acceptParcel(btn));
    });
  }

  async function acceptParcel(btn) {
    const id = btn.dataset.id;
    btn.disabled = true;
    btn.textContent = 'Accepting...';

    try {
      const res = await fetch(`${API_BASE}/${encodeURIComponent(id)}/accept`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();

      if (!res.ok) {
        window.showToast(data.error || 'Could not accept parcel.', 'error');
        btn.disabled = false;
        btn.textContent = 'Accept & Carry';
        return;
      }

      btn.textContent = 'Accepted!';
      btn.closest('.parcel-card')?.classList.add('is-accepted');
      window.showToast('Parcel accepted! Added to your Active Deliveries.', 'success');

      setTimeout(() => {
        switchTab('deliveries');
      }, 1000);
    } catch (err) {
      console.error(err);
      window.showToast('Could not reach the server.', 'error');
      btn.disabled = false;
      btn.textContent = 'Accept & Carry';
    }
  }

  if (routeForm) {
    routeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const from = document.getElementById('routeFrom').value.trim();
      const to = document.getElementById('routeTo').value.trim();

      if (!from || !to) {
        window.showToast('Enter both starting point and destination.', 'error');
        return;
      }

      setButtonLoading(routeSearchBtn, true);
      if (pickupResults) {
        pickupResults.innerHTML = '<li class="skeleton-row"></li><li class="skeleton-row"></li>';
      }

      try {
        const res = await fetch(`${API_BASE}/search?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
          headers: authHeaders(),
        });
        const data = await res.json();

        if (!res.ok) {
          window.showToast(data.error || 'Search failed.', 'error');
          renderPickupResults([]);
          return;
        }

        renderPickupResults(data.results || []);
      } catch (err) {
        console.error(err);
        window.showToast('Could not reach the server.', 'error');
        renderPickupResults([]);
      } finally {
        setButtonLoading(routeSearchBtn, false);
      }
    });
  }

  // Pre-fill query parameters if routed from search
  const params = new URLSearchParams(window.location.search);
  const qFrom = params.get('from');
  const qTo = params.get('to');
  if (qFrom && qTo) {
    switchTab('find');
    const fInput = document.getElementById('routeFrom');
    const tInput = document.getElementById('routeTo');
    if (fInput && tInput) {
      fInput.value = qFrom;
      tInput.value = qTo;
      routeForm?.dispatchEvent(new Event('submit'));
    }
  } else {
    loadActiveDeliveries();
  }
})();
