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

  // State
  let parcelData = null;
  let currentUserId = null;
  let currentOtpPurpose = 'pickup';
  let selectedRating = 5;

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

    if (liveTrackLink) {
      liveTrackLink.href = `track.html?id=${encodeURIComponent(p.id)}`;
    }

    // Cancel Button visibility
    const isCancellable = ['pending', 'accepted', 'pickup_point_pending', 'pickup_point_selected'].includes(p.status);
    if (cancelParcelBtn) {
      cancelParcelBtn.style.display = isCancellable ? 'inline-flex' : 'none';
    }

    // Review Button visibility
    if (reviewBtn) {
      reviewBtn.style.display = (p.status === 'delivered' && !p.isRated) ? 'inline-flex' : 'none';
    }

    // Timeline Rendering
    renderTimeline(p);

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

    // Financials
    const rawPrice = Number(p.price || 0);
    const paise = rawPrice > 1000 ? rawPrice : rawPrice * 100;
    finGrossPrice.textContent = formatPaise(paise);

    const commissionPaise = p.platformCommission ? Number(p.platformCommission) : Math.round(paise * 0.1);
    finPlatformFee.textContent = formatPaise(commissionPaise);

    const earningPaise = p.travelerEarning ? Number(p.travelerEarning) : (paise - commissionPaise);
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
          <a href="track.html?id=${encodeURIComponent(p.id)}&action=pickup-qr" class="btn-primary" style="text-decoration:none;"><i class="fa-solid fa-qrcode"></i> Show Pickup QR</a>
          <button type="button" class="btn-ghost" id="requestPickupOtpBtn"><i class="fa-solid fa-key"></i> Resend Pickup OTP</button>
        `;
      } else {
        actionBannerDesc.textContent = 'Collect the parcel from the sender. Verify the 6-digit handover OTP or scan their QR code to confirm.';
        actionBannerButtons.innerHTML = `
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
          <a href="track.html?id=${encodeURIComponent(p.id)}&action=delivery-qr" class="btn-primary" style="text-decoration:none;"><i class="fa-solid fa-qrcode"></i> Show Delivery QR</a>
          <button type="button" class="btn-ghost" id="requestDeliveryOtpBtn"><i class="fa-solid fa-key"></i> Resend Delivery OTP</button>
        `;
      } else {
        actionBannerDesc.textContent = 'You are currently transporting this parcel. Hand over to the recipient and verify the delivery OTP or scan their QR.';
        actionBannerButtons.innerHTML = `
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
      actionBannerButtons.innerHTML = (!p.isRated)
        ? `<button type="button" class="btn-primary" id="bannerReviewBtn"><i class="fa-solid fa-star"></i> Rate Experience</button>`
        : `<span class="tag tag--delivered"><i class="fa-solid fa-check"></i> Reviewed</span>`;
      actionBanner.classList.remove('hidden');
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
    } catch (err) {
      console.error(err);
      window.showToast('Could not reach server to request OTP.', 'error');
    }
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
  function openReviewModal() {
    selectedRating = 5;
    updateStarDisplay(5);
    reviewComment.value = '';
    const name = (parcelData.role === 'sender' ? parcelData.traveler?.displayName : parcelData.sender?.displayName) || 'the user';
    reviewTargetName.textContent = name;
    reviewModal.classList.remove('hidden');
  }

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
    reviewBtn.onclick = openReviewModal;
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
  [cancelModalClose, cancelModalDismiss].forEach(el => el && (el.onclick = () => cancelModal.classList.add('hidden')));
  if (otpModalClose) otpModalClose.onclick = () => otpModal.classList.add('hidden');
  if (reviewModalClose) reviewModalClose.onclick = () => reviewModal.classList.add('hidden');
  if (reportModalClose) reportModalClose.onclick = () => reportModal.classList.add('hidden');

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      [cancelModal, otpModal, reviewModal, reportModal].forEach(m => m && m.classList.add('hidden'));
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
