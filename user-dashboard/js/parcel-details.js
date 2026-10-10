(function () {
  'use strict';

  const { API_ORIGIN, authHeaders, authFetchOptions, escapeHTML, formatPaise, statusBadge, setButtonLoading } = window.TravelBuddy;
  const API_BASE = `${API_ORIGIN}/api/postparcel`;

  // UI Helper
  const ui = (id) => document.getElementById(id);

  // Global UI Elements (Outside detailsShell or the Shell itself)
  const detailsLoading = () => ui('detailsLoading');
  const detailsError = () => ui('detailsError');
  const detailsErrorMessage = () => ui('detailsErrorMessage');
  const detailsShell = () => ui('detailsShell');

  // Modals (Safe as they are outside detailsShell)
  const cancelModal = () => ui('cancelModal');
  const cancelModalClose = () => ui('cancelModalClose');
  const cancelModalDismiss = () => ui('cancelModalDismiss');
  const confirmCancelBtn = () => ui('confirmCancelBtn');
  const cancelReason = () => ui('cancelReason');

  const otpModal = () => ui('otpModal');
  const otpModalClose = () => ui('otpModalClose');
  const otpModalTitle = () => ui('otpModalTitle');
  const otpModalSub = () => ui('otpModalSub');
  const otpInput = () => ui('otpInput');
  const submitOtpBtn = () => ui('submitOtpBtn');

  const reviewModal = () => ui('reviewModal');
  const reviewModalClose = () => ui('reviewModalClose');
  const starRatingBox = () => ui('starRatingBox');
  const starRatingLabel = () => ui('starRatingLabel');
  const reviewComment = () => ui('reviewComment');
  const submitReviewBtn = () => ui('submitReviewBtn');
  const reviewTargetName = () => ui('reviewTargetName');

  const reportModal = () => ui('reportModal');
  const reportModalClose = () => ui('reportModalClose');
  const reportReason = () => ui('reportReason');
  const reportDescription = () => ui('reportDescription');
  const submitReportBtn = () => ui('submitReportBtn');

  const locationModal = () => ui('locationModal');
  const locationModalClose = () => ui('locationModalClose');
  const locationModalTitle = () => ui('locationModalTitle');
  const useCurrentLocationBtn = () => ui('useCurrentLocationBtn');
  const pickOnMapBtn = () => ui('pickOnMapBtn');
  const locationSearchInput = () => ui('locationSearchInput');
  const locationSearchBtn = () => ui('locationSearchBtn');
  const locationSearchResults = () => ui('locationSearchResults');
  const geocodingProviderAttribution = () => ui('geocodingProviderAttribution');
  const locationPickerMap = () => ui('locationPickerMap');
  const recommendedPointsList = () => ui('recommendedPointsList');
  const selectedPointCard = () => ui('selectedPointCard');
  const selectedPointName = () => ui('selectedPointName');
  const selectedPointAddress = () => ui('selectedPointAddress');
  const confirmLocationBtn = () => ui('confirmLocationBtn');
  const changingWarning = () => ui('changingWarning');
  const compatibilityBadge = () => ui('compatibilityBadge');
  const detourWarningBox = () => ui('detourWarningBox');
  const verificationSuccessOverlay = () => ui('verificationSuccessOverlay');

  const profileModal = () => ui('profileModal');
  const profileModalClose = () => ui('profileModalClose');
  const locationChangeModal = () => ui('locationChangeModal');
  const locationChangeModalClose = () => ui('locationChangeModalClose');
  const chosenLocationText = () => ui('chosenLocationText');
  const openLocationPickerBtn = () => ui('openLocationPickerBtn');
  const submitChangeRequestBtn = () => ui('submitChangeRequestBtn');
  const changeReasonText = () => ui('changeReason');

  const qrModal = () => ui('qrModal');
  const qrModalClose = () => ui('qrModalClose');
  const handoverOtpModal = () => ui('handoverOtpModal');
  const handoverOtpClose = () => ui('handoverOtpClose');
  const handoverOtpTitle = () => ui('handoverOtpTitle');
  const handoverOtpDescription = () => ui('handoverOtpDescription');
  const handoverOtpStatus = () => ui('handoverOtpStatus');
  const handoverOtpCountdown = () => ui('handoverOtpCountdown');
  const handoverOtpInput = () => ui('handoverOtpInput');
  const handoverOtpResend = () => ui('handoverOtpResend');
  const handoverOtpVerify = () => ui('handoverOtpVerify');
  const qrLoadingState = () => ui('qrLoadingState');
  const qrReadyState = () => ui('qrReadyState');
  const qrCodeContainer = () => ui('qrCodeContainer');
  const qrExpiryTime = () => ui('qrExpiryTime');

  const receiptGenModal = () => ui('receiptGenModal');
  const receiptPreviewModal = () => ui('receiptPreviewModal');
  const receiptPreviewContent = () => ui('receiptPreviewContent');
  const downloadReceiptBtn = () => ui('downloadReceiptBtn');
  const closeReceiptPreviewBtn = () => ui('closeReceiptPreviewBtn');
  const receiptPreviewModalClose = () => ui('receiptPreviewModalClose');

  // State
  let parcelData = null;
  let parcelLoadSequence = 0;
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
  let locationSearchTimer = null;
  let locationSearchSequence = 0;
  let locationSearchAbortController = null;
  let locationSearchPendingQuery = null;
  const locationSearchCache = new Map();
  let handoverOtpPurpose = null;
  let handoverOtpResendAt = 0;
  let handoverOtpExpiresAt = 0;
  let handoverOtpTimer = null;
  let handoverOtpSequence = 0;
  let reverseGeocodeSequence = 0;
  let reverseGeocodeTimer = null;
  let reverseGeocodeAbortController = null;
  let pendingReverseGeocodeKey = null;

  function generateSecureQr(purpose) {
    if (!qrModal()) return;
    qrModal().classList.remove('hidden');
    qrLoadingState().classList.remove('hidden');
    qrReadyState().classList.add('hidden');
    qrCodeContainer().innerHTML = '';

    setTimeout(async () => {
      try {
        const url = `${API_BASE}/${parcelData.id}/${purpose}-qr`;
        const res = await fetch(url, authFetchOptions({ method: 'POST' }));
        const data = await res.json();

        if (!res.ok) throw new Error(data.message || 'QR generation failed');

        qrLoadingState().classList.add('hidden');
        qrReadyState().classList.remove('hidden');

        new QRCode(qrCodeContainer(), {
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
        qrModal().classList.add('hidden');
      }
    }, 1500);
  }

  function startQrExpiryTimer(expiryIso) {
    const expiry = new Date(expiryIso);
    clearInterval(qrExpiryTimer);

    const update = () => {
      const now = new Date();
      const diff = expiry - now;
      if (diff <= 0) {
        qrExpiryTime().textContent = 'Expired';
        clearInterval(qrExpiryTimer);
        return;
      }
      clearTimeout(reverseGeocodeTimer);
      reverseGeocodeAbortController?.abort();
      reverseGeocodeSequence++;
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      qrExpiryTime().textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
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

  function isValidLocation(latitude, longitude) {
    return typeof latitude === 'number' && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
      && typeof longitude === 'number' && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
  }

  function handleLocationError(error, fallbackMessage) {
    const code = error?.code;
    if (code === 1) {
      window.showToast('Location permission was denied. Enable location access for CarryParcel in your browser or device settings, then try again. You can still search or select a point on the map.', 'error');
    } else if (code === 2) {
      window.showToast('Your current location could not be determined. Please try again or select a location manually.', 'error');
    } else if (code === 3) {
      window.showToast('We could not get your location in time. Please try again.', 'error');
    } else {
      window.showToast(fallbackMessage || 'We could not determine your location right now.', 'error');
    }
  }

  async function loadParcelDetails() {
    const targetId = getParcelIdFromUrl();
    if (!targetId) {
      showError('No parcel specified. Please select a parcel from the list.');
      return;
    }
    const requestId = ++parcelLoadSequence;

    if (window.TravelBuddySkeleton) {
        window.TravelBuddySkeleton.show('#detailsShell', 'parcel-details');
        detailsShell().classList.remove('hidden');
    } else if (detailsLoading()) {
        detailsLoading().classList.remove('hidden');
    }
    if (detailsError()) detailsError().classList.add('hidden');

    try {
      const user = await window.TravelBuddy.getCurrentUser();
      if (requestId !== parcelLoadSequence) return;
      currentUserId = user?._id || user?.id || '';

      const isOrderId = targetId.startsWith('TB-');
      const url = isOrderId
        ? `${API_BASE}/track/order/${encodeURIComponent(targetId)}`
        : `${API_BASE}/tracking/${encodeURIComponent(targetId)}`;

      const res = await fetch(url, authFetchOptions());
      const data = await res.json();
      if (requestId !== parcelLoadSequence) return;

      if (!res.ok) {
        showError(data.error || 'You are not authorized to view this parcel or it does not exist.');
        return;
      }

      parcelData = data.parcel;
      if (parcelData) {
        const timeline = window.CarryParcelTrackingTimeline?.resolve(parcelData);
        if (timeline) {
          parcelData.trackingTimeline = timeline.stages;
          parcelData.trackingTerminal = timeline.terminal;
        }
      }
      renderDetails(parcelData);
    } catch (err) {
      if (requestId !== parcelLoadSequence) return;
      console.error('Failed to load parcel details:', err);
      showError('Could not reach the server to load parcel details.');
    } finally {
      if (requestId !== parcelLoadSequence) return;
      const loader = detailsLoading();
      if (loader) loader.classList.add('hidden');
      // Ensure skeleton is hidden even on error
      if (window.TravelBuddySkeleton) {
          window.TravelBuddySkeleton.hide('#detailsShell');
      }
    }
  }

  function showError(msg) {
    if (detailsLoading()) detailsLoading().classList.add('hidden');
    if (detailsShell()) detailsShell().classList.add('hidden');
    if (detailsError()) {
      detailsError().classList.remove('hidden');
      if (detailsErrorMessage()) detailsErrorMessage().textContent = msg;
    }
  }

  function renderDetails(p) {
    if (!p) return;
    if (!p.status || !Array.isArray(p.trackingTimeline)) {
      showError('Current tracking information is unavailable. Please refresh and try again.');
      return;
    }

    if (window.TravelBuddySkeleton) {
        window.TravelBuddySkeleton.hide('#detailsShell');
    }
    if (detailsShell()) detailsShell().classList.remove('hidden');

    const isSender = p.role === 'sender';

    // Header
    const orderIdText = ui('orderIdText');
    const statusBadgeWrap = ui('statusBadgeWrap');
    const userRoleBadge = ui('userRoleBadge');
    const liveTrackLink = ui('liveTrackLink');
    const chatCounterpartBtn = ui('chatCounterpartBtn');
    const reportIssueBtn = ui('reportIssueBtn');
    const cancelParcelBtn = ui('cancelParcelBtn');
    const reviewBtn = ui('reviewBtn');

    if (orderIdText) orderIdText.textContent = p.parcelNumber || p.orderId || p.id;
    if (statusBadgeWrap) statusBadgeWrap.innerHTML = statusBadge(p.status);

    if (userRoleBadge) {
      userRoleBadge.innerHTML = isSender
        ? '<span class="parcel-role-badge is-sender"><i class="fa-solid fa-paper-plane"></i> You: Sender</span>'
        : '<span class="parcel-role-badge is-traveler"><i class="fa-solid fa-person-walking-luggage"></i> You: Traveler</span>';
    }

    // Premium Role Badge Parity
    const roleBadgePremium = ui('roleBadgePremium');
    const roleBadgeText = ui('roleBadgeText');
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
    const pathFromCity = ui('pathFromCity');
    const pathToCity = ui('pathToCity');
    if (pathFromCity) pathFromCity.textContent = p.fromCity || '---';
    if (pathToCity) pathToCity.textContent = p.toCity || '---';

    // Specs Grid
    const specWeight = ui('specWeight');
    const specEarning = ui('specEarning');
    const specEarningLabel = ui('specEarningLabel');
    if (specWeight) {
      const w = Number(p.weight) || 0;
      specWeight.textContent = `${w > 0 ? w : '---'} kg`;
    }
    if (specEarning) {
      const e = p.financials?.netEarnings ?? p.travelerEarning;
      specEarning.textContent = window.TravelBuddy.formatPaise(e || 0);
      if (specEarningLabel) specEarningLabel.textContent = isSender ? 'Reward' : 'Earning';
    }

    // Core Action Handlers (Re-bind because DOM was replaced by skeleton)
    if (cancelParcelBtn) cancelParcelBtn.onclick = () => cancelModal().classList.remove('hidden');
    if (reportIssueBtn) reportIssueBtn.onclick = () => { reportDescription().value = ''; reportModal().classList.remove('hidden'); };
    if (reviewBtn) reviewBtn.onclick = window.openReviewModal;

    // Change Location Buttons
    const changePickupBtn = ui('changePickupBtn');
    const pickupPointText = ui('pickupPointText');
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

       if (pickupPointText) {
          if (isLocked && !senderCanRequestChange) {
             pickupPointText.innerHTML = `<i class="fa-solid fa-lock" style="font-size:10px; opacity:0.6; margin-right:4px;"></i> ${escapeHTML(p.pickupPoint?.name || '---')}`;
          } else {
             pickupPointText.textContent = p.pickupPoint?.name || p.pickupPoint?.address || (p.status === 'pending' ? 'Will be arranged once accepted' : 'Exact pickup location arranged in chat');
          }
       }
    }

    const changeDeliveryBtn = ui('changeDeliveryBtn');
    const deliveryPointText = ui('deliveryPointText');
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

       if (deliveryPointText) {
          if (isLocked && !senderCanRequestChange) {
             deliveryPointText.innerHTML = `<i class="fa-solid fa-lock" style="font-size:10px; opacity:0.6; margin-right:4px;"></i> ${escapeHTML(p.deliveryPoint?.name || '---')}`;
          } else {
             deliveryPointText.textContent = p.deliveryPoint?.name || p.deliveryPoint?.address || (p.status === 'pending' ? 'Will be arranged once accepted' : 'Exact delivery location arranged in chat');
          }
       }
    }

    // Location Change Request Card
    const locationRequestCard = ui('locationRequestCard');
    if (locationRequestCard) {
      const req = p.locationChangeRequest;
      if (!isSender && req && req.status === 'pending') {
        locationRequestCard.classList.remove('hidden');
        ui('reqLocationType').textContent = req.type;
        ui('reqLocationName').textContent = req.newLocation.name;
        ui('reqLocationAddress').textContent = req.newLocation.formattedAddress;
        ui('reqReasonBox').textContent = req.reason ? `"${req.reason}"` : 'No reason provided.';

        ui('approveLocationBtn').onclick = () => handleLocationRequest('approve');
        ui('declineLocationBtn').onclick = () => handleLocationRequest('decline');
      } else {
        locationRequestCard.classList.add('hidden');
      }
    }

    // Cancellation Summary
    const cancellationCard = ui('cancellationCard');
    if (cancellationCard) {
      if (p.status.includes('cancel')) {
        cancellationCard.style.display = 'block';
        ui('cancelOriginalPrice').textContent = window.TravelBuddy.formatPaise(p.financials?.grossAmount || p.price);

        if (isSender) {
          ui('cancelFeeRow').style.display = 'flex';
          ui('cancelCompensationRow').style.display = 'none';
          ui('cancelFeeValue').textContent = `-${window.TravelBuddy.formatPaise(p.cancellationFee)}`;
          ui('cancelNetLabel').textContent = 'Net Refund';
          const refund = (p.financials?.grossAmount || p.price) - p.cancellationFee;
          ui('cancelNetValue').textContent = window.TravelBuddy.formatPaise(refund);
        } else {
          ui('cancelFeeRow').style.display = 'none';
          ui('cancelCompensationRow').style.display = 'flex';
          ui('cancelCompensationValue').textContent = `+${window.TravelBuddy.formatPaise(p.cancellationTravelerCompensation)}`;
          ui('cancelNetLabel').textContent = 'Total Compensation';
          ui('cancelNetValue').textContent = window.TravelBuddy.formatPaise(p.cancellationTravelerCompensation);
        }

        ui('refundStatusPill').innerHTML = p.paymentStatus === 'refunded'
          ? '<i class="fa-solid fa-circle-check"></i> Processed'
          : '<i class="fa-solid fa-clock"></i> Processing';
      } else {
        cancellationCard.style.display = 'none';
      }
    }

    // Recommendation Card
    const nextActionCard = ui('nextActionCard');
    if (nextActionCard) {
       if (p.status === 'delivered') {
          nextActionCard.classList.remove('hidden');
          ui('recFromCity').textContent = p.fromCity;
          ui('recToCity').textContent = p.toCity;
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
      const counterpartChatBtn = ui('counterpartChatBtn');
      if (counterpartChatBtn) {
        counterpartChatBtn.disabled = true;
        counterpartChatBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Chat Locked';
      }
    }

    // Sub-renders
    renderTimeline(p);
    renderContextualBanners(p, isSender);
    renderActionBanner(p, isSender);
    renderCounterpart(p, isSender);
    renderMoneyJourney(p);

    // Static Data
    const pickupCityText = ui('pickupCityText');
    const deliveryCityText = ui('deliveryCityText');
    const parcelDescText = ui('parcelDescText');
    const parcelWeightText = ui('parcelWeightText');
    const parcelDateText = ui('parcelDateText');
    const parcelCreatedText = ui('parcelCreatedText');

    if (pickupCityText) pickupCityText.textContent = p.fromCity || 'Pickup City';
    if (deliveryCityText) deliveryCityText.textContent = p.toCity || 'Delivery City';
    if (parcelDescText) parcelDescText.textContent = p.description || 'General Parcel';
    if (parcelWeightText) parcelWeightText.textContent = `${p.weight || 1} kg`;
    if (parcelDateText) parcelDateText.textContent = formatDateTime(p.pickupDate || p.createdAt);
    if (parcelCreatedText) parcelCreatedText.textContent = formatDateTime(p.createdAt);

    // Financials
    const financials = p.financials || {};
    const grossPaise = Number(financials.grossAmount ?? p.price ?? 0);
    const platformPaise = Number(financials.platformFee ?? p.platformCommission ?? Math.round(grossPaise * 0.1));
    const earningPaise = Number(financials.netEarnings ?? p.travelerEarning ?? (grossPaise - platformPaise));

    const finGrossPrice = ui('finGrossPrice');
    const finPlatformFee = ui('finPlatformFee');
    const finTravelerEarning = ui('finTravelerEarning');
    const finPaymentStatusTag = ui('finPaymentStatusTag');

    if (finGrossPrice) finGrossPrice.textContent = formatPaise(grossPaise);
    if (finPlatformFee) finPlatformFee.textContent = formatPaise(platformPaise);
    if (finTravelerEarning) finTravelerEarning.textContent = formatPaise(earningPaise);

    if (finPaymentStatusTag) {
      if (p.status === 'delivered') {
        finPaymentStatusTag.className = 'tag tag--delivered';
        finPaymentStatusTag.textContent = 'Released to Traveler';
      } else if (p.status.includes('cancel')) {
        finPaymentStatusTag.className = 'tag tag--cancelled';
        finPaymentStatusTag.textContent = 'Refunded / Cancelled';
      } else {
        finPaymentStatusTag.className = 'tag tag--held';
        finPaymentStatusTag.textContent = 'Payment Received';
      }
    }
  }

  function renderMoneyJourney(p) {
    const journey = p.paymentJourney;
    const panel = ui('moneyJourneyPanel');
    const list = ui('moneyJourneyList');
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
    const timelineStepsList = ui('timelineStepsList');
    if (!timelineStepsList) return;

    const stageByKey = new Map(p.trackingTimeline.map((stage) => [stage.key, stage]));
    const visibleStageKeys = ['posted', 'accepted', 'pickup_confirmed', 'in_transit', 'delivered'];
    const rows = visibleStageKeys.map((key) => {
      const stage = stageByKey.get(key);
      if (!stage) return '';

      const itemClass = stage.state === 'done'
        ? 'is-done'
        : (stage.state === 'current' ? 'is-current' : (stage.state === 'skipped' ? 'is-skipped' : ''));
      const icon = stage.state === 'done'
        ? '<i class="fa-solid fa-check"></i>'
        : (stage.state === 'current' ? '<i class="fa-solid fa-circle"></i>' : '<i class="fa-regular fa-circle"></i>');
      const time = stage.time
        ? formatDateTime(stage.time)
        : (stage.state === 'done' ? 'Completed' : (stage.state === 'skipped' ? 'Not reached' : 'Pending'));

      return `
        <div class="timeline-step-item ${itemClass}">
          <div class="timeline-step-icon">${icon}</div>
          <div class="timeline-step-body">
            <h4 class="timeline-step-title">${escapeHTML(stage.title)}</h4>
            <span class="timeline-step-time">${escapeHTML(time)}</span>
          </div>
        </div>
      `;
    });

    if (p.trackingTerminal) {
      const isDisputed = p.trackingTerminal.key === 'disputed';
      rows.push(`
        <div class="timeline-step-item ${isDisputed ? 'is-current' : 'is-failed'}">
          <div class="timeline-step-icon">${isDisputed ? '<i class="fa-solid fa-circle-exclamation"></i>' : '<i class="fa-solid fa-xmark"></i>'}</div>
          <div class="timeline-step-body">
            <h4 class="timeline-step-title">${escapeHTML(p.trackingTerminal.title)}</h4>
            <span class="timeline-step-time">${escapeHTML(formatDateTime(p.trackingTerminal.time))}</span>
          </div>
        </div>
      `);
    }
    timelineStepsList.innerHTML = rows.join('');
  }

  function renderContextualBanners(p, isSender) {
    const bannersContainer = ui('contextualBannersContainer');
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
      if (isSender) {
        addBanner('🔄 Location Change Pending', `Waiting for the traveler to respond to your change request.`, 'fa-clock');
      }
    }
  }

  function renderActionBanner(p, isSender) {
    const actionBanner = ui('actionBanner');
    if (!actionBanner) return;

    const title = ui('actionBannerTitle');
    const desc = ui('actionBannerDesc');
    const buttons = ui('actionBannerButtons');

    const s = p.status;

    if (s === 'pending') {
      actionBanner.className = 'journey-action-box is-info';
      title.innerHTML = '<i class="fa-solid fa-hourglass-half"></i> Awaiting Traveler';
      desc.textContent = 'Your parcel is visible to travelers travelling on this route. You will be notified when someone accepts.';
      buttons.innerHTML = isSender && !p.traveler && !p.acceptedAt
        ? `<a href="post.html?edit=${encodeURIComponent(p.id)}" class="btn-ghost" style="text-decoration:none;"><i class="fa-solid fa-pen"></i> Edit Details</a>`
        : '';
      actionBanner.classList.remove('hidden');
    } else if (['accepted', 'pickup_point_pending', 'pickup_point_selected'].includes(s)) {
      actionBanner.className = 'journey-action-box';
      title.innerHTML = '<i class="fa-solid fa-handshake"></i> Ready for Handover';
      if (isSender) {
        desc.textContent = 'Meet the traveler to hand over the parcel. They can scan your secure QR code or request an email verification code.';
        buttons.innerHTML = `
          <button type="button" class="btn-primary" onclick="window.generateSecureQr('pickup')"><i class="fa-solid fa-qrcode"></i> Show Pickup QR</button>
        `;
      } else {
        const isPointNeeded = s === 'pickup_point_pending';
        desc.textContent = isPointNeeded
          ? 'Choose a convenient meeting point to collect the parcel from the sender.'
          : 'Collect the parcel from the sender. Scan their secure QR code to confirm handover.';
        buttons.innerHTML = isPointNeeded
          ? `<button type="button" class="btn-primary" onclick="window.openLocationPicker('pickup', false)"><i class="fa-solid fa-location-dot"></i> Select Pickup Point</button>`
          : `
          <button type="button" class="btn-primary scan-qr-btn" data-id="${escapeHTML(p.id)}" data-type="pickup"><i class="fa-solid fa-camera"></i> Scan Sender QR</button>
          <button type="button" class="btn-ghost handover-otp-btn" data-id="${escapeHTML(p.id)}" data-type="pickup"><i class="fa-solid fa-envelope"></i> Verify using Email OTP</button>
        `;
      }
      actionBanner.classList.remove('hidden');
    } else if (s === 'pickup_confirmed') {
      actionBanner.className = 'journey-action-box is-info';
      title.innerHTML = '<i class="fa-solid fa-box-archive"></i> Parcel Collected';
      if (isSender) {
        desc.textContent = 'The traveler has safely received your parcel. The transit will begin shortly.';
        buttons.innerHTML = `<a href="track.html?id=${encodeURIComponent(p.id)}" class="btn-ghost" style="text-decoration:none;"><i class="fa-solid fa-location-crosshairs"></i> Live Map</a>`;
      } else {
        desc.textContent = 'Parcel pickup is confirmed! Start your journey to notify the sender that delivery is underway.';
        buttons.innerHTML = `
          <button type="button" class="btn-primary" id="startJourneyBtn"><i class="fa-solid fa-truck-fast"></i> Start Delivery Journey</button>
        `;
      }
      actionBanner.classList.remove('hidden');
    } else if (['in_transit', 'delivery_point_pending', 'delivery_point_selected'].includes(s)) {
      actionBanner.className = 'journey-action-box';
      title.innerHTML = '<i class="fa-solid fa-truck-fast"></i> Parcel in Transit';
      if (isSender) {
        desc.textContent = 'The parcel is on the way. At delivery, the recipient can show a QR code or provide an email verification code.';
        buttons.innerHTML = `
          <button type="button" class="btn-primary" onclick="window.generateSecureQr('delivery')"><i class="fa-solid fa-qrcode"></i> Show Delivery QR</button>
        `;
      } else {
        const isPointNeeded = s === 'delivery_point_pending';
        desc.textContent = isPointNeeded
          ? 'Choose the final destination point to deliver the parcel safely.'
          : 'You are currently transporting this parcel. Hand over to the recipient and scan their secure QR code to complete.';
        buttons.innerHTML = isPointNeeded
          ? `<button type="button" class="btn-primary" onclick="window.openLocationPicker('delivery', false)"><i class="fa-solid fa-location-dot"></i> Select Delivery Point</button>`
          : `
          <button type="button" class="btn-primary scan-qr-btn" data-id="${escapeHTML(p.id)}" data-type="delivery"><i class="fa-solid fa-camera"></i> Scan Recipient QR</button>
          <button type="button" class="btn-ghost handover-otp-btn" data-id="${escapeHTML(p.id)}" data-type="delivery"><i class="fa-solid fa-envelope"></i> Verify using Email OTP</button>
        `;
      }
      actionBanner.classList.remove('hidden');
    } else if (s === 'delivered') {
      actionBanner.className = 'journey-action-box is-info';
      title.innerHTML = '<i class="fa-solid fa-circle-check"></i> Delivered Successfully';
      desc.textContent = isSender
        ? 'Parcel delivery verified! Your payment has been securely settled to the traveler.'
        : 'Delivery completed! Your earnings have been credited to your CarryParcel wallet.';

      let buttonsHtml = '';
      if (!p.isRated) {
        buttonsHtml += `<button type="button" class="btn-primary" onclick="window.openReviewModal()"><i class="fa-solid fa-star"></i> Rate Experience</button>`;
      } else {
        buttonsHtml += `<span class="tag tag--delivered" style="height:36px; padding:0 14px; display:inline-flex; align-items:center;"><i class="fa-solid fa-check"></i> Reviewed</span>`;
      }
      buttonsHtml += `<button type="button" class="btn-ghost" id="genReceiptBtn" style="border-color:var(--primary); color:var(--primary);"><i class="fa-solid fa-file-invoice"></i> Generate Receipt</button>`;

      buttons.innerHTML = buttonsHtml;
      actionBanner.classList.remove('hidden');

      const genBtn = ui('genReceiptBtn');
      if (genBtn) genBtn.onclick = () => window.generateReceipt();
    } else {
      actionBanner.classList.add('hidden');
    }

    attachActionBannerEvents();
  }

  function attachActionBannerEvents() {
    const startJourneyBtn = ui('startJourneyBtn');
    if (startJourneyBtn) startJourneyBtn.onclick = startJourneyAction;

    // Attach QR Scanner buttons
    document.querySelectorAll('.scan-qr-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const type = btn.dataset.type; // 'pickup' or 'delivery'
        openQrScanner(id, type);
      });
    });

    document.querySelectorAll('.handover-otp-btn').forEach(btn => {
      btn.addEventListener('click', () => openHandoverOtp(btn.dataset.id, btn.dataset.type));
    });
  }

  function renderHandoverOtpCountdown() {
    const secondsToResend = Math.max(0, Math.ceil((handoverOtpResendAt - Date.now()) / 1000));
    const secondsToExpire = Math.max(0, Math.ceil((handoverOtpExpiresAt - Date.now()) / 1000));
    if (handoverOtpResend()) {
      handoverOtpResend().disabled = secondsToResend > 0;
      handoverOtpResend().textContent = secondsToResend > 0 ? `Resend in ${secondsToResend}s` : 'Resend code';
    }
    if (secondsToExpire > 0 && handoverOtpCountdown()) {
      handoverOtpCountdown().textContent = `Sent to ${handoverOtpStatus().dataset.maskedEmail}. Expires in ${Math.floor(secondsToExpire / 60)}:${String(secondsToExpire % 60).padStart(2, '0')}.`;
    } else if (handoverOtpStatus()?.dataset.maskedEmail && handoverOtpCountdown()) {
      handoverOtpCountdown().textContent = 'Code expired. Request a new code to continue.';
    }
    if (!secondsToResend && !secondsToExpire) clearInterval(handoverOtpTimer);
  }

  async function requestHandoverOtp() {
    if (!parcelData?.id || !handoverOtpPurpose) return;
    const sequence = ++handoverOtpSequence;
    const parcelId = parcelData.id;
    const purpose = handoverOtpPurpose;
    if (handoverOtpResend()) handoverOtpResend().disabled = true;
    if (handoverOtpVerify()) handoverOtpVerify().disabled = true;
    handoverOtpStatus().textContent = 'Sending verification code…';
    handoverOtpStatus().style.color = 'var(--text-muted)';
    try {
      const response = await fetch(
        `${API_BASE}/tracking/${encodeURIComponent(parcelId)}/otp/${purpose}/request`,
        authFetchOptions({ method: 'POST' })
      );
      const data = await response.json();
      if (sequence !== handoverOtpSequence) return;
      if (!response.ok || data.success === false) {
        if (data.retryAfterSeconds) {
          handoverOtpResendAt = Date.now() + data.retryAfterSeconds * 1000;
          renderHandoverOtpCountdown();
        } else if (handoverOtpResend()) {
          handoverOtpResend().disabled = false;
        }
        throw new Error(data.error || 'Could not send verification code.');
      }
      handoverOtpStatus().dataset.maskedEmail = data.sentTo?.email || 'the registered email';
      handoverOtpResendAt = Date.now() + Number(data.resendAfterSeconds || 60) * 1000;
      handoverOtpExpiresAt = Date.now() + Number(data.expiresInSeconds || 300) * 1000;
      handoverOtpStatus().textContent = 'Verification code sent.';
      handoverOtpStatus().style.color = 'var(--success)';
      renderHandoverOtpCountdown();
      if (handoverOtpVerify()) handoverOtpVerify().disabled = false;
      clearInterval(handoverOtpTimer);
      handoverOtpTimer = setInterval(renderHandoverOtpCountdown, 1000);
      handoverOtpInput()?.focus();
    } catch (error) {
      if (sequence !== handoverOtpSequence) return;
      handoverOtpStatus().textContent = error.message || 'Email delivery failed. No code was issued.';
      handoverOtpStatus().style.color = 'var(--error)';
      if (handoverOtpVerify()) handoverOtpVerify().disabled = true;
    }
  }

  function openHandoverOtp(parcelId, purpose) {
    if (!parcelData || parcelId !== String(parcelData.id) || !['pickup', 'delivery'].includes(purpose)) return;
    handoverOtpPurpose = purpose;
    handoverOtpExpiresAt = 0;
    handoverOtpResendAt = 0;
    handoverOtpInput().value = '';
    handoverOtpStatus().dataset.maskedEmail = '';
    handoverOtpStatus().textContent = '';
    handoverOtpCountdown().textContent = '';
    handoverOtpTitle().textContent = `Verify ${purpose === 'pickup' ? 'Pickup' : 'Delivery'} by Email OTP`;
    handoverOtpDescription().textContent = purpose === 'pickup'
      ? 'A one-time code will be sent to the parcel sender’s registered email. Ask them to share it when they are ready to hand over the parcel.'
      : 'A one-time code will be sent to the linked recipient’s registered email. Ask them to share it when they are ready to receive the parcel.';
    handoverOtpModal().classList.remove('hidden');
    requestHandoverOtp();
  }

  async function verifyHandoverOtp() {
    const otp = handoverOtpInput()?.value.trim() || '';
    if (!/^\d{6}$/.test(otp)) {
      handoverOtpStatus().textContent = 'Enter the six-digit code from the email.';
      handoverOtpStatus().style.color = 'var(--error)';
      return;
    }
    const sequence = ++handoverOtpSequence;
    const parcelId = parcelData.id;
    const purpose = handoverOtpPurpose;
    handoverOtpVerify().disabled = true;
    handoverOtpVerify().textContent = 'Verifying…';
    handoverOtpStatus().textContent = 'Verifying handover…';
    handoverOtpStatus().style.color = 'var(--text-muted)';
    try {
      const response = await fetch(
        `${API_BASE}/tracking/${encodeURIComponent(parcelId)}/otp/${purpose}/verify`,
        authFetchOptions({ method: 'POST', body: JSON.stringify({ otp }) })
      );
      const data = await response.json();
      if (sequence !== handoverOtpSequence) return;
      if (!response.ok || data.success === false) {
        if (data.retryAfterSeconds) {
          handoverOtpResendAt = Date.now() + data.retryAfterSeconds * 1000;
          renderHandoverOtpCountdown();
        }
        throw new Error(data.error || 'Could not verify handover.');
      }
      clearInterval(handoverOtpTimer);
      handoverOtpModal().classList.add('hidden');
      window.showToast(data.message || 'Handover verified successfully.', 'success');
      loadParcelDetails();
    } catch (error) {
      if (sequence !== handoverOtpSequence) return;
      handoverOtpStatus().textContent = error.message || 'Could not verify handover.';
      handoverOtpStatus().style.color = 'var(--error)';
      handoverOtpVerify().disabled = false;
    } finally {
      if (sequence === handoverOtpSequence) handoverOtpVerify().textContent = 'Verify handover';
    }
  }

  function renderCounterpart(p, isSender) {
    const person = isSender ? p.traveler : p.sender;
    const counterpartTitle = ui('counterpartTitle');
    const counterpartAvatar = ui('counterpartAvatar');
    const counterpartName = ui('counterpartName');
    const counterpartVerified = ui('counterpartVerified');
    const counterpartRating = ui('counterpartRating');
    const counterpartDeliveries = ui('counterpartDeliveries');
    const counterpartChatBtn = ui('counterpartChatBtn');
    const chatCounterpartBtn = ui('chatCounterpartBtn');
    const counterpartBox = ui('counterpartBox');
    const hasAcceptedTraveler = Boolean(p.traveler);
    const isCompleted = ['delivered', 'cancelled', 'cancelled_by_sender', 'cancelled_by_traveler', 'cancelled_by_system'].includes(p.status);

    if (counterpartTitle) counterpartTitle.textContent = isSender ? 'Assigned Traveler' : 'Parcel Sender';
    if (chatCounterpartBtn) chatCounterpartBtn.style.display = hasAcceptedTraveler ? 'inline-flex' : 'none';
    if (counterpartChatBtn) counterpartChatBtn.style.display = hasAcceptedTraveler ? 'inline-flex' : 'none';

    if (!person) {
      if (counterpartAvatar) counterpartAvatar.textContent = '?';
      if (counterpartName) counterpartName.textContent = 'Searching for traveler...';
      if (counterpartVerified) counterpartVerified.style.display = 'none';
      if (counterpartRating) counterpartRating.innerHTML = '<i class="fa-solid fa-clock"></i> Not assigned yet';
      if (counterpartDeliveries) counterpartDeliveries.style.display = 'none';
      if (counterpartChatBtn) counterpartChatBtn.disabled = true;
      return;
    }

    if (counterpartAvatar) {
        counterpartAvatar.textContent = person.initials || 'TB';
        if (person.profilePhoto) {
          counterpartAvatar.style.backgroundImage = `url(${window.TravelBuddy.resolveMediaUrl(person.profilePhoto)})`;
          counterpartAvatar.classList.add('has-photo');
        }
    }
    if (counterpartName) counterpartName.textContent = person.displayName || 'Counterpart';
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
      counterpartChatBtn.disabled = isCompleted;
      counterpartChatBtn.onclick = isCompleted ? null : () => startChatWithCounterpart(person.userId);
    }
    if (chatCounterpartBtn) {
      chatCounterpartBtn.disabled = isCompleted;
      chatCounterpartBtn.onclick = isCompleted ? null : () => startChatWithCounterpart(person.userId);
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
    const avatar = ui('profAvatar');
    const name = ui('profName');
    const verified = ui('profVerified');
    const rating = ui('profRating');
    const trips = ui('profTrips');
    const posted = ui('profPosted');
    const joined = ui('profJoined');
    const reliability = ui('profReliability');

    profileModal().classList.remove('hidden');

    name.textContent = 'Loading...';
    avatar.style.backgroundImage = 'none';
    avatar.textContent = '..';

    try {
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
      reliability.textContent = '100%';
      joined.textContent = window.TravelBuddyDate ? window.TravelBuddyDate.formatDate(p.memberSince, { month: 'short', year: 'numeric' }) : 'Aug 2026';

    } catch (err) {
      name.textContent = 'Error loading profile';
    }
  }

  function initMap(lat, lng) {
    const center = [Number(lat), Number(lng)];
    if (map) {
      map.setView(center, Math.max(map.getZoom(), 13));
      if (mapMarker) mapMarker.setLatLng(center);
      return;
    }

    map = L.map('locationPickerMap').setView(center, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    mapMarker = L.marker(center, { draggable: true, autoPan: true }).addTo(map);

    mapMarker.on('dragend', function() {
      const pos = mapMarker.getLatLng();
      scheduleLocationResolution(pos.lat, pos.lng);
    });

    map.on('click', function(e) {
      mapMarker.setLatLng(e.latlng);
      scheduleLocationResolution(e.latlng.lat, e.latlng.lng);
    });

    map.on('dragend', function() {
      const centerPoint = map.getCenter();
      mapMarker.setLatLng(centerPoint);
      scheduleLocationResolution(centerPoint.lat, centerPoint.lng);
    });
  }

  function setLocationFromData(latitude, longitude, name, formattedAddress, city = '') {
    if (!isValidLocation(latitude, longitude) || !name?.trim() || !formattedAddress?.trim()) {
      window.showToast('Please select a valid location with an address before confirming.', 'warning');
      return;
    }
    const lat = Number(latitude);
    const lng = Number(longitude);

    selectedLocation = {
      name,
      formattedAddress,
      latitude: lat,
      longitude: lng,
      city
    };

    if (mapMarker) {
      mapMarker.setLatLng([lat, lng]);
    }
    if (map) {
      map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { animate: true, duration: 1.2 });
    }
    renderSelectedPoint();
  }

  function showLocationResolutionStatus(name, address) {
    const coordinates = /Coordinates: (-?\d+(?:\.\d+)?), (-?\d+(?:\.\d+)?)/.exec(address || '');
    if (name === 'Address unavailable' && coordinates) {
      selectedLocation = {
        name: 'Map point (address unavailable)',
        formattedAddress: `Address unavailable; coordinates: ${coordinates[1]}, ${coordinates[2]}`,
        latitude: Number(coordinates[1]),
        longitude: Number(coordinates[2]),
        city: '',
        addressResolved: false
      };
    } else {
      selectedLocation = null;
    }
    selectedPointCard().classList.remove('hidden');
    selectedPointName().textContent = name;
    selectedPointAddress().textContent = address;
    selectedPointAddress().style.color = selectedLocation ? 'var(--error)' : 'var(--text-muted)';
    confirmLocationBtn().disabled = !selectedLocation;
  }

  function scheduleLocationResolution(lat, lng) {
    if (!isValidLocation(lat, lng)) {
      window.showToast('Invalid latitude or longitude selected.', 'warning');
      return;
    }
    const latitude = Number(lat);
    const longitude = Number(lng);
    const coordinateKey = `${latitude},${longitude}`;
    if ((selectedLocation?.latitude === latitude && selectedLocation?.longitude === longitude)
      || pendingReverseGeocodeKey === coordinateKey) return;

    clearTimeout(reverseGeocodeTimer);
    reverseGeocodeAbortController?.abort();
    reverseGeocodeAbortController = new AbortController();
    const controller = reverseGeocodeAbortController;
    const requestSequence = ++reverseGeocodeSequence;
    pendingReverseGeocodeKey = coordinateKey;
    showLocationResolutionStatus('Resolving address…', `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
    reverseGeocodeTimer = setTimeout(async () => {
      try {
        const response = await fetch(
          `${API_ORIGIN}/api/geocoding/reverse?lat=${latitude}&lon=${longitude}`,
          { headers: { Accept: 'application/json' }, signal: controller.signal }
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not resolve the selected location.');
        if (requestSequence !== reverseGeocodeSequence) return;
        const address = data.address || {};
        const formattedAddress = data.display_name;
        if (!formattedAddress) {
          throw new Error('The geocoding provider returned no address for this point.');
        }
        const locationName = data.name || address.amenity || address.building || address.road
          || formattedAddress.split(',')[0];
        const city = address.city || address.town || address.village || address.county || address.state || '';
        setLocationFromData(latitude, longitude, locationName, formattedAddress, city);
        pendingReverseGeocodeKey = null;
        setGeocodingProviderAttribution(response);
      } catch (error) {
        if (requestSequence !== reverseGeocodeSequence || error.name === 'AbortError') return;
        pendingReverseGeocodeKey = null;
        console.error('Reverse geocoding failed:', error);
        showLocationResolutionStatus(
          'Address unavailable',
          `Address lookup failed. You can still confirm this exact map point. Coordinates: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}.`
        );
        window.showToast(error.message || 'Could not resolve the selected location.', 'error');
      }
    }, 500);
  }

  async function searchLocationByQuery(query) {
    clearTimeout(locationSearchTimer);
    const searchText = String(query || '').trim();
    const normalizedQuery = searchText.toLocaleLowerCase();
    if (locationSearchPendingQuery === normalizedQuery && locationSearchAbortController) return;
    const cachedResults = locationSearchCache.get(normalizedQuery);
    if (cachedResults && cachedResults.expiresAt > Date.now()) {
      renderLocationSearchResults(cachedResults.results);
      return;
    }
    const requestSequence = ++locationSearchSequence;
    locationSearchAbortController?.abort();
    locationSearchPendingQuery = null;
    clearTimeout(reverseGeocodeTimer);
    reverseGeocodeAbortController?.abort();
    reverseGeocodeSequence++;
    pendingReverseGeocodeKey = null;
    selectedLocation = null;
    selectedPointCard()?.classList.add('hidden');
    if (confirmLocationBtn()) confirmLocationBtn().disabled = true;
    if (!locationSearchResults() || searchText.length < 2) {
      if (locationSearchResults()) {
        locationSearchResults().innerHTML = '<div style="font-size:12px; color:var(--text-faint); padding:8px 0;">Enter at least 2 characters to search.</div>';
      }
      if (locationSearchBtn()) locationSearchBtn().disabled = false;
      return;
    }

    locationSearchAbortController = new AbortController();
    const controller = locationSearchAbortController;
    locationSearchPendingQuery = normalizedQuery;
    locationSearchResults().textContent = 'Searching…';
    if (locationSearchBtn()) locationSearchBtn().disabled = true;
    try {
      const response = await fetch(
        `${API_ORIGIN}/api/geocoding/search?q=${encodeURIComponent(searchText)}`,
        { headers: { Accept: 'application/json' }, signal: controller.signal }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not search locations right now.');
      if (requestSequence !== locationSearchSequence) return;
      if (!Array.isArray(data)) throw new Error('The geocoding service returned an invalid search response.');
      locationSearchCache.set(normalizedQuery, { results: data, expiresAt: Date.now() + 5 * 60 * 1000 });
      if (locationSearchCache.size > 20) locationSearchCache.delete(locationSearchCache.keys().next().value);
      setGeocodingProviderAttribution(response);
      renderLocationSearchResults(data);
    } catch (error) {
      if (requestSequence !== locationSearchSequence || error.name === 'AbortError') return;
      console.error('Address search failed:', error);
      locationSearchResults().innerHTML = `<div style="font-size:12px; color:var(--error); padding:8px 0;">${escapeHTML(error.message || 'Could not search locations right now. Please try again.')}</div>`;
    } finally {
      if (requestSequence === locationSearchSequence) locationSearchPendingQuery = null;
      if (requestSequence === locationSearchSequence && locationSearchBtn()) locationSearchBtn().disabled = false;
    }
  }

  function setGeocodingProviderAttribution(response) {
    const provider = response?.headers?.get('X-Geocoding-Provider');
    if (geocodingProviderAttribution() && ['photon', 'nominatim'].includes(provider)) {
      geocodingProviderAttribution().textContent = provider === 'photon' ? 'Photon' : 'Nominatim';
    }
  }

  function renderLocationSearchResults(data) {
    if (!locationSearchResults()) return;
    if (!data.length) {
      locationSearchResults().innerHTML = '<div style="font-size:12px; color:var(--text-faint); padding:8px 0;">No matching location found. Try another address or landmark.</div>';
      return;
    }
    locationSearchResults().innerHTML = data.map(item => {
      const displayName = item.display_name || item.name || '';
      const name = item.name || displayName.split(',')[0];
      const latitude = Number(item.lat);
      const longitude = Number(item.lon);
      if (!displayName || !name || !isValidLocation(latitude, longitude)) return '';
      const address = item.address || {};
      const city = address.city || address.town || address.village || address.county || address.state || '';
      return `<button type="button" data-search-result="true" data-lat="${latitude}" data-lon="${longitude}" data-name="${escapeHTML(name)}" data-display="${escapeHTML(displayName)}" data-city="${escapeHTML(city)}" style="width:100%; text-align:left; background:#fff; border:1px solid var(--border); border-radius:8px; padding:10px; color:var(--text-main); cursor:pointer;">
        <strong style="display:block; font-size:12.5px;">${escapeHTML(name)}</strong>
        <span style="display:block; font-size:11px; color:var(--text-muted); margin-top:2px;">${escapeHTML(displayName)}</span>
      </button>`;
    }).join('') || '<div style="font-size:12px; color:var(--text-faint); padding:8px 0;">No usable locations found. Try another search.</div>';
  }
  function renderSelectedPoint() {
    if (!selectedLocation) return;
    selectedPointCard().classList.remove('hidden');
    selectedPointName().textContent = selectedLocation.name;
    selectedPointAddress().textContent = selectedLocation.formattedAddress;
    selectedPointAddress().style.color = selectedLocation.addressResolved === false
      ? 'var(--error)'
      : 'var(--text-muted)';
    confirmLocationBtn().disabled = false;

    if (selectedLocation.compatibility && compatibilityBadge()) {
      compatibilityBadge().classList.remove('hidden', 'tag--success', 'tag--warning', 'tag--error');
      compatibilityBadge().textContent = selectedLocation.compatibility;
      if (selectedLocation.compatibility === 'EXCELLENT') compatibilityBadge().classList.add('tag--success');
      else if (selectedLocation.compatibility === 'GOOD') compatibilityBadge().classList.add('tag--warning');
      else if (selectedLocation.compatibility === 'DETOUR') {
        compatibilityBadge().classList.add('tag--error');
        detourWarningBox()?.classList.remove('hidden');
      } else {
        compatibilityBadge().classList.add('hidden');
      }
    } else {
      compatibilityBadge()?.classList.add('hidden');
      detourWarningBox()?.classList.add('hidden');
    }

    if (isRequestChange && chosenLocationText()) {
       chosenLocationText().textContent = selectedLocation.name;
    }
  }

  function showVerificationSuccess() {
    if (!verificationSuccessOverlay()) return;
    verificationSuccessOverlay().classList.remove('hidden');
    setTimeout(() => {
      verificationSuccessOverlay().classList.add('hidden');
    }, 2500);
  }

  if (locationSearchInput()) {
    locationSearchInput().addEventListener('input', () => {
      clearTimeout(locationSearchTimer);
      locationSearchAbortController?.abort();
      locationSearchPendingQuery = null;
      clearTimeout(reverseGeocodeTimer);
      reverseGeocodeAbortController?.abort();
      locationSearchSequence++;
      reverseGeocodeSequence++;
      pendingReverseGeocodeKey = null;
      selectedLocation = null;
      selectedPointCard()?.classList.add('hidden');
      if (confirmLocationBtn()) confirmLocationBtn().disabled = true;
      if (locationSearchResults()) locationSearchResults().innerHTML = '';
      if (locationSearchBtn()) locationSearchBtn().disabled = false;
      const query = locationSearchInput().value.trim();
      if (query.length >= 2) {
        locationSearchResults().textContent = 'Searching shortly…';
        locationSearchTimer = setTimeout(() => searchLocationByQuery(query), 550);
      } else if (query) {
        locationSearchResults().textContent = 'Enter at least 2 characters to search.';
      }
    });

    locationSearchInput().addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        searchLocationByQuery(locationSearchInput().value);
      }
    });

    locationSearchResults()?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-search-result]');
      if (!button) return;

      const latitude = Number(button.dataset.lat);
      const longitude = Number(button.dataset.lon);
      const displayName = button.dataset.display || button.dataset.name || 'Selected Location';
      const name = button.dataset.name || displayName;
      if (!isValidLocation(latitude, longitude)) {
        window.showToast('This location is missing valid coordinates.', 'warning');
        return;
      }

      clearTimeout(reverseGeocodeTimer);
      reverseGeocodeAbortController?.abort();
      reverseGeocodeSequence++;
      locationSearchSequence++;
      locationSearchAbortController?.abort();
      locationSearchPendingQuery = null;
      pendingReverseGeocodeKey = null;
      locationSearchInput().value = displayName;
      locationSearchResults().innerHTML = '';
      setLocationFromData(latitude, longitude, name, displayName, button.dataset.city || '');
      locationPickerMap().classList.remove('hidden');
      if (map) {
        mapMarker.setLatLng([latitude, longitude]);
        map.flyTo([latitude, longitude], 15, { animate: true, duration: 1.2 });
      } else {
        setTimeout(() => {
          initMap(latitude, longitude);
          map.invalidateSize();
        }, 100);
      }
    });
  }

  if (locationSearchBtn()) {
    locationSearchBtn().onclick = () => searchLocationByQuery(locationSearchInput()?.value || '');
  }

  window.openLocationPicker = async (purpose, requestChange = false) => {
    if (!parcelData || !parcelData.id) {
       window.showToast('Wait for parcel data to load...', 'warning');
       return;
    }
    activePickerPurpose = purpose;
    isRequestChange = requestChange;
    selectedLocation = null;
    clearTimeout(reverseGeocodeTimer);
    reverseGeocodeAbortController?.abort();
    clearTimeout(locationSearchTimer);
    locationSearchAbortController?.abort();
    locationSearchPendingQuery = null;
    locationSearchSequence++;
    reverseGeocodeSequence++;
    pendingReverseGeocodeKey = null;
    locationModalTitle().textContent = `Select ${purpose === 'pickup' ? 'Pickup' : 'Delivery'} Point`;
    if (locationSearchInput()) locationSearchInput().value = '';
    if (locationSearchResults()) locationSearchResults().innerHTML = '';
    if (locationSearchBtn()) locationSearchBtn().disabled = false;

    const existing = purpose === 'pickup' ? parcelData.pickupPoint : parcelData.deliveryPoint;
    if (changingWarning()) changingWarning().classList.toggle('hidden', !existing?.name);

    if (locationModal()) locationModal().classList.remove('hidden');
    if (locationPickerMap()) locationPickerMap().classList.add('hidden');
    if (selectedPointCard()) selectedPointCard().classList.add('hidden');
    if (confirmLocationBtn()) confirmLocationBtn().disabled = true;

    try {
      if (recommendedPointsList()) recommendedPointsList().innerHTML = '<p style="font-size:12px; color:var(--text-faint);">Loading recommendations...</p>';
      const res = await fetch(`${API_BASE}/tracking/${parcelData.id}/location-recommendations?purpose=${purpose}`, authFetchOptions());
      const data = await res.json();

      if (data.recommendations?.length) {
        recommendedPointsList().innerHTML = data.recommendations.map(p => `
          <div class="recent-item" onclick="selectRecommendedPoint('${p._id}')" style="background:#fff; border:1px solid var(--border); border-radius:8px; padding:10px; cursor:pointer;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong style="font-size:13px;">${escapeHTML(p.name)}</strong>
              ${p.isBestMatch ? '<span style="font-size:9px; background:var(--success); color:#fff; padding:2px 6px; border-radius:4px;">Best Match</span>' : ''}
            </div>
            <p style="font-size:11px; color:var(--text-muted); margin:2px 0 0;">${escapeHTML(p.formattedAddress)}</p>
          </div>
        `).join('');
        window._points = data.recommendations;
      } else {
        recommendedPointsList().innerHTML = '<p style="font-size:12px; color:var(--text-faint);">No specific recommendations for this city. Use the map or search to pick a point.</p>';
      }
    } catch (e) {
      recommendedPointsList().innerHTML = '<p style="font-size:12px; color:var(--error);">Failed to load recommendations.</p>';
    }
  };

  window.selectRecommendedPoint = (id) => {
    const p = (window._points || []).find(x => x._id === id);
    if (!p) return;
    if (!isValidLocation(p.latitude, p.longitude)) {
      window.showToast('This recommended point is missing valid coordinates.', 'warning');
      return;
    }
    clearTimeout(reverseGeocodeTimer);
    reverseGeocodeAbortController?.abort();
    reverseGeocodeSequence++;
    pendingReverseGeocodeKey = null;
    selectedLocation = {
      travelPointId: p._id,
      name: p.name,
      type: p.type,
      formattedAddress: p.formattedAddress,
      city: p.city,
      latitude: Number(p.latitude),
      longitude: Number(p.longitude),
      compatibility: p.compatibility
    };
    if (locationSearchInput()) locationSearchInput().value = p.formattedAddress;
    if (locationPickerMap()) locationPickerMap().classList.remove('hidden');
    if (map) {
      mapMarker.setLatLng([selectedLocation.latitude, selectedLocation.longitude]);
      map.flyTo([selectedLocation.latitude, selectedLocation.longitude], 15, { animate: true, duration: 1.2 });
    } else {
      setTimeout(() => {
        initMap(selectedLocation.latitude, selectedLocation.longitude);
        map.invalidateSize();
      }, 100);
    }
    renderSelectedPoint();
  };

  if (pickOnMapBtn()) {
    pickOnMapBtn().onclick = () => {
      locationPickerMap().classList.remove('hidden');
      const center = selectedLocation
        ? [selectedLocation.latitude, selectedLocation.longitude]
        : map
          ? [map.getCenter().lat, map.getCenter().lng]
          : [20.5937, 78.9629];
      setTimeout(() => {
        initMap(center[0], center[1]);
        map.invalidateSize();
      }, 100);
    };
  }

  if (useCurrentLocationBtn()) {
    useCurrentLocationBtn().onclick = () => {
       if (!navigator.geolocation) {
         window.showToast('Geolocation is not supported by your browser.', 'error');
         return;
       }
       if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
         window.showToast('Location access requires a secure connection. Please use HTTPS or choose a location manually.', 'warning');
         return;
       }
       selectedLocation = null;
       selectedPointCard()?.classList.add('hidden');
       if (confirmLocationBtn()) confirmLocationBtn().disabled = true;
       setButtonLoading(useCurrentLocationBtn(), true, 'Locating...');
       navigator.geolocation.getCurrentPosition(
         (pos) => {
           setButtonLoading(useCurrentLocationBtn(), false);
           const { latitude, longitude, accuracy } = pos.coords;
           if (!isValidLocation(latitude, longitude)) {
             window.showToast('The browser returned invalid coordinates. Please choose a point manually.', 'warning');
             return;
           }
           scheduleLocationResolution(latitude, longitude);
           locationPickerMap().classList.remove('hidden');
           setTimeout(() => {
             initMap(latitude, longitude);
             if (map) map.invalidateSize();
           }, 100);
           window.showToast(
             accuracy > 0
               ? `Current location found (accuracy about ${Math.round(accuracy)} m). Resolving address…`
               : 'Current location found. Resolving address…',
             'success'
           );
         },
         (error) => {
           setButtonLoading(useCurrentLocationBtn(), false);
           handleLocationError(error, 'Your current location could not be determined. Please try again or choose a location manually.');
         },
         {
           enableHighAccuracy: true,
           timeout: 15000,
           maximumAge: 30000
         }
       );
    };
  }

  if (confirmLocationBtn()) {
    confirmLocationBtn().onclick = async () => {
       if (!selectedLocation) return;
       if (!isValidLocation(selectedLocation.latitude, selectedLocation.longitude)
         || !selectedLocation.name?.trim()
         || !selectedLocation.formattedAddress?.trim()) {
         window.showToast('Select a valid location with a resolved address before confirming.', 'warning');
         return;
       }
       if (isRequestChange) {
          locationModal().classList.add('hidden');
          return;
       }
       setButtonLoading(confirmLocationBtn(), true, 'Saving...');
       try {
         const url = `${API_BASE}/tracking/${parcelData.id}/${activePickerPurpose}-point`;
         const res = await fetch(url, authFetchOptions({
           method: 'POST',
           body: JSON.stringify(selectedLocation)
         }));
         const data = await res.json();
         if (!res.ok) throw new Error(data.error);
         window.showToast(`${activePickerPurpose.toUpperCase()} point saved!`, 'success');
         locationModal().classList.add('hidden');
         loadParcelDetails();
       } catch (err) {
         window.showToast(err.message || 'Failed to save location', 'error');
       } finally {
         setButtonLoading(confirmLocationBtn(), false);
       }
    };
  }

  function openLocationChangeRequest(purpose) {
     activePickerPurpose = purpose;
     isRequestChange = true;
     selectedLocation = null;
     chosenLocationText().textContent = 'Choose meeting point...';
     changeReasonText().value = '';
     locationChangeModal().classList.remove('hidden');
  }

  if (openLocationPickerBtn()) {
    openLocationPickerBtn().onclick = () => openLocationPicker(activePickerPurpose, true);
  }

  if (submitChangeRequestBtn()) {
    submitChangeRequestBtn().onclick = async () => {
      if (!selectedLocation) {
        window.showToast('Please select a new location first', 'warning');
        return;
      }
      setButtonLoading(submitChangeRequestBtn(), true, 'Sending...');
      try {
        const res = await fetch(`${API_BASE}/tracking/${parcelData.id}/location-change/request`, authFetchOptions({
          method: 'POST',
          body: JSON.stringify({
            type: activePickerPurpose,
            newLocation: selectedLocation,
            reason: changeReasonText().value.trim()
          })
        }));
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        window.showToast('Request sent to traveler!', 'success');
        locationChangeModal().classList.add('hidden');
        loadParcelDetails();
      } catch (err) {
        window.showToast(err.message || 'Failed to send request', 'error');
      } finally {
        setButtonLoading(submitChangeRequestBtn(), false);
      }
    };
  }

  async function handleLocationRequest(action) {
    const btn = action === 'approve' ? ui('approveLocationBtn') : ui('declineLocationBtn');
    if (!btn) return;
    setButtonLoading(btn, true, action === 'approve' ? 'Approving...' : 'Declining...');
    try {
      const res = await fetch(`${API_BASE}/tracking/${parcelData.id}/location-change/${action}`, authFetchOptions({ method: 'POST' }));
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
      const res = await fetch(`${API_ORIGIN}/api/messages/start`, authFetchOptions({
        method: 'POST',
        body: JSON.stringify({ recipientId: userId, parcelId: parcelData.id })
      }));
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
      const res = await fetch(`${API_BASE}/tracking/${encodeURIComponent(parcelData.id)}/actions/start-journey`, authFetchOptions({ method: 'POST' }));
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

  // QR Scanner function
  async function openQrScanner(parcelId, type) {
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
      
      let verifyResult;
      if (type === 'pickup') {
        verifyResult = await window.TravelBuddy.QRVerification.verifyPickupQr(parcelId, qrToken);
      } else {
        verifyResult = await window.TravelBuddy.QRVerification.verifyDeliveryQr(parcelId, qrToken);
      }
      
      if (verifyResult?.success) {
        window.showToast('Verification successful!', 'success');
        loadParcelDetails();
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

  if (confirmCancelBtn()) {
    confirmCancelBtn().onclick = async () => {
      if (!parcelData) return;
      const reason = cancelReason().value;
      setButtonLoading(confirmCancelBtn(), true, 'Cancelling...');
      try {
        const res = await fetch(`${API_BASE}/tracking/${encodeURIComponent(parcelData.id)}/cancel`, authFetchOptions({
          method: 'POST',
          body: JSON.stringify({ reason })
        }));
        const data = await res.json();
        if (!res.ok) {
          window.showToast(data.error || 'Could not cancel parcel.', 'error');
          return;
        }
        window.showToast(data.message || 'Parcel cancelled successfully.', 'success');
        cancelModal().classList.add('hidden');
        loadParcelDetails();
      } catch (err) {
        console.error(err);
        window.showToast('Network error while cancelling.', 'error');
      } finally {
        setButtonLoading(confirmCancelBtn(), false);
      }
    };
  }

  if (submitReviewBtn()) {
    submitReviewBtn().onclick = async () => {
      if (!parcelData) return;
      setButtonLoading(submitReviewBtn(), true, 'Submitting...');
      try {
        const res = await fetch(`${API_BASE}/review`, authFetchOptions({
          method: 'POST',
          body: JSON.stringify({
            parcelId: parcelData.id,
            rating: selectedRating,
            comment: reviewComment().value.trim(),
            role: parcelData.role
          })
        }));
        const data = await res.json();
        if (!res.ok) {
          window.showToast(data.error || 'Could not submit review.', 'error');
          return;
        }
        window.showToast('Thank you! Your review has been recorded.', 'success');
        reviewModal().classList.add('hidden');
        parcelData.isRated = true;
        loadParcelDetails();
      } catch (err) {
        console.error(err);
        window.showToast('Failed to submit review.', 'error');
      } finally {
        setButtonLoading(submitReviewBtn(), false);
      }
    };
  }

  if (submitReportBtn()) {
    submitReportBtn().onclick = async () => {
      if (!parcelData) return;
      const reason = reportReason().value;
      const desc = reportDescription().value.trim();
      if (!desc) {
        window.showToast('Please provide details in the description.', 'warning');
        return;
      }
      setButtonLoading(submitReportBtn(), true, 'Reporting...');
      try {
        const res = await fetch(`${API_BASE}/tracking/${encodeURIComponent(parcelData.id)}/report`, authFetchOptions({
          method: 'POST',
          body: JSON.stringify({ reason, description: desc })
        }));
        const data = await res.json();
        if (!res.ok) {
          window.showToast(data.error || 'Could not submit report.', 'error');
          return;
        }
        window.showToast('Report submitted successfully.', 'success');
        reportModal().classList.add('hidden');
      } catch (err) {
        console.error(err);
        window.showToast('Failed to submit report.', 'error');
      } finally {
        setButtonLoading(submitReportBtn(), false);
      }
    };
  }

  const closeModalElements = [
    cancelModalClose, cancelModalDismiss, otpModalClose, handoverOtpClose,
    reviewModalClose, reportModalClose, locationModalClose,
    profileModalClose, locationChangeModalClose, qrModalClose,
    receiptPreviewModalClose, closeReceiptPreviewBtn
  ];
  closeModalElements.forEach(fn => {
    const el = fn();
    if (el) el.onclick = () => {
      if (el === handoverOtpClose()) handoverOtpSequence++;
      if (el === locationModalClose()) {
        clearTimeout(reverseGeocodeTimer);
        reverseGeocodeAbortController?.abort();
        clearTimeout(locationSearchTimer);
        locationSearchAbortController?.abort();
        locationSearchPendingQuery = null;
        reverseGeocodeSequence++;
        pendingReverseGeocodeKey = null;
        locationSearchSequence++;
      }
      [cancelModal, otpModal, handoverOtpModal, reviewModal, reportModal, locationModal, profileModal, locationChangeModal, qrModal, receiptPreviewModal].forEach(m => m() && m().classList.add('hidden'));
      clearInterval(qrExpiryTimer);
      clearInterval(handoverOtpTimer);
    };
  });
  if (handoverOtpResend()) handoverOtpResend().onclick = requestHandoverOtp;
  if (handoverOtpVerify()) handoverOtpVerify().onclick = verifyHandoverOtp;
  if (handoverOtpInput()) {
    handoverOtpInput().addEventListener('input', () => {
      handoverOtpInput().value = handoverOtpInput().value.replace(/\D/g, '').slice(0, 6);
    });
    handoverOtpInput().addEventListener('keydown', (event) => {
      if (event.key === 'Enter') verifyHandoverOtp();
    });
  }

  window.generateSecureQr = generateSecureQr;
  window.generateReceipt = async () => {
    if (!parcelData) return;
    receiptGenModal().classList.remove('hidden');
    const stages = ['details', 'timeline', 'financials', 'final'];
    const resetStages = () => stages.forEach(s => {
      const el = ui(`stage-${s}`);
      if (el) {
          el.classList.remove('completed');
          el.querySelector('i').className = 'fa-regular fa-circle';
      }
    });
    resetStages();
    const runStage = async (id, ms) => {
      const el = ui(`stage-${id}`);
      await new Promise(r => setTimeout(r, ms));
      if (el) {
          el.classList.add('completed');
          el.querySelector('i').className = 'fa-solid fa-circle-check';
      }
    };
    try {
      await runStage('details', 800);
      await runStage('timeline', 1000);
      await runStage('financials', 800);
      await runStage('final', 1200);
      renderReceiptPreview();
      receiptGenModal().classList.add('hidden');
      receiptPreviewModal().classList.remove('hidden');
    } catch (err) {
      window.showToast('Failed to generate receipt.', 'error');
      receiptGenModal().classList.add('hidden');
    }
  };

  function renderReceiptPreview() {
    const p = parcelData;
    const isSender = p.role === 'sender';
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

    receiptPreviewContent().innerHTML = `
      <div class="receipt-preview-section">
        <h4>General Information</h4>
        <div class="receipt-row"><span class="receipt-label">Receipt ID</span><span class="receipt-value">${p.parcelNumber || p.id}</span></div>
        <div class="receipt-row"><span class="receipt-label">Parcel ID</span><span class="receipt-value">#${p.orderId || p.id}</span></div>
        <div class="receipt-row"><span class="receipt-label">Status</span><span class="receipt-value" style="color:var(--success);">Delivered</span></div>
        <div class="receipt-row"><span class="receipt-label">User Role</span><span class="receipt-value">${isSender ? 'Sender' : 'Traveler'}</span></div>
      </div>
      <div class="receipt-preview-section">
        <h4>Participants</h4>
        <div class="receipt-row"><span class="receipt-label">Sender</span><span class="receipt-value">${escapeHTML(p.sender?.displayName || 'CarryParcel Sender')}</span></div>
        <div class="receipt-row"><span class="receipt-label">Traveler</span><span class="receipt-value">${escapeHTML(p.traveler?.displayName || 'CarryParcel Traveler')}</span></div>
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
    `;
    downloadReceiptBtn().onclick = () => downloadReceiptPDF();
  }

  async function downloadReceiptPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const p = parcelData;
    const fin = p.financials || {};
    doc.setFillColor(13, 110, 253);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('CARRYPARCEL', 20, 20);
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
    row('Sender', p.sender?.displayName || 'CarryParcel User');
    row('Traveler', p.traveler?.displayName || 'CarryParcel User');
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
    doc.text('Generated by CarryParcel on ' + new Date().toLocaleString(), 105, y, { align: 'center' });
    doc.save(`CarryParcel-Receipt-${p.parcelNumber || p.id}.pdf`);
    window.showToast('Receipt downloaded successfully!', 'success');
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      handoverOtpSequence++;
      clearTimeout(reverseGeocodeTimer);
      reverseGeocodeAbortController?.abort();
      clearTimeout(locationSearchTimer);
      locationSearchAbortController?.abort();
      locationSearchPendingQuery = null;
      reverseGeocodeSequence++;
      locationSearchSequence++;
      pendingReverseGeocodeKey = null;
      [cancelModal, otpModal, handoverOtpModal, reviewModal, reportModal, locationModal, profileModal, locationChangeModal, qrModal].forEach(m => m() && m().classList.add('hidden'));
      clearInterval(qrExpiryTimer);
      clearInterval(handoverOtpTimer);
    }
  });

  document.addEventListener('travelbuddy:notification', (e) => {
    const notificationParcelId = e.detail?.parcelId || e.detail?.relatedParcel;
    if (parcelData && (
      String(notificationParcelId || '') === String(parcelData.id) ||
      e.detail?.text?.includes(parcelData.parcelNumber)
    )) {
      loadParcelDetails();
    }
  });
  document.addEventListener('travelbuddy:parcel-status', (e) => {
    if (parcelData && String(e.detail?.parcelId || '') === String(parcelData.id)) {
      loadParcelDetails();
    }
  });

  loadParcelDetails();
})();
