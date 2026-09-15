/**
 * TravelBuddy — Trust & Verification JS
 */
(function () {
  'use strict';

  const { API_ORIGIN, authHeaders, showToast, setButtonLoading } = window.TravelBuddy;

  const elements = {
    form: document.getElementById('verificationForm'),
    pending: document.getElementById('pendingState'),
    verified: document.getElementById('verifiedState'),
    statusTitle: document.getElementById('statusTitle'),
    statusDesc: document.getElementById('statusDesc'),
    statusBadge: document.getElementById('statusBadge'),
    submitBtn: document.getElementById('submitKycBtn'),
    inputs: {
      selfie: document.getElementById('inputSelfie'),
      id: document.getElementById('inputId'),
      optional: document.getElementById('inputOptional')
    },
    previews: {
      selfie: document.getElementById('previewSelfie'),
      id: document.getElementById('previewId'),
      optional: document.getElementById('previewOptional')
    },
    slots: {
      selfie: document.getElementById('slotSelfie'),
      id: document.getElementById('slotId'),
      optional: document.getElementById('slotOptional')
    }
  };

  let files = {
    selfie: null,
    id: null,
    optional: null
  };

  async function init() {
    bindUploads();
    await loadKycStatus();
  }

  function bindUploads() {
    // Prevent slot click bubbling to input and re-triggering if clicking internal buttons
    const stopBubbling = (e) => e.stopPropagation();

    ['selfie', 'id', 'optional'].forEach(key => {
      const input = elements.inputs[key];
      const preview = elements.previews[key];
      const slot = elements.slots[key];

      input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
          showToast('File is too large. Maximum size is 2MB.', 'error');
          input.value = '';
          return;
        }

        if (!file.type.startsWith('image/')) {
          showToast('Please select an image file.', 'error');
          input.value = '';
          return;
        }

        files[key] = file;
        const url = URL.createObjectURL(file);
        preview.querySelector('img').src = url;
        preview.style.display = 'block';
        slot.classList.add('has-file');
        checkValidation();
      });

      slot.querySelectorAll('.remove-file').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          files[key] = null;
          input.value = '';
          preview.style.display = 'none';
          slot.classList.remove('has-file');
          checkValidation();
        });
      });
    });

    elements.submitBtn?.addEventListener('click', submitKyc);
  }

  function checkValidation() {
    const isValid = files.selfie && files.id;
    elements.submitBtn.disabled = !isValid;
  }

  async function submitKyc() {
    setButtonLoading(elements.submitBtn, true, 'Submitting...');

    const formData = new FormData();
    formData.append('selfie', files.selfie);
    formData.append('governmentId', files.id);
    if (files.optional) {
      formData.append('selfieWithId', files.optional);
    }

    try {
      const res = await fetch(`${API_ORIGIN}/api/verification/submit`, {
        method: 'POST',
        headers: {
          'Authorization': authHeaders().Authorization
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');

      showToast('Verification submitted successfully.', 'success');
      loadKycStatus();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setButtonLoading(elements.submitBtn, false);
    }
  }

  async function loadKycStatus() {
    try {
      const res = await fetch(`${API_ORIGIN}/api/verification/status`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) return;

      renderStatus(data.kyc || {});
    } catch (err) {
      console.error('KYC load error:', err);
    }
  }

  function renderStatus(kyc) {
    const status = kyc.status || 'not_submitted';

    // Reset view
    elements.form.classList.add('hidden');
    elements.pending.classList.add('hidden');
    elements.verified.classList.add('hidden');

    elements.statusBadge.className = `status-badge status-${status}`;
    elements.statusBadge.textContent = status.replace('_', ' ');

    if (status === 'not_submitted' || status === 'requires_changes' || status === 'rejected') {
      elements.form.classList.remove('hidden');
      elements.statusTitle.textContent = status === 'requires_changes' ? 'Changes Required' : 'Verification Required';
      elements.statusDesc.textContent = status === 'requires_changes'
        ? (kyc.governmentId?.rejectionReason || 'Please review your documents and resubmit.')
        : 'Upload proof of identity to secure your account.';
    } else if (status === 'pending') {
      elements.pending.classList.remove('hidden');
      elements.statusTitle.textContent = 'Under Review';
      elements.statusDesc.textContent = 'Our team is checking your identity documents.';
    } else if (status === 'verified') {
      elements.verified.classList.remove('hidden');
      elements.statusTitle.textContent = 'Identity Verified';
      elements.statusDesc.textContent = 'You have full access to TravelBuddy features.';
    }
  }

  init();
})();
