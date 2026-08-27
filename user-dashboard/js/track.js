(function () {
  'use strict';

  const API_BASE = `${APP_CONFIG.API_BASE_URL}/api/postparcel`;
  const { authHeaders, escapeHTML, setButtonLoading, QRVerification } = window.TravelBuddy;

  const loading = document.getElementById('trackLoading');
  const empty = document.getElementById('trackEmpty');
  const content = document.getElementById('trackContent');
  const alertBox = document.getElementById('trackAlert');
  const selectorWrap = document.getElementById('parcelSelectorWrap');
  const selector = document.getElementById('parcelSelector');
  const routeCard = document.querySelector('.route-card:not(.route-card--skeleton)');
  const routeProgress = document.getElementById('routeProgress');
  const routeFrom = document.getElementById('routeFrom');
  const routeTo = document.getElementById('routeTo');
  const parcelNumber = document.getElementById('parcelNumber');
  const statusBadge = document.getElementById('statusBadge');
  const travelerName = document.getElementById('travelerName');
  const travelerPublicId = document.getElementById('travelerPublicId');
  const travelerVerification = document.getElementById('travelerVerification');
  const travelerStats = document.getElementById('travelerStats');
  const travelerAvatar = document.getElementById('travelerAvatar');
  const etaText = document.getElementById('etaText');
  const timeline = document.getElementById('journeyTimeline');
  const actionPanel = document.getElementById('actionPanel');
  const messageBtn = document.getElementById('messageBtn');
  const audioCallBtn = document.getElementById('audioCallBtn');
  const orderTrackForm = document.getElementById('orderTrackForm');
  const orderTrackInput = document.getElementById('orderTrackInput');

  const stages = [
    { key: 'pending', title: 'Posted', field: 'createdAt', icon: 'fa-magnifying-glass' },
    { key: 'accepted', title: 'Accepted', field: 'acceptedAt', icon: 'fa-check' },
    { key: 'pickup_verification', title: 'Pickup Verification', field: 'pickupVerificationAt', icon: 'fa-qrcode' },
    { key: 'pickup_confirmed', title: 'Picked Up', field: 'pickupConfirmedAt', icon: 'fa-box' },
    { key: 'in_transit', title: 'In Transit', field: 'inTransitAt', icon: 'fa-route' },
    { key: 'delivery_verification', title: 'Delivery Verification', field: 'deliveryVerificationAt', icon: 'fa-qrcode' },
    { key: 'delivered', title: 'Delivered', field: 'deliveredAt', icon: 'fa-flag-checkered' },
  ];

  const statusOrder = ['pending', 'accepted', 'pickup_verification', 'pickup_confirmed', 'in_transit', 'delivery_verification', 'delivered'];
  const progressByStatus = {
    pending: 8,
    accepted: 25,
    pickup_verification: 32,
    pickup_confirmed: 46,
    in_transit: 70,
    delivery_verification: 84,
    delivered: 100,
    cancelled: 18,
  };

  let parcels = [];
  let selectedId = null;

  function show(el, visible) {
    if (!el) return;
    el.classList.toggle('hidden', !visible);
  }

  function showAlert(message) {
    if (!alertBox) return;
    alertBox.textContent = message || '';
    show(alertBox, Boolean(message));
  }

  function formatDateTime(value, prefix) {
    if (window.TravelBuddyDate) return `${prefix || ''}${window.TravelBuddyDate.formatDateTime(value)}` || 'Pending';
    if (!value) return 'Pending';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Time unavailable';
    return `${prefix || ''}${date.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    })}`;
  }

  function selectorText(parcel) {
    return `${parcel.parcelNumber} - ${parcel.fromCity} -> ${parcel.toCity} - ${parcel.statusLabel}`;
  }

  function renderSelector() {
    if (!selector) return;
    const activeParcels = parcels.filter((parcel) => parcel.status !== 'delivered' && parcel.status !== 'cancelled');
    show(selectorWrap, activeParcels.length > 1);
    selector.innerHTML = activeParcels.map((parcel) => `
      <option value="${escapeHTML(parcel.id)}">${escapeHTML(selectorText(parcel))}</option>
    `).join('');
    selector.value = selectedId || activeParcels[0]?.id || '';
  }

  function timelineStatus(parcel) {
    if (parcel.status === 'accepted') return 'pickup_verification';
    if (parcel.status === 'in_transit') return 'delivery_verification';
    return parcel.status;
  }

  function stageState(parcel, stage) {
    const currentStatus = timelineStatus(parcel);
    const currentIndex = statusOrder.indexOf(currentStatus);
    const stageIndex = statusOrder.indexOf(stage.key);
    if (parcel.status === 'cancelled') return stageIndex === 0 ? 'complete' : 'pending';
    if (stageIndex < currentIndex || parcel.status === 'delivered') return 'complete';
    if (stageIndex === currentIndex) return 'current';
    return 'pending';
  }

  function renderTimeline(parcel) {
    timeline.innerHTML = stages.map((stage) => {
      const state = stageState(parcel, stage);
      const timestamp = state === 'pending'
        ? 'Pending'
        : formatDateTime(parcel[stage.field], stage.key === 'in_transit' ? 'Started at ' : '');
      const icon = state === 'complete' ? 'fa-check' : stage.icon;
      return `
        <li class="timeline-item is-${state}">
          <span class="timeline-dot" aria-hidden="true"><i class="fa-solid ${icon}"></i></span>
          <div>
            <h4>${stage.title}</h4>
            <p>${escapeHTML(timestamp)}</p>
          </div>
        </li>
      `;
    }).join('');
  }

  function setRouteProgress(parcel) {
    const progress = progressByStatus[timelineStatus(parcel)] || 18;
    if (routeProgress) {
      routeProgress.style.setProperty('--route-progress-factor', String(progress / 100));
    }
    if (routeCard) {
      routeCard.style.setProperty('--route-progress-factor', String(progress / 100));
      const current = parcel.status === 'delivered'
        ? 'destination'
        : parcel.status === 'accepted'
          ? 'origin'
          : 'middle';
      routeCard.dataset.current = current;
    }
  }

  function renderActions(parcel) {
    if (!actionPanel) return;

    if (parcel.status === 'delivered') {
      actionPanel.innerHTML = `
        <h3>Journey Complete</h3>
        <p>Your parcel journey is complete.</p>
        <div class="success-note"><i class="fa-solid fa-circle-check"></i> Delivered ${escapeHTML(formatDateTime(parcel.deliveredAt))}</div>
      `;
      return;
    }

    if (parcel.role !== 'traveler') {
      const qrAction = parcel.status === 'accepted'
        ? { action: 'show-pickup-qr', label: 'Show Pickup QR', icon: 'fa-qrcode' }
        : parcel.status === 'in_transit'
          ? { action: 'show-delivery-qr', label: 'Show Delivery QR', icon: 'fa-qrcode' }
          : null;

      actionPanel.innerHTML = `
        <h3>Available Actions</h3>
        <p>${qrAction ? 'Display the stage-specific QR code for the accepted traveler to scan.' : 'You can view progress, message the traveler, start a private in-app audio call, or report a problem. Only the assigned traveler can update journey status.'}</p>
        <div class="action-buttons">
          ${qrAction ? `<button type="button" class="btn-primary btn-primary--inline" id="showQrBtn" data-action="${qrAction.action}">
            <span class="btn-label"><i class="fa-solid ${qrAction.icon}"></i> ${qrAction.label}</span>
            <span class="spinner" aria-hidden="true"></span>
          </button>` : ''}
          <button type="button" class="btn-ghost" id="reportProblemBtn"><i class="fa-solid fa-triangle-exclamation"></i> Report a Problem</button>
        </div>
      `;
      document.getElementById('showQrBtn')?.addEventListener('click', (event) => {
        openJourneyQrDisplay(event.currentTarget.dataset.action);
      });
      document.getElementById('reportProblemBtn')?.addEventListener('click', () => {
        window.showToast('Problem reporting is not available yet.', 'error');
      });
      return;
    }

    const actionByStatus = {
      accepted: { action: 'scan-pickup-qr', label: 'Scan Pickup QR', icon: 'fa-qrcode' },
      pickup_confirmed: { action: 'start-journey', label: 'Start Journey', icon: 'fa-route' },
      in_transit: { action: 'scan-delivery-qr', label: 'Scan Delivery QR', icon: 'fa-qrcode' },
    };
    const action = actionByStatus[parcel.status];

    if (!action) {
      actionPanel.innerHTML = `
        <h3>Available Actions</h3>
        <p>No status actions are available for this parcel right now.</p>
      `;
      return;
    }

    actionPanel.innerHTML = `
      <h3>Available Actions</h3>
      <p>${action.action.startsWith('scan-') ? 'Open the camera only when you are ready to scan the matching parcel QR.' : 'This action updates the parcel journey after backend authorization and transition checks.'}</p>
      <div class="action-buttons">
        <button type="button" class="btn-primary btn-primary--inline" id="statusActionBtn" data-action="${action.action}">
          <span class="btn-label"><i class="fa-solid ${action.icon}"></i> ${action.label}</span>
          <span class="spinner" aria-hidden="true"></span>
        </button>
        ${action.action.startsWith('scan-') ? `<button type="button" class="btn-ghost" id="otpFallbackBtn" data-action="${action.action === 'scan-pickup-qr' ? 'confirm-pickup' : 'confirm-delivery'}">
          <i class="fa-solid fa-key"></i> Verify using OTP
        </button>` : ''}
      </div>
    `;
    document.getElementById('statusActionBtn')?.addEventListener('click', (event) => {
      const a = event.currentTarget.dataset.action;
      if (a === 'scan-pickup-qr' || a === 'scan-delivery-qr') openJourneyQrScanner(a);
      else if (a === 'confirm-pickup' || a === 'confirm-delivery') openJourneyOtpModal(a);
      else handleStatusAction(event);
    });
    document.getElementById('otpFallbackBtn')?.addEventListener('click', (event) => {
      openJourneyOtpModal(event.currentTarget.dataset.action);
    });
  }

  function renderParcel(parcel) {
    if (!parcel) return;
    content.classList.remove('is-switching');
    void content.offsetWidth;
    content.classList.add('is-switching');

    routeFrom.textContent = parcel.fromCity || 'Origin';
    routeTo.textContent = parcel.toCity || 'Destination';
    // The large Parcel Journey summary card was intentionally removed.
    // Keep these updates guarded for backward compatibility if those elements exist.
    if (parcelNumber) parcelNumber.textContent = `Parcel #${parcel.parcelNumber}`;
    if (statusBadge) {
      statusBadge.textContent = parcel.statusLabel;
      statusBadge.className = `status-badge is-${parcel.status}`;
    }
    setRouteProgress(parcel);

    const isSenderView = parcel.role === 'sender';
    const person = isSenderView ? (parcel.traveler || {}) : (parcel.sender || {});
    const hasAssignedTraveler = Boolean(parcel.traveler);

    travelerAvatar.textContent = person.initials || (isSenderView ? 'TR' : 'PS');
    travelerName.textContent = person.displayName || (isSenderView ? 'Traveler not assigned' : 'Parcel Sender');
    travelerPublicId.textContent = isSenderView
      ? (hasAssignedTraveler ? (parcel.traveler.publicId || 'Traveler') : 'Waiting for a traveler')
      : 'Parcel Sender';

    if (travelerVerification) {
      travelerVerification.innerHTML = person.isVerified
        ? '<i class="fa-solid fa-circle-check"></i> Identity Verified'
        : '<i class="fa-solid fa-user"></i> TravelBuddy User';
    }

    if (isSenderView) {
      travelerStats.innerHTML = hasAssignedTraveler
        ? `<i class="fa-solid fa-star"></i> ${parcel.traveler.rating ? escapeHTML(Number(parcel.traveler.rating).toFixed(1)) : 'Not rated yet'} · ${escapeHTML(parcel.traveler.completedDeliveries || 0)} Deliveries`
        : '<i class="fa-solid fa-hourglass-half"></i> Searching for a traveler';
    } else {
      travelerStats.innerHTML = '<i class="fa-solid fa-box"></i> Parcel posted by this sender';
    }

    etaText.textContent = parcel.estimatedArrival
      ? `Estimated arrival: ${formatDateTime(parcel.estimatedArrival)}`
      : 'Arrival time not available yet';

    renderTimeline(parcel);
    renderActions(parcel);
  }

  function selectParcel(id) {
    selectedId = id || parcels[0]?.id || null;
    renderSelector();
    renderParcel(parcels.find((parcel) => String(parcel.id) === String(selectedId)));
  }

  async function refreshParcel(id) {
    const res = await fetch(`${API_BASE}/tracking/${encodeURIComponent(id)}`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not refresh parcel journey.');
    const index = parcels.findIndex((parcel) => String(parcel.id) === String(id));
    if (index >= 0) parcels[index] = data.parcel;
    return data.parcel;
  }

  let qrCountdownTimer = null;
  let qrStatusPollTimer = null;
  let activeScanner = null;
  let activeScannerControls = null;
  let scannerLocked = false;

  function qrStageFromAction(action) {
    const isPickup = action === 'show-pickup-qr' || action === 'scan-pickup-qr';
    return {
      purpose: isPickup ? 'pickup' : 'delivery',
      label: isPickup ? 'Pickup' : 'Delivery',
      create: isPickup ? QRVerification.createPickupQr : QRVerification.createDeliveryQr,
      verify: isPickup ? QRVerification.verifyPickupQr : QRVerification.verifyDeliveryQr,
      otpAction: isPickup ? 'confirm-pickup' : 'confirm-delivery',
    };
  }

  function formatCountdown(expiresAt) {
    const expires = new Date(expiresAt).getTime();
    if (!expiresAt || Number.isNaN(expires)) return 'Expiration unavailable';
    const remaining = Math.max(0, Math.floor((expires - Date.now()) / 1000));
    const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
    const seconds = String(remaining % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  function setQrStatus(kind, message) {
    const status = document.getElementById('journeyQrStatus');
    if (!status) return;
    status.className = `journey-qr-status is-${kind || 'info'}`;
    status.innerHTML = message || '';
  }

  function stopQrStatusPolling() {
    if (qrStatusPollTimer) clearInterval(qrStatusPollTimer);
    qrStatusPollTimer = null;
  }

  function hasStageAdvanced(parcel, stage) {
    if (!parcel || !stage) return false;
    if (stage.purpose === 'pickup') {
      return ['pickup_confirmed', 'in_transit', 'delivered'].includes(parcel.status);
    }
    return parcel.status === 'delivered';
  }

  function stageSuccessMessage(stage, message) {
    const fallback = stage.purpose === 'pickup'
      ? 'Parcel successfully handed over'
      : 'Parcel Delivered Successfully';
    return `<i class="fa-solid fa-circle-check"></i> ${stage.label} Verified<br><span>${escapeHTML(message || fallback)}</span>`;
  }

  function startQrStatusPolling(stage) {
    stopQrStatusPolling();
    if (!selectedId) return;
    qrStatusPollTimer = setInterval(async () => {
      try {
        const parcel = await refreshParcel(selectedId);
        if (!hasStageAdvanced(parcel, stage)) return;
        stopQrStatusPolling();
        if (qrCountdownTimer) clearInterval(qrCountdownTimer);
        const refreshBtn = document.getElementById('refreshQrBtn');
        if (refreshBtn) refreshBtn.disabled = true;
        setQrStatus('success', stageSuccessMessage(stage));
        window.showToast(`${stage.label} verified successfully.`, 'success');
        selectParcel(selectedId);
      } catch (err) {
        stopQrStatusPolling();
      }
    }, 5000);
  }

  function closeJourneyQrModal() {
    const modal = document.getElementById('journeyQrModal');
    if (modal) modal.hidden = true;
    if (qrCountdownTimer) clearInterval(qrCountdownTimer);
    stopQrStatusPolling();
    stopQrScanner();
    scannerLocked = false;
  }

  function ensureQrModal() {
    if (document.getElementById('journeyQrModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="journey-qr-modal" id="journeyQrModal" hidden>
        <div class="journey-qr-backdrop"></div>
        <div class="journey-qr-card" role="dialog" aria-modal="true" aria-labelledby="journeyQrTitle">
          <button class="journey-qr-close" type="button" aria-label="Close">&times;</button>
          <div class="journey-qr-icon"><i class="fa-solid fa-qrcode"></i></div>
          <h2 id="journeyQrTitle">Pickup Verification</h2>
          <p id="journeyQrMessage">Show this QR code to your traveler.</p>
          <div class="journey-qr-body" id="journeyQrBody"></div>
          <div class="journey-qr-status is-info" id="journeyQrStatus" role="status"></div>
          <div class="journey-qr-actions" id="journeyQrActions"></div>
        </div>
      </div>
    `);
    const modal = document.getElementById('journeyQrModal');
    modal.querySelector('.journey-qr-close').onclick = closeJourneyQrModal;
    modal.querySelector('.journey-qr-backdrop').onclick = closeJourneyQrModal;
  }

  function renderQrDisplayShell(stage) {
    document.getElementById('journeyQrTitle').textContent = `${stage.label} Verification`;
    document.getElementById('journeyQrMessage').textContent = `Show this ${stage.label} QR code to your traveler`;
    document.getElementById('journeyQrBody').innerHTML = `
      <div class="journey-qr-label">${stage.label} QR</div>
      <div class="journey-qr-code" id="journeyQrCode" aria-label="${stage.label} QR code">
        <div class="journey-qr-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Generating QR...</div>
      </div>
      <div class="journey-qr-countdown" id="journeyQrCountdown">QR expires in: --:--</div>
      <p class="journey-qr-note">The QR contains only a backend token. TravelBuddy verifies the parcel, stage, and authorization on the server.</p>
    `;
    document.getElementById('journeyQrActions').innerHTML = `
      <button type="button" class="btn-primary btn-primary--inline" id="refreshQrBtn">
        <span class="btn-label"><i class="fa-solid fa-rotate"></i> Refresh QR</span>
        <span class="spinner" aria-hidden="true"></span>
      </button>
    `;
  }

  function startQrCountdown(expiresAt, stage) {
    const countdown = document.getElementById('journeyQrCountdown');
    const refreshBtn = document.getElementById('refreshQrBtn');
    if (qrCountdownTimer) clearInterval(qrCountdownTimer);

    const tick = () => {
      const expires = new Date(expiresAt).getTime();
      const expired = !expiresAt || Number.isNaN(expires) || Date.now() >= expires;
      if (expired) {
        countdown.textContent = 'QR Expired';
        setQrStatus('warning', '<i class="fa-solid fa-triangle-exclamation"></i> QR expired. Generate a new QR before scanning.');
        stopQrStatusPolling();
        if (refreshBtn) {
          refreshBtn.disabled = false;
          refreshBtn.querySelector('.btn-label').innerHTML = '<i class="fa-solid fa-rotate"></i> Generate New QR';
        }
        clearInterval(qrCountdownTimer);
        return;
      }
      countdown.textContent = `QR expires in: ${formatCountdown(expiresAt)}`;
      if (refreshBtn) refreshBtn.disabled = false;
    };

    tick();
    qrCountdownTimer = setInterval(tick, 1000);
    if (refreshBtn) refreshBtn.onclick = () => loadQrToken(stage, true);
  }

  async function loadQrToken(stage, isRefresh) {
    const code = document.getElementById('journeyQrCode');
    const refreshBtn = document.getElementById('refreshQrBtn');
    if (!code || !selectedId) return;
    stopQrStatusPolling();
    setButtonLoading(refreshBtn, true, '<i class="fa-solid fa-circle-notch fa-spin"></i> Generating');
    code.innerHTML = '<div class="journey-qr-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Generating QR...</div>';
    setQrStatus('info', '<i class="fa-solid fa-clock"></i> Generating secure QR token...');
    try {
      const data = await stage.create(selectedId);
      if (!data.qrToken || !data.expiresAt) throw new Error(QRVerification.UNAVAILABLE_MESSAGE);
      code.innerHTML = '';
      if (!window.QRCode) throw new Error('QR display library is unavailable. Please try again or use OTP.');
      new window.QRCode(code, {
        text: String(data.qrToken),
        width: 220,
        height: 220,
        correctLevel: window.QRCode.CorrectLevel.M,
      });
      setQrStatus('info', '<i class="fa-solid fa-hourglass-half"></i> Waiting for traveler to scan...');
      startQrCountdown(data.expiresAt, stage);
      startQrStatusPolling(stage);
      if (isRefresh) window.showToast(`${stage.label} QR refreshed.`, 'success');
    } catch (err) {
      code.innerHTML = '<div class="journey-qr-placeholder"><i class="fa-solid fa-qrcode"></i></div>';
      setQrStatus('error', `<i class="fa-solid fa-circle-exclamation"></i> ${escapeHTML(err.message || QRVerification.UNAVAILABLE_MESSAGE)}`);
    } finally {
      setButtonLoading(refreshBtn, false);
    }
  }

  function openJourneyQrDisplay(action) {
    ensureQrModal();
    const stage = qrStageFromAction(action);
    const modal = document.getElementById('journeyQrModal');
    renderQrDisplayShell(stage);
    modal.hidden = false;
    loadQrToken(stage, false);
  }

  function renderQrScannerShell(stage) {
    document.getElementById('journeyQrTitle').textContent = `${stage.label} Verification`;
    document.getElementById('journeyQrMessage').textContent = `Open device camera and scan the ${stage.label.toLowerCase()} QR code.`;
    document.getElementById('journeyQrBody').innerHTML = `
      <div class="journey-qr-label">${stage.label} QR Scanner</div>
      <div class="journey-qr-scanner" id="qrScannerViewport">
        <video id="qrScannerVideo" muted playsinline></video>
        <div class="journey-qr-placeholder" id="qrScannerPlaceholder"><i class="fa-solid fa-camera"></i></div>
      </div>
      <p class="journey-qr-note">Camera permission is requested only after pressing Scan.</p>
    `;
    document.getElementById('journeyQrActions').innerHTML = `
      <button type="button" class="btn-primary btn-primary--inline" id="startQrScanBtn">
        <span class="btn-label"><i class="fa-solid fa-camera"></i> Scan ${stage.label} QR</span>
        <span class="spinner" aria-hidden="true"></span>
      </button>
      <span class="journey-qr-fallback-label">${stage.purpose === 'pickup' ? "Can't scan?" : 'Having trouble?'}</span>
      <button type="button" class="btn-ghost" id="qrOtpFallbackBtn"><i class="fa-solid fa-key"></i> Verify using OTP</button>
    `;
    document.getElementById('startQrScanBtn').onclick = () => startQrScanner(stage);
    document.getElementById('qrOtpFallbackBtn').onclick = () => {
      closeJourneyQrModal();
      openJourneyOtpModal(stage.otpAction);
    };
  }

  async function stopQrScanner() {
    try {
      if (activeScannerControls) activeScannerControls.stop();
    } catch (err) {}
    const video = document.getElementById('qrScannerVideo');
    if (video?.srcObject) {
      video.srcObject.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    }
    activeScanner = null;
    activeScannerControls = null;
  }

  async function handleQrDetected(stage, decodedText) {
    if (scannerLocked) return;
    scannerLocked = true;
    setQrStatus('info', '<i class="fa-solid fa-qrcode"></i> QR detected. Verifying...');
    await stopQrScanner();
    const startBtn = document.getElementById('startQrScanBtn');
    if (startBtn) startBtn.disabled = true;
    try {
      const data = await stage.verify(selectedId, decodedText);
      setQrStatus('success', stageSuccessMessage(stage, data.message));
      if (data.parcel) {
        const index = parcels.findIndex((parcel) => String(parcel.id) === String(selectedId));
        if (index >= 0) parcels[index] = data.parcel;
      } else {
        await refreshParcel(selectedId).catch(() => {});
      }
      window.showToast(data.message || `${stage.label} verified successfully.`, 'success');
      selectParcel(selectedId);
    } catch (err) {
      scannerLocked = false;
      if (startBtn) startBtn.disabled = false;
      setQrStatus('error', `<i class="fa-solid fa-circle-exclamation"></i> ${escapeHTML(err.message || 'Invalid QR. Please try again or use OTP.')}`);
    }
  }

  async function startQrScanner(stage) {
    const startBtn = document.getElementById('startQrScanBtn');
    if (!selectedId || scannerLocked) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setQrStatus('error', '<i class="fa-solid fa-video-slash"></i> Camera unavailable on this browser. Use OTP instead.');
      return;
    }
    if (!window.ZXingBrowser?.BrowserQRCodeReader) {
      setQrStatus('error', '<i class="fa-solid fa-circle-exclamation"></i> QR scanner library is unavailable. Please try again or use OTP.');
      return;
    }

    setButtonLoading(startBtn, true, '<i class="fa-solid fa-camera"></i> Requesting camera');
    setQrStatus('info', '<i class="fa-solid fa-camera"></i> Requesting camera permission...');
    try {
      await stopQrScanner();
      const video = document.getElementById('qrScannerVideo');
      const placeholder = document.getElementById('qrScannerPlaceholder');
      activeScanner = new window.ZXingBrowser.BrowserQRCodeReader();
      activeScannerControls = await activeScanner.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } } },
        video,
        (result) => {
          if (result) handleQrDetected(stage, result.getText());
        }
      );
      if (placeholder) placeholder.hidden = true;
      setQrStatus('info', '<i class="fa-solid fa-camera"></i> Scanner active. Point the camera at the QR code.');
    } catch (err) {
      setQrStatus('error', '<i class="fa-solid fa-video-slash"></i> Camera unavailable or permission was denied. Use OTP instead.');
      await stopQrScanner();
    } finally {
      setButtonLoading(startBtn, false);
    }
  }

  function openJourneyQrScanner(action) {
    ensureQrModal();
    const stage = qrStageFromAction(action);
    const modal = document.getElementById('journeyQrModal');
    scannerLocked = false;
    stopQrStatusPolling();
    renderQrScannerShell(stage);
    setQrStatus('info', '<i class="fa-solid fa-circle-info"></i> Press Scan when you are ready.');
    modal.hidden = false;
  }

  let otpTimer = null;
  function ensureOtpModal() {
    if (document.getElementById('journeyOtpModal')) return;
    document.body.insertAdjacentHTML('beforeend', `<div class="journey-otp-modal" id="journeyOtpModal" hidden><div class="journey-otp-backdrop"></div><div class="journey-otp-card" role="dialog" aria-modal="true" aria-labelledby="journeyOtpTitle"><button class="journey-otp-close" type="button" aria-label="Close">&times;</button><div class="journey-otp-icon"><i class="fa-solid fa-shield-halved"></i></div><h2 id="journeyOtpTitle">Verify Parcel</h2><p id="journeyOtpMessage"></p><div class="journey-otp-dest" id="journeyOtpDest"></div><input id="journeyOtpInput" class="journey-otp-input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" aria-label="6 digit OTP"><div class="journey-otp-error" id="journeyOtpError"></div><button class="btn-primary btn-primary--inline journey-otp-verify" id="journeyOtpVerify" type="button">Verify OTP</button><button class="journey-otp-resend" id="journeyOtpResend" type="button" disabled>Resend OTP in 60s</button><p class="journey-otp-note">The OTP is valid for 10 minutes and can be tried up to 5 times.</p></div></div>`);
    const modal=document.getElementById('journeyOtpModal');
    modal.querySelector('.journey-otp-close').onclick=closeJourneyOtpModal;
    modal.querySelector('.journey-otp-backdrop').onclick=closeJourneyOtpModal;
    document.getElementById('journeyOtpInput').addEventListener('input',e=>e.target.value=e.target.value.replace(/\D/g,'').slice(0,6));
  }
  function closeJourneyOtpModal(){ const m=document.getElementById('journeyOtpModal'); if(m)m.hidden=true; if(otpTimer)clearInterval(otpTimer); }
  function startResendCountdown(action, seconds=60){
    const btn=document.getElementById('journeyOtpResend'); let left=seconds; btn.disabled=true; btn.textContent=`Resend OTP in ${left}s`; if(otpTimer)clearInterval(otpTimer);
    otpTimer=setInterval(()=>{ left--; if(left<=0){clearInterval(otpTimer);btn.disabled=false;btn.textContent='Resend OTP';btn.onclick=()=>requestJourneyOtp(action,true);} else btn.textContent=`Resend OTP in ${left}s`; },1000);
  }
  async function requestJourneyOtp(action, isResend=false){
    const purpose=action==='confirm-pickup'?'pickup':'delivery'; const err=document.getElementById('journeyOtpError'); err.textContent='';
    try { const res=await fetch(`${API_BASE}/tracking/${encodeURIComponent(selectedId)}/otp/${purpose}/request`,{method:'POST',headers:authHeaders()}); const data=await res.json(); if(!res.ok)throw new Error(data.error||'Could not send OTP.');
      const destinations=[data.sentTo?.email].filter(Boolean); document.getElementById('journeyOtpDest').textContent=destinations.length?`Sent to ${destinations.join(' and ')}`:'Sent to the sender';
      if(isResend) window.showToast('A new OTP was sent to the sender.','success'); startResendCountdown(action,data.resendAfterSeconds||60);
    } catch(e){ err.textContent=e.message; }
  }
  async function openJourneyOtpModal(action){
    ensureOtpModal(); const pickup=action==='confirm-pickup'; const modal=document.getElementById('journeyOtpModal');
    document.getElementById('journeyOtpTitle').textContent=pickup?'Verify Parcel Pickup':'Verify Parcel Delivery';
    document.getElementById('journeyOtpMessage').textContent=pickup?'Ask the sender for the OTP sent to their registered email address, then enter it below.':'After handing over the parcel, ask the sender for the OTP sent to their registered email address.';
    document.getElementById('journeyOtpInput').value=''; document.getElementById('journeyOtpError').textContent=''; document.getElementById('journeyOtpDest').textContent='Sending OTP…'; modal.hidden=false;
    document.getElementById('journeyOtpVerify').onclick=()=>verifyJourneyOtp(action); await requestJourneyOtp(action); document.getElementById('journeyOtpInput').focus();
  }
  async function verifyJourneyOtp(action){
    const purpose=action==='confirm-pickup'?'pickup':'delivery'; const otp=document.getElementById('journeyOtpInput').value; const err=document.getElementById('journeyOtpError'); const btn=document.getElementById('journeyOtpVerify');
    if(!/^\d{6}$/.test(otp)){err.textContent='Enter the complete 6-digit OTP.';return;} btn.disabled=true; err.textContent='';
    try { const res=await fetch(`${API_BASE}/tracking/${encodeURIComponent(selectedId)}/otp/${purpose}/verify`,{method:'POST',headers:{...authHeaders(),'Content-Type':'application/json'},body:JSON.stringify({otp})}); const data=await res.json(); if(!res.ok)throw new Error(data.error||'OTP verification failed.');
      const i=parcels.findIndex(p=>String(p.id)===String(selectedId)); if(i>=0)parcels[i]=data.parcel; closeJourneyOtpModal(); window.showToast(data.message,'success'); selectParcel(selectedId);
    } catch(e){err.textContent=e.message;} finally {btn.disabled=false;}
  }

  async function handleStatusAction(e) {
    const button = e.currentTarget;
    const action = button.dataset.action;
    if (!selectedId || !action) return;

    setButtonLoading(button, true);
    showAlert('');
    try {
      const res = await fetch(`${API_BASE}/tracking/${encodeURIComponent(selectedId)}/actions/${encodeURIComponent(action)}`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        showAlert(data.error || 'Could not update this journey.');
        return;
      }

      const index = parcels.findIndex((parcel) => String(parcel.id) === String(selectedId));
      if (index >= 0) parcels[index] = data.parcel;
      window.showToast(data.message || 'Journey updated.', 'success');
      selectParcel(selectedId);
    } catch (err) {
      console.error(err);
      showAlert(err.message || 'Could not reach the server.');
    } finally {
      setButtonLoading(button, false);
    }
  }


  async function loadByOrderId(orderId, updateUrl = false) {
    const normalized = String(orderId || '').trim().toUpperCase();
    if (!/^TB-\d{8}-[A-Z0-9]{5}$/.test(normalized)) { showAlert('Enter a valid Order ID.'); return; }
    if (orderTrackInput) orderTrackInput.value = normalized;
    show(loading, true); show(empty, false); show(content, false); showAlert('');
    try {
      const res = await fetch(`${API_BASE}/track/order/${encodeURIComponent(normalized)}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) { showAlert(data.error || 'Could not find this parcel.'); show(empty, true); return; }
      parcels = [data.parcel]; selectedId = data.parcel.id; show(content, true); selectParcel(selectedId);
      if (updateUrl) history.pushState({}, '', `track.html?orderId=${encodeURIComponent(normalized)}`);
    } catch (err) { console.error(err); showAlert('Could not reach the server.'); show(empty, true); }
    finally { show(loading, false); }
  }

  async function loadTracking(preferredId) {
    show(loading, true);
    show(empty, false);
    show(content, false);
    showAlert('');

    try {
      const res = await fetch(`${API_BASE}/tracking`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) {
        showAlert(data.error || 'Could not load parcel journeys.');
        show(empty, true);
        return;
      }

      // The journey dropdown is only for active parcels. Delivered/cancelled parcels belong in History.
      parcels = (data.parcels || []).filter((parcel) => parcel.status !== 'delivered' && parcel.status !== 'cancelled');
      if (!parcels.length) {
        show(empty, true);
        return;
      }

      show(content, true);
      const match = preferredId && parcels.some((parcel) => String(parcel.id) === String(preferredId));
      selectParcel(match ? preferredId : parcels[0].id);
    } catch (err) {
      console.error(err);
      showAlert('Could not reach the server. Please try again.');
      show(empty, true);
    } finally {
      show(loading, false);
    }
  }

  selector?.addEventListener('change', () => selectParcel(selector.value));

  messageBtn?.addEventListener('click', () => {
    if (!selectedId) return;
    window.location.href = `messages.html?parcel=${encodeURIComponent(selectedId)}`;
  });

  audioCallBtn?.addEventListener('click', () => {
    if (!selectedId) return;
    window.location.href = `messages.html?parcel=${encodeURIComponent(selectedId)}&call=audio`;
  });

  window.addEventListener('focus', () => {
    if (selectedId) {
      refreshParcel(selectedId)
        .then(() => selectParcel(selectedId))
        .catch(() => {});
    }
  });

  orderTrackForm?.addEventListener('submit', (e) => { e.preventDefault(); loadByOrderId(orderTrackInput.value, true); });



  // Desktop track workspace: scrolling anywhere on the Track Parcel page moves only
  // the cards below the fixed PARCEL JOURNEY label. No separate scrollbar is shown.
  const trackView = document.getElementById('view-track');
  const trackSideScroll = document.getElementById('trackSideScroll');
  if (trackView && trackSideScroll) {
    trackView.addEventListener('wheel', (event) => {
      if (!window.matchMedia('(min-width: 1181px)').matches) return;
      const maxScroll = trackSideScroll.scrollHeight - trackSideScroll.clientHeight;
      if (maxScroll <= 0) return;
      event.preventDefault();
      trackSideScroll.scrollTop += event.deltaY;
    }, { passive: false });
  }

  const initialParams = new URLSearchParams(window.location.search);
  const initialOrderId = initialParams.get('orderId');
  const initialParcelId = initialParams.get('id');
  if (initialOrderId) loadByOrderId(initialOrderId);
  else loadTracking(initialParcelId);
})();
