(function () {
  'use strict';

  const { API_ORIGIN, authHeaders, escapeHTML, formatPaise, resolveMediaUrl, setButtonLoading, statusBadge } = window.TravelBuddy;

  // Elements - Hero & Info
  const heroAvatar = document.getElementById('heroAvatar');
  const heroFullName = document.getElementById('heroFullName');
  const heroVerifiedBadge = document.getElementById('heroVerifiedBadge');
  const heroEmail = document.getElementById('heroEmail');
  const heroRating = document.getElementById('heroRating');
  const heroRatingCount = document.getElementById('heroRatingCount');
  const heroMemberSince = document.getElementById('heroMemberSince');
  const removePhotoBtn = document.getElementById('removePhotoBtn');
  const photoFileInput = document.getElementById('photoFileInput');

  const statsPostedCount = document.getElementById('statsPostedCount');
  const statsDeliveredCount = document.getElementById('statsDeliveredCount');
  const statsWalletBalance = document.getElementById('statsWalletBalance');

  const editProfileForm = document.getElementById('editProfileForm');
  const inputFirstName = document.getElementById('inputFirstName');
  const inputLastName = document.getElementById('inputLastName');
  const inputEmail = document.getElementById('inputEmail');
  const inputPhone = document.getElementById('inputPhone');
  const saveProfileBtn = document.getElementById('saveProfileBtn');

  // Elements - Security
  const status2fa = document.getElementById('status2fa');
  const statusRecovery = document.getElementById('statusRecovery');
  const kycGovIdStatus = document.getElementById('kycGovIdStatus');
  const kycFaceStatus = document.getElementById('kycFaceStatus');
  const deviceSummaryList = document.getElementById('deviceSummaryList');
  const fullDeviceList = document.getElementById('fullDeviceList');
  const logoutAllOthersBtn = document.getElementById('logoutAllOthersBtn');

  // Elements - Personal
  const savedAddressesList = document.getElementById('savedAddressesList');
  const avgRatingValue = document.getElementById('avgRatingValue');
  const fullReviewsList = document.getElementById('fullReviewsList');

  // Elements - Activity
  const submittedReportsCount = document.getElementById('submittedReportsCount');

  // Modals
  const modals = {
    address: document.getElementById('addressModal'),
    devices: document.getElementById('devicesModal'),
    security: document.getElementById('securityModal'),
    reviews: document.getElementById('reviewsModal')
  };

  // State
  let currentUserData = null;
  let addresses = [];
  let sessions = [];
  let reviews = [];

  // ---------------- INITIALIZATION ----------------

  async function loadAllProfileData() {
    // 1. Basic Profile & Stats
    try {
      const [meRes, statsRes, addrRes, sessionRes, reportsRes, ratingsRes] = await Promise.allSettled([
        fetch(`${API_ORIGIN}/api/auth/me`, { headers: authHeaders() }).then(r => r.json()),
        fetch(`${API_ORIGIN}/api/postparcel/stats`, { headers: authHeaders() }).then(r => r.json()),
        fetch(`${API_ORIGIN}/api/settings/addresses`, { headers: authHeaders() }).then(r => r.json()),
        fetch(`${API_ORIGIN}/api/auth/sessions`, { headers: authHeaders() }).then(r => r.json()),
        fetch(`${API_ORIGIN}/api/support/my-reports`, { headers: authHeaders() }).then(r => r.json()),
        fetch(`${API_ORIGIN}/api/settings/ratings`, { headers: authHeaders() }).then(r => r.json())
      ]);

      if (meRes.status === 'fulfilled' && meRes.value.user) {
        currentUserData = meRes.value.user;
        renderProfileHeader(currentUserData);
        renderSecuritySummary(currentUserData);
        renderKycStatus(currentUserData.kyc);
      }

      if (statsRes.status === 'fulfilled' && statsRes.value) {
        const s = statsRes.value;
        if (statsPostedCount) statsPostedCount.textContent = s.tripsPosted || s.activeParcels || 0;
        if (statsDeliveredCount) statsDeliveredCount.textContent = s.completedDeliveries || 0;
      }

      if (addrRes.status === 'fulfilled' && addrRes.value.addresses) {
        addresses = addrRes.value.addresses;
        renderAddresses();
      }

      if (sessionRes.status === 'fulfilled' && sessionRes.value.sessions) {
        sessions = sessionRes.value.sessions;
        renderSessions();
      }

      if (reportsRes.status === 'fulfilled' && reportsRes.value.reports) {
        if (submittedReportsCount) submittedReportsCount.textContent = reportsRes.value.reports.length;
      }

      if (ratingsRes.status === 'fulfilled' && ratingsRes.value.ratings) {
        reviews = ratingsRes.value.ratings;
        if (avgRatingValue) avgRatingValue.textContent = Number(currentUserData?.rating || 0).toFixed(1);
        renderReviews();
      }

    } catch (err) {
      console.error('Failed to load profile data:', err);
    }
  }

  // ---------------- RENDERERS ----------------

  function renderProfileHeader(user) {
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'TravelBuddy User';
    const initials = ((user.firstName?.[0] || '') + (user.lastName?.[0] || '')).toUpperCase() || 'TB';
    const isPrivate = window.TravelBuddy.isPrivacyMode();

    heroFullName.textContent = fullName;
    heroEmail.textContent = user.email || '';
    if (heroVerifiedBadge) heroVerifiedBadge.style.display = user.isVerified ? 'inline' : 'none';
    if (heroRating) heroRating.textContent = Number(user.rating || 0).toFixed(1);
    if (heroRatingCount) heroRatingCount.textContent = user.ratingCount || 0;
    if (heroMemberSince && user.createdAt) heroMemberSince.textContent = new Date(user.createdAt).getFullYear();
    if (statsWalletBalance) statsWalletBalance.textContent = isPrivate ? '••••' : formatPaise(user.walletBalance || 0);

    // Avatar
    if (user.profilePhoto) {
      heroAvatar.textContent = '';
      heroAvatar.style.backgroundImage = `url(${resolveMediaUrl(user.profilePhoto)})`;
      if (removePhotoBtn) removePhotoBtn.style.display = 'inline-flex';
    } else {
      heroAvatar.style.backgroundImage = 'none';
      heroAvatar.textContent = initials;
      if (removePhotoBtn) removePhotoBtn.style.display = 'none';
    }

    // Form inputs
    inputFirstName.value = user.firstName || '';
    inputLastName.value = user.lastName || '';
    inputEmail.value = user.email || '';
    inputPhone.value = user.phone || '';
  }

  function renderSecuritySummary(user) {
    if (status2fa) {
      status2fa.innerHTML = user.twoStepEnabled
        ? '<span style="color:var(--tb-success)"><i class="fa-solid fa-circle-check"></i> Enabled</span>'
        : '<span style="color:var(--tb-text-faint)">Disabled</span>';
    }
    if (statusRecovery) {
      statusRecovery.innerHTML = user.recoveryEmail
        ? `<span style="color:var(--tb-navy)">${escapeHTML(user.recoveryEmail)}</span>`
        : '<span style="color:var(--tb-warning)"><i class="fa-solid fa-circle-exclamation"></i> Not Added</span>';
    }
  }

  function renderKycStatus(kyc) {
    if (!kyc) return;
    const mapStatus = (s) => {
      if (s === 'verified') return { label: 'Verified', class: 'tag--delivered', icon: 'fa-circle-check' };
      if (s === 'pending') return { label: 'Pending', class: 'tag--pending', icon: 'fa-clock' };
      return { label: 'Not Started', class: 'tag--cancelled', icon: 'fa-circle-xmark' };
    };

    const gov = mapStatus(kyc.governmentId?.status);
    kycGovIdStatus.className = `tag ${gov.class}`;
    kycGovIdStatus.innerHTML = `<i class="fa-solid ${gov.icon}"></i> ${gov.label}`;

    const face = mapStatus(kyc.selfie?.status);
    kycFaceStatus.className = `tag ${face.class}`;
    kycFaceStatus.innerHTML = `<i class="fa-solid ${face.icon}"></i> ${face.label}`;
  }

  function renderAddresses() {
    if (!savedAddressesList) return;
    if (!addresses.length) {
      savedAddressesList.innerHTML = '<p style="font-size:12px; color:var(--tb-text-faint);">No addresses saved yet. Add your home or office for faster parcel posting.</p>';
      return;
    }

    savedAddressesList.innerHTML = addresses.map(addr => `
      <div class="address-item">
        <i class="fa-solid ${addr.label.toLowerCase() === 'home' ? 'fa-house-user' : 'fa-building'}"></i>
        <div class="address-info">
          <strong>${escapeHTML(addr.label)}</strong>
          <span>${escapeHTML(addr.address)}, ${escapeHTML(addr.city)}</span>
        </div>
        ${addr.isDefault ? '<span class="tag tag--accepted" style="font-size:9px; padding:2px 6px;">Default</span>' : ''}
        <button type="button" class="btn-ghost btn-sm" onclick="window.deleteAddress('${addr._id}')" style="color:var(--tb-danger); min-height:30px; width:30px; padding:0;"><i class="fa-solid fa-trash-can"></i></button>
      </div>
    `).join('');
  }

  function renderSessions() {
    if (!deviceSummaryList) return;
    const active = sessions.filter(s => s.isActive);

    // Summary view (first 2)
    deviceSummaryList.innerHTML = active.slice(0, 2).map(s => `
      <div class="device-item">
        <i class="fa-solid ${s.deviceType === 'mobile' ? 'fa-mobile-screen' : 'fa-laptop'}"></i>
        <div class="device-info">
          <strong>${escapeHTML(s.deviceName)}</strong>
          <span>${escapeHTML(s.os)} · ${escapeHTML(s.browser || 'App')}</span>
        </div>
        ${s.isCurrent ? '<span class="tag tag--delivered" style="font-size:9px;">Current</span>' : ''}
      </div>
    `).join('');

    // Modal view (full list)
    if (fullDeviceList) {
      fullDeviceList.innerHTML = active.map(s => `
        <div class="device-item">
          <i class="fa-solid ${s.deviceType === 'mobile' ? 'fa-mobile-screen' : 'fa-laptop'}" style="font-size:20px;"></i>
          <div class="device-info">
            <strong>${escapeHTML(s.deviceName)} ${s.isCurrent ? '(This device)' : ''}</strong>
            <span style="white-space:normal;">${escapeHTML(s.os)} ${escapeHTML(s.osVersion || '')} · ${escapeHTML(s.browser || '')}</span>
            <small style="color:var(--tb-text-faint); font-size:10px;">Last active: ${new Date(s.lastUsedAt).toLocaleString()} · IP: ${s.ipAddress}</small>
          </div>
          ${!s.isCurrent ? `<button type="button" class="btn-danger btn-sm" onclick="window.revokeSession('${s._id}')">Revoke</button>` : ''}
        </div>
      `).join('');
    }
  }

  function renderReviews() {
    if (!fullReviewsList) return;
    if (!reviews.length) {
      fullReviewsList.innerHTML = '<p style="text-align:center; padding:20px; color:var(--tb-text-faint);">No reviews received yet.</p>';
      return;
    }

    fullReviewsList.innerHTML = reviews.map(r => `
      <div class="activity-item">
        <div class="avatar avatar--sm">${escapeHTML((r.fromUserId?.firstName?.[0] || '') + (r.fromUserId?.lastName?.[0] || ''))}</div>
        <div class="activity-content">
          <div style="display:flex; justify-content:space-between;">
            <span class="activity-title">${escapeHTML(r.fromUserId?.firstName)} ${escapeHTML(r.fromUserId?.lastName)}</span>
            <span style="color:#F59E0B; font-weight:700;">★ ${r.score.toFixed(1)}</span>
          </div>
          <p class="activity-desc">${escapeHTML(r.comment || 'No comment provided.')}</p>
          <span class="activity-time">${new Date(r.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
    `).join('');
  }

  // ---------------- ACTIONS ----------------

  // Modal Controls
  window.openAddressModal = () => modals.address.classList.remove('hidden');
  window.openDevicesModal = () => modals.devices.classList.remove('hidden');
  window.openSecurityModal = () => {
    const recInput = document.getElementById('recoveryEmailInput');
    const toggle2fa = document.getElementById('profile2faToggle');
    if (recInput) recInput.value = currentUserData?.recoveryEmail || '';
    if (toggle2fa) toggle2fa.checked = !!currentUserData?.twoStepEnabled;
    modals.security.classList.remove('hidden');
  };
  window.openReviewsModal = () => modals.reviews.classList.remove('hidden');

  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      Object.values(modals).forEach(m => m.classList.add('hidden'));
    });
  });

  // Saved Addresses
  document.getElementById('addressForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      label: document.getElementById('addrLabel').value.trim(),
      address: document.getElementById('addrFull').value.trim(),
      city: document.getElementById('addrCity').value.trim(),
      isDefault: document.getElementById('addrDefault').checked
    };

    try {
      const res = await fetch(`${API_ORIGIN}/api/settings/addresses`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        window.showToast('Address saved successfully!', 'success');
        modals.address.classList.add('hidden');
        loadAllProfileData();
      }
    } catch (err) {
      window.showToast('Failed to save address.', 'error');
    }
  });

  window.deleteAddress = async (id) => {
    if (!confirm('Are you sure you want to remove this saved address?')) return;
    try {
      const res = await fetch(`${API_ORIGIN}/api/settings/addresses/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (res.ok) {
        window.showToast('Address removed.', 'success');
        loadAllProfileData();
      }
    } catch (err) {
      window.showToast('Failed to delete address.', 'error');
    }
  };

  // Sessions
  window.revokeSession = async (id) => {
    if (!confirm('This will log you out from that device. Continue?')) return;
    try {
      const res = await fetch(`${API_ORIGIN}/api/auth/sessions/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (res.ok) {
        window.showToast('Device logged out.', 'success');
        loadAllProfileData();
      }
    } catch (err) {
      window.showToast('Failed to revoke session.', 'error');
    }
  };

  document.getElementById('logoutAllOthersBtn')?.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to log out from all other devices?')) return;
    try {
      const res = await fetch(`${API_ORIGIN}/api/auth/sessions/logout-others`, { method: 'POST', headers: authHeaders() });
      if (res.ok) {
        window.showToast('All other sessions revoked.', 'success');
        loadAllProfileData();
      }
    } catch (err) {
      window.showToast('Failed to revoke sessions.', 'error');
    }
  });

  // Security Settings
  document.getElementById('profile2faToggle')?.addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    try {
      const res = await fetch(`${API_ORIGIN}/api/settings/2fa`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ enabled })
      });
      if (res.ok) {
        window.showToast(`Two-step authentication ${enabled ? 'enabled' : 'disabled'}.`, 'success');
        currentUserData.twoStepEnabled = enabled;
        renderSecuritySummary(currentUserData);
      }
    } catch (err) {
      window.showToast('Failed to update 2FA status.', 'error');
      e.target.checked = !enabled; // Revert
    }
  });

  document.getElementById('saveRecoveryBtn')?.addEventListener('click', async () => {
    const email = document.getElementById('recoveryEmailInput').value.trim();
    if (!email || !email.includes('@')) {
      window.showToast('Please enter a valid email address.', 'warning');
      return;
    }
    try {
      const res = await fetch(`${API_ORIGIN}/api/settings/recovery-email`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ email })
      });
      if (res.ok) {
        window.showToast('Recovery email updated successfully.', 'success');
        currentUserData.recoveryEmail = email;
        renderSecuritySummary(currentUserData);
      }
    } catch (err) {
      window.showToast('Failed to update recovery email.', 'error');
    }
  });

  document.getElementById('profilePasswordForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('oldPass').value;
    const newPassword = document.getElementById('newPass').value;

    if (newPassword.length < 8) {
      window.showToast('New password must be at least 8 characters.', 'warning');
      return;
    }

    try {
      const res = await fetch(`${API_ORIGIN}/api/auth/me/password`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        window.showToast('Password updated successfully! All other sessions logged out.', 'success');
        e.target.reset();
        modals.security.classList.add('hidden');
        loadAllProfileData();
      } else {
        window.showToast(data.error || 'Failed to update password.', 'error');
      }
    } catch (err) {
      window.showToast('Network error updating password.', 'error');
    }
  });

  // Basic Profile Update (preserved and enhanced)
  if (editProfileForm) {
    editProfileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const firstName = inputFirstName.value.trim();
      const lastName = inputLastName.value.trim();
      const phone = inputPhone.value.trim();

      if (!firstName || !lastName) {
        window.showToast('First name and last name are required.', 'warning');
        return;
      }

      setButtonLoading(saveProfileBtn, true, 'Saving...');
      try {
        const res = await fetch(`${API_ORIGIN}/api/auth/me`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({ firstName, lastName, phone })
        });
        const data = await res.json();
        if (res.ok) {
          window.showToast('Profile updated successfully!', 'success');
          currentUserData = data.user;
          renderProfileHeader(currentUserData);
        } else {
          window.showToast(data.error || 'Update failed.', 'error');
        }
      } catch (err) {
        window.showToast('Network error saving profile.', 'error');
      } finally {
        setButtonLoading(saveProfileBtn, false);
      }
    });
  }

  // Handle Photo File Upload
  if (photoFileInput) {
    photoFileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
        window.showToast('Please select a JPG or PNG image.', 'warning');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        window.showToast('Image size must be under 5 MB.', 'warning');
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = event.target?.result;
        if (!base64Data) return;

        window.showToast('Uploading profile photo...', 'info');

        try {
          const res = await fetch(`${API_ORIGIN}/api/auth/me`, {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({
              firstName: currentUserData.firstName,
              lastName: currentUserData.lastName,
              phone: currentUserData.phone,
              profilePhoto: base64Data
            })
          });
          const data = await res.json();

          if (!res.ok) {
            window.showToast(data.error || 'Failed to update photo.', 'error');
            return;
          }

          window.showToast('Profile photo updated successfully!', 'success');
          currentUserData = data.user;
          renderProfileHeader(currentUserData);
        } catch (err) {
          console.error(err);
          window.showToast('Network error uploading photo.', 'error');
        }
      };
      reader.readAsDataURL(file);
    });
  }

  // Remove Photo
  if (removePhotoBtn) {
    removePhotoBtn.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to remove your profile photo?')) return;
      try {
        const res = await fetch(`${API_ORIGIN}/api/auth/me`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({
            firstName: currentUserData.firstName,
            lastName: currentUserData.lastName,
            phone: currentUserData.phone,
            profilePhoto: ''
          })
        });
        const data = await res.json();
        if (res.ok) {
          window.showToast('Profile photo removed.', 'success');
          currentUserData = data.user;
          renderProfileHeader(currentUserData);
        }
      } catch (err) {
        window.showToast('Could not reach server to remove photo.', 'error');
      }
    });
  }

  document.addEventListener('travelbuddy:privacy-toggled', () => {
    if (currentUserData) {
      renderProfileHeader(currentUserData);
      renderAddresses();
    }
  });

  loadAllProfileData();
})();
