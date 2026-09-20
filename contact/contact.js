// =========================================================
// TravelBuddy — Contact Page
// =========================================================

const ctReduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ============ SCROLL REVEAL ============ */
const ctRevealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, idx) => {
        if (entry.isIntersecting) {
            entry.target.style.transitionDelay = Math.min(idx % 5, 4) * 0.08 + 's';
            entry.target.classList.add('ct-in-view');
            ctRevealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.15 });
document.querySelectorAll('.ct-reveal').forEach(el => ctRevealObserver.observe(el));

/* ============ VISIT SUPPORT LOGIC ============ */
const ctSupportCard = document.getElementById('ctSupportCard');
ctSupportCard?.addEventListener('click', (e) => {
    const token = localStorage.getItem('carryParcelToken');
    if (!token) {
        e.preventDefault();
        if (window.TBAiAssistant && typeof window.TBAiAssistant.open === 'function') {
            window.TBAiAssistant.open();
        } else {
            window.location.href = '../support/support.html';
        }
    }
});

/* ============ FORM VALIDATION + SUBMIT ============ */
const ctForm = document.getElementById('ctForm');
const ctSubmitBtn = document.getElementById('ctSubmitBtn');

function ctSetFieldError(id, msg) {
    const field = document.getElementById(id);
    if (!field) return;
    field.classList.toggle('ct-error', !!msg);
    field.querySelector('.ct-field-msg').textContent = msg || '';
}

ctForm?.addEventListener('submit', e => {
    e.preventDefault();
    let valid = true;

    const name = document.getElementById('ctName').value.trim();
    const email = document.getElementById('ctEmail').value.trim();
    const subject = document.getElementById('ctSubject').value;
    const message = document.getElementById('ctMsg').value.trim();
    const phone = document.getElementById('ctPhone')?.value.trim() || '';

    if (!name) { ctSetFieldError('cfName', 'Enter your name'); valid = false; } else ctSetFieldError('cfName', '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { ctSetFieldError('cfEmail', 'Enter a valid email'); valid = false; } else ctSetFieldError('cfEmail', '');
    if (!subject) { ctSetFieldError('cfSubject', 'Choose a subject'); valid = false; } else ctSetFieldError('cfSubject', '');
    if (message.length < 10) { ctSetFieldError('cfMsg', 'Add a few more details (10+ characters)'); valid = false; } else ctSetFieldError('cfMsg', '');

    if (!valid) return;

    ctSubmitBtn.classList.add('ct-loading');
    ctSubmitBtn.disabled = true;
    const originalBtnInner = ctSubmitBtn.innerHTML;
    const btnTextSpan = ctSubmitBtn.querySelector('.ct-btn-text');
    if (btnTextSpan) btnTextSpan.textContent = 'Sending...';
    else ctSubmitBtn.textContent = 'Sending...';

    // Make API call to backend
    const apiUrl = (window.APP_CONFIG?.API_BASE_URL || '') + '/api/contact/submit';

    // Get token if user is logged in
    const token = localStorage.getItem('carryParcelToken');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch(apiUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ fullName: name, email, subject, message, phone })
    })
    .then(res => res.json().then(data => ({ status: res.status, ok: res.ok, data })))
    .then(({ status, ok, data }) => {
        ctSubmitBtn.classList.remove('ct-loading');
        ctSubmitBtn.disabled = false;
        ctSubmitBtn.innerHTML = originalBtnInner;

        if (ok) {
            document.getElementById('ctSuccessName').textContent = name.split(' ')[0] || 'there';
            document.getElementById('ctSuccess').classList.add('ct-show');
            ctForm.reset();
            ctShowToast(data.message || 'Message sent — thanks for reaching out!');
            // Scroll to success message
            document.getElementById('ctSuccess').scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            ctShowToast(data.error || 'Failed to send message. Please try again.');
        }
    })
    .catch(err => {
        ctSubmitBtn.classList.remove('ct-loading');
        ctSubmitBtn.disabled = false;
        ctSubmitBtn.innerHTML = originalBtnInner;
        console.error('Contact form error:', err);
        ctShowToast('Failed to send message. Please check your connection and try again.');
    });
});

/* ============ TOAST ============ */
let ctToastTimer;
function ctShowToast(msg) {
    const toast = document.getElementById('ctToast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('ct-show');
    clearTimeout(ctToastTimer);
    ctToastTimer = setTimeout(() => toast.classList.remove('ct-show'), 2800);
}
