(function () {
  'use strict';

  const API_BASE = `${APP_CONFIG.API_BASE_URL}/api/auth`;

  // UI elements
  const phoneForm = document.getElementById('phoneForm');
  const otpForm = document.getElementById('otpForm');
  const countryCodeSelect = document.getElementById('countryCodeSelect');
  const phoneInput = document.getElementById('phoneInput');
  const otpInput = document.getElementById('otpInput');
  const sendOtpBtn = document.getElementById('sendOtpBtn');
  const verifyOtpBtn = document.getElementById('verifyOtpBtn');
  const resendOtpBtn = document.getElementById('resendOtpBtn');
  const changePhoneBtn = document.getElementById('changePhoneBtn');
  const cooldownTimer = document.getElementById('cooldownTimer');
  const displayPhone = document.getElementById('displayPhone');
  const displayEmail = document.getElementById('displayEmail');
  const alertBox = document.getElementById('alertBox');
  const toast = document.getElementById('toast');
  const successOverlay = document.getElementById('successOverlay');

  let activePhone = '';
  let activeCountryCode = '+91';
  let currentUserEmail = '';
  let timerInterval = null;
  let secondsRemaining = 0;

  function maskEmail(email) {
    if (!email || !email.includes('@')) return 'your registered email';
    const parts = email.trim().split('@');
    const name = parts[0];
    const domain = parts[1];
    if (name.length <= 2) {
      return `${name[0]}***@${domain}`;
    }
    return `${name.slice(0, 2)}***${name.slice(-1)}@${domain}`;
  }

  function getAuthHeaders(extra = {}) {
    const headers = { ...extra };
    const token = localStorage.getItem('carryParcelToken') ||
                  localStorage.getItem('carryParcelAdminToken') ||
                  localStorage.getItem('admin_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  function getSafeRedirectTarget() {
    try {
      const raw = new URLSearchParams(window.location.search).get('redirect');
      if (!raw) return null;
      const decoded = decodeURIComponent(raw);
      if (!/^\/user-dashboard\//.test(decoded)) return null;
      return `..${decoded}`;
    } catch (err) {
      return null;
    }
  }

  function showToast(message, type = 'info') {
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => {
      toast.className = 'toast';
    }, 4000);
  }

  function showAlert(message, type = 'error') {
    if (!alertBox) return;
    alertBox.textContent = message;
    alertBox.className = `alert-box alert-${type}`;
    alertBox.style.display = 'flex';
  }

  function hideAlert() {
    if (alertBox) {
      alertBox.style.display = 'none';
    }
  }

  function setButtonLoading(button, isLoading, loadingText) {
    if (!button) return;
    button.disabled = isLoading;
    if (isLoading) {
      button.dataset.originalHtml = button.innerHTML;
      button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>${loadingText || 'Please wait...'}</span>`;
    } else if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
    }
  }

  function startCooldownTimer(duration) {
    clearInterval(timerInterval);
    secondsRemaining = duration;
    resendOtpBtn.disabled = true;
    cooldownTimer.textContent = `(${secondsRemaining}s)`;

    timerInterval = setInterval(() => {
      secondsRemaining--;
      if (secondsRemaining <= 0) {
        clearInterval(timerInterval);
        resendOtpBtn.disabled = false;
        cooldownTimer.textContent = '';
      } else {
        cooldownTimer.textContent = `(${secondsRemaining}s)`;
      }
    }, 1000);
  }

  async function checkInitialUserStatus() {
    try {
      const response = await fetch(`${API_BASE}/me`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) {
        if (response.status === 401) {
          window.location.replace('../login/login.html');
          return;
        }
      }
      const data = await response.json().catch(() => ({}));
      if (data.user) {
        currentUserEmail = data.user.email || '';
        if (data.user.isPhoneVerified) {
          const destination = getSafeRedirectTarget() || '../user-dashboard/overview.html';
          window.location.replace(destination);
          return;
        }

        if (data.user.phone) {
          let cleanPhone = data.user.phone;
          if (cleanPhone.startsWith('+91')) {
            countryCodeSelect.value = '+91';
            cleanPhone = cleanPhone.slice(3);
          }
          phoneInput.value = cleanPhone;
        }
      }
    } catch (err) {
      console.error('Failed to verify session status:', err);
    }
  }

  function validatePhoneInput(showError = false) {
    const rawNumber = phoneInput.value.trim().replace(/\D/g, '');
    const code = countryCodeSelect.value;
    const res = window.CarryParcelPhone ? window.CarryParcelPhone.validatePhoneNumber(rawNumber, code) : { isValid: rawNumber.length >= 8 && rawNumber.length <= 13 };
    if (!res.isValid && showError) {
      showAlert(res.error || 'Please enter a valid mobile number.', 'error');
    } else if (res.isValid) {
      hideAlert();
    }
    return res;
  }

  countryCodeSelect.addEventListener('change', () => {
    if (phoneInput.value.trim()) {
      validatePhoneInput(true);
    }
  });

  phoneInput.addEventListener('blur', () => {
    if (phoneInput.value.trim()) validatePhoneInput(true);
  });

  // Send OTP handler
  phoneForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const validation = validatePhoneInput(true);
    if (!validation.isValid) {
      phoneInput.focus();
      return;
    }

    const rawNumber = phoneInput.value.trim().replace(/\D/g, '');
    activeCountryCode = countryCodeSelect.value;

    activePhone = rawNumber;
    const fullPhone = `${activeCountryCode}${activePhone}`;

    setButtonLoading(sendOtpBtn, true, 'Sending OTP...');

    try {
      const response = await fetch(`${API_BASE}/mobile/send-otp`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          phone: activePhone,
          countryCode: activeCountryCode
        })
      });

      const data = await response.json();

      if (!response.ok) {
        showAlert(data.error || 'Failed to send OTP. Please try again.', 'error');
        if (data.cooldownRemaining) {
          startCooldownTimer(data.cooldownRemaining);
        }
        return;
      }

      const maskedEmail = maskEmail(currentUserEmail);
      if (displayEmail) displayEmail.textContent = maskedEmail;
      displayPhone.textContent = `${activeCountryCode} ${activePhone}`;
      phoneForm.style.display = 'none';
      otpForm.style.display = 'block';
      hideAlert();

      showToast(`Verification code sent to ${maskedEmail}! Check your inbox.`, 'success');

      startCooldownTimer(data.cooldown || 60);
      otpInput.focus();
    } catch (err) {
      console.error('Send OTP error:', err);
      showAlert('Network error. Please check your connection and try again.', 'error');
    } finally {
      setButtonLoading(sendOtpBtn, false);
    }
  });

  // Verify OTP handler
  otpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const code = otpInput.value.trim();
    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      showAlert('Please enter the full 6-digit OTP code.', 'error');
      otpInput.focus();
      return;
    }

    setButtonLoading(verifyOtpBtn, true, 'Verifying...');

    try {
      const response = await fetch(`${API_BASE}/mobile/verify-otp`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          phone: activePhone,
          countryCode: activeCountryCode,
          otp: code
        })
      });

      const data = await response.json();

      if (!response.ok) {
        showAlert(data.error || 'Incorrect OTP code. Please try again.', 'error');
        otpInput.value = '';
        otpInput.focus();
        return;
      }

      if (data.user) {
        localStorage.setItem('carryParcelUser', JSON.stringify(data.user));
        localStorage.setItem('carryParcelLoggedIn', 'true');
      }

      otpForm.style.display = 'none';
      successOverlay.style.display = 'block';

      showToast('Mobile number verified successfully!', 'success');

      setTimeout(() => {
        const destination = getSafeRedirectTarget() || '../user-dashboard/overview.html';
        window.location.replace(destination);
      }, 1500);

    } catch (err) {
      console.error('Verify OTP error:', err);
      showAlert('Network error. Please try again.', 'error');
    } finally {
      setButtonLoading(verifyOtpBtn, false);
    }
  });

  // Resend OTP handler
  resendOtpBtn.addEventListener('click', async () => {
    if (resendOtpBtn.disabled) return;
    hideAlert();

    setButtonLoading(resendOtpBtn, true, 'Resending...');

    try {
      const response = await fetch(`${API_BASE}/mobile/resend-otp`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          phone: activePhone,
          countryCode: activeCountryCode
        })
      });

      const data = await response.json();

      if (!response.ok) {
        showAlert(data.error || 'Failed to resend OTP.', 'error');
        return;
      }

      const maskedEmail = maskEmail(currentUserEmail);
      showToast(`New verification code sent to ${maskedEmail}! Check your inbox.`, 'success');

      startCooldownTimer(data.cooldown || 60);
      otpInput.value = '';
      otpInput.focus();
    } catch (err) {
      console.error('Resend OTP error:', err);
      showAlert('Network error. Please try again.', 'error');
    } finally {
      setButtonLoading(resendOtpBtn, false);
    }
  });

  // Change phone button handler
  changePhoneBtn.addEventListener('click', () => {
    hideAlert();
    otpForm.style.display = 'none';
    phoneForm.style.display = 'block';
    phoneInput.focus();
  });

  // Restrict OTP input to numbers
  otpInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
  });

  // Initialize status check
  checkInitialUserStatus();
})();
