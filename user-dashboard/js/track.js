(function () {
  'use strict';

  const API_BASE = `${APP_CONFIG.API_BASE_URL}/api/postparcel`;
  const { authHeaders, escapeHTML, setButtonLoading, formatDate } = window.TravelBuddy;

  // Elements
  const viewSearch = document.getElementById('viewSearch');
  const viewDetails = document.getElementById('viewDetails');
  const loading = document.getElementById('trackLoading');
  const alertBox = document.getElementById('trackAlert');

  const orderTrackInput = document.getElementById('orderTrackInput');
  const orderTrackForm = document.getElementById('orderTrackForm');
  const trackSubmitBtn = document.getElementById('trackSubmitBtn');
  const pasteBtn = document.getElementById('pasteBtn');

  const detOrderId = document.getElementById('detOrderId');
  const detAcceptedTime = document.getElementById('detAcceptedTime');
  const detStatusPill = document.getElementById('detStatusPill');
  const detStatusLabel = document.getElementById('detStatusLabel');

  const journeyTimeline = document.getElementById('journeyTimeline');
  const trackBottomBar = document.getElementById('trackBottomBar');
  const mapContainer = document.getElementById('liveTrackingMapContainer');

  const trackBackBtn = document.getElementById('trackBackBtn');
  const trackAnotherBtn = document.getElementById('trackAnotherBtn');
  const viewFullDetailsBtn = document.getElementById('viewFullDetailsBtn');
  const messageBtn = document.getElementById('messageBtn');
  const helpBtn = document.getElementById('helpBtn');
  const reportBtn = document.getElementById('reportBtn');

  let selectedId = null;
  let map = null;
  let travelerMarker = null;
  let firestoreUnsubscribe = null;

  // ---------- State Management & Routing ----------

  function resetState() {
    selectedId = null;
    if (firestoreUnsubscribe) firestoreUnsubscribe();
    if (map) {
      map.remove();
      map = null;
    }
    travelerMarker = null;
    journeyTimeline.innerHTML = '';
    alertBox.classList.add('hidden');
    alertBox.textContent = '';
  }

  function showView(viewId) {
    [viewSearch, viewDetails, loading].forEach(el => el.classList.add('hidden'));
    trackBottomBar.classList.add('hidden');

    if (viewId === 'search') {
      viewSearch.classList.remove('hidden');
      trackBackBtn.href = 'overview.html';
      document.getElementById('trackPageTitle').textContent = 'Track Parcel';
      document.getElementById('trackPageSubtitle').textContent = 'Track your parcel in real time';
    } else if (viewId === 'details') {
      viewDetails.classList.remove('hidden');
      trackBottomBar.classList.remove('hidden');
      trackBackBtn.href = '#'; // JS will handle this
      document.getElementById('trackPageTitle').textContent = 'Tracking Status';
      document.getElementById('trackPageSubtitle').textContent = 'Live journey updates';
    } else if (viewId === 'loading') {
      loading.classList.remove('hidden');
    }
  }

  async function handleTrackRequest(id) {
    const parcelId = String(id || '').trim().toUpperCase();
    if (!parcelId) return window.showToast('Please enter a parcel ID.', 'warning');

    showView('loading');
    resetState();

    try {
      // Try by Order ID first
      const res = await fetch(`${API_BASE}/track/order/${encodeURIComponent(parcelId)}`, { headers: authHeaders() });
      const data = await res.json();

      if (!res.ok) {
         // If not found by Order ID, try by internal ID (fallback for deep links)
         const res2 = await fetch(`${API_BASE}/tracking/${encodeURIComponent(parcelId)}`, { headers: authHeaders() });
         const data2 = await res2.json();
         if (!res2.ok) throw new Error(data2.error || 'Parcel not found.');
         renderTrackingDetails(data2.parcel);
         updateUrl(data2.parcel.parcelNumber || data2.parcel.id);
      } else {
         renderTrackingDetails(data.parcel);
         updateUrl(parcelId);
      }
    } catch (err) {
      console.error(err);
      window.showToast(err.message || 'Unable to load tracking details.', 'error');
      showView('search');
    }
  }

  function updateUrl(id) {
    const url = new URL(window.location.href);
    url.searchParams.set('id', id);
    window.history.pushState({ id }, '', url.toString());
  }

  window.addEventListener('popstate', (e) => {
    const id = e.state?.id || new URLSearchParams(window.location.search).get('id');
    if (id) {
      handleTrackRequest(id);
    } else {
      showView('search');
      resetState();
    }
  });

  // ---------- UI Rendering ----------

  function renderTrackingDetails(p) {
    if (!p) return;
    selectedId = p.id;
    showView('details');

    detOrderId.textContent = p.parcelNumber || p.id;
    detAcceptedTime.textContent = p.acceptedAt ? `Accepted on ${formatDate(p.acceptedAt, { day: '2-digit', month: 'short', year: 'numeric' })}` : 'Waiting for traveler acceptance';

    detStatusPill.textContent = (p.status || 'Pending').replace(/_/g, ' ');
    detStatusLabel.textContent = p.statusLabel || 'Processing';

    // Timeline Rendering
    renderTimelineV3(p);

    // Live Tracking
    if (p.status === 'in_transit' && p.travelerId) {
      observeLiveTracking(p.travelerId);
    } else {
      mapContainer.classList.add('hidden');
    }
  }

  const TIMELINE_STAGES = [
    { key: 'posted', title: 'Parcel Posted', icon: 'fa-box', status: 'pending' },
    { key: 'accepted', title: 'Traveler Accepted', icon: 'fa-handshake', status: 'accepted' },
    { key: 'pickup_point', title: 'Pickup Point', icon: 'fa-location-dot', status: 'pickup_point_selected' },
    { key: 'pickup_confirmed', title: 'Pickup Confirmed', icon: 'fa-box-open', status: 'pickup_confirmed' },
    { key: 'in_transit', title: 'In Transit', icon: 'fa-truck-fast', status: 'in_transit' },
    { key: 'delivery_point', title: 'Delivery Point Selection', icon: 'fa-map-pin', status: 'delivery_point_selected' },
    { key: 'delivered', title: 'Delivered Successfully', icon: 'fa-circle-check', status: 'delivered' }
  ];

  const statusMap = {
    'pending': 0,
    'accepted': 1,
    'pickup_point_pending': 1,
    'pickup_point_selected': 2,
    'pickup_confirmed': 3,
    'in_transit': 4,
    'delivery_point_pending': 4,
    'delivery_point_selected': 5,
    'delivered': 6,
    'cancelled': -1,
    'disputed': 4
  };

  function renderTimelineV3(p) {
    const currentIdx = statusMap[p.status] ?? 0;
    const isCancelled = p.status.includes('cancelled');

    journeyTimeline.innerHTML = TIMELINE_STAGES.map((stage, idx) => {
      let state = 'pending';
      let time = 'Pending';
      let details = '';

      if (idx < currentIdx || (p.status === 'delivered' && idx === 6)) {
        state = 'done';
      } else if (idx === currentIdx && !isCancelled) {
        state = 'current';
      }

      // Resolve Timestamps
      if (idx === 0) time = formatDate(p.createdAt);
      else if (idx === 1 && p.acceptedAt) time = formatDate(p.acceptedAt);
      else if (idx === 3 && p.pickupConfirmedAt) time = formatDate(p.pickupConfirmedAt);
      else if (idx === 4 && p.inTransitAt) time = formatDate(p.inTransitAt);
      else if (idx === 6 && p.deliveredAt) time = formatDate(p.deliveredAt);

      // Special Stage: Pickup Point
      if (stage.key === 'pickup_point' && p.pickupPoint) {
          const isLocked = p.pickupPoint.locked;
          if (p.pickupPoint.name) {
              details = `
                <div class="step-detail">
                  <i class="fa-solid fa-location-arrow"></i>
                  <div>
                    ${escapeHTML(p.pickupPoint.name)}<br>
                    <small>${escapeHTML(p.pickupPoint.address || p.pickupPoint.formattedAddress || '')}</small>
                    ${isLocked ? '<br><span class="lock-tag"><i class="fa-solid fa-lock"></i> Confirmed & Locked</span>' : ''}
                  </div>
                </div>
              `;
              if (state === 'pending' && currentIdx >= 2) state = 'done';
          }
      }

      // Special Stage: Delivery Point
      if (stage.key === 'delivery_point' && p.deliveryPoint) {
          if (p.deliveryPoint.name) {
              details = `
                <div class="step-detail">
                  <i class="fa-solid fa-map-location-dot"></i>
                  <div>
                    ${escapeHTML(p.deliveryPoint.name)}<br>
                    <small>${escapeHTML(p.deliveryPoint.address || p.deliveryPoint.formattedAddress || '')}</small>
                  </div>
                </div>
              `;
              if (state === 'pending' && currentIdx >= 5) state = 'done';
          }
      }

      const icon = state === 'done' ? 'fa-check' : (stage.key === 'delivered' ? 'fa-flag-checkered' : stage.icon);

      return `
        <div class="timeline-step ${state}">
          <div class="step-dot">${state === 'done' ? '<i class="fa-solid fa-check"></i>' : ''}</div>
          <div class="step-content">
            <h4>${stage.title}</h4>
            <p>${time === 'Pending' ? '<span style="opacity:0.6">Pending</span>' : escapeHTML(time)}</p>
            ${details}
          </div>
        </div>
      `;
    }).join('');

    if (isCancelled) {
        journeyTimeline.insertAdjacentHTML('beforeend', `
            <div class="timeline-step failed">
              <div class="step-dot"><i class="fa-solid fa-xmark"></i></div>
              <div class="step-content">
                <h4>Parcel Cancelled</h4>
                <p>${formatDate(p.cancelledAt || p.updatedAt)}</p>
                <div class="step-detail" style="color:var(--error); border-color:var(--error);">
                  <i class="fa-solid fa-circle-exclamation"></i>
                  <div>Reason: ${escapeHTML(p.cancellationReason || 'User cancelled')}</div>
                </div>
              </div>
            </div>
        `);
    }
  }

  // ---------- Live Tracking (Leaflet) ----------

  function initMap(lat, lng) {
    if (map) return;
    map = L.map('liveMap', { zoomControl: false }).setView([lat, lng], 14);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
       attribution: '© OpenStreetMap'
    }).addTo(map);

    const travelerIcon = L.divIcon({
      className: 'custom-div-icon',
      html: "<div style='background-color:var(--primary); width:18px; height:18px; border:3px solid #fff; border-radius:50%; box-shadow: 0 0 15px rgba(13,110,253,0.5);'></div>",
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    travelerMarker = L.marker([lat, lng], { icon: travelerIcon }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
  }

  function updateMapLocation(lat, lng, data = {}) {
    if (!map) {
      initMap(lat, lng);
      mapContainer.classList.remove('hidden');
    } else {
      const pos = [lat, lng];
      travelerMarker.setLatLng(pos);
      map.panTo(pos);
    }

    if (data.timestamp) {
      const d = data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
      document.getElementById('lastSeenText').textContent = `Last location updated: ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    }

    if (data.speed) {
      document.getElementById('liveSpeed').textContent = `${Math.round(data.speed * 3.6)} km/h`;
    }
  }

  function observeLiveTracking(travelerId) {
    if (firestoreUnsubscribe) firestoreUnsubscribe();
    if (!travelerId || typeof firebase === 'undefined') return;

    if (!firebase.apps.length) {
      firebase.initializeApp(window.TravelBuddyFirebaseConfig);
    }

    const db = firebase.firestore();
    firestoreUnsubscribe = db.collection('locations').doc(travelerId)
      .onSnapshot((doc) => {
        if (doc.exists) {
          const data = doc.data();
          // Android app uses lat/lng instead of latitude/longitude
          const lat = data.lat || data.latitude;
          const lng = data.lng || data.longitude;
          if (lat && lng) {
            updateMapLocation(lat, lng, data);
          }
        }
      }, (err) => {
        console.error('[Realtime] Firestore tracking error:', err);
      });
  }

  // ---------- Action Handlers ----------

  trackBackBtn.onclick = (e) => {
    if (selectedId) {
        e.preventDefault();
        showView('search');
        resetState();
        const url = new URL(window.location.href);
        url.searchParams.delete('id');
        window.history.pushState({}, '', url.toString());
    }
  };

  trackAnotherBtn.onclick = () => {
    showView('search');
    resetState();
    orderTrackInput.value = '';
    const url = new URL(window.location.href);
    url.searchParams.delete('id');
    window.history.replaceState({}, '', url.toString());
  };

  messageBtn.onclick = () => {
    if (selectedId) window.location.href = `messages.html?parcel=${selectedId}`;
  };

  helpBtn.onclick = () => {
    if (selectedId) window.location.href = `../support/support.html?parcel=${selectedId}`;
    else window.location.href = '../support/support.html';
  };

  reportBtn.onclick = () => {
    if (selectedId) window.location.href = `parcel-details.html?id=${selectedId}#report`;
  };

  viewFullDetailsBtn.onclick = () => {
    if (selectedId) window.location.href = `parcel-details.html?id=${selectedId}`;
  };

  // ---------- Form Logic ----------

  pasteBtn.onclick = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        orderTrackInput.value = text.trim();
        orderTrackInput.dispatchEvent(new Event('input'));
      }
    } catch (err) {
      window.showToast('Unable to access clipboard.', 'warning');
    }
  };

  orderTrackInput.oninput = () => {
    const hasVal = orderTrackInput.value.trim().length > 0;
    trackSubmitBtn.classList.toggle('active', hasVal);
  };

  orderTrackForm.onsubmit = (e) => {
    e.preventDefault();
    handleTrackRequest(orderTrackInput.value);
  };

  // ---------- Real-time listeners ----------

  document.addEventListener('travelbuddy:parcel-status', (e) => {
    const data = e.detail;
    if (selectedId && (String(data.parcelId) === String(selectedId))) {
      console.log('[Track] Parcel status updated remotely, refreshing details...');
      handleTrackRequest(selectedId);
    }
  });

  // ---------- Initialization ----------

  const params = new URLSearchParams(window.location.search);
  const qId = params.get('id') || params.get('orderId');
  if (qId) {
    handleTrackRequest(qId);
  } else {
    showView('search');
  }

})();
