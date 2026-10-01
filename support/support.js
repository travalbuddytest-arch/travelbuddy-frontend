/* CarryParcel Support page interactions. Main site navigation/footer are untouched. */
document.addEventListener('DOMContentLoaded', () => {
    // Keep FAQ panels simple and accessible: opening one closes the others.
    const faqItems = document.querySelectorAll('#cpSupportFaqList details');
    faqItems.forEach(item => {
        item.addEventListener('toggle', () => {
            if (!item.open) return;
            faqItems.forEach(other => {
                if (other !== item) other.open = false;
            });
        });
    });
});

// Capture-phase listener ensuring cookie notice/modal/backdrop closes immediately when clicked on Support page
document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.cp-notice-close, .tb-cookie-close, [data-banner-action="close"], [data-banner-action="save"], [data-banner-action="reject"], [data-banner-action="accept"], [data-cookie-action="close"], [data-cookie-action="save"], [data-cookie-action="reject"], [data-cookie-action="accept"], #cpBackdrop, #tbCookieBackdrop, .cp-banner-backdrop, .tb-cookie-backdrop');
    if (trigger) {
        const modal = document.getElementById('cpNoticeModal') || document.getElementById('tbCookieModal');
        const backdrop = document.getElementById('cpBackdrop') || document.getElementById('tbCookieBackdrop');
        const banner = document.getElementById('cpBanner') || document.getElementById('tbCookieBanner');

        if (modal) modal.classList.remove('show');
        if (backdrop) backdrop.classList.remove('show', 'cp-backdrop-behind-banner');
        if (banner) {
            const action = trigger.getAttribute('data-banner-action') || trigger.getAttribute('data-cookie-action');
            if (action === 'accept' || action === 'reject' || action === 'save' || action === 'close') {
                banner.classList.remove('show', 'cp-banner-leave');
            }
        }
    }
}, true);
