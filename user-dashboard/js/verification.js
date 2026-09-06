(function () {
  'use strict';

  const { API_ORIGIN, authHeaders, escapeHTML } = window.TravelBuddy;

  const kycTierText = document.getElementById('kycTierText');
  const kycSubText = document.getElementById('kycSubText');
  const statusGovId = document.getElementById('statusGovId');
  const statusSelfie = document.getElementById('statusSelfie');
  const statusDL = document.getElementById('statusDL');

  async function loadKycStatus() {
    try {
      const res = await fetch(`${API_ORIGIN}/api/auth/me`, { headers: authHeaders() });
      const data = await res.json();

      if (!res.ok) return;

      const user = data.user;
      // In the real system, kyc status comes from user.kyc or a calculated tier.
      // We'll mimic the Android app's UI logic.
      renderKycUI(user.kyc || {});
    } catch (err) {
      console.error('Failed to load KYC status:', err);
    }
  }

  function renderKycUI(kyc) {
    updateItemStatus(statusGovId, kyc.governmentId?.status || 'not_submitted');
    updateItemStatus(statusSelfie, kyc.selfie?.status || 'not_submitted');
    updateItemStatus(statusDL, kyc.address?.status || 'not_submitted'); // DL often mapped to address or separate field

    const allVerified = kyc.governmentId?.status === 'verified' && kyc.selfie?.status === 'verified';

    if (allVerified) {
      kycTierText.textContent = 'Status: Tier 1 Verified';
      kycSubText.textContent = 'You have unlocked basic traveler benefits.';
    } else {
      kycTierText.textContent = 'Status: Verification Required';
      kycSubText.textContent = 'Complete your profile to unlock premium benefits.';
    }
  }

  function updateItemStatus(el, status) {
    if (!el) return;
    const s = String(status).toLowerCase();
    let text = 'Not Started';
    let color = '#94A3B8';
    let bg = '#F1F5F9';

    if (s === 'verified') {
      text = 'Verified';
      color = '#15803D';
      bg = '#DCFCE7';
    } else if (s === 'pending') {
      text = 'Pending';
      color = '#B25E09';
      bg = '#FEF3DD';
    } else if (s === 'rejected') {
      text = 'Rejected';
      color = '#B91C1C';
      bg = '#FEE2E2';
    }

    el.textContent = text;
    el.style.color = color;
    el.style.backgroundColor = bg;
  }

  loadKycStatus();
})();
