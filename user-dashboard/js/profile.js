(function () {
  'use strict';

  const { API_ORIGIN, authHeaders, escapeHTML, formatPaise, resolveMediaUrl, setButtonLoading } = window.TravelBuddy;

  // Elements
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

  let currentUserData = null;

  async function loadProfile() {
    try {
      const [meRes, statsRes] = await Promise.allSettled([
        fetch(`${API_ORIGIN}/api/auth/me`, { headers: authHeaders() }).then(r => r.json()),
        fetch(`${API_ORIGIN}/api/postparcel/stats`, { headers: authHeaders() }).then(r => r.json())
      ]);

      if (meRes.status === 'fulfilled' && meRes.value.user) {
        currentUserData = meRes.value.user;
        renderProfile(currentUserData);
      }

      if (statsRes.status === 'fulfilled' && statsRes.value) {
        const s = statsRes.value;
        if (statsPostedCount) statsPostedCount.textContent = s.tripsPosted || s.activeParcels || 0;
        if (statsDeliveredCount) statsDeliveredCount.textContent = s.completedDeliveries || 0;
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
      window.showToast('Could not load profile information.', 'error');
    }
  }

  function renderProfile(user) {
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'TravelBuddy User';
    const initials = ((user.firstName?.[0] || '') + (user.lastName?.[0] || '')).toUpperCase() || 'TB';

    heroFullName.textContent = fullName;
    heroEmail.textContent = user.email || '';

    if (heroVerifiedBadge) {
      heroVerifiedBadge.style.display = user.isVerified ? 'inline' : 'none';
    }

    if (heroRating) heroRating.textContent = Number(user.rating || 0).toFixed(1);
    if (heroRatingCount) heroRatingCount.textContent = user.ratingCount || 0;

    if (heroMemberSince && user.createdAt) {
      heroMemberSince.textContent = new Date(user.createdAt).getFullYear();
    }

    if (statsWalletBalance) {
      statsWalletBalance.textContent = formatPaise(user.walletBalance || 0);
    }

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
          renderProfile(currentUserData);
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

        if (!res.ok) {
          window.showToast(data.error || 'Failed to remove photo.', 'error');
          return;
        }

        window.showToast('Profile photo removed.', 'success');
        currentUserData = data.user;
        renderProfile(currentUserData);
      } catch (err) {
        console.error(err);
        window.showToast('Could not reach server to remove photo.', 'error');
      }
    });
  }

  // Form Submit
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

      setButtonLoading(saveProfileBtn, true, 'Saving Changes...');

      try {
        const res = await fetch(`${API_ORIGIN}/api/auth/me`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({ firstName, lastName, phone })
        });
        const data = await res.json();

        if (!res.ok) {
          window.showToast(data.error || 'Could not update profile.', 'error');
          return;
        }

        window.showToast('Profile saved successfully!', 'success');
        currentUserData = data.user;
        renderProfile(currentUserData);
      } catch (err) {
        console.error(err);
        window.showToast('Network error saving profile.', 'error');
      } finally {
        setButtonLoading(saveProfileBtn, false);
      }
    });
  }

  loadProfile();
})();
