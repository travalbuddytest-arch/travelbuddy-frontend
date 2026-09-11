(function () {
  'use strict';

  const API_BASE = `${APP_CONFIG.API_BASE_URL}/api/auth`;

  const toast = document.getElementById('toast');
  const requestForm = document.getElementById('requestForm');
  const emailInput = document.getElementById('email');
  const emailError = document.getElementById('emailError');
  const sendBtn = document.getElementById('sendBtn');

  let toastTimer;

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function showToast(message, type) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = 'toast show' + (type ? ' ' + type : '');
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
  }

  function setButtonLoading(isLoading) {
    sendBtn.classList.toggle('loading', isLoading);
    sendBtn.disabled = isLoading;
    emailInput.disabled = isLoading;
  }

  function validateEmail() {
    const value = emailInput.value.trim();
    if (!value) {
      setFieldError('Please enter your email address.');
      return false;
    }
    if (!EMAIL_RE.test(value)) {
      setFieldError('Please enter a valid email address.');
      return false;
    }
    clearFieldError();
    return true;
  }

  function setFieldError(message) {
    emailInput.closest('.field').classList.add('has-error');
    emailError.textContent = message;
    emailError.style.display = 'block';
  }

  function clearFieldError() {
    emailInput.closest('.field').classList.remove('has-error');
    emailError.textContent = '';
    emailError.style.display = 'none';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validateEmail()) return;

    setButtonLoading(true);

    const email = emailInput.value.trim().toLowerCase();

    try {
      const response = await fetch(`${API_BASE}/forgot-password/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      // We don't really care about the response body status for success vs account-not-found
      // because we show a generic message either way for security.
      // But we do care about server errors or validation errors.

      const data = await response.json().catch(() => ({}));

      if (!response.ok && response.status !== 404) {
        showToast(data.error || 'Something went wrong. Please try again.', 'error');
        setButtonLoading(false);
        return;
      }

      // Redirect to check-email page, passing email as param for UI
      window.location.href = `check-email.html?email=${encodeURIComponent(email)}`;

    } catch (err) {
      showToast('Could not reach the server. Please check your connection.', 'error');
      setButtonLoading(false);
    }
  }

  requestForm.addEventListener('submit', handleSubmit);
  emailInput.addEventListener('input', clearFieldError);

})();
