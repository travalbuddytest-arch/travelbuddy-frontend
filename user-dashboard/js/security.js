(function () {
  'use strict';

  const { API_ORIGIN, authHeaders, setButtonLoading } = window.TravelBuddy;

  // Password Elements
  const changePasswordForm = document.getElementById('changePasswordForm');
  const currentPasswordInput = document.getElementById('currentPasswordInput');
  const newPasswordInput = document.getElementById('newPasswordInput');
  const confirmPasswordInput = document.getElementById('confirmPasswordInput');
  const savePasswordBtn = document.getElementById('savePasswordBtn');

  // 2FA Elements
  const toggle2faCheck = document.getElementById('toggle2faCheck');

  // Recovery Email Elements
  const recoveryEmailForm = document.getElementById('recoveryEmailForm');
  const recoveryEmailInput = document.getElementById('recoveryEmailInput');
  const saveRecoveryBtn = document.getElementById('saveRecoveryBtn');

  async function loadSecuritySettings() {
    try {
      const res = await fetch(`${API_ORIGIN}/api/auth/me`, { headers: authHeaders() });
      const data = await res.json();

      if (!res.ok || !data.user) return;
      const user = data.user;

      if (toggle2faCheck) {
        toggle2faCheck.checked = Boolean(user.twoStepEnabled);
      }

      if (recoveryEmailInput) {
        recoveryEmailInput.value = user.recoveryEmail || '';
      }
    } catch (err) {
      console.error('Failed to load security settings:', err);
    }
  }

  // Change Password
  if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const currentPassword = currentPasswordInput.value;
      const newPassword = newPasswordInput.value;
      const confirmPassword = confirmPasswordInput.value;

      if (!currentPassword || !newPassword) {
        window.showToast('Please enter both current and new passwords.', 'warning');
        return;
      }

      if (newPassword.length < 8) {
        window.showToast('New password must be at least 8 characters.', 'warning');
        newPasswordInput.focus();
        return;
      }

      if (newPassword !== confirmPassword) {
        window.showToast('New passwords do not match.', 'error');
        confirmPasswordInput.focus();
        return;
      }

      setButtonLoading(savePasswordBtn, true, 'Updating Password...');

      try {
        const res = await fetch(`${API_ORIGIN}/api/auth/me/password`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({ currentPassword, newPassword })
        });
        const data = await res.json();

        if (!res.ok) {
          window.showToast(data.error || 'Failed to update password.', 'error');
          return;
        }

        window.showToast(data.message || 'Password updated successfully!', 'success');
        changePasswordForm.reset();
      } catch (err) {
        console.error(err);
        window.showToast('Network error updating password.', 'error');
      } finally {
        setButtonLoading(savePasswordBtn, false);
      }
    });
  }

  // 2FA Toggle
  if (toggle2faCheck) {
    toggle2faCheck.addEventListener('change', async () => {
      const enabled = toggle2faCheck.checked;

      try {
        const res = await fetch(`${API_ORIGIN}/api/settings/2fa`, {
          method: 'PATCH',
          headers: authHeaders(),
          body: JSON.stringify({ enabled })
        });
        const data = await res.json();

        if (!res.ok) {
          window.showToast(data.error || 'Failed to update 2FA.', 'error');
          toggle2faCheck.checked = !enabled;
          return;
        }

        window.showToast(data.message || `Two-step authentication ${enabled ? 'enabled' : 'disabled'}.`, 'success');
      } catch (err) {
        console.error(err);
        window.showToast('Could not reach server to update 2FA.', 'error');
        toggle2faCheck.checked = !enabled;
      }
    });
  }

  // Recovery Email
  if (recoveryEmailForm) {
    recoveryEmailForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = recoveryEmailInput.value.trim();
      if (!email || !email.includes('@')) {
        window.showToast('Please enter a valid email address.', 'warning');
        recoveryEmailInput.focus();
        return;
      }

      setButtonLoading(saveRecoveryBtn, true, 'Saving...');

      try {
        const res = await fetch(`${API_ORIGIN}/api/settings/recovery-email`, {
          method: 'PATCH',
          headers: authHeaders(),
          body: JSON.stringify({ email })
        });
        const data = await res.json();

        if (!res.ok) {
          window.showToast(data.error || 'Failed to save recovery email.', 'error');
          return;
        }

        window.showToast(data.message || 'Recovery email saved successfully!', 'success');
      } catch (err) {
        console.error(err);
        window.showToast('Network error saving recovery email.', 'error');
      } finally {
        setButtonLoading(saveRecoveryBtn, false);
      }
    });
  }

  loadSecuritySettings();
})();
