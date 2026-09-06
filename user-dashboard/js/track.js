(function () {
  'use strict';

  const API_BASE = `${APP_CONFIG.API_BASE_URL}/api/postparcel`;
  const { authHeaders, escapeHTML, setButtonLoading } = window.TravelBuddy;

  // Elements
  const loading = document.getElementById('trackLoading');
  const empty = document.getElementById('trackEmpty');
  const content = document.getElementById('trackContent');
  const alertBox = document.getElementById('trackAlert');
  const orderTrackInput = document.getElementById('orderTrackInput');
  const orderTrackForm = document.getElementById('orderTrackForm');
  const pasteBtn = document.getElementById('pasteBtn');
  const trackBottomBar = document.getElementById('trackBottomBar');

  // Summary Elements
  const summaryOrderId = document.getElementById('summaryOrderId');
  const summaryAcceptedTime = document.getElementById('summaryAcceptedTime');
  const summaryStatusPill = document.getElementById('summaryStatusPill');
  const summaryStatusLabel = document.getElementById('summaryStatusLabel');
  const viewDetailsLink = document.getElementById('viewDetailsLink');

  // Timeline
  const timeline = document.getElementById('journeyTimeline');

  // Bottom Bar Buttons
  const messageBtn = document.getElementById('messageBtn');
  const helpBtn = document.getElementById('helpBtn');
  const reportBtn = document.getElementById('reportBtn');

  let parcels = [];
  let selectedId = null;

  const STATUS_STAGES = [
    { key: 'pending', title: 'Parcel Posted', icon: 'fa-box' },
    { key: 'accepted', title: 'Traveler Accepted', icon: 'fa-handshake' },
    { key: 'pickup_point_selected', title: 'Pickup Point Selected', icon: 'fa-location-dot' },
    { key: 'pickup_confirmed', title: 'Pickup Confirmed', icon: 'fa-box-open' },
    { key: 'in_transit', title: 'In Transit', icon: 'fa-truck-fast' },
    { key: 'delivery_point_selected', title: 'Delivery Point Selection', icon: 'fa-map-pin' },
    { key: 'delivered', title: 'Delivered Successfully', icon: 'fa-circle-check' }
  ];

  const statusHierarchy = {
    'pending': 0,
    'accepted': 1,
    'pickup_point_pending': 2,
    'pickup_point_selected': 2,
    'pickup_confirmed': 3,
    'in_transit': 4,
    'delivery_point_pending': 5,
    'delivery_point_selected': 5,
    'delivered': 6,
    'cancelled': -1,
    'disputed': 4
  };

  function show(el, visible) {
    if (el) el.classList.toggle('hidden', !visible);
  }

  function formatTime(iso) {
    if (!iso) return 'Pending';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Pending';
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  async function loadByOrderId(id) {
    const orderId = String(id || '').trim().toUpperCase();
    if (!orderId) return;

    show(loading, true);
    show(empty, false);
    show(content, false);
    show(trackBottomBar, false);

    try {
      const res = await fetch(`${API_BASE}/track/order/${encodeURIComponent(orderId)}`, { headers: authHeaders() });
      const data = await res.json();

      if (!res.ok) {
        show(empty, true);
        window.showToast(data.error || 'Parcel not found.', 'error');
        return;
      }

      renderParcel(data.parcel);
    } catch (err) {
      console.error(err);
      show(empty, true);
    } finally {
      show(loading, false);
    }
  }

  function renderParcel(p) {
    if (!p) return;
    selectedId = p.id;
    show(content, true);
    show(trackBottomBar, true);

    // Summary Card
    summaryOrderId.textContent = p.parcelNumber || p.orderId;
    summaryAcceptedTime.textContent = p.acceptedAt ? `Accepted on ${formatTime(p.acceptedAt)}` : 'Waiting for traveler...';
    summaryStatusPill.textContent = (p.status || 'Pending').replace(/_/g, ' ');
    summaryStatusLabel.textContent = p.statusLabel || 'Processing';
    viewDetailsLink.href = `parcel-details.html?id=${p.id}`;

    // Timeline Rendering
    renderTimeline(p);
  }

  function renderTimeline(p) {
    const currentIdx = statusHierarchy[p.status] ?? 0;

    timeline.innerHTML = STATUS_STAGES.map((stage, idx) => {
      let state = 'pending';
      if (idx < currentIdx || (p.status === 'delivered' && idx === 6)) state = 'done';
      else if (idx === currentIdx) state = 'current';

      let time = 'Pending';
      if (idx === 0) time = formatTime(p.createdAt);
      else if (idx === 1 && p.acceptedAt) time = formatTime(p.acceptedAt);
      else if (idx === 3 && p.pickupConfirmedAt) time = formatTime(p.pickupConfirmedAt);
      else if (idx === 4 && p.inTransitAt) time = formatTime(p.inTransitAt);
      else if (idx === 6 && p.deliveredAt) time = formatTime(p.deliveredAt);

      let detailHtml = '';
      if (stage.key === 'pickup_point_selected' && p.pickupPoint) {
        detailHtml = `
          <div class="step-detail">
            <i class="fa-solid fa-location-dot"></i>
            <div>
              ${escapeHTML(p.pickupPoint.name || 'Selected Point')}<br>
              <small>${escapeHTML(p.pickupPoint.address || p.pickupPoint.formattedAddress || '')}</small>
            </div>
          </div>
        `;
      } else if (stage.key === 'delivery_point_selected' && p.deliveryPoint) {
        detailHtml = `
          <div class="step-detail">
            <i class="fa-solid fa-location-dot"></i>
            <div>
              ${escapeHTML(p.deliveryPoint.name || 'Selected Point')}<br>
              <small>${escapeHTML(p.deliveryPoint.address || p.deliveryPoint.formattedAddress || '')}</small>
            </div>
          </div>
        `;
      }

      return `
        <div class="timeline-step ${state}">
          <div class="step-dot">${state === 'done' ? '<i class="fa-solid fa-check"></i>' : ''}</div>
          <div class="step-content">
            <h4>${stage.title} ${state === 'done' && stage.key === 'pickup_point_selected' ? '✓' : ''}</h4>
            <p>${time}</p>
            ${detailHtml}
          </div>
        </div>
      `;
    }).join('');
  }

  // Action Handlers
  messageBtn.onclick = () => {
    if (selectedId) window.location.href = `messages.html?parcel=${selectedId}`;
  };

  helpBtn.onclick = () => {
    window.location.href = '../support/support.html';
  };

  reportBtn.onclick = () => {
    if (selectedId) window.location.href = `parcel-details.html?id=${selectedId}#report`;
  };

  // Clipboard Support
  pasteBtn.onclick = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        orderTrackInput.value = text.trim();
        orderTrackInput.dispatchEvent(new Event('input'));
      }
    } catch (err) {
      window.showToast('Clipboard access denied.', 'warning');
    }
  };

  orderTrackInput.oninput = () => {
    const hasVal = orderTrackInput.value.trim().length > 0;
    orderTrackForm.querySelector('.btn-track-main').classList.toggle('active', hasVal);
  };

  orderTrackForm.onsubmit = (e) => {
    e.preventDefault();
    loadByOrderId(orderTrackInput.value);
  };

  // Initial Load
  const params = new URLSearchParams(window.location.search);
  const qId = params.get('orderId') || params.get('id');
  if (qId) {
    orderTrackInput.value = qId;
    loadByOrderId(qId);
  } else {
    // Check for active parcels
    fetch(`${API_BASE}/tracking`, { headers: authHeaders() })
      .then(r => r.json())
      .then(data => {
        const active = (data.parcels || []).find(p => p.status !== 'delivered' && p.status !== 'cancelled');
        if (active) loadByOrderId(active.parcelNumber || active.orderId || active.id);
        else show(empty, true);
      })
      .catch(() => show(empty, true))
      .finally(() => show(loading, false));
  }

})();
