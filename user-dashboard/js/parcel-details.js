(function () {
  'use strict';

  const { API_ORIGIN, authHeaders, escapeHTML, formatPaise, statusBadge, setButtonLoading } = window.TravelBuddy;
  const API_BASE = `${API_ORIGIN}/api/postparcel`;

  // UI Elements
  const detailsLoading = document.getElementById('detailsLoading');
  const detailsError = document.getElementById('detailsError');
  const detailsErrorMessage = document.getElementById('detailsErrorMessage');
  const detailsShell = document.getElementById('detailsShell');

  // Header Elements
  const orderIdText = document.getElementById('orderIdText');
  const statusBadgeWrap = document.getElementById('statusBadgeWrap');
  const userRoleBadge = document.getElementById('userRoleBadge');
  const liveTrackLink = document.getElementById('liveTrackLink');
  const chatCounterpartBtn = document.getElementById('chatCounterpartBtn');
  const cancelParcelBtn = document.getElementById('cancelParcelBtn');
  const reportIssueBtn = document.getElementById('reportIssueBtn');
  const reviewBtn = document.getElementById('reviewBtn');

  // Dynamic Action Banner
  const actionBanner = document.getElementById('actionBanner');
  const actionBannerTitle = document.getElementById('actionBannerTitle');
  const actionBannerDesc = document.getElementById('actionBannerDesc');
  const actionBannerButtons = document.getElementById('actionBannerButtons');

  // Timeline
  const timelineStepsList = document.getElementById('timelineStepsList');

  // Route & Specs
  const pickupCityText = document.getElementById('pickupCityText');
  const pickupPointText = document.getElementById('pickupPointText');
  const deliveryCityText = document.getElementById('deliveryCityText');
  const deliveryPointText = document.getElementById('deliveryPointText');
  const parcelDescText = document.getElementById('parcelDescText');
  const parcelWeightText = document.getElementById('parcelWeightText');
  const parcelDateText = document.getElementById('parcelDateText');
  const parcelCreatedText = document.getElementById('parcelCreatedText');

  // Counterpart
  const counterpartTitle = document.getElementById('counterpartTitle');
  const counterpartAvatar = document.getElementById('counterpartAvatar');
  const counterpartName = document.getElementById('counterpartName');
  const counterpartVerified = document.getElementById('counterpartVerified');
  const counterpartRating = document.getElementById('counterpartRating');
  const counterpartDeliveries = document.getElementById('counterpartDeliveries');
  const counterpartChatBtn = document.getElementById('counterpartChatBtn');

  // Financials
  const finGrossPrice = document.getElementById('finGrossPrice');
  const finPlatformFee = document.getElementById('finPlatformFee');
  const finTravelerEarning = document.getElementById('finTravelerEarning');
  const finPaymentStatusTag = document.getElementById('finPaymentStatusTag');

  // Modals
  const cancelModal = document.getElementById('cancelModal');
  const cancelModalClose = document.getElementById('cancelModalClose');
  const cancelModalDismiss = document.getElementById('cancelModalDismiss');
  const confirmCancelBtn = document.getElementById('confirmCancelBtn');
  const cancelReason = document.getElementById('cancelReason');

  const otpModal = document.getElementById('otpModal');
  const otpModalClose = document.getElementById('otpModalClose');
  const otpModalTitle = document.getElementById('otpModalTitle');
  const otpModalSub = document.getElementById('otpModalSub');
  const otpInput = document.getElementById('otpInput');
  const submitOtpBtn = document.getElementById('submitOtpBtn');

  const reviewModal = document.getElementById('reviewModal');
  const reviewModalClose = document.getElementById('reviewModalClose');
  const starRatingBox = document.getElementById('starRatingBox');
  const starRatingLabel = document.getElementById('starRatingLabel');
  const reviewComment = document.getElementById('reviewComment');
  const submitReviewBtn = document.getElementById('submitReviewBtn');
  const reviewTargetName = document.getElementById('reviewTargetName');

  const reportModal = document.getElementById('reportModal');
  const reportModalClose = document.getElementById('reportModalClose');
  const reportReason = document.getElementById('reportReason');
  const reportDescription = document.getElementById('reportDescription');
  const submitReportBtn = document.getElementById('submitReportBtn');

  // New Elements for Functional Parity
  const roleBadgePremium = document.getElementById('roleBadgePremium');
  const roleBadgeText = document.getElementById('roleBadgeText');
  const pathFromCity = document.getElementById('pathFromCity');
  const pathToCity = document.getElementById('pathToCity');
  const specWeight = document.getElementById('specWeight');
  const specEarning = document.getElementById('specEarning');
  const specEarningLabel = document.getElementById('specEarningLabel');
  const changePickupBtn = document.getElementById('changePickupBtn');
  const changeDeliveryBtn = document.getElementById('changeDeliveryBtn');
  const nextActionCard = document.getElementById('nextActionCard');
  const recFromCity = document.getElementById('recFromCity');
  const recToCity = document.getElementById('recToCity');

  const bannersContainer = document.getElementById('contextualBannersContainer');
  const counterpartBox = document.getElementById('counterpartBox');

  const cancellationCard = document.getElementById('cancellationCard');
  const cancelOriginalPrice = document.getElementById('cancelOriginalPrice');
  const cancelFeeRow = document.getElementById('cancelFeeRow');
  const cancelFeeValue = document.getElementById('cancelFeeValue');
  const cancelCompensationRow = document.getElementById('cancelCompensationRow');
  const cancelCompensationValue = document.getElementById('cancelCompensationValue');
  const cancelNetLabel = document.getElementById('cancelNetLabel');
  const cancelNetValue = document.getElementById('cancelNetValue');
  const refundStatusPill = document.getElementById('refundStatusPill');

  const locationRequestCard = document.getElementById('locationRequestCard');
  const reqLocationType = document.getElementById('reqLocationType');
  const reqLocationName = document.getElementById('reqLocationName');
  const reqLocationAddress = document.getElementById('reqLocationAddress');
  const reqReasonBox = document.getElementById('reqReasonBox');
  const approveLocationBtn = document.getElementById('approveLocationBtn');
  const declineLocationBtn = document.getElementById('declineLocationBtn');

  const locationModal = document.getElementById('locationModal');
  const locationModalClose = document.getElementById('locationModalClose');
  const locationModalTitle = document.getElementById('locationModalTitle');
  const useCurrentLocationBtn = document.getElementById('useCurrentLocationBtn');
  const pickOnMapBtn = document.getElementById('pickOnMapBtn');
  const locationPickerMap = document.getElementById('locationPickerMap');
  const recommendedPointsList = document.getElementById('recommendedPointsList');
  const selectedPointCard = document.getElementById('selectedPointCard');
  const selectedPointName = document.getElementById('selectedPointName');
  const selectedPointAddress = document.getElementById('selectedPointAddress');
  const confirmLocationBtn = document.getElementById('confirmLocationBtn');
  const changingWarning = document.getElementById('changingWarning');
  const compatibilityBadge = document.getElementById('compatibilityBadge');
  const detourWarningBox = document.getElementById('detourWarningBox');
  const verificationSuccessOverlay = document.getElementById('verificationSuccessOverlay');

  const profileModal = document.getElementById('profileModal');
  const profileModalClose = document.getElementById('profileModalClose');
  const locationChangeModal = document.getElementById('locationChangeModal');
  const locationChangeModalClose = document.getElementById('locationChangeModalClose');
  const chosenLocationText = document.getElementById('chosenLocationText');
  const openLocationPickerBtn = document.getElementById('openLocationPickerBtn');
  const submitChangeRequestBtn = document.getElementById('submitChangeRequestBtn');
  const changeReasonText = document.getElementById('changeReason');

  const qrModal = document.getElementById('qrModal');
  const qrModalClose = document.getElementById('qrModalClose');
  const qrLoadingState = document.getElementById('qrLoadingState');
  const qrReadyState = document.getElementById('qrReadyState');
  const qrCodeContainer = document.getElementById('qrCodeContainer');
  const qrExpiryTime = document.getElementById('qrExpiryTime');

  const receiptGenModal = document.getElementById('receiptGenModal');
  const receiptPreviewModal = document.getElementById('receiptPreviewModal');
  const receiptPreviewContent = document.getElementById('receiptPreviewContent');
  const downloadReceiptBtn = document.getElementById('downloadReceiptBtn');
  const closeReceiptPreviewBtn = document.getElementById('closeReceiptPreviewBtn');
  const receiptPreviewModalClose = document.getElementById('receiptPreviewModalClose');

  // State
  let parcelData = null;
  let currentUserId = null;
  let currentOtpPurpose = 'pickup';
  let otpCooldownSeconds = 0;
  let otpCooldownTimer = null;
  let selectedRating = 5;
  let map = null;
  let mapMarker = null;
  let selectedLocation = null;
  let activePickerPurpose = 'pickup'; // pickup or delivery
  let isRequestChange = false; // true if sender is requesting a change
  let qrExpiryTimer = null;

  function generateSecureQr(purpose) {
    if (!qrModal) return;
    qrModal.classList.remove('hidden');
    qrLoadingState.classList.remove('hidden');
    qrReadyState.classList.add('hidden');
    qrCodeContainer.innerHTML = '';

    setTimeout(async () => {
      try {
        const url = `${API_BASE}/${parcelData.id}/${purpose}-qr`;
        const res = await fetch(url, { method: 'POST', headers: authHeaders() });
        const data = await res.json();

        if (!res.ok) throw new Error(data.message || 'QR generation failed');

        qrLoadingState.classList.add('hidden');
        qrReadyState.classList.remove('hidden');

        new QRCode(qrCodeContainer, {
          text: data.qrToken,
          width: 200,
          height: 200,
          colorDark : "#0f172a",
          colorLight : "#ffffff",
          correctLevel : QRCode.CorrectLevel.H
        });

        startQrExpiryTimer(data.expiresAt);
      } catch (err) {
        window.showToast(err.message, 'error');
        qrModal.classList.add('hidden');
      }
    }, 1500); // Functional Parity: Simulate "Securing" delay
  }

  function startQrExpiryTimer(expiryIso) {
    const expiry = new Date(expiryIso);
    clearInterval(qrExpiryTimer);

    const update = () => {
      const now = new Date();
      const diff = expiry - now;
      if (diff <= 0) {
        qrExpiryTime.textContent = 'Expired';
        clearInterval(qrExpiryTimer);
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      qrExpiryTime.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    update();
    qrExpiryTimer = setInterval(update, 1000);
  }

  function getParcelIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id') || params.get('orderId') || null;
  }

  function formatDateTime(iso) {
    if (!iso) return 'Pending';
    if (window.TravelBuddyDate) return window.TravelBuddyDate.formatDateTime(iso);
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Pending';
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  async function loadParcelDetails() {
    const targetId = getParcelIdFromUrl();
    if (!targetId) {
      showError('No parcel specified. Please select a parcel from the list.');
      return;
    }

    if (detailsLoading) detailsLoading.classList.remove('hidden');
    if (detailsError) detailsError.classList.add('hidden');
    if (detailsShell) detailsShell.classList.add('hidden');

    try {
      const user = await window.TravelBuddy.getCurrentUser();
      currentUserId = user?._id || user?.id || '';

      const isOrderId = targetId.startsWith('TB-');
      const url = isOrderId
        ? `${API_BASE}/track/order/${encodeURIComponent(targetId)}`
        : `${API_BASE}/tracking/${encodeURIComponent(targetId)}`;

      const res = await fetch(url, { headers: authHeaders() });
      const data = await res.json();

      if (!res.ok) {
        showError(data.error || 'You are not authorized to view this parcel or it does not exist.');
        return;
      }

      parcelData = data.parcel;
      renderDetails(parcelData);
    } catch (err) {
      console.error('Failed to load parcel details:', err);
      showError('Could not reach the server to load parcel details.');
    } finally {
      if (detailsLoading) detailsLoading.classList.add('hidden');
    }
  }

  function showError(msg) {
    if (detailsLoading) detailsLoading.classList.add('hidden');
    if (detailsShell) detailsShell.classList.add('hidden');
    if (detailsError) {
      detailsError.classList.remove('hidden');
      if (detailsErrorMessage) detailsErrorMessage.textContent = msg;
    }
  }

  function renderDetails(p) {
    if (!p) return;
    if (detailsShell) detailsShell.classList.remove('hidden');

    // Header
    orderIdText.textContent = p.parcelNumber || p.orderId || p.id;
    statusBadgeWrap.innerHTML = statusBadge(p.status);

    const isSender = p.role === 'sender';
    userRoleBadge.innerHTML = isSender
      ? '<span class="parcel-role-badge is-sender"><i class="fa-solid fa-paper-plane"></i> You: Sender</span>'
      : '<span class="parcel-role-badge is-traveler"><i class="fa-solid fa-person-walking-luggage"></i> You: Traveler</span>';

    // Premium Role Badge Parity
    if (roleBadgePremium) {
      roleBadgePremium.classList.remove('hidden', 'is-sender', 'is-traveler');
      roleBadgePremium.classList.add(isSender ? 'is-sender' : 'is-traveler');
      if (roleBadgeText) roleBadgeText.textContent = isSender ? 'YOU ARE THE SENDER' : 'YOU ARE THE TRAVELER';
      const roleIcon = roleBadgePremium.querySelector('i');
      if (roleIcon) roleIcon.className = isSender ? 'fa-solid fa-person' : 'fa-solid fa-person-walking-luggage';
    }

    if (liveTrackLink) {
      liveTrackLink.href = `track.html?id=${encodeURIComponent(p.id)}`;
    }

    // Address Path Viz
    if (pathFromCity) pathFromCity.textContent = p.fromCity || '---';
    if (pathToCity) pathToCity.textContent = p.toCity || '---';

    // Specs Grid
    if (specWeight) {
      const w = Number(p.weight) || 0;
      specWeight.textContent = `${w > 0 ? w : '---'} kg`;
    }
    if (specEarning) {
      const e = p.financials?.netEarnings ?? p.travelerEarning;
      specEarning.textContent = window.TravelBuddy.formatPaise(e || 0);
      specEarningLabel.textContent = isSender ? 'Reward' : 'Earning';
    }

    // Cancel Button visibility
    const isCancellable = ['pending', 'accepted', 'pickup_point_pending', 'pickup_point_selected'].includes(p.status);
    if (cancelParcelBtn) {
      cancelParcelBtn.style.display = isCancellable ? 'inline-flex' : 'none';
    }

    // Change Location Buttons
    if (changePickupBtn) {
       const isLocked = p.pickupPoint?.locked || ['pickup_confirmed', 'in_transit', 'delivered'].includes(p.status);
       const canChangePickup = !isSender && ['accepted', 'pickup_point_pending', 'pickup_point_selected'].includes(p.status) && !isLocked;
       const senderCanRequestChange = isSender && p.status === 'pickup_point_selected' && p.pickupPoint?.locked;

       changePickupBtn.style.display = (canChangePickup || senderCanRequestChange) ? 'block' : 'none';
       changePickupBtn.textContent = senderCanRequestChange ? 'Request Change' : 'Change';
       changePickupBtn.onclick = () => {
         if (senderCanRequestChange) openLocationChangeRequest('pickup');
         else window.openLocationPicker('pickup', false);
       };

       if (isLocked && !senderCanRequestChange) {
          pickupPointText.innerHTML = `<i class="fa-solid fa-lock" style="font-size:10px; opacity:0.6; margin-right:4px;"></i> ${escapeHTML(p.pickupPoint?.name || '---')}`;
       } else {
          pickupPointText.textContent = p.pickupPoint?.name || p.pickupPoint?.address || (p.status === 'pending' ? 'Will be arranged once accepted' : 'Exact pickup location arranged in chat');
       }
    }
    if (changeDeliveryBtn) {
       const isLocked = p.deliveryPoint?.locked || ['delivered'].includes(p.status);
       const canChangeDelivery = !isSender && ['in_transit', 'delivery_point_pending', 'delivery_point_selected'].includes(p.status) && !isLocked;
       const senderCanRequestChange = isSender && p.status === 'delivery_point_selected' && p.deliveryPoint?.locked;

       changeDeliveryBtn.style.display = (canChangeDelivery || senderCanRequestChange) ? 'block' : 'none';
       changeDeliveryBtn.textContent = senderCanRequestChange ? 'Request Change' : 'Change';
       changeDeliveryBtn.onclick = () => {
         if (senderCanRequestChange) openLocationChangeRequest('delivery');
         else window.openLocationPicker('delivery', false);
       };

       if (isLocked && !senderCanRequestChange) {
          deliveryPointText.innerHTML = `<i class="fa-solid fa-lock" style="font-size:10px; opacity:0.6; margin-right:4px;"></i> ${escapeHTML(p.deliveryPoint?.name || '---')}`;
       } else {
          deliveryPointText.textContent = p.deliveryPoint?.name || p.deliveryPoint?.address || (p.status === 'pending' ? 'Will be arranged once accepted' : 'Exact delivery location arranged in chat');
       }
    }

    // Location Change Request Card
    if (locationRequestCard) {
      const req = p.locationChangeRequest;
      if (!isSender && req && req.status === 'pending') {
        locationRequestCard.classList.remove('hidden');
        reqLocationType.textContent = req.type;
        reqLocationName.textContent = req.newLocation.name;
        reqLocationAddress.textContent = req.newLocation.formattedAddress;
        reqReasonBox.textContent = req.reason ? `"${req.reason}"` : 'No reason provided.';

        approveLocationBtn.onclick = () => handleLocationRequest('approve');
        declineLocationBtn.onclick = () => handleLocationRequest('decline');
      } else {
        locationRequestCard.classList.add('hidden');
      }
    }

    // Cancellation Summary
    if (cancellationCard) {
      if (p.status.includes('cancel')) {
        cancellationCard.style.display = 'block';
        cancelOriginalPrice.textContent = window.TravelBuddy.formatPaise(p.financials?.grossAmount || p.price);

        if (isSender) {
          cancelFeeRow.style.display = 'flex';
          cancelCompensationRow.style.display = 'none';
          cancelFeeValue.textContent = `-${window.TravelBuddy.formatPaise(p.cancellationFee)}`;
          cancelNetLabel.textContent = 'Net Refund';
          const refund = (p.financials?.grossAmount || p.price) - p.cancellationFee;
          cancelNetValue.textContent = window.TravelBuddy.formatPaise(refund);
        } else {
          cancelFeeRow.style.display = 'none';
          cancelCompensationRow.style.display = 'flex';
          cancelCompensationValue.textContent = `+${window.TravelBuddy.formatPaise(p.cancellationTravelerCompensation)}`;
          cancelNetLabel.textContent = 'Total Compensation';
          cancelNetValue.textContent = window.TravelBuddy.formatPaise(p.cancellationTravelerCompensation);
        }

        refundStatusPill.innerHTML = p.paymentStatus === 'refunded'
          ? '<i class="fa-solid fa-circle-check"></i> Processed'
          : '<i class="fa-solid fa-clock"></i> Processing';
      } else {
        cancellationCard.style.display = 'none';
      }
    }

    // Recommendation Card
    if (nextActionCard) {
       if (p.status === 'delivered') {
          nextActionCard.classList.remove('hidden');
          recFromCity.textContent = p.fromCity;
          recToCity.textContent = p.toCity;
       } else {
          nextActionCard.classList.add('hidden');
       }
    }

    // Review Button visibility
    if (reviewBtn) {
      reviewBtn.style.display = (p.status === 'delivered' && !p.isRated) ? 'inline-flex' : 'none';
    }

    // Chat Lock Enforcement
    const isCompleted = ['delivered', 'cancelled', 'cancelled_by_sender', 'cancelled_by_traveler', 'cancelled_by_system'].includes(p.status);
    if (isCompleted) {
      if (chatCounterpartBtn) {
        chatCounterpartBtn.disabled = true;
        chatCounterpartBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Chat Locked';
        chatCounterpartBtn.title = 'Messaging is unavailable for completed parcels.';
      }
      if (counterpartChatBtn) {
        counterpartChatBtn.disabled = true;
        counterpartChatBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Chat Locked';
      }
    }

    // Timeline Rendering
    renderTimeline(p);

    // Contextual Banners Parity
    renderContextualBanners(p, isSender);

    // Action Banner Rendering
    renderActionBanner(p, isSender);

    // Route & Specs
    pickupCityText.textContent = p.fromCity || 'Pickup City';
    pickupPointText.textContent = p.pickupPoint?.name || p.pickupPoint?.address || (p.status === 'pending' ? 'Will be arranged once accepted' : 'Exact pickup location arranged in chat');

    deliveryCityText.textContent = p.toCity || 'Delivery City';
    deliveryPointText.textContent = p.deliveryPoint?.name || p.deliveryPoint?.address || (p.status === 'pending' ? 'Will be arranged once accepted' : 'Exact delivery location arranged in chat');

    parcelDescText.textContent = p.description || 'General Parcel';
    parcelWeightText.textContent = `${p.weight || 1} kg`;
    parcelDateText.textContent = formatDateTime(p.pickupDate || p.createdAt);
    parcelCreatedText.textContent = formatDateTime(p.createdAt);

    // Counterpart Profile
    renderCounterpart(p, isSender);

    // Money Journey
    renderMoneyJourney(p);

    // Financials
    // Canonical Unit: Backend always returns price/commission/earning in Paise.
    const financials = p.financials || {};
    const grossPaise = Number(financials.grossAmount ?? p.price ?? 0);
    const platformPaise = Number(financials.platformFee ?? p.platformCommission ?? Math.round(grossPaise * 0.1));
    const earningPaise = Number(financials.netEarnings ?? p.travelerEarning ?? (grossPaise - platformPaise));

    finGrossPrice.textContent = formatPaise(grossPaise);
    finPlatformFee.textContent = formatPaise(platformPaise);
    finTravelerEarning.textContent = formatPaise(earningPaise);

    if (p.status === 'delivered') {
      finPaymentStatusTag.className = 'tag tag--delivered';
      finPaymentStatusTag.textContent = 'Released to Traveler';
    } else if (p.status.includes('cancel')) {
      finPaymentStatusTag.className = 'tag tag--cancelled';
      finPaymentStatusTag.textContent = 'Refunded / Cancelled';
    } else {
      finPaymentStatusTag.className = 'tag tag--held';
      finPaymentStatusTag.textContent = 'Held in Escrow';
    }
  }

  function renderMoneyJourney(p) {
    const journey = p.paymentJourney;
    const panel = document.getElementById('moneyJourneyPanel');
    const list = document.getElementById('moneyJourneyList');
    if (!panel || !list) return;

    if (!journey || !journey.isHeld) {
      panel.style.display = 'none';
      return;
    }

    panel.style.display = 'block';
    list.innerHTML = journey.stages.map((st, idx) => {
      let itemClass = '';
      if (st.done) itemClass = 'is-done';
      else if (idx > 0 && journey.stages[idx-1].done) itemClass = 'is-current';

      return `
        <div class="money-item ${itemClass}">
          <div class="money-dot"></div>
          <div class="money-info">
            <span class="money-label">${escapeHTML(st.label)}</span>
            <span class="money-desc">${escapeHTML(st.desc)}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderTimeline(p) {
    const s = p.status;
    const stages = [
      { id: 'posted', title: 'Parcel Posted', time: p.createdAt, done: true },
      { id: 'accepted', title: 'Accepted by Traveler', time: p.acceptedAt, done: ['accepted', 'pickup_point_pending', 'pickup_point_selected', 'pickup_confirmed', 'in_transit', 'delivery_point_pending', 'delivery_point_selected', 'delivered'].includes(s) },
      { id: 'pickup', title: 'Pickup Confirmed', time: p.pickupConfirmedAt, done: ['pickup_confirmed', 'in_transit', 'delivery_point_pending', 'delivery_point_selected', 'delivered'].includes(s) },
      { id: 'transit', title: 'In Transit', time: p.inTransitAt, done: ['in_transit', 'delivery_point_pending', 'delivery_point_selected', 'delivered'].includes(s) },
      { id: 'delivered', title: s.includes('cancel') ? 'Cancelled' : 'Delivered & Completed', time: s.includes('cancel') ? p.cancelledAt : p.deliveredAt, done: ['delivered', 'cancelled', 'cancelled_by_sender', 'cancelled_by_traveler', 'cancelled_by_system'].includes(s) }
    ];

    if (!timelineStepsList) return;
    timelineStepsList.innerHTML = stages.map((st, idx) => {
      let itemClass = '';
      if (st.done) itemClass = 'is-done';
      else if (idx > 0 && stages[idx - 1].done) itemClass = 'is-current';

      const icon = st.done
        ? '<i class="fa-solid fa-check"></i>'
        : (itemClass === 'is-current' ? '<i class="fa-solid fa-circle"></i>' : '<i class="fa-regular fa-circle"></i>');

      return `
        <div class="timeline-step-item ${itemClass}">
          <div class="timeline-step-icon">${icon}</div>
          <div class="timeline-step-body">
            <h4 class="timeline-step-title">${escapeHTML(st.title)}</h4>
            <span class="timeline-step-time">${escapeHTML(formatDateTime(st.time))}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderContextualBanners(p, isSender) {
    if (!bannersContainer) return;
    bannersContainer.innerHTML = '';
    const s = p.status;

    const addBanner = (title, sub, icon, actionText, actionFn) => {
      const banner = document.createElement('div');
      banner.className = 'journey-action-box is-info';
      banner.style.margin = '0';
      banner.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:40px; height:40px; border-radius:50%; background:rgba(13,110,253,0.1); color:var(--primary); display:grid; place-items:center; font-size:18px;">
            <i class="fa-solid ${icon}"></i>
          </div>
          <div>
            <h4 style="margin:0; font-size:14px; font-weight:700;">${title}</h4>
            <p style="margin:2px 0 0; font-size:12px; color:var(--text-muted);">${sub}</p>
          </div>
        </div>
        ${actionText ? `<button type="button" class="btn-primary" style="height:36px; font-size:12px; padding:0 14px;">${actionText}</button>` : ''}
      `;
      if (actionFn && actionText) {
        banner.querySelector('button').onclick = actionFn;
      }
      bannersContainer.appendChild(banner);
    };

    if (!isSender) {
      if (s === 'pickup_point_pending') {
        addBanner('📍 Pickup Point Required', `Choose a convenient meeting point in ${p.fromCity.toUpperCase()}.`, 'fa-location-dot', 'Select Now', () => window.openLocationPicker('pickup', false));
      } else if (s === 'delivery_point_pending') {
        addBanner('🏠 Delivery Point Required', `Select the destination point in ${p.toCity.toUpperCase()}.`, 'fa-map-pin', 'Select Now', () => window.openLocationPicker('delivery', false));
      }
    }

    if (p.locationChangeRequest?.status === 'pending') {
      if (!isSender) {
        // Traveler sees notification of request (already handled by locationRequestCard, but banners are more standard)
        // For parity we keep locationRequestCard for now as it has approve/decline buttons.
      } else {
        addBanner('🔄 Location Change Pending', `Waiting for the traveler to respond to your change request.`, 'fa-clock');
      }
    }
  }

  function renderActionBanner(p, isSender) {
    if (!actionBanner) return;
    const s = p.status;

    if (s === 'pending') {
      actionBanner.className = 'journey-action-box is-info';
      actionBannerTitle.innerHTML = '<i class="fa-solid fa-hourglass-half"></i> Awaiting Traveler';
      actionBannerDesc.textContent = 'Your parcel is visible to travelers travelling on this route. You will be notified when someone accepts.';
      actionBannerButtons.innerHTML = `
        <a href="post.html" class="btn-ghost" style="text-decoration:none;"><i class="fa-solid fa-pen"></i> Edit Details</a>
      `;
      actionBanner.classList.remove('hidden');
    } else if (['accepted', 'pickup_point_pending', 'pickup_point_selected'].includes(s)) {
      actionBanner.className = 'journey-action-box';
      actionBannerTitle.innerHTML = '<i class="fa-solid fa-handshake"></i> Ready for Handover';
      if (isSender) {
        actionBannerDesc.textContent = 'Meet the traveler to hand over the parcel. Provide the pickup OTP or show the secure QR code.';
        actionBannerButtons.innerHTML = `
          <button type="button" class="btn-primary" onclick="window.generateSecureQr('pickup')"><i class="fa-solid fa-qrcode"></i> Show Pickup QR</button>
          <button type="button" class="btn-ghost" id="requestPickupOtpBtn"><i class="fa-solid fa-key"></i> Resend Pickup OTP</button>
        `;
      } else {
        const isPointNeeded = s === 'pickup_point_pending';
        actionBannerDesc.textContent = isPointNeeded
          ? 'Choose a convenient meeting point to collect the parcel from the sender.'
          : 'Collect the parcel from the sender. Verify the 6-digit handover OTP or scan their QR code to confirm.';
        actionBannerButtons.innerHTML = isPointNeeded
          ? `<button type="button" class="btn-primary" onclick="window.openLocationPicker('pickup', false)"><i class="fa-solid fa-location-dot"></i> Select Pickup Point</button>`
          : `
          <button type="button" class="btn-primary" id="openVerifyPickupOtpBtn"><i class="fa-solid fa-key"></i> Verify Pickup OTP</button>
          <a href="track.html?id=${encodeURIComponent(p.id)}&action=scan" class="btn-ghost" style="text-decoration:none;"><i class="fa-solid fa-camera"></i> Scan Sender QR</a>
        `;
      }
      actionBanner.classList.remove('hidden');
    } else if (s === 'pickup_confirmed') {
      actionBanner.className = 'journey-action-box is-info';
      actionBannerTitle.innerHTML = '<i class="fa-solid fa-box-archive"></i> Parcel Collected';
      if (isSender) {
        actionBannerDesc.textContent = 'The traveler has safely received your parcel. The transit will begin shortly.';
        actionBannerButtons.innerHTML = `<a href="track.html?id=${encodeURIComponent(p.id)}" class="btn-ghost" style="text-decoration:none;"><i class="fa-solid fa-location-crosshairs"></i> Live Map</a>`;
      } else {
        actionBannerDesc.textContent = 'Parcel pickup is confirmed! Start your journey to notify the sender that delivery is underway.';
        actionBannerButtons.innerHTML = `
          <button type="button" class="btn-primary" id="startJourneyBtn"><i class="fa-solid fa-truck-fast"></i> Start Delivery Journey</button>
        `;
      }
      actionBanner.classList.remove('hidden');
    } else if (['in_transit', 'delivery_point_pending', 'delivery_point_selected'].includes(s)) {
      actionBanner.className = 'journey-action-box';
      actionBannerTitle.innerHTML = '<i class="fa-solid fa-truck-fast"></i> Parcel in Transit';
      if (isSender) {
        actionBannerDesc.textContent = 'The parcel is on the way. Once arrived, share the delivery completion OTP or show your QR code to release payment.';
        actionBannerButtons.innerHTML = `
          <button type="button" class="btn-primary" onclick="window.generateSecureQr('delivery')"><i class="fa-solid fa-qrcode"></i> Show Delivery QR</button>
          <button type="button" class="btn-ghost" id="requestDeliveryOtpBtn"><i class="fa-solid fa-key"></i> Resend Delivery OTP</button>
        `;
      } else {
        const isPointNeeded = s === 'delivery_point_pending';
        actionBannerDesc.textContent = isPointNeeded
          ? 'Choose the final destination point to deliver the parcel safely.'
          : 'You are currently transporting this parcel. Hand over to the recipient and verify the delivery OTP or scan their QR.';
        actionBannerButtons.innerHTML = isPointNeeded
          ? `<button type="button" class="btn-primary" onclick="window.openLocationPicker('delivery', false)"><i class="fa-solid fa-location-dot"></i> Select Delivery Point</button>`
          : `
          <button type="button" class="btn-primary" id="openVerifyDeliveryOtpBtn"><i class="fa-solid fa-check-double"></i> Verify Delivery OTP</button>
          <a href="track.html?id=${encodeURIComponent(p.id)}&action=scan" class="btn-ghost" style="text-decoration:none;"><i class="fa-solid fa-camera"></i> Scan Recipient QR</a>
        `;
      }
      actionBanner.classList.remove('hidden');
    } else if (s === 'delivered') {
      actionBanner.className = 'journey-action-box is-info';
      actionBannerTitle.innerHTML = '<i class="fa-solid fa-circle-check"></i> Delivered Successfully';
      actionBannerDesc.textContent = isSender
        ? 'Parcel delivery verified! Your payment has been securely settled to the traveler.'
        : 'Delivery completed! Your earnings have been credited to your TravelBuddy wallet.';

      let buttonsHtml = '';
      if (!p.isRated) {
        buttonsHtml += `<button type="button" class="btn-primary" onclick="window.openReviewModal()"><i class="fa-solid fa-star"></i> Rate Experience</button>`;
      } else {
        buttonsHtml += `<span class="tag tag--delivered" style="height:36px; padding:0 14px; display:inline-flex; align-items:center;"><i class="fa-solid fa-check"></i> Reviewed</span>`;
      }
      buttonsHtml += `<button type="button" class="btn-ghost" id="genReceiptBtn" style="border-color:var(--primary); color:var(--primary);"><i class="fa-solid fa-file-invoice"></i> Generate Receipt</button>`;

      actionBannerButtons.innerHTML = buttonsHtml;
      actionBanner.classList.remove('hidden');

      const genBtn = document.getElementById('genReceiptBtn');
      if (genBtn) genBtn.onclick = () => window.generateReceipt();
    } else {
      actionBanner.classList.add('hidden');
    }

    // Attach dynamic button handlers
    attachActionBannerEvents();
  }

  function attachActionBannerEvents() {
    const openVerifyPickupBtn = document.getElementById('openVerifyPickupOtpBtn');
    if (openVerifyPickupBtn) {
      openVerifyPickupBtn.onclick = () => openOtpModal('pickup');
    }

    const openVerifyDeliveryBtn = document.getElementById('openVerifyDeliveryOtpBtn');
    if (openVerifyDeliveryBtn) {
      openVerifyDeliveryBtn.onclick = () => openOtpModal('delivery');
    }

    const reqPickupBtn = document.getElementById('requestPickupOtpBtn');
    if (reqPickupBtn) {
      reqPickupBtn.onclick = () => requestOtp('pickup');
    }

    const reqDeliveryBtn = document.getElementById('requestDeliveryOtpBtn');
    if (reqDeliveryBtn) {
      reqDeliveryBtn.onclick = () => requestOtp('delivery');
    }

    const startJourneyBtn = document.getElementById('startJourneyBtn');
    if (startJourneyBtn) {
      startJourneyBtn.onclick = startJourneyAction;
    }

    const bannerRevBtn = document.getElementById('bannerReviewBtn');
    if (bannerRevBtn) {
      bannerRevBtn.onclick = openReviewModal;
    }
  }

  function renderCounterpart(p, isSender) {
    const person = isSender ? p.traveler : p.sender;
    counterpartTitle.textContent = isSender ? 'Assigned Traveler' : 'Parcel Sender';

    if (!person) {
      counterpartAvatar.textContent = '?';
      counterpartName.textContent = 'Searching for traveler...';
      if (counterpartVerified) counterpartVerified.style.display = 'none';
      if (counterpartRating) counterpartRating.innerHTML = '<i class="fa-solid fa-clock"></i> Not assigned yet';
      if (counterpartDeliveries) counterpartDeliveries.style.display = 'none';
      if (counterpartChatBtn) counterpartChatBtn.disabled = true;
      return;
    }

    counterpartAvatar.textContent = person.initials || 'TB';
    if (person.profilePhoto) {
      counterpartAvatar.style.backgroundImage = `url(${window.TravelBuddy.resolveMediaUrl(person.profilePhoto)})`;
      counterpartAvatar.classList.add('has-photo');
    }
    counterpartName.textContent = person.displayName || 'Counterpart';
    if (counterpartVerified) {
      counterpartVerified.style.display = person.isVerified ? 'inline' : 'none';
    }
    if (counterpartRating) {
      counterpartRating.innerHTML = `<i class="fa-solid fa-star" style="color:#F59E0B;"></i> ${(Number(person.rating || 0)).toFixed(1)}`;
    }
    if (counterpartDeliveries) {
      counterpartDeliveries.innerHTML = `<i class="fa-solid fa-truck-fast"></i> ${person.completedDeliveries || 0} trips`;
    }
    if (counterpartChatBtn) {
      counterpartChatBtn.disabled = false;
      counterpartChatBtn.onclick = () => startChatWithCounterpart(person.userId);
    }
    if (chatCounterpartBtn) {
      chatCounterpartBtn.onclick = () => startChatWithCounterpart(person.userId);
    }
    if (counterpartBox) {
      counterpartBox.onclick = () => openPublicProfile(person.userId);
    }
  }

  async function openPublicProfile(userId) {
    if (!userId || userId === 'undefined') {
       window.showToast('User information not available', 'warning');
       return;
    }
    const avatar = document.getElementById('profAvatar');
    const name = document.getElementById('profName');
    const verified = document.getElementById('profVerified');
    const rating = document.getElementById('profRating');
    const trips = document.getElementById('profTrips');
    const posted = document.getElementById('profPosted');
    const joined = document.getElementById('profJoined');
    const reliability = document.getElementById('profReliability');

    profileModal.classList.remove('hidden');

    // Initial state
    name.textContent = 'Loading...';
    avatar.style.backgroundImage = 'none';
    avatar.textContent = '..';

    try {
      // Use the public profile API instead of the admin one to avoid 403 Forbidden auto-logout
      const res = await fetch(`${API_ORIGIN}/api/auth/profile/${userId}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error();

      const p = data.profile;
      name.textContent = p.displayName;
      avatar.textContent = p.initials;
      if (p.profilePhoto) {
         avatar.style.backgroundImage = `url(${window.TravelBuddy.resolveMediaUrl(p.profilePhoto)})`;
         avatar.textContent = '';
      }
      verified.style.display = p.isVerified ? 'inline-flex' : 'none';
      rating.textContent = (p.rating || 0).toFixed(1);
      trips.textContent = p.stats?.parcelsDelivered || 0;
      posted.textContent = p.stats?.parcelsPosted || 0;
      reliability.textContent = '100%'; // Default for public view
      joined.textContent = window.TravelBuddyDate ? window.TravelBuddyDate.formatDate(p.memberSince, { month: 'short', year: 'numeric' }) : 'Aug 2026';

    } catch (err) {
      name.textContent = 'Error loading profile';
    }
  }

  function initMap(lat, lng) {
    if (map) {
      map.setView([lat, lng], 13);
      if (mapMarker) mapMarker.setLatLng([lat, lng]);
      return;
    }

    map = L.map('locationPickerMap').setView([lat, lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(map);

    mapMarker = L.marker([lat, lng], { draggable: true }).addTo(map);

    mapMarker.on('dragend', function() {
      const pos = mapMarker.getLatLng();
      updateSelectedLocationFromCoords(pos.lat, pos.lng);
    });

    map.on('click', function(e) {
      mapMarker.setLatLng(e.latlng);
      updateSelectedLocationFromCoords(e.latlng.lat, e.latlng.lng);
    });
  }

  async function updateSelectedLocationFromCoords(lat, lng) {
     // Simple reverse geocoding using OSM Nominatim (Free for small usage)
     try {
       const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
       const data = await res.json();
       selectedLocation = {
          name: data.name || data.display_name.split(',')[0],
          formattedAddress: data.display_name,
          latitude: lat,
          longitude: lng,
          city: data.address.city || data.address.town || data.address.village || ''
       };
       renderSelectedPoint();
     } catch (e) {
       selectedLocation = { name: 'Pinned Location', formattedAddress: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, latitude: lat, longitude: lng };
       renderSelectedPoint();
     }
  }

  function renderSelectedPoint() {
    if (!selectedLocation) return;
    selectedPointCard.classList.remove('hidden');
    selectedPointName.textContent = selectedLocation.name;
    selectedPointAddress.textContent = selectedLocation.formattedAddress;
    confirmLocationBtn.disabled = false;

    // Compatibility Parity
    if (selectedLocation.compatibility && compatibilityBadge) {
      compatibilityBadge.classList.remove('hidden', 'tag--success', 'tag--warning', 'tag--error');
      compatibilityBadge.textContent = selectedLocation.compatibility;
      if (selectedLocation.compatibility === 'EXCELLENT') compatibilityBadge.classList.add('tag--success');
      else if (selectedLocation.compatibility === 'GOOD') compatibilityBadge.classList.add('tag--warning');
      else if (selectedLocation.compatibility === 'DETOUR') {
        compatibilityBadge.classList.add('tag--error');
        detourWarningBox?.classList.remove('hidden');
      } else {
        compatibilityBadge.classList.add('hidden');
      }
    } else {
      compatibilityBadge?.classList.add('hidden');
      detourWarningBox?.classList.add('hidden');
    }

    if (isRequestChange && chosenLocationText) {
       chosenLocationText.textContent = selectedLocation.name;
    }
  }

  function showVerificationSuccess() {
    if (!verificationSuccessOverlay) return;
    verificationSuccessOverlay.classList.remove('hidden');
    setTimeout(() => {
      verificationSuccessOverlay.classList.add('hidden');
    }, 2500);
  }

  window.openLocationPicker = async (purpose, requestChange = false) => {
    if (!parcelData || !parcelData.id) {
       window.showToast('Wait for parcel data to load...', 'warning');
       return;
    }
    activePickerPurpose = purpose;
    isRequestChange = requestChange;
    locationModalTitle.textContent = `Select ${purpose === 'pickup' ? 'Pickup' : 'Delivery'} Point`;

    const existing = purpose === 'pickup' ? parcelData.pickupPoint : parcelData.deliveryPoint;
    if (changingWarning) changingWarning.classList.toggle('hidden', !existing?.name);

    if (locationModal) locationModal.classList.remove('hidden');
    if (locationPickerMap) locationPickerMap.classList.add('hidden');
    if (selectedPointCard) selectedPointCard.classList.add('hidden');
    if (confirmLocationBtn) confirmLocationBtn.disabled = true;

    // Load recommendations
    try {
      if (recommendedPointsList) recommendedPointsList.innerHTML = '<p style="font-size:12px; color:var(--text-faint);">Loading recommendations...</p>';
      const res = await fetch(`${API_BASE}/tracking/${parcelData.id}/location-recommendations?purpose=${purpose}`, { headers: authHeaders() });
      const data = await res.json();

      if (data.recommendations?.length) {
        recommendedPointsList.innerHTML = data.recommendations.map(p => `
          <div class="recent-item" onclick="selectRecommendedPoint('${p._id}')" style="background:#fff; border:1px solid var(--border); border-radius:8px; padding:10px; cursor:pointer;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong style="font-size:13px;">${escapeHTML(p.name)}</strong>
              ${p.isBestMatch ? '<span style="font-size:9px; background:var(--success); color:#fff; padding:2px 6px; border-radius:4px;">Best Match</span>' : ''}
            </div>
            <p style="font-size:11px; color:var(--text-muted); margin:2px 0 0;">${escapeHTML(p.formattedAddress)}</p>
          </div>
        `).join('');

        // Store points globally for selection
        window._points = data.recommendations;
      } else {
        recommendedPointsList.innerHTML = '<p style="font-size:12px; color:var(--text-faint);">No specific recommendations for this city. Use the map to pick a point.</p>';
      }
    } catch (e) {
      recommendedPointsList.innerHTML = '<p style="font-size:12px; color:var(--error);">Failed to load recommendations.</p>';
    }
  };

  window.selectRecommendedPoint = (id) => {
    const p = window._points.find(x => x._id === id);
    if (!p) return;
    selectedLocation = {
      travelPointId: p._id,
      name: p.name,
      type: p.type,
      formattedAddress: p.formattedAddress,
      city: p.city,
      latitude: p.latitude,
      longitude: p.longitude,
      compatibility: p.compatibility // Pass through from API
    };
    renderSelectedPoint();
  };

  if (pickOnMapBtn) {
    pickOnMapBtn.onclick = () => {
      locationPickerMap.classList.remove('hidden');
      const defaultLat = selectedLocation?.latitude || 19.9975; // Nashik approx
      const defaultLng = selectedLocation?.longitude || 73.7898;
      setTimeout(() => {
        initMap(defaultLat, defaultLng);
        map.invalidateSize();
      }, 100);
    };
  }

  if (useCurrentLocationBtn) {
    useCurrentLocationBtn.onclick = () => {
       if (!navigator.geolocation) {
         window.showToast('Geolocation is not supported by your browser', 'error');
         return;
       }
       setButtonLoading(useCurrentLocationBtn, true, 'Locating...');
       navigator.geolocation.getCurrentPosition(
         (pos) => {
           setButtonLoading(useCurrentLocationBtn, false);
           updateSelectedLocationFromCoords(pos.coords.latitude, pos.coords.longitude);
           locationPickerMap.classList.remove('hidden');
           setTimeout(() => {
             initMap(pos.coords.latitude, pos.coords.longitude);
             map.invalidateSize();
           }, 100);
         },
         () => {
           setButtonLoading(useCurrentLocationBtn, false);
           window.showToast('Location access denied or unavailable', 'error');
         }
       );
    };
  }

  if (confirmLocationBtn) {
    confirmLocationBtn.onclick = async () => {
       if (!selectedLocation) return;

       if (isRequestChange) {
          locationModal.classList.add('hidden');
          return; // The value is already set in state
       }

       setButtonLoading(confirmLocationBtn, true, 'Saving...');
       try {
         const url = `${API_BASE}/tracking/${parcelData.id}/${activePickerPurpose}-point`;
         const res = await fetch(url, {
           method: 'POST',
           headers: authHeaders(),
           body: JSON.stringify(selectedLocation)
         });
         const data = await res.json();
         if (!res.ok) throw new Error(data.error);

         window.showToast(`${activePickerPurpose.toUpperCase()} point saved!`, 'success');
         locationModal.classList.add('hidden');
         loadParcelDetails();
       } catch (err) {
         window.showToast(err.message || 'Failed to save location', 'error');
       } finally {
         setButtonLoading(confirmLocationBtn, false);
       }
    };
  }

  function openLocationChangeRequest(purpose) {
     activePickerPurpose = purpose;
     isRequestChange = true;
     selectedLocation = null;
     chosenLocationText.textContent = 'Choose meeting point...';
     changeReasonText.value = '';
     locationChangeModal.classList.remove('hidden');
  }

  if (openLocationPickerBtn) {
    openLocationPickerBtn.onclick = () => openLocationPicker(activePickerPurpose, true);
  }

  if (submitChangeRequestBtn) {
    submitChangeRequestBtn.onclick = async () => {
      if (!selectedLocation) {
        window.showToast('Please select a new location first', 'warning');
        return;
      }
      setButtonLoading(submitChangeRequestBtn, true, 'Sending...');
      try {
        const res = await fetch(`${API_BASE}/tracking/${parcelData.id}/location-change/request`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            type: activePickerPurpose,
            newLocation: selectedLocation,
            reason: changeReasonText.value.trim()
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        window.showToast('Request sent to traveler!', 'success');
        locationChangeModal.classList.add('hidden');
        loadParcelDetails();
      } catch (err) {
        window.showToast(err.message || 'Failed to send request', 'error');
      } finally {
        setButtonLoading(submitChangeRequestBtn, false);
      }
    };
  }

  async function handleLocationRequest(action) {
    const btn = action === 'approve' ? approveLocationBtn : declineLocationBtn;
    setButtonLoading(btn, true, action === 'approve' ? 'Approving...' : 'Declining...');
    try {
      const res = await fetch(`${API_BASE}/tracking/${parcelData.id}/location-change/${action}`, {
        method: 'POST',
        headers: authHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      window.showToast(`Request ${action}d successfully`, 'success');
      loadParcelDetails();
    } catch (err) {
      window.showToast(err.message || 'Action failed', 'error');
    } finally {
      setButtonLoading(btn, false);
    }
  }

  async function startChatWithCounterpart(userId) {
    if (!userId || !parcelData) return;
    try {
      window.showToast('Connecting to conversation...', 'info');
      const res = await fetch(`${API_ORIGIN}/api/messages/start`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          recipientId: userId,
          parcelId: parcelData.id
        })
      });
      const data = await res.json();
      if (res.ok && data.conversationId) {
        window.location.href = `messages.html?conversation=${encodeURIComponent(data.conversationId)}`;
      } else {
        window.location.href = `messages.html?parcel=${encodeURIComponent(parcelData.id)}`;
      }
    } catch (err) {
      console.error(err);
      window.location.href = 'messages.html';
    }
  }

  async function startJourneyAction() {
    if (!parcelData) return;
    try {
      window.showToast('Starting journey...', 'info');
      const res = await fetch(`${API_BASE}/tracking/${encodeURIComponent(parcelData.id)}/actions/start-journey`, {
        method: 'POST',
        headers: authHeaders()
      });
      const data = await res.json();
      if (!res.ok) {
        window.showToast(data.error || 'Could not start journey.', 'error');
        return;
      }
      window.showToast('Journey started! Parcel is now In Transit.', 'success');
      loadParcelDetails();
    } catch (err) {
      console.error(err);
      window.showToast('Failed to start journey.', 'error');
    }
  }

  async function requestOtp(purpose) {
    if (!parcelData) return;
    if (otpCooldownSeconds > 0) return;

    try {
      window.showToast(`Requesting ${purpose} OTP...`, 'info');
      const res = await fetch(`${API_BASE}/tracking/${encodeURIComponent(parcelData.id)}/otp/${purpose}/request`, {
        method: 'POST',
        headers: authHeaders()
      });
      const data = await res.json();
      if (!res.ok) {
        window.showToast(data.error || `Failed to request ${purpose} OTP.`, 'error');
        return;
      }
      window.showToast(`${purpose.toUpperCase()} OTP sent to recipient successfully!`, 'success');

      startOtpCooldown(data.resendAfterSeconds || 60);
    } catch (err) {
      console.error(err);
      window.showToast('Could not reach server to request OTP.', 'error');
    }
  }

  function startOtpCooldown(seconds) {
    otpCooldownSeconds = seconds;
    updateOtpButtonsUI();

    clearInterval(otpCooldownTimer);
    otpCooldownTimer = setInterval(() => {
      otpCooldownSeconds--;
      updateOtpButtonsUI();
      if (otpCooldownSeconds <= 0) {
        clearInterval(otpCooldownTimer);
      }
    }, 1000);
  }

  function updateOtpButtonsUI() {
    const btns = [
      document.getElementById('requestPickupOtpBtn'),
      document.getElementById('requestDeliveryOtpBtn')
    ];

    btns.forEach(btn => {
      if (!btn) return;
      if (otpCooldownSeconds > 0) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-clock"></i> Resend in ${otpCooldownSeconds}s`;
      } else {
        btn.disabled = false;
        const type = btn.id.includes('Pickup') ? 'Pickup' : 'Delivery';
        btn.innerHTML = `<i class="fa-solid fa-key"></i> Resend ${type} OTP`;
      }
    });
  }

  function openOtpModal(purpose) {
    currentOtpPurpose = purpose;
    otpModalTitle.textContent = purpose === 'pickup' ? 'Verify Pickup Handover' : 'Verify Delivery Completion';
    otpModalSub.textContent = `Enter the 6-digit ${purpose} PIN shared by the counterpart.`;
    otpInput.value = '';
    otpModal.classList.remove('hidden');
    otpInput.focus();
  }

  // OTP Verification Submission
  if (submitOtpBtn) {
    submitOtpBtn.onclick = async () => {
      const pin = otpInput.value.trim();
      if (pin.length !== 6) {
        window.showToast('Please enter a valid 6-digit OTP.', 'warning');
        return;
      }

      setButtonLoading(submitOtpBtn, true, 'Verifying...');
      try {
        const res = await fetch(`${API_BASE}/tracking/${encodeURIComponent(parcelData.id)}/otp/${currentOtpPurpose}/verify`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ otp: pin })
        });
        const data = await res.json();

        if (!res.ok) {
          window.showToast(data.error || 'Verification failed. Incorrect OTP.', 'error');
          return;
        }

        window.showToast(`${currentOtpPurpose === 'pickup' ? 'Pickup' : 'Delivery'} verified successfully!`, 'success');
        otpModal.classList.add('hidden');
        showVerificationSuccess();
        loadParcelDetails();
      } catch (err) {
        console.error(err);
        window.showToast('Could not reach server.', 'error');
      } finally {
        setButtonLoading(submitOtpBtn, false);
      }
    };
  }

  // Cancellation
  if (cancelParcelBtn) {
    cancelParcelBtn.onclick = () => {
      cancelModal.classList.remove('hidden');
    };
  }

  if (confirmCancelBtn) {
    confirmCancelBtn.onclick = async () => {
      if (!parcelData) return;
      const reason = cancelReason.value;
      setButtonLoading(confirmCancelBtn, true, 'Cancelling...');

      try {
        const res = await fetch(`${API_BASE}/tracking/${encodeURIComponent(parcelData.id)}/cancel`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ reason })
        });
        const data = await res.json();

        if (!res.ok) {
          window.showToast(data.error || 'Could not cancel parcel.', 'error');
          return;
        }

        window.showToast(data.message || 'Parcel cancelled successfully.', 'success');
        cancelModal.classList.add('hidden');
        loadParcelDetails();
      } catch (err) {
        console.error(err);
        window.showToast('Network error while cancelling.', 'error');
      } finally {
        setButtonLoading(confirmCancelBtn, false);
      }
    };
  }

  // Review Modal
  window.openReviewModal = () => {
    selectedRating = 5;
    updateStarDisplay(5);
    reviewComment.value = '';
    const name = (parcelData.role === 'sender' ? parcelData.traveler?.displayName : parcelData.sender?.displayName) || 'the user';
    reviewTargetName.textContent = name;
    reviewModal.classList.remove('hidden');
  };

  function updateStarDisplay(count) {
    const stars = starRatingBox.querySelectorAll('i');
    stars.forEach((star, index) => {
      star.classList.toggle('active', index < count);
    });
    const labels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Exceptional'];
    starRatingLabel.textContent = labels[count] || `${count} Stars`;
  }

  if (starRatingBox) {
    starRatingBox.querySelectorAll('i').forEach((star) => {
      star.onclick = () => {
        selectedRating = parseInt(star.dataset.rating, 10);
        updateStarDisplay(selectedRating);
      };
    });
  }

  if (submitReviewBtn) {
    submitReviewBtn.onclick = async () => {
      if (!parcelData) return;
      setButtonLoading(submitReviewBtn, true, 'Submitting...');

      try {
        const res = await fetch(`${API_BASE}/review`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            parcelId: parcelData.id,
            rating: selectedRating,
            comment: reviewComment.value.trim(),
            role: parcelData.role
          })
        });
        const data = await res.json();

        if (!res.ok) {
          window.showToast(data.error || 'Could not submit review.', 'error');
          return;
        }

        window.showToast('Thank you! Your review has been recorded.', 'success');
        reviewModal.classList.add('hidden');
        parcelData.isRated = true;
        if (reviewBtn) reviewBtn.style.display = 'none';
        const bannerRevBtn = document.getElementById('bannerReviewBtn');
        if (bannerRevBtn) bannerRevBtn.remove();
      } catch (err) {
        console.error(err);
        window.showToast('Failed to submit review.', 'error');
      } finally {
        setButtonLoading(submitReviewBtn, false);
      }
    };
  }

  if (reviewBtn) {
    reviewBtn.onclick = window.openReviewModal;
  }

  // Report Issue Modal
  if (reportIssueBtn) {
    reportIssueBtn.onclick = () => {
      reportDescription.value = '';
      reportModal.classList.remove('hidden');
    };
  }

  if (submitReportBtn) {
    submitReportBtn.onclick = async () => {
      if (!parcelData) return;
      const reason = reportReason.value;
      const desc = reportDescription.value.trim();

      if (!desc) {
        window.showToast('Please provide details in the description.', 'warning');
        return;
      }

      setButtonLoading(submitReportBtn, true, 'Reporting...');
      try {
        const res = await fetch(`${API_BASE}/tracking/${encodeURIComponent(parcelData.id)}/report`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ reason, description: desc })
        });
        const data = await res.json();

        if (!res.ok) {
          window.showToast(data.error || 'Could not submit report.', 'error');
          return;
        }

        window.showToast('Your report has been submitted to TravelBuddy Trust & Safety.', 'success');
        reportModal.classList.add('hidden');
      } catch (err) {
        console.error(err);
        window.showToast('Failed to submit report.', 'error');
      } finally {
        setButtonLoading(submitReportBtn, false);
      }
    };
  }

  // Close modals
  const closeModalElements = [
    cancelModalClose, cancelModalDismiss, otpModalClose,
    reviewModalClose, reportModalClose, locationModalClose,
    profileModalClose, locationChangeModalClose, qrModalClose,
    receiptPreviewModalClose, closeReceiptPreviewBtn
  ];
  closeModalElements.forEach(el => el && (el.onclick = () => {
    [cancelModal, otpModal, reviewModal, reportModal, locationModal, profileModal, locationChangeModal, qrModal, receiptPreviewModal].forEach(m => m && m.classList.add('hidden'));
    clearInterval(qrExpiryTimer);
  }));

  window.generateSecureQr = generateSecureQr;

  // ---------- Receipt Generation & PDF ----------

  window.generateReceipt = async () => {
    if (!parcelData) return;
    receiptGenModal.classList.remove('hidden');

    const stages = ['details', 'timeline', 'financials', 'final'];
    const resetStages = () => stages.forEach(s => {
      const el = document.getElementById(`stage-${s}`);
      el.classList.remove('completed');
      el.querySelector('i').className = 'fa-regular fa-circle';
    });

    resetStages();

    const runStage = async (id, ms) => {
      const el = document.getElementById(`stage-${id}`);
      await new Promise(r => setTimeout(r, ms));
      el.classList.add('completed');
      el.querySelector('i').className = 'fa-solid fa-circle-check';
    };

    try {
      await runStage('details', 800);
      await runStage('timeline', 1000);
      await runStage('financials', 800);
      await runStage('final', 1200);

      renderReceiptPreview();
      receiptGenModal.classList.add('hidden');
      receiptPreviewModal.classList.remove('hidden');
    } catch (err) {
      window.showToast('Failed to generate receipt.', 'error');
      receiptGenModal.classList.add('hidden');
    }
  };

  function renderReceiptPreview() {
    const p = parcelData;
    const isSender = p.role === 'sender';
    const counterpart = isSender ? p.traveler : p.sender;
    const fin = p.financials || {};

    const timelineHtml = [
      { l: 'Parcel Posted', t: p.createdAt },
      { l: 'Accepted by Traveler', t: p.acceptedAt },
      { l: 'Pickup Confirmed', t: p.pickupConfirmedAt },
      { l: 'In Transit', t: p.inTransitAt },
      { l: 'Delivered', t: p.deliveredAt }
    ].filter(x => x.t).map(x => `
      <div class="receipt-timeline-item">
        <i class="fa-solid fa-check-circle receipt-timeline-icon"></i>
        <div>
          <div style="font-weight:700;">${x.l}</div>
          <div style="font-size:11px; color:var(--text-faint);">${formatDateTime(x.t)}</div>
        </div>
      </div>
    `).join('');

    receiptPreviewContent.innerHTML = `
      <div class="receipt-preview-section">
        <h4>General Information</h4>
        <div class="receipt-row"><span class="receipt-label">Receipt ID</span><span class="receipt-value">${p.parcelNumber || p.id}</span></div>
        <div class="receipt-row"><span class="receipt-label">Parcel ID</span><span class="receipt-value">#${p.orderId || p.id}</span></div>
        <div class="receipt-row"><span class="receipt-label">Status</span><span class="receipt-value" style="color:var(--success);">Delivered</span></div>
        <div class="receipt-row"><span class="receipt-label">User Role</span><span class="receipt-value">${isSender ? 'Sender' : 'Traveler'}</span></div>
      </div>

      <div class="receipt-preview-section">
        <h4>Participants</h4>
        <div class="receipt-row"><span class="receipt-label">Sender</span><span class="receipt-value">${escapeHTML(p.sender?.displayName || 'TravelBuddy Sender')}</span></div>
        <div class="receipt-row"><span class="receipt-label">Traveler</span><span class="receipt-value">${escapeHTML(p.traveler?.displayName || 'TravelBuddy Traveler')}</span></div>
      </div>

      <div class="receipt-preview-section">
        <h4>Route & Parcel</h4>
        <div class="receipt-row"><span class="receipt-label">Origin</span><span class="receipt-value">${escapeHTML(p.fromCity)}</span></div>
        <div class="receipt-row"><span class="receipt-label">Destination</span><span class="receipt-value">${escapeHTML(p.toCity)}</span></div>
        <div class="receipt-row"><span class="receipt-label">Pickup Point</span><span class="receipt-value">${escapeHTML(p.pickupPoint?.name || 'Arranged in Chat')}</span></div>
        <div class="receipt-row"><span class="receipt-label">Delivery Point</span><span class="receipt-value">${escapeHTML(p.deliveryPoint?.name || 'Arranged in Chat')}</span></div>
        <div class="receipt-row"><span class="receipt-label">Weight</span><span class="receipt-value">${p.weight} kg</span></div>
        <div class="receipt-row"><span class="receipt-label">Description</span><span class="receipt-value">${escapeHTML(p.description)}</span></div>
      </div>

      <div class="receipt-preview-section">
        <h4>Financial Details</h4>
        <div class="receipt-row"><span class="receipt-label">Parcel Amount</span><span class="receipt-value">${formatPaise(fin.grossAmount || p.price)}</span></div>
        <div class="receipt-row"><span class="receipt-label">Platform Fee</span><span class="receipt-value">${formatPaise(fin.platformFee || p.platformCommission)}</span></div>
        <div class="receipt-row"><span class="receipt-label">Traveler Earnings</span><span class="receipt-value" style="color:var(--success); font-size:15px;">${formatPaise(fin.netEarnings || p.travelerEarning)}</span></div>
        <div class="receipt-row"><span class="receipt-label">Payment Status</span><span class="receipt-value">Released</span></div>
      </div>

      <div class="receipt-preview-section">
        <h4>Journey Timeline</h4>
        <div style="margin-top:10px;">${timelineHtml}</div>
      </div>

      <div style="text-align:center; font-size:10px; color:var(--text-faint); margin-top:20px; border-top:1px dashed var(--border); padding-top:10px;">
        This is a computer-generated document. No signature is required.
      </div>
    `;

    downloadReceiptBtn.onclick = () => downloadReceiptPDF();
  }

  async function downloadReceiptPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const p = parcelData;
    const fin = p.financials || {};

    // Branding
    doc.setFillColor(13, 110, 253);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('TRAVELBUDDY', 20, 20);
    doc.setFontSize(10);
    doc.text('Parcel Delivery Receipt', 20, 30);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    let y = 55;

    const row = (label, val, bold = false) => {
      doc.setFont('helvetica', 'normal');
      doc.text(label + ':', 20, y);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.text(String(val), 190, y, { align: 'right' });
      y += 10;
    };

    const section = (title) => {
      y += 5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(title.toUpperCase(), 20, y);
      doc.line(20, y + 2, 190, y + 2);
      y += 12;
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
    };

    section('General Information');
    row('Receipt Reference', p.parcelNumber || p.id);
    row('Parcel ID', '#' + (p.orderId || p.id));
    row('Status', 'DELIVERED', true);
    row('User Role', p.role.charAt(0).toUpperCase() + p.role.slice(1));

    section('Participants');
    row('Sender', p.sender?.displayName || 'TravelBuddy User');
    row('Traveler', p.traveler?.displayName || 'TravelBuddy User');

    section('Parcel & Route');
    row('Route', `${escapeHTML(p.fromCity)} to ${escapeHTML(p.toCity)}`);
    row('Pickup Point', p.pickupPoint?.name || 'Arranged in Chat');
    row('Delivery Point', p.deliveryPoint?.name || 'Arranged in Chat');
    row('Weight', p.weight + ' kg');

    section('Financials');
    row('Parcel Amount', formatPaise(fin.grossAmount || p.price));
    row('Platform Fee', formatPaise(fin.platformFee || p.platformCommission));
    row('Traveler Earning', formatPaise(fin.netEarnings || p.travelerEarning), true);
    row('Settlement Status', 'Released');

    section('Journey Timeline');
    if (p.createdAt) row('Posted', formatDateTime(p.createdAt));
    if (p.acceptedAt) row('Accepted', formatDateTime(p.acceptedAt));
    if (p.pickupConfirmedAt) row('Picked Up', formatDateTime(p.pickupConfirmedAt));
    if (p.inTransitAt) row('In Transit', formatDateTime(p.inTransitAt));
    if (p.deliveredAt) row('Delivered', formatDateTime(p.deliveredAt));

    y += 20;
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text('Generated by TravelBuddy on ' + new Date().toLocaleString(), 105, y, { align: 'center' });

    doc.save(`TravelBuddy-Receipt-${p.parcelNumber || p.id}.pdf`);
    window.showToast('Receipt downloaded successfully!', 'success');
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      [cancelModal, otpModal, reviewModal, reportModal, locationModal, profileModal, locationChangeModal, qrModal].forEach(m => m && m.classList.add('hidden'));
      clearInterval(qrExpiryTimer);
    }
  });

  // Real-time socket notification listener
  document.addEventListener('travelbuddy:notification', (e) => {
    if (e.detail && parcelData && (e.detail.parcelId === parcelData.id || e.detail.text?.includes(parcelData.parcelNumber))) {
      loadParcelDetails();
    }
  });

  loadParcelDetails();
})();
