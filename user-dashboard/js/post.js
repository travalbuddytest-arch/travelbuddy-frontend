(function () {
  'use strict';

  const { API_ORIGIN, authHeaders, escapeHTML, formatPaise, setButtonLoading, formatDate } = window.TravelBuddy;
  const API_BASE = `${API_ORIGIN}/api/postparcel`;

  let currentStep = 1;
  const totalSteps = 6;

  // Form Step Panes
  const panes = {
    1: document.getElementById('stepPane1'),
    2: document.getElementById('stepPane2'),
    3: document.getElementById('stepPane3'),
    4: document.getElementById('stepPane4'),
    5: document.getElementById('stepPane5'),
    6: document.getElementById('stepPane6'),
  };

  // Step Inputs
  const stepDesc = document.getElementById('stepDesc');
  const stepCategory = document.getElementById('stepCategory');
  const stepWeight = document.getElementById('stepWeight');
  const stepFromCity = document.getElementById('stepFromCity');
  const stepPickupAddress = document.getElementById('stepPickupAddress');
  const stepPickupNotes = document.getElementById('stepPickupNotes');
  const stepToCity = document.getElementById('stepToCity');
  const stepDeliveryAddress = document.getElementById('stepDeliveryAddress');
  const stepRecipientName = document.getElementById('stepRecipientName');
  const stepRecipientPhone = document.getElementById('stepRecipientPhone');
  const stepDate = document.getElementById('stepDate');
  const stepTimePreference = document.getElementById('stepTimePreference');
  const stepPrice = document.getElementById('stepPrice');
  const termsAgreeCheck = document.getElementById('termsAgreeCheck');

  // Wallet and Fee elements
  const freePostNotice = document.getElementById('freePostNotice');
  const walletEscrowStatus = document.getElementById('walletEscrowStatus');
  const postWalletBalance = document.getElementById('postWalletBalance');
  const postRequiredEscrow = document.getElementById('postRequiredEscrow');
  const walletShortageWarning = document.getElementById('walletShortageWarning');
  const postShortageText = document.getElementById('postShortageText');

  // Review Elements
  const revRoute = document.getElementById('revRoute');
  const revItem = document.getElementById('revItem');
  const revWeight = document.getElementById('revWeight');
  const revDate = document.getElementById('revDate');
  const revPrice = document.getElementById('revPrice');
  const revPayment = document.getElementById('revPayment');

  // Topup Modal Elements
  const walletTopupOverlay = document.getElementById('walletTopupOverlay');
  const walletTopupClose = document.getElementById('walletTopupClose');
  const walletTopupCancel = document.getElementById('walletTopupCancel');
  const walletShortageAmount = document.getElementById('walletShortageAmount');
  const walletCurrentBalance = document.getElementById('walletCurrentBalance');

  // Stepper UI
  const stepperContainer = document.getElementById('wizardStepper');
  const postSubmitFinalBtn = document.getElementById('postSubmitFinalBtn');

  // Route recommendations
  const routeRecPanel = document.getElementById('routeRecommendationsPanel');
  const routeRecList = document.getElementById('routeRecommendationsList');

  // State
  let userWalletData = null;
  let isFreePostEligible = false;

  // Set minimum date to today
  if (stepDate) {
    const todayStr = new Date().toISOString().split('T')[0];
    stepDate.setAttribute('min', todayStr);
    stepDate.value = todayStr;
  }

  function goToStep(step) {
    if (step < 1 || step > totalSteps) return;

    Object.keys(panes).forEach(k => {
      panes[k]?.classList.toggle('active', Number(k) === step);
    });

    if (stepperContainer) {
      stepperContainer.querySelectorAll('.wizard-step').forEach(el => {
        const s = Number(el.dataset.step);
        el.classList.toggle('active', s === step);
        el.classList.toggle('completed', s < step);
      });
    }

    currentStep = step;
    window.scrollTo({ top: 100, behavior: 'smooth' });

    if (step === 5) {
      checkWalletStatus();
    } else if (step === 6) {
      populateReviewSummary();
    }
  }

  function validateStep(step) {
    if (step === 1) {
      const desc = stepDesc.value.trim();
      const weight = Number(stepWeight.value);
      if (!desc) {
        window.showToast('Please describe the parcel.', 'warning');
        stepDesc.focus();
        return false;
      }
      if (!Number.isFinite(weight) || weight < 0.1) {
        window.showToast('Please enter a valid weight of at least 0.1 kg.', 'warning');
        stepWeight.focus();
        return false;
      }
      return true;
    }

    if (step === 2) {
      const from = stepFromCity.value.trim();
      if (!from) {
        window.showToast('Please enter the pickup city.', 'warning');
        stepFromCity.focus();
        return false;
      }
      return true;
    }

    if (step === 3) {
      const from = stepFromCity.value.trim().toLowerCase();
      const to = stepToCity.value.trim().toLowerCase();
      if (!to) {
        window.showToast('Please enter the destination city.', 'warning');
        stepToCity.focus();
        return false;
      }
      if (from === to) {
        window.showToast('Pickup and destination cities cannot be the same.', 'warning');
        stepToCity.focus();
        return false;
      }
      return true;
    }

    if (step === 4) {
      const d = stepDate.value;
      if (!d) {
        window.showToast('Please select a pickup date.', 'warning');
        stepDate.focus();
        return false;
      }
      const selected = new Date(`${d}T00:00:00`);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (Number.isNaN(selected.getTime()) || selected < today) {
        window.showToast('Pickup date cannot be in the past.', 'warning');
        stepDate.focus();
        return false;
      }
      return true;
    }

    if (step === 5) {
      const price = Number(stepPrice.value);
      if (!Number.isFinite(price) || price < 50) {
        window.showToast('Please enter an offered amount of at least ₹50.', 'warning');
        stepPrice.focus();
        return false;
      }
      return true;
    }

    return true;
  }

  async function checkWalletStatus() {
    try {
      const [walletRes, statsRes] = await Promise.allSettled([
        fetch(`${API_ORIGIN}/api/payments/wallet-summary`, { headers: authHeaders() }).then(r => r.json()),
        fetch(`${API_BASE}/stats`, { headers: authHeaders() }).then(r => r.json())
      ]);

      userWalletData = walletRes.status === 'fulfilled' ? walletRes.value : { walletBalance: 0 };
      const stats = statsRes.status === 'fulfilled' ? statsRes.value : { activeParcels: 0 };

      // Backend rule: Free posts for the first 2 parcels across the platform
      const totalPosts = Number(stats.tripsPosted || 0) + Number(stats.activeParcels || 0);
      isFreePostEligible = totalPosts < 2;

      if (isFreePostEligible) {
        freePostNotice.classList.remove('hidden');
        walletEscrowStatus.classList.add('hidden');
      } else {
        freePostNotice.classList.add('hidden');
        walletEscrowStatus.classList.remove('hidden');
        updateWalletEscrowDisplay();
      }
    } catch (err) {
      console.error('Wallet check failed:', err);
    }
  }

  function updateWalletEscrowDisplay() {
    if (isFreePostEligible || !userWalletData) return;

    const priceRupees = Number(stepPrice.value || 0);
    const requiredPaise = Math.round(priceRupees * 100);
    const availablePaise = Number(userWalletData.walletBalance || 0);

    postWalletBalance.textContent = formatPaise(availablePaise);
    postRequiredEscrow.textContent = formatPaise(requiredPaise);

    if (requiredPaise > availablePaise) {
      const shortagePaise = requiredPaise - availablePaise;
      walletEscrowStatus.className = 'wallet-status-box is-insufficient';
      walletShortageWarning.classList.remove('hidden');
      postShortageText.textContent = formatPaise(shortagePaise);
    } else {
      walletEscrowStatus.className = 'wallet-status-box is-sufficient';
      walletShortageWarning.classList.add('hidden');
    }
  }

  if (stepPrice) {
    stepPrice.addEventListener('input', updateWalletEscrowDisplay);
  }

  function populateReviewSummary() {
    const from = stepFromCity.value.trim();
    const to = stepToCity.value.trim();
    const desc = stepDesc.value.trim();
    const category = stepCategory.value;
    const weight = stepWeight.value;
    const date = stepDate.value;
    const timePref = stepTimePreference.value;
    const price = Number(stepPrice.value || 0);

    revRoute.textContent = `${from} → ${to}`;
    revItem.textContent = `${desc} (${category})`;
    revWeight.textContent = `${weight} kg`;
    revDate.textContent = `${formatDate(date)} · ${timePref}`;
    revPrice.textContent = `₹${price.toLocaleString('en-IN')}`;
    revPayment.textContent = isFreePostEligible ? 'Free Post (Cash on Delivery)' : 'Wallet Escrow (Held safely)';
  }

  // Navigation Button Handlers
  document.getElementById('step1NextBtn')?.addEventListener('click', () => { if (validateStep(1)) goToStep(2); });
  document.getElementById('step2PrevBtn')?.addEventListener('click', () => goToStep(1));
  document.getElementById('step2NextBtn')?.addEventListener('click', () => { if (validateStep(2)) goToStep(3); });
  document.getElementById('step3PrevBtn')?.addEventListener('click', () => goToStep(2));
  document.getElementById('step3NextBtn')?.addEventListener('click', () => { if (validateStep(3)) goToStep(4); });
  document.getElementById('step4PrevBtn')?.addEventListener('click', () => goToStep(3));
  document.getElementById('step4NextBtn')?.addEventListener('click', () => { if (validateStep(4)) goToStep(5); });
  document.getElementById('step5PrevBtn')?.addEventListener('click', () => goToStep(4));
  document.getElementById('step5NextBtn')?.addEventListener('click', () => { if (validateStep(5)) goToStep(6); });
  document.getElementById('step6PrevBtn')?.addEventListener('click', () => goToStep(5));

  // Stepper Header Direct Click
  if (stepperContainer) {
    stepperContainer.querySelectorAll('.wizard-step').forEach(st => {
      st.addEventListener('click', () => {
        const targetStep = Number(st.dataset.step);
        if (targetStep < currentStep) {
          goToStep(targetStep);
        } else if (targetStep === currentStep + 1 && validateStep(currentStep)) {
          goToStep(targetStep);
        }
      });
    });
  }

  // Final Form Submission
  const form = document.getElementById('multiStepPostForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!termsAgreeCheck.checked) {
        window.showToast('Please certify that the parcel contains no prohibited items.', 'warning');
        termsAgreeCheck.focus();
        return;
      }

      setButtonLoading(postSubmitFinalBtn, true, 'Publishing...');

      const from = stepFromCity.value.trim();
      const to = stepToCity.value.trim();
      const desc = `${stepDesc.value.trim()} [${stepCategory.value}]`;
      const weight = Number(stepWeight.value);
      const priceRupees = Number(stepPrice.value);
      const pricePaise = Math.round(priceRupees * 100); // Send in PAISE to match backend & Android parity!
      const date = stepDate.value;

      try {
        const res = await fetch(`${API_BASE}/post`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            from,
            to,
            desc,
            weight,
            price: pricePaise, // EXACT PAISE
            date,
            pickupAddress: stepPickupAddress?.value.trim() || '',
            pickupNotes: stepPickupNotes?.value.trim() || '',
            deliveryAddress: stepDeliveryAddress?.value.trim() || '',
            recipientName: stepRecipientName?.value.trim() || '',
            recipientPhone: stepRecipientPhone?.value.trim() || '',
          })
        });

        const data = await res.json();

        if (!res.ok) {
          if (res.status === 402 || data.code === 'INSUFFICIENT_WALLET') {
            showWalletTopupModal(data);
            return;
          }
          window.showToast(data.error || 'Could not post parcel.', 'error');
          return;
        }

        window.showToast(data.message || 'Parcel posted successfully! Redirecting to tracking...', 'success');

        const newId = data.parcel?._id || data.parcel?.id;
        if (data.recommendations && data.recommendations.length > 0) {
          renderRecommendations(data.recommendations);
        }

        setTimeout(() => {
          if (newId) {
            window.location.href = `parcel-details.html?id=${encodeURIComponent(newId)}`;
          } else {
            window.location.href = 'parcels.html';
          }
        }, 1200);

      } catch (err) {
        console.error(err);
        window.showToast('Network error while posting parcel.', 'error');
      } finally {
        setButtonLoading(postSubmitFinalBtn, false);
      }
    });
  }

  function showWalletTopupModal(errData) {
    const shortagePaise = Number(errData.shortage || 0);
    const balancePaise = Number(errData.walletBalance || 0);

    walletShortageAmount.textContent = formatPaise(shortagePaise);
    walletCurrentBalance.textContent = formatPaise(balancePaise);
    walletTopupOverlay.classList.remove('hidden');
  }

  [walletTopupClose, walletTopupCancel].forEach(btn => {
    btn?.addEventListener('click', () => walletTopupOverlay.classList.add('hidden'));
  });

  function renderRecommendations(recs) {
    if (!routeRecPanel || !routeRecList) return;
    if (!recs || recs.length === 0) {
      routeRecPanel.classList.add('hidden');
      return;
    }

    routeRecList.innerHTML = recs.map(r => `
      <li class="parcel-card" style="margin-bottom:12px;">
        <div class="parcel-body">
          <p class="parcel-title">${escapeHTML(r.travelerName)}</p>
          <div class="parcel-meta">
            <span><i class="fa-solid fa-route"></i> ${escapeHTML(r.from)} → ${escapeHTML(r.to)}</span>
            <span><i class="fa-regular fa-calendar"></i> ${formatDate(r.date)}</span>
          </div>
        </div>
        <button class="btn-primary btn-primary--inline" onclick="window.location.href='messages.html'">
          <i class="fa-solid fa-message"></i> Message
        </button>
      </li>
    `).join('');

    routeRecPanel.classList.remove('hidden');
  }

  checkWalletStatus();
})();
