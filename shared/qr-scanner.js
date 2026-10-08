(function () {
  'use strict';

  let activeScanner = null;
  let activeModal = null;
  let isScanning = false;
  let isScanDone = false;
  let modalKeydownHandler = null;
  let scanResolve = null;
  let scanReject = null;

  function getVideoElement() {
    return activeModal?.querySelector('#qr-reader video') || document.querySelector('#qr-reader video');
  }

  function describeCameraError(err) {
    const error = err && typeof err === 'object' ? err : { message: String(err) };
    const name = error.name || 'UnknownError';
    const message = error.message || 'Camera initialization failed';
    const constraint = error.constraint || null;
    const code = error.code || null;

    console.error('[QRScanner] Camera failure details:', { name, message, constraint, code });

    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return 'Camera permission was denied. Please allow camera access and try again.';
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return 'No camera was found on this device.';
    }
    if (name === 'NotReadableError') {
      return 'The camera is already in use by another app or browser tab.';
    }
    if (name === 'OverconstrainedError') {
      return 'This camera does not support the requested mode. Trying an available camera.';
    }
    if (name === 'SecurityError') {
      return 'Camera access requires a secure connection (HTTPS or localhost).';
    }
    if (name === 'AbortError') {
      return 'Camera startup was interrupted. Please try again.';
    }
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      return 'Camera access requires a secure connection (HTTPS or localhost).';
    }
    return message || 'Camera initialization failed';
  }

  function getCameraCandidates() {
    return [
      { facingMode: { ideal: 'environment' } },
      { facingMode: 'environment' },
      { facingMode: { ideal: 'user' } },
      { facingMode: 'user' },
      { video: true }
    ];
  }

  const QRScanner = {
    init() {
      if (typeof window.Html5Qrcode === 'undefined') {
        console.warn('Html5Qrcode library not loaded');
        return false;
      }
      if (!window.isSecureContext) {
        console.warn('Camera access requires a secure context. Current protocol:', window.location.protocol);
        return false;
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('MediaDevices.getUserMedia is not available in this browser');
        return false;
      }
      if (navigator.mediaDevices.enumerateDevices) {
        navigator.mediaDevices.enumerateDevices().then((devices) => {
          const videoInputs = devices.filter((device) => device.kind === 'videoinput');
          console.info('[QRScanner] Video input devices found:', videoInputs.length);
        }).catch((err) => {
          console.warn('[QRScanner] enumerateDevices check failed:', err);
        });
      }
      return true;
    },

    async startReaderWithFallback(reader, onResult) {
      let lastError = null;

      for (const cameraConfig of getCameraCandidates()) {
        try {
          await reader.start(
            cameraConfig,
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => {
              isScanDone = true;
              this.stopScan().catch(() => {});
              if (typeof onResult === 'function') {
                onResult(decodedText);
              }
              if (scanResolve) {
                const result = decodedText?.trim();
                scanResolve(result || decodedText);
                scanResolve = null;
                scanReject = null;
              }
            },
            () => {
              // Ignore decode noise while scanning.
            }
          );
          return;
        } catch (err) {
          lastError = err;
          console.warn('[QRScanner] Camera config failed:', cameraConfig, describeCameraError(err));
        }
      }

      throw lastError || new Error('Camera initialization failed');
    },

    async startScan(onResult) {
      if (!this.init()) {
        throw new Error(window.isSecureContext ? 'QR scanner library not available' : 'Camera access requires a secure connection (HTTPS or localhost).');
      }

      if (isScanning) {
        throw new Error('Scanner already running');
      }

      isScanning = true;
      isScanDone = false;

      return new Promise((resolve, reject) => {
        scanResolve = resolve;
        scanReject = reject;

        const modal = this.createModal();
        activeModal = modal;
        document.body.appendChild(modal);

        const closeBtn = modal.querySelector('#qr-scanner-close');
        closeBtn?.focus();

        modalKeydownHandler = (e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            this.stopScan({ cancelled: true, reason: 'Scan cancelled' }).catch(() => {});
          }
        };
        document.addEventListener('keydown', modalKeydownHandler);

        const reader = new window.Html5Qrcode('qr-reader');
        activeScanner = reader;

        this.startReaderWithFallback(reader, onResult).then(() => {
          const videoEl = getVideoElement();
          if (videoEl) {
            videoEl.setAttribute('playsinline', 'true');
            videoEl.setAttribute('autoplay', 'true');
            videoEl.muted = true;
            videoEl.playsInline = true;
            videoEl.style.display = 'block';
            videoEl.style.opacity = '1';
            videoEl.style.visibility = 'visible';
            videoEl.play().catch((playErr) => {
              console.warn('QR video playback warning:', playErr);
            });
          }
        }).catch((err) => {
          const friendlyMessage = describeCameraError(err);
          this.stopScan({ cancelled: false, reason: friendlyMessage }).catch(() => {});
          if (scanReject) {
            const wrapped = err instanceof Error ? err : new Error(friendlyMessage);
            wrapped.message = friendlyMessage;
            scanReject(wrapped);
            scanResolve = null;
            scanReject = null;
          }
        });
      });
    },

    async stopScan({ cancelled = false, reason = 'Scan stopped' } = {}) {
      const scanner = activeScanner;
      const modal = activeModal;

      if (modalKeydownHandler) {
        document.removeEventListener('keydown', modalKeydownHandler);
        modalKeydownHandler = null;
      }

      if (scanner && typeof scanner.stop === 'function') {
        try {
          await scanner.stop();
        } catch (err) {
          console.warn('QR scanner stop warning:', err);
        }
      }

      if (scanner && typeof scanner.clear === 'function') {
        try {
          await scanner.clear();
        } catch (err) {
          console.warn('QR scanner clear warning:', err);
        }
      }

      if (modal) {
        const video = modal.querySelector('#qr-reader video');
        if (video) {
          try {
            video.pause();
          } catch (err) {
            console.warn('QR video pause warning:', err);
          }

          if (video.srcObject && typeof video.srcObject.getTracks === 'function') {
            video.srcObject.getTracks().forEach((track) => {
              try {
                track.stop();
              } catch (err) {
                console.warn('QR media track stop warning:', err);
              }
            });
          }
          video.srcObject = null;
        }
        modal.remove();
      }

      activeScanner = null;
      activeModal = null;
      isScanning = false;

      if (!isScanDone && scanReject) {
        scanReject(new Error(cancelled ? 'Scan cancelled' : reason));
      }

      scanResolve = null;
      scanReject = null;
      isScanDone = false;
    },

    createModal() {
      const modal = document.createElement('div');
      modal.id = 'qr-scanner-modal';
      modal.className = 'qr-scanner-modal';
      modal.innerHTML = `
        <div class="qr-scanner-overlay" id="qrScannerOverlay"></div>
        <div class="qr-scanner-container" role="dialog" aria-modal="true" aria-label="QR Code Scanner">
          <div class="qr-scanner-header">
            <h3><i class="fa-solid fa-qrcode"></i> Scan QR Code</h3>
            <button type="button" class="qr-scanner-close" id="qr-scanner-close" aria-label="Close scanner">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div class="qr-scanner-viewport">
            <div id="qr-reader" class="qr-reader"></div>
            <div class="qr-scanner-frame">
              <div class="qr-corner tl"></div>
              <div class="qr-corner tr"></div>
              <div class="qr-corner bl"></div>
              <div class="qr-corner br"></div>
            </div>
          </div>
          <div class="qr-scanner-footer">
            <p class="qr-scanner-hint">Position the QR code within the frame</p>
            <button type="button" class="btn-ghost qr-scanner-toggle-flash" id="qrScannerToggleFlash">
              <i class="fa-solid fa-bolt"></i> Toggle Flash
            </button>
          </div>
        </div>
      `;

      const closeBtn = modal.querySelector('#qr-scanner-close');
      const overlay = modal.querySelector('#qrScannerOverlay');
      const flashBtn = modal.querySelector('#qrScannerToggleFlash');

      const closeHandler = () => {
        this.stopScan({ cancelled: true, reason: 'Scan cancelled' }).catch(() => {});
      };
      closeBtn?.addEventListener('click', closeHandler);
      overlay?.addEventListener('click', closeHandler);

      let flashOn = false;
      flashBtn?.addEventListener('click', async () => {
        if (!activeScanner || typeof activeScanner.applyVideoConstraints !== 'function') {
          window.showToast?.('Flash is not available on this device.', 'warning');
          return;
        }

        try {
          flashOn = !flashOn;
          await activeScanner.applyVideoConstraints({ advanced: [{ torch: flashOn }] });
          flashBtn.innerHTML = flashOn
            ? '<i class="fa-solid fa-bolt-lightning"></i> Flash On'
            : '<i class="fa-solid fa-bolt"></i> Toggle Flash';
        } catch (err) {
          console.warn('Flash toggle failed:', err);
          window.showToast?.('Flash is not available on this device.', 'warning');
        }
      });

      return modal;
    }
  };

  // Expose globally
  window.CarryParcel = window.CarryParcel || {};
  window.CarryParcel.QRScanner = QRScanner;
  window.TravelBuddy = window.TravelBuddy || {};
  window.TravelBuddy.QRScanner = QRScanner;
})();