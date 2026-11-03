(function () {
  'use strict';

  window.CarryParcel = window.CarryParcel || {};

  /**
   * Check onboarding status and show wizard modal if incomplete.
   * @param {Object} options
   * @param {Object} options.onboarding - Onboarding status object
   * @param {Function} options.onComplete - Callback when onboarding completes
   */
  window.CarryParcel.startOnboardingWizard = function ({ onboarding, onComplete }) {
    if (!onboarding || onboarding.completed) {
      if (onComplete) onComplete();
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'cp-onboarding-overlay';

    let currentStep = onboarding.mobileNumberRequired ? 'PHONE' : (onboarding.passwordSetupRequired ? 'PASSWORD' : 'DONE');
    let phoneValue = '';

    function renderStep() {
      if (currentStep === 'PHONE') {
        overlay.innerHTML = `
          <div class="cp-onboarding-card">
            <div class="cp-onboarding-badge"><i class="fa-solid fa-phone"></i></div>
            <h2 class="cp-onboarding-title">Add Your Mobile Number</h2>
            <p class="cp-onboarding-subtitle">Please enter your mobile number to receive delivery updates and handover OTPs.</p>

            <div class="cp-onboarding-steps">
              <span class="cp-onboarding-step-dot active"></span>
              <span class="cp-onboarding-step-dot"></span>
              <span class="cp-onboarding-step-dot"></span>
            </div>

            <div class="cp-onboarding-field">
              <label for="obPhone">Mobile Number</label>
              <div class="cp-onboarding-input-wrap">
                <select id="obCountryCode" class="cp-onboarding-select">
                  <option value="+91">+91 (IN)</option>
                  <option value="+1">+1 (US)</option>
                  <option value="+44">+44 (UK)</option>
                  <option value="+971">+971 (UAE)</option>
                </select>
                <input type="tel" id="obPhone" class="cp-onboarding-input" placeholder="98765 43210" required />
              </div>
            </div>

            <button id="obSubmitPhoneBtn" class="cp-onboarding-btn">Continue & Verify Email</button>
            <div id="obError" class="cp-onboarding-error"></div>
          </div>
        `;

        requestAnimationFrame(() => {
          overlay.classList.add('show');
          const phoneInput = overlay.querySelector('#obPhone');
          if (phoneInput) phoneInput.focus();

          const btn = overlay.querySelector('#obSubmitPhoneBtn');
          const errorEl = overlay.querySelector('#obError');

          btn.addEventListener('click', async () => {
            const rawNumber = phoneInput.value.trim().replace(/[\s-]/g, '');
            if (!rawNumber || rawNumber.length < 8) {
              errorEl.textContent = 'Please enter a valid mobile number.';
              return;
            }
            const countryCode = overlay.querySelector('#obCountryCode').value;
            phoneValue = `${countryCode}${rawNumber}`;

            btn.disabled = true;
            btn.textContent = 'Sending Code...';
            errorEl.textContent = '';

            try {
              const res = await fetch(`${APP_CONFIG.API_BASE_URL}/api/auth/onboarding/submit-phone`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ phone: phoneValue })
              });
              const data = await res.json();
              if (!res.ok) {
                errorEl.textContent = data.error || 'Failed to submit phone number.';
                btn.disabled = false;
                btn.textContent = 'Continue & Verify Email';
                return;
              }
              currentStep = 'OTP';
              renderStep();
            } catch (err) {
              errorEl.textContent = 'Network error. Please try again.';
              btn.disabled = false;
              btn.textContent = 'Continue & Verify Email';
            }
          });
        });
      } else if (currentStep === 'OTP') {
        overlay.innerHTML = `
          <div class="cp-onboarding-card">
            <div class="cp-onboarding-badge"><i class="fa-solid fa-envelope-circle-check"></i></div>
            <h2 class="cp-onboarding-title">Verify Email OTP</h2>
            <p class="cp-onboarding-subtitle">We sent a 6-digit code to your registered email address to verify phone setup (${phoneValue}).</p>

            <div class="cp-onboarding-steps">
              <span class="cp-onboarding-step-dot active"></span>
              <span class="cp-onboarding-step-dot active"></span>
              <span class="cp-onboarding-step-dot"></span>
            </div>

            <div class="cp-onboarding-field">
              <label for="obOtp">6-Digit Code</label>
              <input type="text" id="obOtp" class="cp-onboarding-input" placeholder="000000" maxlength="6" required style="letter-spacing: 4px; font-weight: 700; text-align: center; font-size: 20px;" />
            </div>

            <button id="obVerifyOtpBtn" class="cp-onboarding-btn">Verify & Continue</button>
            <div id="obError" class="cp-onboarding-error"></div>
          </div>
        `;

        requestAnimationFrame(() => {
          const otpInput = overlay.querySelector('#obOtp');
          if (otpInput) otpInput.focus();

          const btn = overlay.querySelector('#obVerifyOtpBtn');
          const errorEl = overlay.querySelector('#obError');

          btn.addEventListener('click', async () => {
            const otp = otpInput.value.trim();
            if (!otp || otp.length < 6) {
              errorEl.textContent = 'Please enter the 6-digit OTP code.';
              return;
            }

            btn.disabled = true;
            btn.textContent = 'Verifying Code...';
            errorEl.textContent = '';

            try {
              const res = await fetch(`${APP_CONFIG.API_BASE_URL}/api/auth/onboarding/verify-email-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ phone: phoneValue, otp })
              });
              const data = await res.json();
              if (!res.ok) {
                errorEl.textContent = data.error || 'Invalid verification code.';
                btn.disabled = false;
                btn.textContent = 'Verify & Continue';
                return;
              }
              if (data.onboarding && data.onboarding.passwordSetupRequired) {
                currentStep = 'PASSWORD';
                renderStep();
              } else {
                finishOnboarding();
              }
            } catch (err) {
              errorEl.textContent = 'Network error. Please try again.';
              btn.disabled = false;
              btn.textContent = 'Verify & Continue';
            }
          });
        });
      } else if (currentStep === 'PASSWORD') {
        overlay.innerHTML = `
          <div class="cp-onboarding-card">
            <div class="cp-onboarding-badge"><i class="fa-solid fa-lock"></i></div>
            <h2 class="cp-onboarding-title">Create Password</h2>
            <p class="cp-onboarding-subtitle">Create a password so you can also sign in directly using your email and password.</p>

            <div class="cp-onboarding-steps">
              <span class="cp-onboarding-step-dot active"></span>
              <span class="cp-onboarding-step-dot active"></span>
              <span class="cp-onboarding-step-dot active"></span>
            </div>

            <div class="cp-onboarding-field">
              <label for="obPass">New Password</label>
              <input type="password" id="obPass" class="cp-onboarding-input" placeholder="At least 8 characters" minlength="8" required />
            </div>

            <div class="cp-onboarding-field">
              <label for="obPassConfirm">Confirm Password</label>
              <input type="password" id="obPassConfirm" class="cp-onboarding-input" placeholder="Re-enter new password" minlength="8" required />
            </div>

            <button id="obCreatePassBtn" class="cp-onboarding-btn">Complete Setup & Open Dashboard</button>
            <div id="obError" class="cp-onboarding-error"></div>
          </div>
        `;

        requestAnimationFrame(() => {
          const passInput = overlay.querySelector('#obPass');
          if (passInput) passInput.focus();

          const btn = overlay.querySelector('#obCreatePassBtn');
          const errorEl = overlay.querySelector('#obError');

          btn.addEventListener('click', async () => {
            const password = passInput.value;
            const confirmPassword = overlay.querySelector('#obPassConfirm').value;

            if (!password || password.length < 8) {
              errorEl.textContent = 'Password must be at least 8 characters long.';
              return;
            }
            if (password !== confirmPassword) {
              errorEl.textContent = 'Passwords do not match.';
              return;
            }

            btn.disabled = true;
            btn.textContent = 'Saving Password...';
            errorEl.textContent = '';

            try {
              const res = await fetch(`${APP_CONFIG.API_BASE_URL}/api/auth/onboarding/create-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ password, confirmPassword })
              });
              const data = await res.json();
              if (!res.ok) {
                errorEl.textContent = data.error || 'Failed to create password.';
                btn.disabled = false;
                btn.textContent = 'Complete Setup & Open Dashboard';
                return;
              }
              finishOnboarding();
            } catch (err) {
              errorEl.textContent = 'Network error. Please try again.';
              btn.disabled = false;
              btn.textContent = 'Complete Setup & Open Dashboard';
            }
          });
        });
      }
    }

    function finishOnboarding() {
      overlay.classList.remove('show');
      setTimeout(() => {
        overlay.remove();
        if (onComplete) onComplete();
      }, 300);
    }

    document.body.appendChild(overlay);
    renderStep();
  };
})();
