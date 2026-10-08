(function () {
  'use strict';

  let html5Qrcode = null;
  let isScanning = false;
  let scanResolve = null;
  let scanReject = null;

  const QRScanner = {
    init() {
      if (typeof Html5Qrcode === 'undefined') {
        console.warn('Html5Qrcode library not loaded');
        return false;
      }
      return true;
    },

    async startScan(onResult) {
      if (!this.init()) {
        throw new Error('QR scanner library not available');
      }

      if (isScanning) {
        throw new Error('Scanner already running');
      }

      isScanning = true;

      return new Promise((resolve, reject) => {
        scanResolve = resolve;
        scanReject = reject;

        const modal = this.createModal();
        document.body.appendChild(modal);

        const reader = new Html5Qrcode('qr-reader');
        html5Qrcode = reader;

        reader.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText, decodedResult) => {
            this.stopScan();
            onResult?.(decodedText);
            resolve(decodedText);
          },
          (error) => {
            // Ignore scan errors (no QR found in frame)
          }
        ).catch((err) => {
          this.stopScan();
          reject(err);
        });

        // Focus the modal for keyboard events
        const closeBtn = modal.querySelector('#qr-scanner-close');
        closeBtn?.focus();

        // Handle escape key
        const handleKeydown = (e) => {
          if (e.key === 'Escape') {
            this.stopScan();
            reject(new Error('Scan cancelled'));
            document.removeEventListener('keydown', handleKeydown);
          }
        };
        document.addEventListener('keydown', handleKeydown);
        modal._keydownHandler = handleKeydown;
      });
    },

    stopScan() {
      if (!isScanning) return;

      isScanning = false;

      if (html5Qrcode) {
        html5Qrcode.stop().catch(() => {});
        html5Qrcode = null;
      }

      const modal = document.getElementById('qr-scanner-modal');
      if (modal) {
        if (modal._keydownHandler) {
          document.removeEventListener('keydown', modal._keydownHandler);
        }
        modal.remove();
      }

      if (scanReject) {
        scanReject(new Error('Scan stopped'));
        scanResolve = null;
        scanReject = null;
      }
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

      const closeHandler = () => this.stopScan();
      closeBtn?.addEventListener('click', closeHandler);
      overlay?.addEventListener('click', closeHandler);

      let flashOn = false;
      flashBtn?.addEventListener('click', async () => {
        if (html5Qrcode && html5Qrcode.isFlashOn) {
          try {
            flashOn = !flashOn;
            await html5Qrcode.applyVideoConstraints({ advanced: [{ torch: flashOn }] });
            flashBtn.innerHTML = flashOn
              ? '<i class="fa-solid fa-bolt-lightning"></i> Flash On'
              : '<i class="fa-solid fa-bolt"></i> Toggle Flash';
          } catch (err) {
            console.warn('Flash toggle failed:', err);
          }
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