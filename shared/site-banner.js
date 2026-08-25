(()=>{
'use strict';
const COOKIE_NAME='travelbuddy_cookie_consent', DAYS=180;
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
  window.travelBuddyCookieConsent=data;
  window.dispatchEvent(new CustomEvent('travelbuddy:consent-changed',{detail:data}));
}
function build(){
  document.body.insertAdjacentHTML('beforeend',`
  <div class="tb-banner-backdrop" id="tbBackdrop"></div>
  <section class="tb-banner-bar" id="tbBanner" role="dialog" aria-label="Cookie consent" aria-live="polite">
    <div class="tb-banner-row">
      <div class="tb-banner-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none"><circle cx="12" cy="12" r="10" fill="#e9c46a"/><circle cx="8.6" cy="9" r="1.4" fill="#7a4a1e"/><circle cx="14.5" cy="7.8" r="1.1" fill="#7a4a1e"/><circle cx="15.5" cy="13" r="1.3" fill="#7a4a1e"/><circle cx="10" cy="15" r="1" fill="#7a4a1e"/><circle cx="12.5" cy="11" r="0.9" fill="#7a4a1e"/></svg>
      </div>
      <div class="tb-banner-copy">
        <h2 class="tb-banner-title">This website uses cookies</h2>
        <p class="tb-banner-text">We use cookies and other tracking tools to personalise content and ads, to provide social media features and to analyse our traffic. We also share information about your use of our site with our social media, advertising and analytics partners who may combine it with other information that you've provided to them or that they've collected from your use of their services. To find out more, we invite you to read our <a href="#" class="tb-banner-link">Privacy Policy</a>. By browsing our website, you consent to our cookies policy.</p>
      </div>
      <div class="tb-banner-actions">
        <button class="tb-banner-btn tb-banner-primary" data-banner-action="accept">Accept All Cookies</button>
        <button class="tb-banner-btn tb-banner-ghost" data-banner-action="reject">Reject Cookies</button>
      </div>
    </div>
    <button class="tb-banner-manage" data-banner-action="customize" type="button">Manage Cookies <span aria-hidden="true">›</span></button>
  </section>
  <section class="tb-notice-modal" id="tbNoticeModal" role="dialog" aria-modal="true" aria-labelledby="tbNoticeTitle">
    <div class="tb-notice-modal-head"><div><h2 id="tbNoticeTitle">Cookie preferences</h2><p class="tb-banner-text">Choose which optional cookies TravelBuddy may use. Necessary cookies are always active.</p></div><button class="tb-notice-close" data-banner-action="close" aria-label="Close">×</button></div>
    <div class="tb-notice-option"><div><h3>Necessary cookies</h3><p>Required for login state, security, wallet and core website features.</p></div><span class="tb-notice-always">Always on</span></div>
    <div class="tb-notice-option"><div><h3>Preference cookies</h3><p>Remember optional choices such as interface preferences.</p></div><label class="tb-notice-switch"><input id="tbPrefToggle" type="checkbox"><span class="tb-notice-slider"></span></label></div>
    <div class="tb-notice-option"><div><h3>Analytics cookies</h3><p>Allow anonymous usage measurement when analytics is connected.</p></div><label class="tb-notice-switch"><input id="tbAnalyticsToggle" type="checkbox"><span class="tb-notice-slider"></span></label></div>
    <div class="tb-notice-modal-actions"><button class="tb-banner-btn tb-banner-ghost" data-banner-action="reject">Reject non-essential</button><button class="tb-banner-btn tb-banner-primary" data-banner-action="save">Save preferences</button></div>
  </section>
  <button class="tb-banner-reopen" id="tbBannerReopen" type="button" aria-label="Manage cookie preferences">
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none"><circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.1"/><circle cx="9" cy="9.5" r="1.1" fill="currentColor"/><circle cx="14" cy="8.6" r="0.9" fill="currentColor"/><circle cx="14.6" cy="13.3" r="1" fill="currentColor"/><circle cx="9.6" cy="14.6" r="0.8" fill="currentColor"/></svg>
    <span>Manage Cookies</span>
  </button>`);
}
function init(){
  build();
  const banner=document.getElementById('tbBanner'), modal=document.getElementById('tbNoticeModal'), backdrop=document.getElementById('tbBackdrop'), settings=document.getElementById('tbBannerReopen');
  const pref=document.getElementById('tbPrefToggle'), analytics=document.getElementById('tbAnalyticsToggle');
  const current=read(); window.travelBuddyCookieConsent=current||{...defaults};
  let hideTimer=null;

  function closeModal(){modal.classList.remove('show');if(!banner.classList.contains('show'))backdrop.classList.remove('show');}
  function openModal(){const c=read()||defaults;pref.checked=!!c.preferences;analytics.checked=!!c.analytics;modal.classList.add('show');backdrop.classList.add('show');}

  function showBanner(){
    clearTimeout(hideTimer);
    banner.classList.remove('tb-banner-leave');
    banner.classList.add('show');
    // Heuristic fix: Do not show backdrop for the initial banner to avoid blocking hero/CTA
  }
  function hideBanner(){
    if(!banner.classList.contains('show'))return;
    banner.classList.add('tb-banner-leave'); // plays slide-down/fade exit animation
    clearTimeout(hideTimer);
    hideTimer=setTimeout(()=>{
      banner.classList.remove('show','tb-banner-leave');
      if(!modal.classList.contains('show'))backdrop.classList.remove('show','tb-backdrop-behind-banner');
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
  // window.TB_ALWAYS_SHOW_BANNER (left as an opt-in dev/test hook, defaults off)
  // can force the banner to appear for QA purposes.
  const alwaysShow=window.TB_ALWAYS_SHOW_BANNER===true;
  if(current&&!alwaysShow){
    settings.classList.add('show');
  }else{
    // Small delay so the banner doesn't flash in before the page has painted,
    // but still appears promptly like a real consent banner (not after 10s).
    setTimeout(showBanner,700);
  }
}
window.TravelBuddyCookies={
  get:()=>read()||{...defaults},
  has:type=>type==='necessary'||!!(read()||defaults)[type],
  open:()=>document.getElementById('tbBannerReopen')?.click(),
  reset:()=>{document.cookie=`${COOKIE_NAME}=; Max-Age=0; Path=/`;}
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
