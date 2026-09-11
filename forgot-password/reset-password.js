(function () {
  'use strict';

  const API_BASE = `${APP_CONFIG.API_BASE_URL}/api/auth`;

  const toast = document.getElementById('toast');
  const loadingState = document.getElementById('loadingState');
  const errorState = document.getElementById('errorState');
  const formState = document.getElementById('formState');
  const successState = document.getElementById('successState');
  const resetForm = document.getElementById('resetForm');

  const newPasswordInput = document.getElementById('newPassword');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const newPasswordError = document.getElementById('newPasswordError');
  const confirmPasswordError = document.getElementById('confirmPasswordError');
  const resetBtn = document.getElementById('resetBtn');

  let toastTimer;
  let resetToken = '';

  const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

  function showToast(message, type) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = 'toast show' + (type ? ' ' + type : '');
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
  }

  function setButtonLoading(isLoading) {
    resetBtn.classList.toggle('loading', isLoading);
    resetBtn.disabled = isLoading;
    newPasswordInput.disabled = isLoading;
    confirmPasswordInput.disabled = isLoading;
  }

  function showState(state) {
    [loadingState, errorState, formState, successState].forEach(el => el.classList.add('hidden'));
    if (state === 'loading') loadingState.classList.remove('hidden');
    if (state === 'error') errorState.classList.remove('hidden');
    if (state === 'form') formState.classList.remove('hidden');
    if (state === 'success') successState.classList.remove('hidden');
  }

  async function validateToken() {
    const urlParams = new URLSearchParams(window.location.search);
    resetToken = urlParams.get('token');

    if (!resetToken) {
      showState('error');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/forgot-password/validate?token=${encodeURIComponent(resetToken)}`);
      if (response.ok) {
        showState('form');
        setTimeout(() => newPasswordInput.focus(), 200);
      } else {
        showState('error');
      }
    } catch (err) {
      showToast('Connection error. Please refresh.', 'error');
      showState('error');
    }
  }

  function validatePasswords() {
    let valid = true;
    const pwd = newPasswordInput.value;
    const conf = confirmPasswordInput.value;

    if (!pwd) {
      setFieldError(newPasswordInput, newPasswordError, 'Password is required.');
      valid = false;
    } else if (pwd.length < 8) {
      setFieldError(newPasswordInput, newPasswordError, 'Password must be at least 8 characters.');
      valid = false;
    } else if (!PASSWORD_RE.test(pwd)) {
      setFieldError(newPasswordInput, newPasswordError, 'Use at least one letter and one number.');
      valid = false;
    } else {
      clearFieldError(newPasswordInput, newPasswordError);
    }

    if (conf !== pwd) {
      setFieldError(confirmPasswordInput, confirmPasswordError, 'Passwords do not match.');
      valid = false;
    } else {
      clearFieldError(confirmPasswordInput, confirmPasswordError);
    }

    return valid;
  }

  function setFieldError(input, errorEl, message) {
    input.closest('.field').classList.add('has-error');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }

  function clearFieldError(input, errorEl) {
    input.closest('.field').classList.remove('has-error');
    errorEl.textContent = '';
    errorEl.style.display = 'none';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validatePasswords()) return;

    setButtonLoading(true);

    try {
      const response = await fetch(`${API_BASE}/forgot-password/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: resetToken,
          newPassword: newPasswordInput.value
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        showState('success');
      } else {
        showToast(data.error || 'Reset failed. Please try again.', 'error');
        setButtonLoading(false);
        if (response.status === 400) {
            showState('error'); // Token likely expired while on page
        }
      }
    } catch (err) {
      showToast('Server error. Please try again.', 'error');
      setButtonLoading(false);
    }
  }

  // Toggle password visibility
  document.querySelectorAll('.toggle-password').forEach((button) => {
    button.addEventListener('click', () => {
      const targetId = button.getAttribute('data-target');
      const input = document.getElementById(targetId);
      const isShowing = input.type === 'text';
      input.type = isShowing ? 'password' : 'text';
      button.textContent = isShowing ? 'Show' : 'Hide';
      button.setAttribute('aria-pressed', !isShowing);
    });
  });

  // Anti-Paste Protection
  [newPasswordInput, confirmPasswordInput].forEach(input => {
      input.addEventListener('paste', (e) => {
          e.preventDefault();
          showToast('For security, please type your password manually.', 'error');
      });
  });

  resetForm.addEventListener('submit', handleSubmit);
  newPasswordInput.addEventListener('input', () => clearFieldError(newPasswordInput, newPasswordError));
  confirmPasswordInput.addEventListener('input', () => clearFieldError(confirmPasswordInput, confirmPasswordError));

  // Initialize
  validateToken();

})();
