(() => {
  'use strict';

  const COOKIE_NAME = 'carryparcel_cookie_consent';
  const DAYS = 180;
  const defaults = { necessary: true, preferences: false, analytics: false };

  function read() {
    const row = document.cookie.split('; ').find((entry) => entry.startsWith(`${COOKIE_NAME}=`));
    if (!row) return null;
    try {
      return { ...defaults, ...JSON.parse(decodeURIComponent(row.split('=').slice(1).join('='))) };
    } catch (error) {
      return null;
    }
  }

  function write(value) {
    const data = {
      necessary: true,
      preferences: Boolean(value && value.preferences),
      analytics: Boolean(value && value.analytics),
      updatedAt: new Date().toISOString(),
    };

    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(data))}; Max-Age=${DAYS * 86400}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    window.carryParcelCookieConsent = data;
    window.dispatchEvent(new CustomEvent('carryparcel:consent-changed', { detail: data }));
  }

  function build() {
    if (document.getElementById('tbCookieBanner')) return;

    document.body.insertAdjacentHTML('beforeend', `
      <div class="tb-cookie-backdrop" id="tbCookieBackdrop"></div>
      <section class="tb-cookie-banner" id="tbCookieBanner" role="dialog" aria-label="Cookie consent" aria-live="polite">
        <div class="tb-cookie-row">
          <div class="tb-cookie-copy">
            <h2 class="tb-cookie-title">This website uses cookies</h2>
            <p class="tb-cookie-text">We use cookies and other tracking tools to personalise content and ads, to provide social media features and to analyse our traffic. We also share information about your use of our site with our social media, advertising and analytics partners who may combine it with other information that you've provided to them or that they've collected from your use of their services. To find out more, we invite you to read our <a href="#" class="tb-cookie-link">Privacy Policy</a>. By browsing our website, you consent to our cookies policy.</p>
          </div>
          <div class="tb-cookie-actions">
            <button class="tb-cookie-btn tb-cookie-primary" data-cookie-action="accept">Accept All Cookies</button>
            <button class="tb-cookie-btn tb-cookie-ghost" data-cookie-action="reject">Reject Cookies</button>
          </div>
        </div>
        <button class="tb-cookie-manage" data-cookie-action="customize" type="button">Manage Cookies <span aria-hidden="true">›</span></button>
      </section>
      <section class="tb-cookie-modal" id="tbCookieModal" role="dialog" aria-modal="true" aria-labelledby="tbCookieTitle">
        <div class="tb-cookie-modal-head"><div><h2 id="tbCookieTitle">Cookie preferences</h2><p class="tb-cookie-text">Choose which optional cookies CarryParcel may use. Necessary cookies are always active.</p></div><button class="tb-cookie-close" data-cookie-action="close" aria-label="Close">×</button></div>
        <div class="tb-cookie-option"><div><h3>Necessary cookies</h3><p>Required for login state, security, wallet and core website features.</p></div><span class="tb-cookie-always">Always on</span></div>
        <div class="tb-cookie-option"><div><h3>Preference cookies</h3><p>Remember optional choices such as interface preferences.</p></div><label class="tb-cookie-switch"><input id="tbPreferenceConsent" type="checkbox"><span class="tb-cookie-slider"></span></label></div>
        <div class="tb-cookie-option"><div><h3>Analytics cookies</h3><p>Allow anonymous usage measurement when analytics is connected.</p></div><label class="tb-cookie-switch"><input id="tbAnalyticsConsent" type="checkbox"><span class="tb-cookie-slider"></span></label></div>
        <div class="tb-cookie-modal-actions"><button class="tb-cookie-btn tb-cookie-ghost" data-cookie-action="reject">Reject non-essential</button><button class="tb-cookie-btn tb-cookie-primary" data-cookie-action="save">Save preferences</button></div>
      </section>
      <button class="tb-cookie-settings-link" id="tbCookieSettings" type="button">Manage Cookies</button>
    `);
  }

  function init() {
    build();

    const banner = document.getElementById('tbCookieBanner');
    const modal = document.getElementById('tbCookieModal');
    const backdrop = document.getElementById('tbCookieBackdrop');
    const settings = document.getElementById('tbCookieSettings');
    const pref = document.getElementById('tbPreferenceConsent');
    const analytics = document.getElementById('tbAnalyticsConsent');
    const current = read();

    window.travelBuddyCookieConsent = current || { ...defaults };

    function closeModal() {
      if (modal) modal.classList.remove('show');
      if (backdrop) backdrop.classList.remove('show');
    }

    function openModal() {
      const consent = read() || defaults;
      if (pref) pref.checked = Boolean(consent.preferences);
      if (analytics) analytics.checked = Boolean(consent.analytics);
      if (modal) modal.classList.add('show');
      if (backdrop) backdrop.classList.add('show');
    }

    function finish(data) {
      write(data);
      if (banner) banner.classList.remove('show');
      closeModal();
      if (settings) settings.classList.add('show');
    }

    document.addEventListener('click', (event) => {
      const action = event.target.closest('[data-cookie-action]')?.dataset.cookieAction;
      if (action === 'accept') finish({ preferences: true, analytics: true });
      if (action === 'reject') finish(defaults);
      if (action === 'customize') openModal();
      if (action === 'save') finish({ preferences: !!pref?.checked, analytics: !!analytics?.checked });
      if (action === 'close') closeModal();
    });

    if (backdrop) backdrop.addEventListener('click', closeModal);
    if (settings) settings.addEventListener('click', openModal);

    if (current) {
      if (settings) settings.classList.add('show');
    } else if (banner) {
      banner.classList.add('show');
    }
  }

  window.CarryParcelCookies = window.CarryParcelCookies || {
    get() {
      return read() || { ...defaults };
    },
    has(type) {
      return type === 'necessary' || Boolean((read() || defaults)[type]);
    },
    open() {
      const settingsButton = document.getElementById('tbCookieSettings');
      if (settingsButton && typeof settingsButton.click === 'function') {
        settingsButton.click();
      }
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
