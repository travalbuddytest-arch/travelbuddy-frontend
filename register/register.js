(function () {
  'use strict';

  // The address of your running backend server (Part B of the guide).
  // Change this later when you deploy the backend online (e.g. to your Render URL).
  const API_BASE = `${APP_CONFIG.API_BASE_URL}/api/auth`;

  const panels = { details: document.getElementById('panel2'), verify: document.getElementById('panel3') };
  const toast = document.getElementById('toast');

  // ---------- Toast ----------
  let toastTimer;
  function showToast(message, type) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = 'toast show' + (type ? ' ' + type : '');
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  // ---------- Panel navigation ----------
  function goToPanel(name) {
    Object.keys(panels).forEach((k) => panels[k].classList.toggle('active', k === name));
    const focusTarget = panels[name].querySelector('input');
    if (focusTarget) setTimeout(() => focusTarget.focus({ preventScroll: true }), 250);
  }

  // ---------- Personal details validation ----------
  const firstName = document.getElementById('firstName');
  const lastName = document.getElementById('lastName');
  const regEmail = document.getElementById('regEmail');
  const regPassword = document.getElementById('regPassword');
  const phone = document.getElementById('phone');
  const countryCode = document.getElementById('countryCode');
  const detailsForm = document.getElementById('detailsForm');
  const continueBtn = document.getElementById('continueBtn');
  let currentEmail = '';
  let currentPhone = '';
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PHONE_RE = /^[0-9\s-]{7,15}$/;
  const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

  function setError(input, message) {
    const field = input.closest('.field');
    field.classList.add('has-error');
    const err = field.querySelector('.error-msg');
    if (err) err.textContent = message;
  }
  function clearError(input) {
    const field = input.closest('.field');
    field.classList.remove('has-error');
    const err = field.querySelector('.error-msg');
    if (err) err.textContent = '';
  }

  function validateRequired(input, label) {
    if (!input.value.trim()) { setError(input, `${label} is required.`); return false; }
    clearError(input); return true;
  }
  function validateEmailField() {
    const v = regEmail.value.trim();
    if (!v) { setError(regEmail, 'Email is required.'); return false; }
    if (!EMAIL_RE.test(v)) { setError(regEmail, 'Enter a valid email address.'); return false; }
    clearError(regEmail); return true;
  }
  function validatePasswordField() {
    const v = regPassword.value;
    if (!v) { setError(regPassword, 'Password is required.'); return false; }
    if (v.length < 8) { setError(regPassword, 'Password must be at least 8 characters.'); return false; }
    if (!PASSWORD_RE.test(v)) { setError(regPassword, 'Use at least one letter and one number.'); return false; }
    clearError(regPassword); return true;
  }

  // Anti-Paste Protection
  regPassword.addEventListener('paste', (e) => {
    e.preventDefault();
    showToast('For security, please type your password manually.', 'error');
  });
  function validatePhoneField() {
    const v = phone.value.trim();
    if (!v) { setError(phone, 'Phone number is required.'); return false; }
    if (!PHONE_RE.test(v)) { setError(phone, 'Enter a valid phone number.'); return false; }
    clearError(phone); return true;
  }

  [[firstName, 'First name'], [lastName, 'Last name']].forEach(([input, label]) => {
    input.addEventListener('blur', () => validateRequired(input, label));
    input.addEventListener('input', () => { if (input.closest('.field').classList.contains('has-error')) validateRequired(input, label); });
  });
  regEmail.addEventListener('blur', validateEmailField);
  regEmail.addEventListener('input', () => { if (regEmail.closest('.field').classList.contains('has-error')) validateEmailField(); });
  regPassword.addEventListener('blur', validatePasswordField);
  regPassword.addEventListener('input', () => { if (regPassword.closest('.field').classList.contains('has-error')) validatePasswordField(); });

  const togglePassword = document.getElementById('togglePassword');
  togglePassword.addEventListener('click', () => {
    const showing = regPassword.type === 'text';
    regPassword.type = showing ? 'password' : 'text';
    togglePassword.setAttribute('aria-pressed', String(!showing));
    togglePassword.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    togglePassword.querySelector('.icon-eye').style.display = showing ? '' : 'none';
    togglePassword.querySelector('.icon-eye-off').style.display = showing ? 'none' : '';
  });

  phone.addEventListener('blur', validatePhoneField);
  phone.addEventListener('input', () => { if (phone.closest('.field').classList.contains('has-error')) validatePhoneField(); });

  detailsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ok = [
      validateRequired(firstName, 'First name'),
      validateRequired(lastName, 'Last name'),
      validateEmailField(),
      validatePasswordField(),
      validatePhoneField(),
    ].every(Boolean);

    if (!ok) {
      showToast('Please fix the highlighted fields.', 'error');
      const firstBad = detailsForm.querySelector('.has-error input');
      if (firstBad) firstBad.focus();
      return;
    }

    const lock = window.TravelBuddy?.FormLock || window.TravelBuddyValidation?.FormLock;
    lock(detailsForm, true, { loadingText: 'Creating Account...' });

    try {
      const response = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.value.trim(),
          lastName: lastName.value.trim(),
          email: regEmail.value.trim(),
          password: regPassword.value,
          phone: `${countryCode.value}${phone.value.trim().replace(/[\s-]/g, '')}`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Server responded with an error, e.g. "email already exists"
        showToast(data.error || 'Something went wrong. Please try again.', 'error');
        return;
      }

      currentEmail = regEmail.value.trim().toLowerCase();
      currentPhone = `${countryCode.value}${phone.value.trim().replace(/[\s-]/g, '')}`;
      document.getElementById('emailOtpLabel').textContent = `Enter the 6-digit code we sent to your email: ${currentEmail}.`;
      // document.getElementById('phoneOtpLabel').textContent = `Enter the 6-digit code we sent to your mobile number: ${currentPhone}.`;

      if (data.emailOtp) {
        showToast(`Development OTP — Email: ${data.emailOtp}`, 'success');
      } else {
        showToast(data.message || 'Verification code sent.', 'success');
      }
      goToPanel('verify');
      mountOtpVerifiers();
    } catch (err) {
      // The server could not be reached at all (not running, wrong URL, no internet)
      showToast('Could not reach the server. Is it running?', 'error');
    } finally {
      const lock = window.TravelBuddy?.FormLock || window.TravelBuddyValidation?.FormLock;
      lock(detailsForm, false);
    }
  });

  // ---------- OTP (OtpVerifier component: wobble + success-morph + resend timer + back nav) ----------
  const emailOtpMount = document.getElementById('emailOtpMount');
  // const phoneOtpMount = document.getElementById('phoneOtpMount');

  let emailOtpVerifier = null;
  // let phoneOtpVerifier = null;

  // Registration now only requires email verification.
  const otpState = { emailCode: null, emailResolve: null, verifying: false };

  function tryVerifyOtp() {
    if (otpState.emailCode == null || otpState.emailCode.length < 6) return;
    if (otpState.verifying) return;
    otpState.verifying = true;

    const emailOtp = otpState.emailCode;
    const emailResolve = otpState.emailResolve;

    (async () => {
      try {
        const response = await fetch(`${API_BASE}/verify-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: currentEmail || regEmail.value.trim().toLowerCase(),
            phone: currentPhone || `${countryCode.value}${phone.value.trim().replace(/[\s-]/g, '')}`,
            emailOtp,
            phoneOtp: '000000', // Backend now ignores this but we send a dummy to avoid breakage if any
          }),
        });
        const data = await response.json();

        if (!response.ok) {
          showToast(data.error || 'Verification failed.', 'error');
          emailResolve({ success: false, message: 'Invalid verification code.' });
        } else {
          showToast('Welcome to TravelBuddy! Your account has been created.', 'success');
          emailResolve({ success: true });
        }
      } catch (err) {
        showToast('Could not reach the server. Is it running?', 'error');
        emailResolve({ success: false, message: 'Could not reach the server.' });
      } finally {
        otpState.emailCode = null;
        otpState.emailResolve = null;
        otpState.verifying = false;
      }
    })();
  }

  function goBackFromOtp() {
    destroyOtpVerifiers();
    goToPanel('details');
  }

  function destroyOtpVerifiers() {
    if (emailOtpVerifier) { emailOtpVerifier.destroy(); emailOtpVerifier = null; }
    // if (phoneOtpVerifier) { phoneOtpVerifier.destroy(); phoneOtpVerifier = null; }
    otpState.emailCode = null;
    otpState.emailResolve = null;
    otpState.verifying = false;
  }

  function mountOtpVerifiers() {
    destroyOtpVerifiers();

    emailOtpVerifier = new OtpVerifier(emailOtpMount, {
      length: 6,
      resendSeconds: 120,
      showResend: true,
      interceptBackButton: true, // owns the single back-button interception for this step
      onComplete: (code) => new Promise((resolve) => {
        otpState.emailCode = code;
        otpState.emailResolve = resolve;
        tryVerifyOtp();
      }),
      onResend: async () => {
        try {
          const response = await fetch(`${API_BASE}/resend-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: currentEmail || regEmail.value.trim().toLowerCase(),
              phone: currentPhone || `${countryCode.value}${phone.value.trim().replace(/[\s-]/g, '')}`,
            }),
          });
          const data = await response.json();

          if (!response.ok) {
            return { success: false, message: data.error || 'Could not resend code.' };
          }

          if (data.emailOtp) {
            showToast(`Development OTP — Email: ${data.emailOtp}`, 'success');
          } else {
            showToast(data.message || 'New code has been sent.', 'success');
          }

          return { success: true };
        } catch (err) {
          return { success: false, message: 'Could not reach the server. Is it running?' };
        }
      },
      onBack: goBackFromOtp,
      onVerified: () => {
        setTimeout(() => {
          window.location.href = '../login/login.html';
        }, 1500);
      },
    });

    /*
    phoneOtpVerifier = new OtpVerifier(phoneOtpMount, {
      length: 6,
      resendSeconds: 120,
      showResend: false, // the email box's resend link above covers both channels
      interceptBackButton: false,
      onComplete: (code) => new Promise((resolve) => {
        otpState.phoneCode = code;
        otpState.phoneResolve = resolve;
        tryVerifyOtp();
      }),
    });
    */
  }

  document.getElementById('goBack2').addEventListener('click', goBackFromOtp);

  // ---------- Ripple effect ----------
  function attachRipple(button) {
    button.addEventListener('click', function (e) {
      const rect = button.getBoundingClientRect();
      const ripple = document.createElement('span');
      const size = Math.max(rect.width, rect.height);
      ripple.className = 'ripple';
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
      ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
      button.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove());
    });
  }
  [continueBtn].forEach(attachRipple);
})();
