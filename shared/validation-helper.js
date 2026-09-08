(function () {
  'use strict';

  /**
   * TravelBuddy Validation and Form Submission Lock System
   * This helper provides a centralized way to handle form locking and validation.
   */

  const Validation = {
    EMAIL_RE: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    PHONE_RE: /^\+[1-9]\d{7,14}$/,
    OTP_RE: /^\d{6}$/,

    /**
     * Locks or unlocks a form by disabling/enabling all interactive elements.
     * @param {HTMLFormElement} form - The form to lock/unlock.
     * @param {boolean} isLoading - Whether to lock (true) or unlock (false).
     * @param {Object} options - Configuration for the lock.
     * @param {HTMLElement} options.submitBtn - The primary button to show loading state.
     * @param {string} options.loadingText - Text to show on the button.
     */
    FormLock(form, isLoading, options = {}) {
      if (!form) return;

      const elements = form.querySelectorAll('input, select, textarea, button');
      const submitBtn = options.submitBtn || form.querySelector('button[type="submit"]');

      elements.forEach((el) => {
        // Don't disable the submit button if we're handling it separately via setButtonLoading
        if (el === submitBtn && isLoading) return;

        if (isLoading) {
          // Store original state if not already stored
          if (el.dataset.wasDisabled === undefined) {
            el.dataset.wasDisabled = el.disabled;
          }
          el.disabled = true;
          if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            el.readOnly = true;
          }
        } else {
          // Restore original state
          const wasDisabled = el.dataset.wasDisabled === 'true';
          el.disabled = wasDisabled;
          if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            el.readOnly = false;
          }
          delete el.dataset.wasDisabled;
        }
      });

      if (submitBtn && window.TravelBuddy?.setButtonLoading) {
        window.TravelBuddy.setButtonLoading(submitBtn, isLoading, options.loadingText);
      }
    },

    /**
     * Generic field validator
     * @param {string} type - email, phone, otp, required
     * @param {string} value - the value to validate
     * @returns {boolean}
     */
    isValid(type, value) {
      const v = String(value || '').trim();
      switch (type) {
        case 'email': return this.EMAIL_RE.test(v);
        case 'phone': return this.PHONE_RE.test(v);
        case 'otp': return this.OTP_RE.test(v);
        case 'required': return v.length > 0;
        default: return true;
      }
    }
  };

  // Attach to window.TravelBuddy if available, otherwise global
  if (window.TravelBuddy) {
    window.TravelBuddy.FormLock = Validation.FormLock;
    window.TravelBuddy.Validation = Validation;
  } else {
    window.TravelBuddyValidation = Validation;
  }

})();
