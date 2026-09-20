(()=>{
'use strict';
const COOKIE_NAME='carryparcel_cookie_consent', DAYS=180;
const defaults={necessary:true,preferences:false,analytics:false};
const ANIM_MS=380; // keep in sync with CSS exit animation duration

function read(){
  const row=document.cookie.split('; ').find(v=>v.startsWith(COOKIE_NAME+'='));
  if(!row)return null;
  try{return {...defaults,...JSON.parse(decodeURIComponent(row.split('=').slice(1).join('=')))};}catch{return null;}
}
function write(value){
  const data={necessary:true,preferences:!!value.preferences,analytics:!!value.analytics,updatedAt:new Date().toISOString()};
  document.cookie=`${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(data))}; Max-Age=${DAYS*86400}; Path=/; SameSite=Lax${location.protocol==='https:'?'; Secure':''}`;

  // Real Management: Clear actual tracking cookies if consent is revoked
  if (!data.analytics) {
    document.cookie = 'cp_vid=; Max-Age=0; Path=/';
    document.cookie = 'cp_sid=; Max-Age=0; Path=/';
  }

  window.carryParcelCookieConsent=data;
  window.dispatchEvent(new CustomEvent('carryparcel:consent-changed',{detail:data}));
}
function build(){
  document.body.insertAdjacentHTML('beforeend',`
  <div class="cp-banner-backdrop" id="cpBackdrop"></div>
  <section class="cp-banner-bar" id="cpBanner" role="dialog" aria-label="Cookie consent" aria-live="polite">
    <div class="cp-banner-row">
      <div class="cp-banner-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none"><circle cx="12" cy="12" r="10" fill="#e9c46a"/><circle cx="8.6" cy="9" r="1.4" fill="#7a4a1e"/><circle cx="14.5" cy="7.8" r="1.1" fill="#7a4a1e"/><circle cx="15.5" cy="13" r="1.3" fill="#7a4a1e"/><circle cx="10" cy="15" r="1" fill="#7a4a1e"/><circle cx="12.5" cy="11" r="0.9" fill="#7a4a1e"/></svg>
      </div>
      <div class="cp-banner-copy">
        <h2 class="cp-banner-title">This website uses cookies</h2>
        <p class="cp-banner-text">We use cookies and other tracking tools to personalise content and ads, to provide social media features and to analyse our traffic. We also share information about your use of our site with our social media, advertising and analytics partners who may combine it with other information that you've provided to them or that they've collected from your use of their services. To find out more, we invite you to read our <a href="#" class="cp-banner-link">Privacy Policy</a>. By browsing our website, you consent to our cookies policy.</p>
      </div>
      <div class="cp-banner-actions">
        <button class="cp-banner-btn cp-banner-primary" data-banner-action="accept">Accept All Cookies</button>
        <button class="cp-banner-btn cp-banner-ghost" data-banner-action="reject">Reject Cookies</button>
      </div>
    </div>
    <button class="cp-banner-manage" data-banner-action="customize" type="button">Manage Cookies <span aria-hidden="true">›</span></button>
  </section>
  <section class="cp-notice-modal" id="cpNoticeModal" role="dialog" aria-modal="true" aria-labelledby="cpNoticeTitle">
    <div class="cp-notice-modal-head"><div><h2 id="cpNoticeTitle">Cookie preferences</h2><p class="cp-banner-text">Choose which optional cookies CarryParcel may use. Necessary cookies are always active.</p></div><button class="cp-notice-close" data-banner-action="close" aria-label="Close">×</button></div>

    <div class="cp-notice-option">
      <div>
        <h3>Necessary cookies</h3>
        <p>Required for login state, security, wallet and core website features.</p>
        <code style="font-size:10px; color:var(--cp-banner-muted);">Used: carryparcel_session, carryparcel_cookie_consent</code>
      </div>
      <span class="cp-notice-always">Always on</span>
    </div>

    <div class="cp-notice-option">
      <div>
        <h3>Preference cookies</h3>
        <p>Remember optional choices such as interface preferences and language.</p>
      </div>
      <label class="cp-notice-switch"><input id="cpPrefToggle" type="checkbox"><span class="cp-notice-slider"></span></label>
    </div>

    <div class="cp-notice-option">
      <div>
        <h3>Analytics cookies</h3>
        <p>Allow anonymous usage measurement to help us improve the platform.</p>
        <code style="font-size:10px; color:var(--cp-banner-muted);">Used: cp_vid, cp_sid</code>
      </div>
      <label class="cp-notice-switch"><input id="cpAnalyticsToggle" type="checkbox"><span class="cp-notice-slider"></span></label>
    </div>

    <div class="cp-notice-modal-actions"><button class="cp-banner-btn cp-banner-ghost" data-banner-action="reject">Reject non-essential</button><button class="cp-banner-btn cp-banner-primary" data-banner-action="save">Save preferences</button></div>
  </section>
  <button class="cp-banner-reopen" id="cpBannerReopen" type="button" aria-label="Manage cookie preferences">
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none"><circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.1"/><circle cx="9" cy="9.5" r="1.1" fill="currentColor"/><circle cx="14" cy="8.6" r="0.9" fill="currentColor"/><circle cx="14.6" cy="13.3" r="1" fill="currentColor"/><circle cx="9.6" cy="14.6" r="0.8" fill="currentColor"/></svg>
    <span>Manage Cookies</span>
  </button>`);
}
function init(){
  build();
  const banner=document.getElementById('cpBanner'), modal=document.getElementById('cpNoticeModal'), backdrop=document.getElementById('cpBackdrop'), settings=document.getElementById('cpBannerReopen');
  const pref=document.getElementById('cpPrefToggle'), analytics=document.getElementById('cpAnalyticsToggle');
  const current=read(); window.carryParcelCookieConsent=current||{...defaults};
  let hideTimer=null;

  function closeModal(){modal.classList.remove('show');if(!banner.classList.contains('show'))backdrop.classList.remove('show');}
  function openModal(){const c=read()||defaults;pref.checked=!!c.preferences;analytics.checked=!!c.analytics;modal.classList.add('show');backdrop.classList.add('show');}

  function showBanner(){
    clearTimeout(hideTimer);
    banner.classList.remove('cp-banner-leave');
    banner.classList.add('show');
    // Heuristic fix: Do not show backdrop for the initial banner to avoid blocking hero/CTA
  }
  function hideBanner(){
    if(!banner.classList.contains('show'))return;
    banner.classList.add('cp-banner-leave'); // plays slide-down/fade exit animation
    clearTimeout(hideTimer);
    hideTimer=setTimeout(()=>{
      banner.classList.remove('show','cp-banner-leave');
      if(!modal.classList.contains('show'))backdrop.classList.remove('show','cp-backdrop-behind-banner');
    },ANIM_MS);
  }
  function revealReopenPill(){
    settings.classList.remove('show');
    // restart the entrance animation reliably even if it was already shown
    void settings.offsetWidth;
    settings.classList.add('show');
  }
  function finish(data){
    write(data);
    hideBanner();
    closeModal();
    revealReopenPill();
  }

  document.addEventListener('click',e=>{
    const action=e.target.closest('[data-banner-action]')?.dataset.bannerAction;
    if(action==='accept')finish({preferences:true,analytics:true});
    if(action==='reject')finish(defaults);
    if(action==='customize')openModal();
    if(action==='save')finish({preferences:pref.checked,analytics:analytics.checked});
    if(action==='close')closeModal();
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&modal.classList.contains('show'))closeModal();
  });
  backdrop.addEventListener('click',()=>{ if(modal.classList.contains('show'))closeModal(); });
  settings.addEventListener('click',openModal);

  // Respect a saved choice: once the visitor has answered, never interrupt them
  // again on future visits/pages — only the small "Manage Cookies" pill shows.
  // window.CP_ALWAYS_SHOW_BANNER (left as an opt-in dev/test hook, defaults off)
  // can force the banner to appear for QA purposes.
  const alwaysShow=window.CP_ALWAYS_SHOW_BANNER===true;

  // Auto-hide the pill on dashboard pages to relocate it to settings
  const isDashboard = location.pathname.includes('/user-dashboard/') || location.pathname.includes('/admin_dashboard/');
  if (isDashboard) {
    document.body.classList.add('cp-hide-cookie-pill');
  }

  if(current&&!alwaysShow){
    settings.classList.add('show');
  }else{
    setTimeout(showBanner,700);
  }

  // Expose the API
  window.CarryParcelCookies = {
    get: () => read() || { ...defaults },
    has: (type) => type === 'necessary' || !!(read() || defaults)[type],
    open: openModal,
    reset: () => { document.cookie = `${COOKIE_NAME}=; Max-Age=0; Path=/`; }
  };
}

// Fallback if accessed before init/DOMContentLoaded
window.CarryParcelCookies = window.CarryParcelCookies || {
  get: () => read() || { ...defaults },
  has: (type) => type === 'necessary' || !!(read() || defaults)[type],
  open: () => document.getElementById('cpBannerReopen')?.click(),
  reset: () => { document.cookie = `${COOKIE_NAME}=; Max-Age=0; Path=/`; }
};

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();
