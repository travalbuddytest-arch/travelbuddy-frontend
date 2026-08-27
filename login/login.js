(function () {
  'use strict';

  // The address of your running backend server (same one register.js talks to).
  // Update this later when you deploy the backend online.
  const API_BASE = `${APP_CONFIG.API_BASE_URL}/api/auth`;

  const form = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const rememberInput = document.getElementById('remember');
  const togglePass = document.getElementById('togglePass');
  const loginBtn = document.getElementById('loginBtn');
  const toast = document.getElementById('toast');
  const googleBtn = document.getElementById('googleBtn');
  const otpBtn = document.getElementById('otpBtn');
  const forgotLink = document.getElementById('forgotLink');
  const createAccount = document.getElementById('createAccount');
  const backBtn = document.getElementById('backBtn');
  const otpPhoneForm = document.getElementById('otpPhoneForm');
  const otpVerifyForm = document.getElementById('otpVerifyForm');
  const countryCode = document.getElementById('countryCode');
  const phoneNumberInput = document.getElementById('phoneNumber');
  const phoneError = document.getElementById('phoneError');
  const sendOtpBtn = document.getElementById('sendOtpBtn');
  const loginOtpMount = document.getElementById('loginOtpMount');
  const pageTitle = document.getElementById('welcomeTitle');
  const subtitle = document.querySelector('.subtitle');
  let currentPhoneNumber = '';
  let loginOtpVerifier = null;
  const LOGIN_STATE_KEY = 'travelBuddyLoginState';

  // Where auth-guard.js sent the visitor from before bouncing them here
  // (see shared/auth-guard.js). Only ever a same-site relative path into
  // user-dashboard/*, never used for admin — open-redirect guard below.
  function getSafeRedirectTarget() {
    try {
      const raw = new URLSearchParams(window.location.search).get('redirect');
      if (!raw) return null;
      const decoded = decodeURIComponent(raw);
      // Must be a relative path back into the protected user-dashboard
      // area — reject absolute/protocol-relative URLs and anything else
      // to prevent this becoming an open redirect.
      if (!/^\/user-dashboard\//.test(decoded)) return null;
      return `..${decoded}`;
    } catch (err) {
      return null;
    }
  }

  function saveLoginState() {
    const state = {
      email: emailInput.value,
      remember: rememberInput.checked,
    };

    if (rememberInput.checked) {
      state.password = passwordInput.value;
    }

    sessionStorage.setItem(LOGIN_STATE_KEY, JSON.stringify(state));
  }

  function restoreLoginState() {
    const rawState = sessionStorage.getItem(LOGIN_STATE_KEY);
    if (!rawState) return;

    try {
      const state = JSON.parse(rawState);
      if (typeof state.email === 'string') {
        emailInput.value = state.email;
      }
      if (typeof state.remember === 'boolean') {
        rememberInput.checked = state.remember;
      }
      if (state.remember && typeof state.password === 'string') {
        passwordInput.value = state.password;
      }
    } catch (err) {
      sessionStorage.removeItem(LOGIN_STATE_KEY);
    }
  }

  function clearLoginState() {
    sessionStorage.removeItem(LOGIN_STATE_KEY);
  }

  // BUG FIX: each of the three login flows (password, Google, OTP) used to
  // duplicate its own "setTimeout(() => window.location.href = ...)" call.
  // If localStorage.setItem() threw above (private browsing / storage full)
  // the code never even reached this point, so nothing looked broken from
  // the outside except that the user stayed stuck on the login page after
  // seeing the "success" toast. goToDashboard() centralizes the redirect,
  // wraps it in try/catch so a storage error can't silently cancel the
  // navigation, and uses location.replace() so the old login page (with its
  // "loading" button state) isn't left in the browser's back-button history.
  function goToDashboard(delay) {
    const destination = getSafeRedirectTarget() || '../user-dashboard/overview.html';
    setTimeout(() => {
      try {
        window.location.replace(destination);
      } catch (err) {
        window.location.href = destination;
      }
    }, delay);
  }

  // Used only by the unified password-login flow below, since that's the
  // only flow that can resolve to either a user or an admin account. Google
  // and OTP login stay user-only, so they keep calling goToDashboard() as-is.
  function goToRoleDashboard(role, delay) {
    const destination = role === 'admin'
      ? '../admin_dashboard/html/admin.html'
      : (getSafeRedirectTarget() || '../user-dashboard/overview.html');
    setTimeout(() => {
      try {
        window.location.replace(destination);
      } catch (err) {
        window.location.href = destination;
      }
    }, delay);
  }

  restoreLoginState();

  // ---------- Toast ----------
  let toastTimer;
  function showToast(message, type) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = 'toast show' + (type ? ' ' + type : '');
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }

  // ---------- Validation ----------
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function setFieldError(fieldEl, errorEl, message) {
    fieldEl.classList.add('has-error');
    errorEl.textContent = message;
  }

  function clearFieldError(fieldEl, errorEl) {
    fieldEl.classList.remove('has-error');
    errorEl.textContent = '';
  }

  function validateEmail(showError) {
    const field = emailInput.closest('.field');
    const errorEl = document.getElementById('emailError');
    const value = emailInput.value.trim();

    if (!value) {
      if (showError) setFieldError(field, errorEl, 'Email is required.');
      return false;
    }
    if (!EMAIL_RE.test(value)) {
      if (showError) setFieldError(field, errorEl, 'Enter a valid email address.');
      return false;
    }
    clearFieldError(field, errorEl);
    return true;
  }

  function validatePassword(showError) {
    const field = passwordInput.closest('.field');
    const errorEl = document.getElementById('passwordError');
    const value = passwordInput.value;

    if (!value) {
      if (showError) setFieldError(field, errorEl, 'Password is required.');
      return false;
    }
    if (value.length < 8) {
      if (showError) setFieldError(field, errorEl, 'Password must be at least 8 characters.');
      return false;
    }
    clearFieldError(field, errorEl);
    return true;
  }

  emailInput.addEventListener('blur', () => validateEmail(true));
  emailInput.addEventListener('input', () => {
    if (emailInput.closest('.field').classList.contains('has-error')) validateEmail(true);
    saveLoginState();
  });

  passwordInput.addEventListener('blur', () => validatePassword(true));
  passwordInput.addEventListener('input', () => {
    if (passwordInput.closest('.field').classList.contains('has-error')) validatePassword(true);
    saveLoginState();
  });

  rememberInput.addEventListener('change', () => {
    if (rememberInput.checked) {
      saveLoginState();
      return;
    }

    const rawState = sessionStorage.getItem(LOGIN_STATE_KEY);
    if (!rawState) return;

    try {
      const state = JSON.parse(rawState);
      delete state.password;
      state.remember = false;
      sessionStorage.setItem(LOGIN_STATE_KEY, JSON.stringify(state));
    } catch (err) {
      sessionStorage.removeItem(LOGIN_STATE_KEY);
    }
  });

  // ---------- Show / hide password ----------
  togglePass.addEventListener('click', () => {
    const isHidden = passwordInput.type === 'password';
    passwordInput.type = isHidden ? 'text' : 'password';
    togglePass.setAttribute('aria-pressed', String(isHidden));
    togglePass.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
    togglePass.querySelector('.eye-open').hidden = isHidden;
    togglePass.querySelector('.eye-closed').hidden = !isHidden;
    passwordInput.focus({ preventScroll: true });
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
  [loginBtn, googleBtn, otpBtn].forEach(attachRipple);

  // ---------- Submit ----------
  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const emailOk = validateEmail(true);
    const passOk = validatePassword(true);

    if (!emailOk || !passOk) {
      showToast('Please fix the highlighted fields.', 'error');
      const firstError = form.querySelector('.has-error input');
      if (firstError) firstError.focus();
      return;
    }

    loginBtn.classList.add('loading');
    loginBtn.disabled = true;

    try {
      // Single unified endpoint for both users and admins - the backend
      // figures out which collection the email belongs to. credentials:
      // 'include' is kept so the admin session cookie gets set too, since
      // some admin dashboard pages read it as a fallback to the Bearer token.
      const resp = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput.value.trim(),
          password: passwordInput.value,
          rememberMe: rememberInput.checked,
        }),
        credentials: 'include',
      });

      const data = await resp.json();

      if (!resp.ok) {
        // 409 = the same email exists in both the users and admins
        // collections. That's a config error the person can't fix
        // themselves, so show the server's message as-is rather than a
        // generic "login failed".
        showToast(data.error || 'Login failed. Please try again.', 'error');
        return;
      }

      try {
        if (data.role === 'admin') {
          if (data.token) {
            localStorage.setItem('admin_token', data.token);
            localStorage.setItem('travelBuddyAdminToken', data.token);
          }
          if (data.admin) {
            localStorage.setItem('admin_user', JSON.stringify(data.admin));
            localStorage.setItem('travelBuddyAdmin', JSON.stringify(data.admin));
          }
        } else {
          if (data.token) localStorage.setItem('travelBuddyToken', data.token);
          if (data.user) localStorage.setItem('travelBuddyUser', JSON.stringify(data.user));
        }
        clearLoginState();
      } catch (storageErr) {
        console.error('Could not persist login session:', storageErr);
      }

      window.TravelBuddy.showLoginSuccess({
        user: data.role === 'admin' ? data.admin : data.user,
        method: 'EMAIL',
        onComplete: () => {
          goToRoleDashboard(data.role, 0);
        }
      });
    } catch (err) {
      showToast('Could not reach the server. Is it running?', 'error');
    } finally {
      loginBtn.classList.remove('loading');
      loginBtn.disabled = false;
    }
  });

  // ---------- Google login ----------
  async function handleGoogleCredential(idToken) {
    try {
      const apiResponse = await fetch(`${API_BASE}/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = await parseResponse(apiResponse);
      if (!apiResponse.ok) {
        showToast(data.error || 'Google login failed.', 'error');
        return;
      }
      try {
        if (data.token) localStorage.setItem('travelBuddyToken', data.token);
        localStorage.setItem('travelBuddyUser', JSON.stringify(data.user));
        clearLoginState();
      } catch (storageErr) {
        console.error('Could not persist login session:', storageErr);
      }
      window.TravelBuddy.showLoginSuccess({
        user: data.user,
        method: 'GOOGLE',
        onComplete: () => {
          goToDashboard(0);
        }
      });
    } catch (err) {
      showToast('Could not reach the server. Is it running?', 'error');
    }
  }

  async function initializeGoogleLogin() {
    const firebaseConfig = window.TravelBuddyFirebaseConfig || {};

    if (!window.firebase) {
      googleBtn.disabled = true;
      showToast('Firebase could not be loaded.', 'error');
      return;
    }

    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    const provider = new firebase.auth.GoogleAuthProvider();

    googleBtn.addEventListener('click', async () => {
      setButtonLoading(googleBtn, true);
      try {
        const result = await firebase.auth().signInWithPopup(provider);
        const idToken = await result.user.getIdToken(true);
        await handleGoogleCredential(idToken);
      } catch (err) {
        console.error('Firebase Google login failed:', err);
        if (err.code !== 'auth/popup-closed-by-user') {
          showToast(err.message || 'Google login failed.', 'error');
        }
      } finally {
        setButtonLoading(googleBtn, false);
      }
    });
  }

  // ---------- Secondary actions ----------
  otpBtn.addEventListener('click', () => setView('phone'));
  forgotLink.addEventListener('click', () => {
    window.location.href = '../forgot-password/forgot-password.html';
  });
  sendOtpBtn.addEventListener('click', sendOtp);
  backBtn.addEventListener('click', (e) => {
    if (backBtn.dataset.view !== 'login') {
      e.preventDefault();
      resetLoginOtpVerifier();
      setView('login');
    }
  });

  // ---------- Keyboard: Enter in email moves to password ----------
  emailInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      passwordInput.focus();
    }
  });

  function setView(view) {
    form.classList.toggle('hidden', view !== 'login');
    otpPhoneForm.classList.toggle('hidden', view !== 'phone');
    otpVerifyForm.classList.toggle('hidden', view !== 'verify');

    backBtn.dataset.view = view;
    if (view === 'login') {
      pageTitle.textContent = 'Welcome Back';
      subtitle.textContent = 'Log in to manage your shipments and trips.';
      backBtn.href = '/';
      backBtn.setAttribute('aria-label', 'Back to home');
    } else {
      backBtn.href = '#';
      backBtn.setAttribute('aria-label', 'Back to login');
    }

    if (view === 'phone') {
      pageTitle.textContent = 'OTP Login';
      subtitle.textContent = 'Enter your mobile number to receive a one-time code.';
      phoneNumberInput.focus();
    }

    if (view === 'verify') {
      pageTitle.textContent = 'Verify your account';
      subtitle.textContent = `Enter the 6-digit code sent to ${currentPhoneNumber}`;
      loginOtpVerifier?.focus();
    }

    clearFieldError(phoneNumberInput.closest('.field'), phoneError);
  }

  function validatePhone(showError) {
    const field = phoneNumberInput.closest('.field');
    const value = phoneNumberInput.value.trim().replace(/\s+/g, '');
    const cleaned = value.replace(/[^0-9]/g, '');

    if (!cleaned) {
      if (showError) setFieldError(field, phoneError, 'Mobile number is required.');
      return false;
    }
    if (cleaned.length < 8 || cleaned.length > 15) {
      if (showError) setFieldError(field, phoneError, 'Enter a valid mobile number.');
      return false;
    }
    clearFieldError(field, phoneError);
    return true;
  }

  function getFullPhone() {
    return `${countryCode.value}${phoneNumberInput.value.trim().replace(/\s+/g, '')}`;
  }

  function setButtonLoading(button, isLoading) {
    button.classList.toggle('loading', isLoading);
    button.disabled = isLoading;
  }

  async function parseResponse(response) {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return response.json();
    }
    const text = await response.text();
    return { __raw: text };
  }

  async function sendOtp() {
    if (!validatePhone(true)) {
      showToast('Please enter a valid mobile number.', 'error');
      return;
    }

    setButtonLoading(sendOtpBtn, true);
    currentPhoneNumber = getFullPhone();

    try {
      const response = await fetch(`${API_BASE}/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: currentPhoneNumber }),
      });
      const data = await parseResponse(response);

      if (!response.ok) {
        console.error('sendOtp response:', response.status, response.statusText, data);
        const message = data.error || data.message || `Server returned ${response.status}`;
        showToast(message, 'error');
        return;
      }

      showToast('OTP sent. Check your phone.', 'success');
      setView('verify');
      mountLoginOtpVerifier();
    } catch (err) {
      console.error('sendOtp failed:', err);
      showToast(`Could not reach the server. Is it running? ${err.message || ''}`.trim(), 'error');
    } finally {
      setButtonLoading(sendOtpBtn, false);
    }
  }

  function resetLoginOtpVerifier() {
    if (loginOtpVerifier) {
      loginOtpVerifier.destroy();
      loginOtpVerifier = null;
    }
    loginOtpMount.innerHTML = '';
  }

  async function verifyLoginOtpCode(code) {
    try {
      const response = await fetch(`${API_BASE}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: currentPhoneNumber, code }),
      });
      const data = await parseResponse(response);

      if (!response.ok) {
        console.error('verifyOtp response:', response.status, response.statusText, data);
        const toastMessage = data.error || data.message || `Server returned ${response.status}`;
        showToast(toastMessage, 'error');
        return { success: false, message: 'Invalid verification code. Please try again.' };
      }

      try {
        if (data.token) localStorage.setItem('travelBuddyToken', data.token);
        localStorage.setItem('travelBuddyUser', JSON.stringify(data.user));
        clearLoginState();
      } catch (storageErr) {
        console.error('Could not persist login session:', storageErr);
      }

      return {
        success: true,
        user: data.user // Pass user data back to the verifier's success handler if needed
      };
    } catch (err) {
      console.error('verifyOtp failed:', err);
      const message = `Could not reach the server. Is it running? ${err.message || ''}`.trim();
      showToast(message, 'error');
      return { success: false, message };
    }
  }

  function mountLoginOtpVerifier() {
    resetLoginOtpVerifier();
    loginOtpVerifier = new OtpVerifier(loginOtpMount, {
      length: 6,
      resendSeconds: 120,
      showResend: true,
      interceptBackButton: false,
      onComplete: verifyLoginOtpCode,
      onResend: async () => {
        try {
          const response = await fetch(`${API_BASE}/send-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: currentPhoneNumber }),
          });
          const data = await parseResponse(response);

          if (!response.ok) {
            const message = data.error || data.message || `Server returned ${response.status}`;
            showToast(message, 'error');
            return { success: false, message };
          }

          showToast('A new OTP was sent. Check your phone.', 'success');
          return { success: true };
        } catch (err) {
          const message = `Could not reach the server. Is it running? ${err.message || ''}`.trim();
          showToast(message, 'error');
          return { success: false, message };
        }
      },
      onVerified: (result) => {
        window.TravelBuddy.showLoginSuccess({
          user: result.user || JSON.parse(localStorage.getItem('travelBuddyUser')),
          method: 'OTP',
          onComplete: () => {
            goToDashboard(0);
          }
        });
      },
    });
  }

  setView('login');
  initializeGoogleLogin();
})();

