(function () {
  'use strict';

  const API_BASE = `${APP_CONFIG.API_BASE_URL}/api/postparcel`;
  const { authHeaders, authFetchOptions, escapeHTML, setButtonLoading, formatDate } = window.TravelBuddy;

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
  let latestTrackRequest = 0;

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
      if (window.TravelBuddySkeleton) window.TravelBuddySkeleton.hide('#viewDetails');
      viewDetails.classList.remove('hidden');
      trackBottomBar.classList.remove('hidden');
      trackBackBtn.href = '#'; // JS will handle this
      document.getElementById('trackPageTitle').textContent = 'Tracking Status';
      document.getElementById('trackPageSubtitle').textContent = 'Live journey updates';
    } else if (viewId === 'loading') {
      if (window.TravelBuddySkeleton) {
          window.TravelBuddySkeleton.show('#viewDetails', 'tracking');
          viewDetails.classList.remove('hidden');
      } else {
          loading.classList.remove('hidden');
      }
    }
  }

  async function handleTrackRequest(id) {
    const parcelId = String(id || '').trim();
    if (!parcelId) return window.showToast('Please enter a parcel ID.', 'warning');

    const requestId = ++latestTrackRequest;
    const normalizedId = parcelId.startsWith('TB-') ? parcelId.toUpperCase() : parcelId;
    showView('loading');
    resetState();

    try {
      const isObjectId = /^[a-f\d]{24}$/i.test(normalizedId);
      const endpoint = isObjectId
        ? `${API_BASE}/tracking/${encodeURIComponent(normalizedId)}`
        : `${API_BASE}/track/order/${encodeURIComponent(normalizedId)}`;
      const res = await fetch(endpoint, authFetchOptions());
      const data = await res.json();
      if (requestId !== latestTrackRequest) return;
      if (!res.ok) throw new Error(data.error || 'Unable to load current tracking information.');
      if (!data.parcel) throw new Error('Unable to load current tracking information.');

      renderTrackingDetails(data.parcel);
      updateUrl(data.parcel.parcelNumber || data.parcel.id);
    } catch (err) {
      if (requestId !== latestTrackRequest) return;
      console.error(err);
      alertBox.textContent = err.message || 'Unable to load current tracking information.';
      alertBox.classList.remove('hidden');
      window.showToast(alertBox.textContent, 'error');
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
    if (!Array.isArray(p.trackingTimeline) || !p.status) {
      throw new Error('Unable to load current tracking information.');
    }
    selectedId = p.id;
    showView('details');

    detOrderId.textContent = p.parcelNumber || p.id;
    const acceptedStage = p.trackingTimeline.find((stage) => stage.key === 'accepted');
    detAcceptedTime.textContent = acceptedStage?.state === 'done'
      ? (acceptedStage.time ? `Accepted on ${formatDate(acceptedStage.time, { day: '2-digit', month: 'short', year: 'numeric' })}` : 'Traveler accepted')
      : 'Waiting for traveler acceptance';

    detStatusPill.textContent = p.status.replace(/_/g, ' ');
    detStatusLabel.textContent = p.statusLabel || p.status.replace(/_/g, ' ');

    // Timeline Rendering
    renderTimelineV3(p);

    // Live Tracking
    if (['in_transit', 'delivery_point_pending', 'delivery_point_selected'].includes(p.status) && p.travelerId) {
      observeLiveTracking(p.travelerId);
    } else {
      mapContainer.classList.add('hidden');
    }
  }

  function renderTimelineV3(p) {
    journeyTimeline.innerHTML = p.trackingTimeline.map((stage) => {
      const state = stage.state;
      const time = stage.time
        ? formatDate(stage.time)
        : (state === 'done' ? 'Completed' : (state === 'skipped' ? 'Not reached' : 'Pending'));
      let details = '';

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
          }
      }

      return `
        <div class="timeline-step ${state}">
          <div class="step-dot">${state === 'done' ? '<i class="fa-solid fa-check"></i>' : ''}</div>
          <div class="step-content">
            <h4>${escapeHTML(stage.title)}</h4>
            <p>${time === 'Pending' ? '<span style="opacity:0.6">Pending</span>' : escapeHTML(time)}</p>
            ${details}
          </div>
        </div>
      `;
    }).join('');

    if (p.trackingTerminal) {
      const terminal = p.trackingTerminal;
      const isCancelled = terminal.key === 'cancelled';
      journeyTimeline.insertAdjacentHTML('beforeend', `
            <div class="timeline-step ${terminal.state}">
              <div class="step-dot"><i class="fa-solid ${isCancelled ? 'fa-xmark' : 'fa-circle-exclamation'}"></i></div>
              <div class="step-content">
                <h4>${escapeHTML(terminal.title)}</h4>
                <p>${terminal.time ? formatDate(terminal.time) : 'Time unavailable'}</p>
                ${isCancelled ? `<div class="step-detail" style="color:var(--error); border-color:var(--error);"><i class="fa-solid fa-circle-exclamation"></i><div>Reason: ${escapeHTML(p.cancellationReason || 'Not provided')}</div></div>` : ''}
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
      firebase.initializeApp(window.CarryParcelFirebaseConfig);
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
      // Check if clipboard API is available and permissions are granted
      if (!navigator.clipboard || typeof navigator.clipboard.readText !== 'function') {
        throw new Error('Clipboard API not supported');
      }
      
      // Request clipboard permission if needed
      const permission = await navigator.permissions.query({ name: 'clipboard-read' }).catch(() => ({ state: 'prompt' }));
      if (permission.state === 'denied') {
        throw new Error('Clipboard permission denied');
      }

      const text = await navigator.clipboard.readText();
      if (text) {
        orderTrackInput.value = text.trim();
        orderTrackInput.dispatchEvent(new Event('input'));
        window.showToast('Pasted from clipboard', 'success');
      }
    } catch (err) {
      console.warn('Clipboard read failed:', err.message);
      // Fallback: focus input for manual paste
      orderTrackInput.focus();
      window.showToast('Please paste manually (Ctrl+V / Cmd+V)', 'info');
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
  document.addEventListener('travelbuddy:notification', (e) => {
    const parcelId = e.detail?.parcelId || e.detail?.relatedParcel;
    if (selectedId && String(parcelId || '') === String(selectedId)) {
      handleTrackRequest(selectedId);
    }
  });

  // ---------- Initialization ----------

  const params = new URLSearchParams(window.location.search);
  const qId = params.get('id') || params.get('orderId');
  const action = params.get('action');

  if (qId) {
    handleTrackRequest(qId);
    
    // If action=scan, open QR scanner after tracking details load
    if (action === 'scan') {
      // Wait for tracking details to load, then open scanner
      const checkLoaded = setInterval(() => {
        if (selectedId && !viewDetails.classList.contains('hidden')) {
          clearInterval(checkLoaded);
          openQrScanner(selectedId);
        }
      }, 300);
      
      // Timeout after 10 seconds
      setTimeout(() => clearInterval(checkLoaded), 10000);
    }
  } else {
    showView('search');
  }

  // QR Scanner function
  async function openQrScanner(parcelId) {
    if (!window.CarryParcel?.QRScanner || !window.TravelBuddy?.QRVerification) {
      window.showToast('QR scanner not available', 'error');
      return;
    }

    try {
      window.showToast('Opening camera...', 'info');
      
      const qrToken = await window.CarryParcel.QRScanner.startScan();
      
      if (!qrToken) {
        window.showToast('No QR code detected', 'warning');
        return;
      }

      window.showToast('Verifying QR code...', 'info');
      
      // Determine verification type based on parcel status
      const parcelRes = await fetch(`${API_BASE}/tracking/${encodeURIComponent(parcelId)}`, authFetchOptions());
      const parcelData = await parcelRes.json();
      
      if (!parcelRes.ok || !parcelData.parcel) {
        throw new Error('Parcel not found');
      }
      
      const parcel = parcelData.parcel;
      let verifyResult;
      
      if (['accepted', 'pickup_point_pending', 'pickup_point_selected'].includes(parcel.status)) {
        // Pickup verification
        verifyResult = await window.TravelBuddy.QRVerification.verifyPickupQr(parcelId, qrToken);
      } else if (['in_transit', 'delivery_point_pending', 'delivery_point_selected'].includes(parcel.status)) {
        // Delivery verification
        verifyResult = await window.TravelBuddy.QRVerification.verifyDeliveryQr(parcelId, qrToken);
      } else {
        window.showToast('QR verification not available for this parcel status', 'warning');
        return;
      }
      
      if (verifyResult?.success) {
        window.showToast('Verification successful!', 'success');
        // Refresh tracking details
        handleTrackRequest(parcelId);
      } else {
        window.showToast(verifyResult?.message || 'Verification failed', 'error');
      }
      
    } catch (err) {
      if (err.message !== 'Scan cancelled' && err.message !== 'Scan stopped') {
        console.error('QR scan error:', err);
        window.showToast(err.message || 'QR scan failed', 'error');
      }
    }
  }

})();
