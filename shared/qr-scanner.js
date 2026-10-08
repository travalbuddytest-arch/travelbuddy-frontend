(function () {
  'use strict';

  let activeScanner = null;
  let activeModal = null;
  let isScanning = false;
  let isScanDone = false;
  let modalKeydownHandler = null;
  let videoObserver = null;
  let scanResolve = null;
  let scanReject = null;

  function getVideoElement() {
    return activeModal?.querySelector('#qr-reader video') || document.querySelector('#qr-reader video');
  }

  function prepareVideo(video) {
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('autoplay', '');
    video.setAttribute('muted', '');
    video.playsInline = true;
    video.muted = true;
    video.autoplay = true;
    video.style.display = 'block';
    video.style.opacity = '1';
    video.style.visibility = 'visible';
  }

  function waitForVideoMetadata(video, timeoutMs = 8000) {
    if (video.videoWidth > 0 && video.videoHeight > 0) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        window.clearTimeout(timeout);
        video.removeEventListener('loadedmetadata', onMetadata);
        video.removeEventListener('resize', onMetadata);
        video.removeEventListener('error', onError);
      };
      const onMetadata = () => {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          cleanup();
          resolve();
        }
      };
      const onError = () => {
        cleanup();
        reject(new Error('The browser could not display the camera preview.'));
      };
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error('Camera opened, but the video preview did not produce frames.'));
      }, timeoutMs);

      video.addEventListener('loadedmetadata', onMetadata);
      video.addEventListener('resize', onMetadata);
      video.addEventListener('error', onError);
      onMetadata();
    });
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
      return 'This device could not start a camera in the requested mode.';
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
      return true;
    },

    async startReaderWithFallback(onResult) {
      const readerElement = activeModal?.querySelector('#qr-reader');
      if (!readerElement) {
        throw new Error('QR scanner preview element was not created.');
      }

      let cameras = [];
      try {
        cameras = await Promise.race([
          window.Html5Qrcode.getCameras(),
          new Promise((resolve) => window.setTimeout(() => resolve([]), 4000))
        ]);
      } catch (err) {
        console.warn('[QRScanner] Camera enumeration failed:', err);
      }

      const videoInputs = Array.isArray(cameras)
        ? cameras.filter((camera) => camera?.id)
        : [];
      console.info('[QRScanner] Video input devices found:', videoInputs.length);
      const rearCamera = videoInputs.find((camera) => /back|rear|environment/i.test(camera.label || ''));
      const cameraOptions = rearCamera
        ? [rearCamera.id, ...videoInputs.filter((camera) => camera.id !== rearCamera.id).map((camera) => camera.id)]
        : [
            { facingMode: { ideal: 'environment' } },
            ...videoInputs.map((camera) => camera.id)
          ];

      if (cameraOptions.length === 0) {
        cameraOptions.push({ facingMode: { ideal: 'environment' } });
      }
      cameraOptions.push({ facingMode: { ideal: 'user' } });

      const config = { fps: 10, qrbox: { width: 250, height: 250 } };
      let lastError = null;
      videoObserver = new MutationObserver(() => {
        const video = getVideoElement();
        if (video) prepareVideo(video);
      });
      videoObserver.observe(readerElement, { childList: true, subtree: true });

      for (const cameraOption of cameraOptions) {
        const reader = new window.Html5Qrcode('qr-reader');
        activeScanner = reader;

        try {
          await reader.start(
            cameraOption,
            config,
            (decodedText) => {
              if (isScanDone) return;
              isScanDone = true;
              this.stopScan().catch(() => {});
              if (typeof onResult === 'function') onResult(decodedText);
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

          const video = getVideoElement();
          if (!video) {
            throw new Error('Camera started, but the video preview was not created.');
          }

          const hint = activeModal?.querySelector('.qr-scanner-hint');
          if (hint) hint.textContent = 'Camera connected; waiting for video preview…';
          prepareVideo(video);
          await video.play();
          await waitForVideoMetadata(video);
          videoObserver.disconnect();
          videoObserver = null;
          const readyHint = activeModal?.querySelector('.qr-scanner-hint');
          if (readyHint) readyHint.textContent = 'Position the QR code within the frame';
          return;
        } catch (err) {
          lastError = err;
          console.warn('[QRScanner] Camera startup failed:', {
            camera: typeof cameraOption === 'string' ? 'device ID' : cameraOption,
            ...{
              name: err?.name || 'UnknownError',
              message: err?.message || String(err),
              constraint: err?.constraint || null,
              code: err?.code || null
            }
          });

          try {
            await reader.stop();
          } catch (stopError) {
            // A failed start may leave the scanner stopped already.
          }
          try {
            await reader.clear();
          } catch (clearError) {
            console.warn('[QRScanner] Failed to clear a camera after startup failure:', clearError);
          }
          readerElement.replaceChildren();

          if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError' ||
              err?.name === 'NotReadableError' || err?.name === 'SecurityError') {
            break;
          }
        }
      }

      throw lastError || new Error('No usable camera was found on this device.');
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
        const hint = modal.querySelector('.qr-scanner-hint');
        if (hint) hint.textContent = 'Starting camera…';

        const closeBtn = modal.querySelector('#qr-scanner-close');
        closeBtn?.focus();

        modalKeydownHandler = (e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            this.stopScan({ cancelled: true, reason: 'Scan cancelled' }).catch(() => {});
          }
        };
        document.addEventListener('keydown', modalKeydownHandler);

        this.startReaderWithFallback(onResult).catch((err) => {
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
      if (videoObserver) {
        videoObserver.disconnect();
        videoObserver = null;
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
            <p class="qr-scanner-hint">Starting camera…</p>
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