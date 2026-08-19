(function () {
    'use strict';

    if (!window.TravelBuddy) window.TravelBuddy = {};

    /**
     * Show premium login success animation.
     * @param {Object} options
     * @param {Object} options.user - Authenticated user data
     * @param {string} options.method - 'EMAIL', 'GOOGLE', or 'OTP'
     * @param {Function} options.onComplete - Callback after animation finishes
     */
    window.TravelBuddy.showLoginSuccess = function ({ user, method, onComplete }) {
        const overlay = document.createElement('div');
        overlay.className = 'tb-success-overlay';

        const firstName = user.firstName || user.name || 'Buddy';
        const initials = ((user.firstName?.charAt(0) || user.name?.charAt(0) || 'T') +
                         (user.lastName?.charAt(0) || user.name?.split(' ')[1]?.charAt(0) || 'B')).toUpperCase();

        const photoUrl = user.profilePhoto ? (window.TravelBuddy.resolveMediaUrl ? window.TravelBuddy.resolveMediaUrl(user.profilePhoto) : user.profilePhoto) : null;

        const methodText = {
            'EMAIL': 'Successfully signed in with your account.',
            'GOOGLE': 'Signed in successfully with Google.',
            'OTP': 'Verified successfully! Welcome back.'
        }[method] || 'Login successful.';

        overlay.innerHTML = `
            <div class="tb-success-card">
                <div class="tb-success-icon-box">
                    <div class="tb-success-circle"></div>
                    <svg class="tb-success-checkmark" viewBox="0 0 52 52">
                        <path d="M14.1 27.2l7.1 7.2 16.7-16.8" />
                    </svg>
                </div>

                <div class="tb-success-profile">
                    ${photoUrl ? `<img src="${photoUrl}" alt="Profile">` : `<span class="tb-success-initials">${initials}</span>`}
                </div>

                <h2 class="tb-success-title">Login Successful!</h2>
                <div class="tb-success-name">Welcome back, ${firstName}!</div>

                <div class="tb-success-method">
                    ${methodText}
                </div>

                <div class="tb-success-branding">
                    <span>TRAVELBUDDY</span>
                    <i class="fa-solid fa-plane tb-success-plane"></i>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Trigger animations
        requestAnimationFrame(() => {
            overlay.classList.add('show');
        });

        // Auto-navigation delay
        setTimeout(() => {
            if (onComplete) onComplete();
        }, 2500);
    };
})();
