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
