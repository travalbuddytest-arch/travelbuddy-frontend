(function () {
  'use strict';

  // The address of your running backend server (Part B of the guide).
  // Change this later when you deploy the backend online (e.g. to your Render URL).
  const API_BASE = `${window.location.origin}/api/auth`;

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
    clearError(regPassword); return true;
  }
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

    continueBtn.classList.add('loading');
    continueBtn.disabled = true;

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
      document.getElementById('phoneOtpLabel').textContent = `Enter the 6-digit code we sent to your mobile number: ${currentPhone}.`;
      clearOtpInputs(emailOtpBoxes);
      clearOtpInputs(phoneOtpBoxes);

      if (data.emailOtp || data.phoneOtp) {
        showToast(`Development OTPs — Email: ${data.emailOtp || 'sent'}, Mobile: ${data.phoneOtp || 'sent'}`, 'success');
      } else {
        showToast(data.message || 'Verification codes sent.', 'success');
      }
      goToPanel('verify');
    } catch (err) {
      // The server could not be reached at all (not running, wrong URL, no internet)
      showToast('Could not reach the server. Is it running?', 'error');
    } finally {
      continueBtn.classList.remove('loading');
      continueBtn.disabled = false;
    }
  });

  // ---------- OTP ----------
  const emailOtpBoxes = Array.from(document.querySelectorAll('.email-otp-box'));
  const phoneOtpBoxes = Array.from(document.querySelectorAll('.phone-otp-box'));
  const otpForm = document.getElementById('otpForm');
  const verifyBtn = document.getElementById('verifyBtn');
  const emailOtpError = document.getElementById('emailOtpError');
  const phoneOtpError = document.getElementById('phoneOtpError');
  const resendBtn = document.getElementById('resendBtn');

  function setupOtpBoxes(boxes, nextBoxes) {
    boxes.forEach((box, i) => {
      box.addEventListener('input', () => {
        box.value = box.value.replace(/[^0-9]/g, '').slice(0, 1);
        box.classList.toggle('filled', box.value !== '');
        if (box.value && i < boxes.length - 1) boxes[i + 1].focus();
        if (box.value && i === boxes.length - 1 && nextBoxes && nextBoxes[0]) nextBoxes[0].focus();
      });
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !box.value && i > 0) boxes[i - 1].focus();
        if (e.key === 'ArrowLeft' && i > 0) boxes[i - 1].focus();
        if (e.key === 'ArrowRight' && i < boxes.length - 1) boxes[i + 1].focus();
      });
      box.addEventListener('paste', (e) => {
        e.preventDefault();
        const digits = (e.clipboardData.getData('text') || '').replace(/[^0-9]/g, '').slice(0, 6).split('');
        boxes.forEach((b, idx) => { b.value = digits[idx] || ''; b.classList.toggle('filled', !!digits[idx]); });
        const next = boxes[Math.min(digits.length, boxes.length - 1)];
        if (next) next.focus();
      });
    });
  }

  function getOtpCode(boxes) {
    return boxes.map((b) => b.value).join('');
  }

  function clearOtpInputs(boxes) {
    boxes.forEach((box) => {
      box.value = '';
      box.classList.remove('filled');
    });
  }

  function showOtpError(errorEl, message) {
    errorEl.textContent = message;
    errorEl.classList.add('show');
  }

  function clearOtpErrors() {
    emailOtpError.textContent = '';
    phoneOtpError.textContent = '';
    emailOtpError.classList.remove('show');
    phoneOtpError.classList.remove('show');
  }

  setupOtpBoxes(emailOtpBoxes, phoneOtpBoxes);
  setupOtpBoxes(phoneOtpBoxes);

  otpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailOtp = getOtpCode(emailOtpBoxes);
    const phoneOtp = getOtpCode(phoneOtpBoxes);
    clearOtpErrors();

    let hasOtpError = false;
    if (emailOtp.length < 6) {
      showOtpError(emailOtpError, 'Enter all 6 email OTP digits.');
      hasOtpError = true;
    }
    if (phoneOtp.length < 6) {
      showOtpError(phoneOtpError, 'Enter all 6 mobile OTP digits.');
      hasOtpError = true;
    }
    if (hasOtpError) {
      showToast('Please complete both verification codes.', 'error');
      return;
    }

    verifyBtn.classList.add('loading');
    verifyBtn.disabled = true;

    try {
      const response = await fetch(`${API_BASE}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: currentEmail || regEmail.value.trim().toLowerCase(),
          phone: currentPhone || `${countryCode.value}${phone.value.trim().replace(/[\s-]/g, '')}`,
          emailOtp,
          phoneOtp,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // e.g. "Incorrect code." or "Code expired."
        if ((data.error || '').toLowerCase().includes('email')) {
          showOtpError(emailOtpError, data.error || 'Email verification failed.');
        } else if ((data.error || '').toLowerCase().includes('mobile')) {
          showOtpError(phoneOtpError, data.error || 'Mobile verification failed.');
        } else {
          showOtpError(emailOtpError, data.error || 'Verification failed.');
          showOtpError(phoneOtpError, data.error || 'Verification failed.');
        }
        showToast(data.error || 'Verification failed.', 'error');
        return;
      }

      showToast('Welcome to Travel Buddy! Your account has been created.', 'success');

      setTimeout(() => {
      window.location.href = "../login/login.html";
      },1500);
    } catch (err) {
      showToast('Could not reach the server. Is it running?', 'error');
    } finally {
      verifyBtn.classList.remove('loading');
      verifyBtn.disabled = false;
    }
  });

  document.getElementById('goBack2').addEventListener('click', () => goToPanel('details'));

  let resendTimer;
  resendBtn.addEventListener('click', async () => {
    resendBtn.disabled = true;

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
        showToast(data.error || 'Could not resend code.', 'error');
        resendBtn.disabled = false;
        return;
      }

      clearOtpInputs(emailOtpBoxes);
      clearOtpInputs(phoneOtpBoxes);
      clearOtpErrors();
      if (data.emailOtp || data.phoneOtp) {
        showToast(`Development OTPs — Email: ${data.emailOtp || 'sent'}, Mobile: ${data.phoneOtp || 'sent'}`, 'success');
      } else {
        showToast(data.message || 'New codes have been sent.', 'success');
      }
    } catch (err) {
      showToast('Could not reach the server. Is it running?', 'error');
      resendBtn.disabled = false;
      return;
    }

    let seconds = 30;
    const original = 'Resend';
    resendBtn.textContent = `Resend (${seconds}s)`;
    clearInterval(resendTimer);
    resendTimer = setInterval(() => {
      seconds -= 1;
      if (seconds <= 0) {
        clearInterval(resendTimer);
        resendBtn.disabled = false;
        resendBtn.textContent = original;
      } else {
        resendBtn.textContent = `Resend (${seconds}s)`;
      }
    }, 1000);
  });

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
  [continueBtn, verifyBtn].forEach(attachRipple);
})();
