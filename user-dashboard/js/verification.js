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
    },
    camera: {
      modal: document.getElementById('cameraModal'),
      video: document.getElementById('cameraVideo'),
      canvas: document.getElementById('cameraCanvas'),
      capture: document.getElementById('capturePhoto'),
      close: document.getElementById('closeCamera'),
      hint: document.getElementById('cameraHint')
    }
  };

  let files = {
    selfie: null,
    id: null,
    optional: null
  };

  let previewUrls = {
    selfie: null,
    id: null,
    optional: null
  };

  let cameraStream = null;
  let currentCameraMode = null; // 'selfie' or 'optional'

  async function init() {
    bindUIEvents();
    bindCameraEvents();
    await loadKycStatus();
  }

  function bindUIEvents() {
    // Face Selfie Slot (Camera Only)
    elements.slots.selfie.addEventListener('click', () => {
      openCamera('selfie');
    });

    // Government ID Slot (File Only)
    elements.inputs.id.addEventListener('change', (e) => {
      handleFileUpload('id', e.target.files[0]);
    });

    // Selfie + ID Slot (Camera Only)
    elements.slots.optional.addEventListener('click', () => {
      openCamera('optional');
    });

    // Remove file buttons
    document.querySelectorAll('.remove-file').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = btn.dataset.target.toLowerCase();
        removeFile(target);
      });
    });

    elements.submitBtn?.addEventListener('click', submitKyc);
  }

  function handleFileUpload(key, file) {
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('File is too large. Maximum size is 2MB.', 'error');
      elements.inputs[key].value = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file.', 'error');
      elements.inputs[key].value = '';
      return;
    }

    setFile(key, file);
  }

  function setFile(key, file) {
    files[key] = file;

    // Revoke old URL if exists
    if (previewUrls[key]) {
      URL.revokeObjectURL(previewUrls[key]);
    }

    const url = URL.createObjectURL(file);
    previewUrls[key] = url;

    const preview = elements.previews[key];
    preview.querySelector('img').src = url;
    preview.style.display = 'block';
    elements.slots[key].classList.add('has-file');

    checkValidation();
  }

  function removeFile(key) {
    files[key] = null;
    if (elements.inputs[key]) elements.inputs[key].value = '';

    if (previewUrls[key]) {
      URL.revokeObjectURL(previewUrls[key]);
      previewUrls[key] = null;
    }

    const preview = elements.previews[key];
    preview.style.display = 'none';
    elements.slots[key].classList.remove('has-file');

    checkValidation();
  }

  function checkValidation() {
    const isValid = files.selfie && files.id;
    elements.submitBtn.disabled = !isValid;
  }

  // --- Camera Logic ---

  async function openCamera(mode) {
    currentCameraMode = mode;
    elements.camera.hint.textContent = mode === 'selfie'
      ? 'Position your face clearly in the frame'
      : 'Hold your ID next to your face clearly';

    elements.camera.modal.style.display = 'flex';

    try {
      const constraints = {
        video: {
          facingMode: mode === 'selfie' ? 'user' : 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      elements.camera.video.srcObject = cameraStream;
    } catch (err) {
      console.error('Camera error:', err);
      let msg = 'Could not access camera.';
      if (err.name === 'NotAllowedError') msg = 'Camera permission denied.';
      else if (err.name === 'NotFoundError') msg = 'No camera found on this device.';

      showToast(msg, 'error');
      closeCamera();
    }
  }

  function closeCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = null;
    }
    elements.camera.video.srcObject = null;
    elements.camera.modal.style.display = 'none';
    currentCameraMode = null;
  }

  function bindCameraEvents() {
    elements.camera.close.addEventListener('click', closeCamera);
    elements.camera.capture.addEventListener('click', capturePhoto);

    // Stop camera if user leaves page or closes modal
    window.addEventListener('beforeunload', closeCamera);
  }

  function capturePhoto() {
    if (!cameraStream) return;

    const video = elements.camera.video;
    const canvas = elements.camera.canvas;
    const context = canvas.getContext('2d');

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Mirror if selfie
    if (currentCameraMode === 'selfie') {
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        // Create a File-like object for Multer
        const filename = `${currentCameraMode}_${Date.now()}.jpg`;
        const capturedFile = new File([blob], filename, { type: 'image/jpeg' });

        setFile(currentCameraMode, capturedFile);
        showToast('Photo captured!', 'success');
        closeCamera();
      }
    }, 'image/jpeg', 0.85);
  }

  // --- API Interaction ---

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
      elements.statusDesc.textContent = 'You have full access to CarryParcel features.';
    }
  }

  init();
})();
