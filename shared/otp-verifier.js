/**
 * OtpVerifier - reusable 6-digit OTP component with explicit UI states,
 * verifying wobble, success morph, SVG check draw, resend countdown, and
 * optional back-button interception.
 */
(function (global) {
  'use strict';

  const SUCCESS_HOLD_MS = 900;
  const STATES = {
    IDLE: 'IDLE',
    FILLING: 'FILLING',
    VERIFYING: 'VERIFYING',
    SUCCESS_MORPH: 'SUCCESS_MORPH',
    SUCCESS: 'SUCCESS',
    ERROR: 'ERROR',
    EXPIRED: 'EXPIRED',
  };

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
          verifyingText: 'Verifying your code...',
          errorText: 'Invalid verification code. Please try again.',
          onComplete: null,
          onResend: null,
          onBack: null,
          onVerified: null,
          interceptBackButton: true,
          showResend: true,
        },
        options || {}
      );

      this._state = STATES.IDLE;
      this._verifying = false;
      this._completed = false;
      this._resendTimer = null;
      this._timers = [];
      this._popstateBound = this._handlePopState.bind(this);

      this._render();
      this._bindEvents();
      this._setState(STATES.IDLE);

      if (this.opts.interceptBackButton) this._armBackInterception();
      if (this.opts.autoStartResendTimer) this.startResendTimer();
      this.focus();
    }

    _render() {
      const len = this.opts.length;
      this.container.classList.add('otp-verifier');
      this.container.innerHTML = `
        <div class="otp-boxes-wrap">
          <div class="otp-boxes" role="group" aria-label="Enter verification code">
            ${Array.from({ length: len }).map((_, i) => `<input
              type="text"
              inputmode="numeric"
              autocomplete="one-time-code"
              pattern="[0-9]*"
              maxlength="1"
              class="otp-box"
              aria-label="Digit ${i + 1} of ${len}"
            />`).join('')}
          </div>
          <p class="otp-status-msg" aria-live="polite"></p>
          <div class="otp-success-wrap" aria-live="polite" aria-hidden="true">
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
          <button type="button" class="otp-resend-btn" disabled>Resend Code</button>
        </p>
      `;

      this.boxesEl = this.container.querySelector('.otp-boxes');
      this.boxes = Array.from(this.container.querySelectorAll('.otp-box'));
      this.statusMsg = this.container.querySelector('.otp-status-msg');
      this.successWrap = this.container.querySelector('.otp-success-wrap');
      this.successCircleBg = this.container.querySelector('.otp-success-circle-bg');
      this.successCheck = this.container.querySelector('.otp-success-check');
      this.successText = this.container.querySelector('.otp-success-text');
      this.errorMsg = this.container.querySelector('.otp-error-msg');
      this.resendBtn = this.container.querySelector('.otp-resend-btn');

      const checkLength = this.successCheck.getTotalLength();
      this.successCheck.style.strokeDasharray = String(checkLength);
      this.successCheck.style.strokeDashoffset = String(checkLength);
      this._checkLength = checkLength;
    }

    _escape(str) {
      const d = document.createElement('div');
      d.textContent = str;
      return d.innerHTML;
    }

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
      this._setState(STATES.FILLING);
      const raw = box.value.replace(/[^0-9]/g, '');

      if (raw.length > 1) {
        this._distributeDigits(raw, 0);
        return;
      }

      box.value = raw;
      box.classList.toggle('filled', box.value !== '');
      this._clearError();

      if (box.value && i < this.boxes.length - 1) this.boxes[i + 1].focus();
      if (box.value && i === this.boxes.length - 1) this._maybeSubmit();
    }

    _distributeDigits(digits, startIndex) {
      if (this._verifying) return;
      this._setState(STATES.FILLING);
      const chars = digits.slice(0, this.boxes.length - startIndex).split('');
      this.boxes.forEach((box, idx) => {
        if (idx < startIndex) return;
        const val = chars[idx - startIndex];
        if (val !== undefined) {
          box.value = val;
          box.classList.toggle('filled', Boolean(val));
        }
      });
      this._clearError();

      const focusIndex = Math.min(startIndex + chars.length - 1, this.boxes.length - 1);
      this.boxes[focusIndex].focus();
      if (this.getCode().length === this.boxes.length) this._maybeSubmit();
    }

    _handleKeydown(e, i) {
      if (this._verifying) {
        e.preventDefault();
        return;
      }
      const box = this.boxes[i];
      if (e.key === 'Backspace' && !box.value && i > 0) {
        this.boxes[i - 1].focus();
        this.boxes[i - 1].value = '';
        this.boxes[i - 1].classList.remove('filled');
        e.preventDefault();
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
      if (digits) this._distributeDigits(digits, 0);
    }

    getCode() {
      return this.boxes.map((box) => box.value).join('');
    }

    async _maybeSubmit() {
      const code = this.getCode();
      if (this._verifying || this._completed || code.length !== this.boxes.length || typeof this.opts.onComplete !== 'function') return;
      this._startVerifying();

      let result;
      try {
        result = await this.opts.onComplete(code);
      } catch (err) {
        result = { success: false, message: 'Something went wrong. Please try again.' };
      }

      if (result && result.success) this._playSuccess();
      else this._playError((result && result.message) || this.opts.errorText);
    }

    _startVerifying() {
      this._clearTimers();
      this._setState(STATES.VERIFYING);
      this._verifying = true;
      this.statusMsg.textContent = this.opts.verifyingText;
      this.statusMsg.classList.add('otp-show');
      this.boxes.forEach((box) => {
        box.disabled = true;
        box.classList.add('otp-verifying');
      });
      this.resendBtn.disabled = true;
    }

    _stopVerifyingVisual() {
      this.boxes.forEach((box) => box.classList.remove('otp-verifying'));
      this.statusMsg.classList.remove('otp-show');
    }

    _playError(message) {
      this._stopVerifyingVisual();
      this._setState(STATES.ERROR);
      this.boxes.forEach((box) => box.classList.add('otp-error-box'));
      this.boxesEl.classList.add('otp-shake');
      this._showError(message || this.opts.errorText);

      let ended = false;
      const onEnd = () => {
        if (ended) return;
        ended = true;
        this.boxesEl.classList.remove('otp-shake');
        this.boxesEl.removeEventListener('animationend', onEnd);
        this._resetToIdle();
      };
      this.boxesEl.addEventListener('animationend', onEnd);
      this._setTimer(onEnd, 520);
    }

    _playSuccess() {
      this._stopVerifyingVisual();
      this._setState(STATES.SUCCESS_MORPH);
      this._completed = true;

      const wrapRect = this.boxesEl.getBoundingClientRect();
      const centerX = wrapRect.left + wrapRect.width / 2;
      const centerY = wrapRect.top + wrapRect.height / 2;

      this.boxes.forEach((box) => {
        const rect = box.getBoundingClientRect();
        const dx = centerX - (rect.left + rect.width / 2);
        const dy = centerY - (rect.top + rect.height / 2);
        box.style.setProperty('--otp-dx', `${dx}px`);
        box.style.setProperty('--otp-dy', `${dy}px`);
        box.classList.add('otp-converge');
      });

      this._setTimer(() => {
        this.boxesEl.style.visibility = 'hidden';
        this.successWrap.classList.add('otp-show');
        this.successWrap.setAttribute('aria-hidden', 'false');
        this.successCircleBg.getBoundingClientRect();
        this.successCircleBg.classList.add('otp-grow');

        this._setTimer(() => {
          this.successCheck.style.transition = 'stroke-dashoffset 0.62s ease';
          this.successCheck.style.strokeDashoffset = '0';

          this._setTimer(() => {
            this._setState(STATES.SUCCESS);
            this.successText.classList.add('otp-show');

            this._setTimer(() => {
              if (typeof this.opts.onVerified === 'function') this.opts.onVerified();
            }, SUCCESS_HOLD_MS);
          }, 650);
        }, 520);
      }, 620);
    }

    _showError(message) {
      this.errorMsg.textContent = message;
      this.errorMsg.classList.add('otp-show');
    }

    _clearError() {
      this.errorMsg.classList.remove('otp-show');
      this.errorMsg.textContent = '';
      this.boxes.forEach((box) => box.classList.remove('otp-error-box'));
    }

    _resetToIdle() {
      this._setState(STATES.IDLE);
      this._verifying = false;
      this._completed = false;
      this.statusMsg.textContent = '';
      this.boxes.forEach((box) => {
        box.disabled = false;
        box.value = '';
        box.classList.remove('filled', 'otp-error-box', 'otp-converge', 'otp-verifying');
        box.style.removeProperty('--otp-dx');
        box.style.removeProperty('--otp-dy');
      });
      this.resendBtn.disabled = this._resendTimer !== null;
      this.focus();
    }

    reset() {
      this._clearTimers();
      this._completed = false;
      this.successWrap.classList.remove('otp-show');
      this.successWrap.setAttribute('aria-hidden', 'true');
      this.successCircleBg.classList.remove('otp-grow');
      this.successCheck.style.transition = 'none';
      this.successCheck.style.strokeDashoffset = String(this._checkLength);
      this.successText.classList.remove('otp-show');
      this.boxesEl.style.visibility = '';
      this.statusMsg.classList.remove('otp-show');
      this.statusMsg.textContent = '';
      this._clearError();
      this._resetToIdle();
    }

    focus() {
      const first = this.boxes[0];
      if (first) first.focus({ preventScroll: true });
    }

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

    _armBackInterception() {
      history.pushState({ otpStep: true }, '', location.href);
      window.addEventListener('popstate', this._popstateBound);
    }

    _handlePopState() {
      if (typeof this.opts.onBack === 'function') this.opts.onBack();
    }

    _setState(state) {
      this._state = state;
      this.container.dataset.otpState = state.toLowerCase();
    }

    _setTimer(fn, delay) {
      const timer = setTimeout(() => {
        this._timers = this._timers.filter((item) => item !== timer);
        fn();
      }, delay);
      this._timers.push(timer);
      return timer;
    }

    _clearTimers() {
      this._timers.forEach((timer) => clearTimeout(timer));
      this._timers = [];
    }

    destroy() {
      this._clearTimers();
      clearInterval(this._resendTimer);
      if (this.opts.interceptBackButton) window.removeEventListener('popstate', this._popstateBound);
    }
  }

  global.OtpVerifier = OtpVerifier;
  global.OtpVerifierStates = STATES;
})(typeof window !== 'undefined' ? window : this);
