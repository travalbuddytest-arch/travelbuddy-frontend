/**
 * OtpVerifier — reusable 6-digit OTP component with a "Verifying → Success"
 * morph animation, auto-focus, paste support, resend countdown and
 * back-button interception.
 *
 * Usage:
 *   const otp = new OtpVerifier(document.getElementById('otpMount'), {
 *     length: 6,
 *     resendSeconds: 120,
 *     autoStartResendTimer: true,
 *     onComplete: async (code) => {
 *       // return { success: true } or { success: false, message: '...' }
 *       const res = await fetch(...);
 *       return res.ok ? { success: true } : { success: false, message: 'Incorrect code.' };
 *     },
 *     onResend: async () => {
 *       await fetch(...);
 *       return { success: true };
 *     },
 *     onBack: () => { goToPanel('details'); },
 *     onVerified: () => { window.location.href = '../login/login.html'; },
 *   });
 *
 *   otp.reset();     // clear boxes, go back to idle
 *   otp.destroy();   // remove listeners (e.g. when leaving the step)
 */
(function (global) {
  'use strict';

  const SUCCESS_HOLD_MS = 1600; // how long the success state is shown before onVerified fires

  class OtpVerifier {
    constructor(container, options) {
      if (!container) throw new Error('OtpVerifier: container element is required.');
      this.container = container;
      this.opts = Object.assign(
        {
          length: 6,
          resendSeconds: 120,
          autoStartResendTimer: true,
          successText: 'Verified Successfully',
          onComplete: null, // async (code) => ({ success, message })
          onResend: null, // async () => ({ success, message })
          onBack: null, // () => void, called when the user presses back
          onVerified: null, // () => void, called after the success animation finishes
          interceptBackButton: true,
          showResend: true, // set false when another instance's resend link already covers this one
        },
        options || {}
      );

      this._resendTimer = null;
      this._popstateBound = this._handlePopState.bind(this);
      this._pushedState = false;
      this._verifying = false;

      this._render();
      this._bindEvents();

      if (this.opts.interceptBackButton) this._armBackInterception();
      if (this.opts.autoStartResendTimer) this.startResendTimer();

      this.focus();
    }

    /* ---------------------------------------------------------------- */
    /* Rendering                                                         */
    /* ---------------------------------------------------------------- */

    _render() {
      const len = this.opts.length;
      this.container.classList.add('otp-verifier');
      this.container.innerHTML = `
        <div class="otp-boxes-wrap">
          <div class="otp-boxes" role="group" aria-label="Enter verification code">
            ${Array.from({ length: len })
              .map(
                (_, i) => `<input
                  type="text"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  pattern="[0-9]*"
                  maxlength="1"
                  class="otp-box"
                  aria-label="Digit ${i + 1} of ${len}"
                />`
              )
              .join('')}
          </div>
          <div class="otp-success-wrap" aria-live="polite">
            <svg class="otp-success-circle" viewBox="0 0 120 120" aria-hidden="true">
              <circle class="otp-success-circle-bg" cx="60" cy="60" r="56"></circle>
              <path class="otp-success-check" d="M35 62 L52 79 L86 41"></path>
            </svg>
            <p class="otp-success-text">${this._escape(this.opts.successText)}</p>
          </div>
        </div>
        <p class="otp-error-msg" role="alert" aria-live="assertive"></p>
        <p class="otp-resend-row"${this.opts.showResend ? '' : ' style="display:none"'}>
          Didn't get a code?
          <button type="button" class="otp-resend-btn" disabled>Resend</button>
        </p>
      `;

      this.boxesEl = this.container.querySelector('.otp-boxes');
      this.boxes = Array.from(this.container.querySelectorAll('.otp-box'));
      this.successWrap = this.container.querySelector('.otp-success-wrap');
      this.successCircleBg = this.container.querySelector('.otp-success-circle-bg');
      this.successCheck = this.container.querySelector('.otp-success-check');
      this.successText = this.container.querySelector('.otp-success-text');
      this.errorMsg = this.container.querySelector('.otp-error-msg');
      this.resendBtn = this.container.querySelector('.otp-resend-btn');

      // Prep the checkmark for a stroke-draw animation using its real length.
      const len2 = this.successCheck.getTotalLength();
      this.successCheck.style.strokeDasharray = String(len2);
      this.successCheck.style.strokeDashoffset = String(len2);
      this._checkLength = len2;
    }

    _escape(str) {
      const d = document.createElement('div');
      d.textContent = str;
      return d.innerHTML;
    }

    /* ---------------------------------------------------------------- */
    /* Events                                                            */
    /* ---------------------------------------------------------------- */

    _bindEvents() {
      this.boxes.forEach((box, i) => {
        box.addEventListener('input', () => this._handleInput(box, i));
        box.addEventListener('keydown', (e) => this._handleKeydown(e, i));
        box.addEventListener('paste', (e) => this._handlePaste(e));
        box.addEventListener('focus', () => box.select());
      });

      this.resendBtn.addEventListener('click', () => this._handleResendClick());
    }

    _handleInput(box, i) {
      if (this._verifying) return;
      const raw = box.value.replace(/[^0-9]/g, '');

      // SMS/keychain autofill (iOS "one-time-code") typically drops the
      // whole code into whichever box has focus — handle it like a paste.
      if (raw.length > 1) {
        this._distributeDigits(raw, 0);
        return;
      }

      box.value = raw;
      box.classList.toggle('filled', box.value !== '');
      this._clearError();

      if (box.value && i < this.boxes.length - 1) {
        this.boxes[i + 1].focus();
      }
      if (box.value && i === this.boxes.length - 1) {
        this._maybeSubmit();
      }
    }

    /** Fill boxes starting at startIndex with the given digit string. */
    _distributeDigits(digits, startIndex) {
      const chars = digits.slice(0, this.boxes.length - startIndex).split('');
      this.boxes.forEach((b, idx) => {
        if (idx < startIndex) return;
        const val = chars[idx - startIndex];
        if (val !== undefined) {
          b.value = val;
          b.classList.add('filled');
        }
      });
      this._clearError();

      const lastFilledIndex = startIndex + chars.length - 1;
      const focusIndex = Math.min(lastFilledIndex, this.boxes.length - 1);
      this.boxes[focusIndex].focus();

      if (this.getCode().length === this.boxes.length) this._maybeSubmit();
    }

    _handleKeydown(e, i) {
      if (this._verifying) return;
      const box = this.boxes[i];
      if (e.key === 'Backspace') {
        if (!box.value && i > 0) {
          this.boxes[i - 1].focus();
          this.boxes[i - 1].value = '';
          this.boxes[i - 1].classList.remove('filled');
          e.preventDefault();
        }
      } else if (e.key === 'ArrowLeft' && i > 0) {
        this.boxes[i - 1].focus();
      } else if (e.key === 'ArrowRight' && i < this.boxes.length - 1) {
        this.boxes[i + 1].focus();
      }
    }

    _handlePaste(e) {
      if (this._verifying) return;
      e.preventDefault();
      const raw = (e.clipboardData || global.clipboardData).getData('text') || '';
      const digits = raw.replace(/[\s-]/g, '').replace(/[^0-9]/g, '').slice(0, this.boxes.length);
      if (!digits.length) return;
      this._distributeDigits(digits, 0);
    }

    /* ---------------------------------------------------------------- */
    /* Verification flow                                                 */
    /* ---------------------------------------------------------------- */

    getCode() {
      return this.boxes.map((b) => b.value).join('');
    }

    async _maybeSubmit() {
      const code = this.getCode();
      if (code.length !== this.boxes.length || typeof this.opts.onComplete !== 'function') return;
      this._startVerifying();

      let result;
      try {
        result = await this.opts.onComplete(code);
      } catch (err) {
        result = { success: false, message: 'Something went wrong. Please try again.' };
      }

      if (result && result.success) {
        this._playSuccess();
      } else {
        this._playError((result && result.message) || 'Incorrect code. Please try again.');
      }
    }

    _startVerifying() {
      this._verifying = true;
      this.boxes.forEach((b) => {
        b.disabled = true;
        b.classList.add('otp-verifying');
      });
      this.resendBtn.disabled = true;
    }

    _stopVerifyingVisual() {
      this.boxes.forEach((b) => b.classList.remove('otp-verifying'));
    }

    _playError(message) {
      this._stopVerifyingVisual();
      this.boxes.forEach((b) => b.classList.add('otp-error-box'));
      this.boxesEl.classList.add('otp-shake');
      this._showError(message);

      const onEnd = () => {
        this.boxesEl.classList.remove('otp-shake');
        this.boxesEl.removeEventListener('animationend', onEnd);
        this._resetToIdle();
      };
      this.boxesEl.addEventListener('animationend', onEnd);
    }

    _playSuccess() {
      this._stopVerifyingVisual();

      // Phase 1 — converge every box toward the container's center and
      // scale/fade them out.
      const wrapRect = this.boxesEl.getBoundingClientRect();
      const centerX = wrapRect.left + wrapRect.width / 2;

      this.boxes.forEach((box) => {
        const r = box.getBoundingClientRect();
        const boxCenterX = r.left + r.width / 2;
        const dx = centerX - boxCenterX;
        box.style.setProperty('--otp-dx', `${dx}px`);
        box.classList.add('otp-converge');
      });

      const CONVERGE_MS = 450;
      setTimeout(() => {
        // Phase 2 — swap the (now invisible) boxes for the green circle.
        this.boxesEl.style.visibility = 'hidden';
        this.successWrap.classList.add('otp-show');
        this.successWrap.setAttribute('aria-hidden', 'false');

        // Force reflow so the transition below reliably runs.
        // eslint-disable-next-line no-unused-expressions
        this.successCircleBg.getBoundingClientRect();
        this.successCircleBg.classList.add('otp-grow');

        // Phase 3 — draw the checkmark once the circle has mostly grown in.
        setTimeout(() => {
          this.successCheck.style.transition = 'stroke-dashoffset 0.4s ease';
          this.successCheck.style.strokeDashoffset = '0';

          // Phase 4 — fade in the confirmation text.
          setTimeout(() => {
            this.successText.classList.add('otp-show');

            setTimeout(() => {
              if (typeof this.opts.onVerified === 'function') this.opts.onVerified();
            }, SUCCESS_HOLD_MS);
          }, 250);
        }, 220);
      }, CONVERGE_MS);
    }

    /* ---------------------------------------------------------------- */
    /* Error / idle helpers                                              */
    /* ---------------------------------------------------------------- */

    _showError(message) {
      this.errorMsg.textContent = message;
      this.errorMsg.classList.add('otp-show');
    }

    _clearError() {
      this.errorMsg.classList.remove('otp-show');
      this.errorMsg.textContent = '';
      this.boxes.forEach((b) => b.classList.remove('otp-error-box'));
    }

    _resetToIdle() {
      this._verifying = false;
      this.boxes.forEach((b) => {
        b.disabled = false;
        b.value = '';
        b.classList.remove('filled', 'otp-error-box', 'otp-converge', 'otp-verifying');
        b.style.removeProperty('--otp-dx');
      });
      this.resendBtn.disabled = this._resendTimer !== null;
      this.focus();
    }

    /** Public: clear the boxes and return to the idle state (e.g. after resend). */
    reset() {
      this.successWrap.classList.remove('otp-show');
      this.successWrap.setAttribute('aria-hidden', 'true');
      this.successCircleBg.classList.remove('otp-grow');
      this.successCheck.style.transition = 'none';
      this.successCheck.style.strokeDashoffset = String(this._checkLength);
      this.successText.classList.remove('otp-show');
      this.boxesEl.style.visibility = '';
      this._clearError();
      this._resetToIdle();
    }

    focus() {
      const first = this.boxes[0];
      if (first) first.focus({ preventScroll: true });
    }

    /* ---------------------------------------------------------------- */
    /* Resend timer                                                      */
    /* ---------------------------------------------------------------- */

    startResendTimer(seconds) {
      const total = seconds != null ? seconds : this.opts.resendSeconds;
      let remaining = total;
      this.resendBtn.disabled = true;
      this._renderResendLabel(remaining);

      clearInterval(this._resendTimer);
      this._resendTimer = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearInterval(this._resendTimer);
          this._resendTimer = null;
          this.resendBtn.disabled = this._verifying;
          this.resendBtn.textContent = 'Resend Code';
        } else {
          this._renderResendLabel(remaining);
        }
      }, 1000);
    }

    _renderResendLabel(remaining) {
      const m = Math.floor(remaining / 60);
      const s = String(remaining % 60).padStart(2, '0');
      this.resendBtn.textContent = `Resend in ${m}:${s}`;
    }

    async _handleResendClick() {
      if (this.resendBtn.disabled || typeof this.opts.onResend !== 'function') return;
      this.resendBtn.disabled = true;

      let result;
      try {
        result = await this.opts.onResend();
      } catch (err) {
        result = { success: false, message: 'Could not resend code.' };
      }

      if (result && result.success === false) {
        this._showError(result.message || 'Could not resend code.');
        this.resendBtn.disabled = false;
        return;
      }

      this.reset();
      this.startResendTimer();
    }

    /* ---------------------------------------------------------------- */
    /* Back-button interception                                          */
    /* ---------------------------------------------------------------- */

    _armBackInterception() {
      // Push a synthetic history entry so the *next* back gesture fires
      // popstate instead of leaving the page/step.
      history.pushState({ otpStep: true }, '', location.href);
      this._pushedState = true;
      window.addEventListener('popstate', this._popstateBound);
    }

    _handlePopState() {
      if (typeof this.opts.onBack === 'function') this.opts.onBack();
    }

    /** Public: remove listeners/timers. Call when leaving the OTP step for good. */
    destroy() {
      clearInterval(this._resendTimer);
      if (this.opts.interceptBackButton) {
        window.removeEventListener('popstate', this._popstateBound);
      }
    }
  }

  global.OtpVerifier = OtpVerifier;
})(typeof window !== 'undefined' ? window : this);
