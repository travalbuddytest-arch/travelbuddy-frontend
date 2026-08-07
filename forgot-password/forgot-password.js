(function () {
  'use strict';

  const API_BASE = `${window.location.origin}/api/auth`;

  const toast = document.getElementById('toast');
  const backBtn = document.getElementById('backBtn');
  const brandHeader = document.getElementById('brandHeader');
  const pageTitle = document.getElementById('pageTitle');
  const pageSubtitle = document.getElementById('pageSubtitle');

  const requestForm = document.getElementById('requestForm');
  const otpForm = document.getElementById('otpForm');
  const resetForm = document.getElementById('resetForm');

  const otpMethod = document.getElementById('otpMethod');
  const emailField = document.getElementById('emailField');
  const phoneField = document.getElementById('phoneField');
  const emailInput = document.getElementById('email');
  const phoneInput = document.getElementById('phone');
  const countryCode = document.getElementById('countryCode');
  const emailError = document.getElementById('emailError');
  const phoneError = document.getElementById('phoneError');
  const sendOtpBtn = document.getElementById('sendOtpBtn');

  const otpBoxes = Array.from(document.querySelectorAll('.otp-box'));
  const otpError = document.getElementById('otpError');
  const verifyOtpBtn = document.getElementById('verifyOtpBtn');
  const resendBtn = document.getElementById('resendBtn');

  const newPassword = document.getElementById('newPassword');
  const confirmPassword = document.getElementById('confirmPassword');
  const newPasswordError = document.getElementById('newPasswordError');
  const confirmPasswordError = document.getElementById('confirmPasswordError');
  const setPasswordBtn = document.getElementById('setPasswordBtn');

  let currentMethod = 'email';
  let currentIdentifier = '';
  let resetToken = '';
  let toastTimer;
  let resendTimer;

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function showToast(message, type) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = 'toast show' + (type ? ' ' + type : '');
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
  }

  function setButtonLoading(button, isLoading) {
    button.classList.toggle('loading', isLoading);
    button.disabled = isLoading;
  }

  async function parseResponse(response) {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) return response.json();
    const text = await response.text();
    return { error: text || `Server returned ${response.status}` };
  }

  function setFieldError(field, errorEl, message) {
    field.classList.add('has-error');
    errorEl.textContent = message;
  }

  function clearFieldError(field, errorEl) {
    field.classList.remove('has-error');
    errorEl.textContent = '';
  }

  function getFullPhone() {
    return `${countryCode.value}${phoneInput.value.trim().replace(/[\s-]/g, '')}`;
  }

  function validateIdentifier(showError) {
    currentMethod = otpMethod.value;

    if (currentMethod === 'email') {
      const value = emailInput.value.trim().toLowerCase();
      if (!value) {
        if (showError) setFieldError(emailField, emailError, 'Email is required.');
        return false;
      }
      if (!EMAIL_RE.test(value)) {
        if (showError) setFieldError(emailField, emailError, 'Enter a valid email address.');
        return false;
      }
      clearFieldError(emailField, emailError);
      currentIdentifier = value;
      return true;
    }

    const phone = getFullPhone();
    if (!phoneInput.value.trim()) {
      if (showError) setFieldError(phoneInput.closest('.field'), phoneError, 'Mobile number is required.');
      return false;
    }
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      if (showError) setFieldError(phoneInput.closest('.field'), phoneError, 'Enter a valid mobile number.');
      return false;
    }
    clearFieldError(phoneInput.closest('.field'), phoneError);
    currentIdentifier = phone;
    return true;
  }

  function validateOtp(showError) {
    const code = otpBoxes.map((box) => box.value.trim()).join('');
    otpError.classList.remove('show');
    otpError.textContent = '';

    if (code.length !== 6 || /\D/.test(code)) {
      if (showError) {
        otpError.textContent = 'Enter the full 6-digit OTP.';
        otpError.classList.add('show');
      }
      return false;
    }
    return true;
  }

  function validatePasswords(showError) {
    let ok = true;

    if (!newPassword.value) {
      if (showError) setFieldError(newPassword.closest('.field'), newPasswordError, 'New password is required.');
      ok = false;
    } else if (newPassword.value.length < 8) {
      if (showError) setFieldError(newPassword.closest('.field'), newPasswordError, 'Password must be at least 8 characters.');
      ok = false;
    } else {
      clearFieldError(newPassword.closest('.field'), newPasswordError);
    }

    if (!confirmPassword.value) {
      if (showError) setFieldError(confirmPassword.closest('.field'), confirmPasswordError, 'Confirm password is required.');
      ok = false;
    } else if (confirmPassword.value !== newPassword.value) {
      if (showError) setFieldError(confirmPassword.closest('.field'), confirmPasswordError, 'Passwords do not match.');
      ok = false;
    } else {
      clearFieldError(confirmPassword.closest('.field'), confirmPasswordError);
    }

    return ok;
  }

  function clearOtp() {
    otpBoxes.forEach((box) => {
      box.value = '';
      box.classList.remove('filled');
    });
  }

  function setView(view) {
    requestForm.classList.toggle('hidden', view !== 'request');
    otpForm.classList.toggle('hidden', view !== 'otp');
    resetForm.classList.toggle('hidden', view !== 'reset');
    brandHeader.classList.toggle('compact', view === 'reset');
    backBtn.dataset.view = view;

    if (view === 'request') {
      pageTitle.textContent = 'Forgot Password';
      pageSubtitle.textContent = 'Choose where you want to receive your OTP.';
      backBtn.href = '../login/login.html';
      setTimeout(() => (otpMethod.value === 'email' ? emailInput : phoneInput).focus({ preventScroll: true }), 100);
    }

    if (view === 'otp') {
      pageTitle.textContent = 'Verify OTP';
      pageSubtitle.textContent = `Enter the code sent to ${currentMethod === 'email' ? currentIdentifier : currentIdentifier}.`;
      backBtn.href = '#';
      clearOtp();
      setTimeout(() => otpBoxes[0].focus({ preventScroll: true }), 100);
    }

    if (view === 'reset') {
      pageTitle.textContent = 'Set New Password';
      pageSubtitle.textContent = 'Create a new password for your account.';
      backBtn.href = '#';
      setTimeout(() => newPassword.focus({ preventScroll: true }), 100);
    }
  }

  function toggleMethodFields() {
    const byEmail = otpMethod.value === 'email';
    emailField.classList.toggle('hidden', !byEmail);
    phoneField.classList.toggle('hidden', byEmail);
    clearFieldError(emailField, emailError);
    clearFieldError(phoneInput.closest('.field'), phoneError);
  }

  async function sendOtp(isResend) {
    if (!validateIdentifier(true)) {
      showToast('Please fix the highlighted field.', 'error');
      return;
    }

    const button = isResend ? resendBtn : sendOtpBtn;
    setButtonLoading(button, true);

    try {
      const body = currentMethod === 'email'
        ? { method: 'email', email: currentIdentifier }
        : { method: 'phone', phone: currentIdentifier };

      const response = await fetch(`${API_BASE}/forgot-password/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await parseResponse(response);

      if (!response.ok) {
        showToast(data.error || 'Could not send OTP.', 'error');
        return;
      }

      if (data.otp) {
        showToast(`Development OTP: ${data.otp}`, 'success');
      } else {
        showToast(data.message || 'OTP sent successfully.', 'success');
      }

      if (!isResend) setView('otp');
      startResendCooldown();
    } catch (err) {
      showToast('Could not reach the server. Is it running?', 'error');
    } finally {
      setButtonLoading(button, false);
    }
  }

  async function verifyOtp() {
    if (!validateOtp(true)) {
      showToast('Please enter the full OTP.', 'error');
      return;
    }

    setButtonLoading(verifyOtpBtn, true);
    const code = otpBoxes.map((box) => box.value.trim()).join('');

    try {
      const body = currentMethod === 'email'
        ? { method: 'email', email: currentIdentifier, otp: code }
        : { method: 'phone', phone: currentIdentifier, otp: code };

      const response = await fetch(`${API_BASE}/forgot-password/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await parseResponse(response);

      if (!response.ok) {
        showToast(data.error || 'OTP verification failed.', 'error');
        return;
      }

      resetToken = data.resetToken;
      showToast('OTP verified. Set your new password.', 'success');
      setView('reset');
    } catch (err) {
      showToast('Could not reach the server. Is it running?', 'error');
    } finally {
      setButtonLoading(verifyOtpBtn, false);
    }
  }

  async function resetPassword() {
    if (!validatePasswords(true)) {
      showToast('Please fix the highlighted fields.', 'error');
      return;
    }
    if (!resetToken) {
      showToast('Reset session expired. Request OTP again.', 'error');
      setView('request');
      return;
    }

    setButtonLoading(setPasswordBtn, true);

    try {
      const response = await fetch(`${API_BASE}/forgot-password/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, newPassword: newPassword.value }),
      });
      const data = await parseResponse(response);

      if (!response.ok) {
        showToast(data.error || 'Could not set password.', 'error');
        return;
      }

      showToast('Password successfully set. Redirecting to login...', 'success');
      setTimeout(() => {
        window.location.href = '../login/login.html';
      }, 1400);
    } catch (err) {
      showToast('Could not reach the server. Is it running?', 'error');
    } finally {
      setButtonLoading(setPasswordBtn, false);
    }
  }

  function startResendCooldown() {
    clearInterval(resendTimer);
    let seconds = 30;
    resendBtn.disabled = true;
    resendBtn.textContent = `Resend OTP (${seconds}s)`;
    resendTimer = setInterval(() => {
      seconds -= 1;
      if (seconds <= 0) {
        clearInterval(resendTimer);
        resendBtn.disabled = false;
        resendBtn.textContent = 'Resend OTP';
      } else {
        resendBtn.textContent = `Resend OTP (${seconds}s)`;
      }
    }, 1000);
  }

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
  [sendOtpBtn, verifyOtpBtn, setPasswordBtn].forEach(attachRipple);

  otpMethod.addEventListener('change', toggleMethodFields);
  emailInput.addEventListener('input', () => {
    if (emailField.classList.contains('has-error')) validateIdentifier(true);
  });
  phoneInput.addEventListener('input', () => {
    if (phoneInput.closest('.field').classList.contains('has-error')) validateIdentifier(true);
  });

  requestForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sendOtp(false);
  });

  otpForm.addEventListener('submit', (e) => {
    e.preventDefault();
    verifyOtp();
  });

  resetForm.addEventListener('submit', (e) => {
    e.preventDefault();
    resetPassword();
  });

  resendBtn.addEventListener('click', () => sendOtp(true));

  backBtn.addEventListener('click', (e) => {
    const view = backBtn.dataset.view;
    if (view === 'otp') {
      e.preventDefault();
      setView('request');
    }
    if (view === 'reset') {
      e.preventDefault();
      setView('otp');
    }
  });

  otpBoxes.forEach((box, index) => {
    box.addEventListener('input', () => {
      box.value = box.value.replace(/[^0-9]/g, '').slice(0, 1);
      box.classList.toggle('filled', box.value !== '');
      if (box.value && index < otpBoxes.length - 1) otpBoxes[index + 1].focus();
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && index > 0) otpBoxes[index - 1].focus();
      if (e.key === 'ArrowLeft' && index > 0) otpBoxes[index - 1].focus();
      if (e.key === 'ArrowRight' && index < otpBoxes.length - 1) otpBoxes[index + 1].focus();
    });
    box.addEventListener('paste', (e) => {
      e.preventDefault();
      const digits = (e.clipboardData.getData('text') || '').replace(/[^0-9]/g, '').slice(0, 6).split('');
      otpBoxes.forEach((otpBox, i) => {
        otpBox.value = digits[i] || '';
        otpBox.classList.toggle('filled', Boolean(digits[i]));
      });
      const nextIndex = Math.min(digits.length, otpBoxes.length - 1);
      otpBoxes[nextIndex].focus();
    });
  });

  document.querySelectorAll('.toggle-password').forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.target);
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      button.textContent = showing ? 'Show' : 'Hide';
      button.setAttribute('aria-pressed', String(!showing));
      button.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
      input.focus({ preventScroll: true });
    });
  });

  newPassword.addEventListener('input', () => {
    if (newPassword.closest('.field').classList.contains('has-error')) validatePasswords(true);
  });
  confirmPassword.addEventListener('input', () => {
    if (confirmPassword.closest('.field').classList.contains('has-error')) validatePasswords(true);
  });

  toggleMethodFields();
  setView('request');
})();
