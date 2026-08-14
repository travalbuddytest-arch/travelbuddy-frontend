(function() {
    'use strict';

    const container = document.createElement('div');
    container.className = 'tb-toast-container';
    document.body.appendChild(container);

    window.TBToast = {
        show(message, type = 'info', duration = 4000) {
            const toast = document.createElement('div');
            toast.className = `tb-toast ${type}`;

            let icon = '';
            switch(type) {
                case 'error': icon = '<i class="fa-solid fa-circle-exclamation"></i>'; break;
                case 'warning': icon = '<i class="fa-solid fa-triangle-exclamation"></i>'; break;
                case 'success': icon = '<i class="fa-solid fa-circle-check"></i>'; break;
                default: icon = '<i class="fa-solid fa-circle-info"></i>'; break;
            }

            toast.innerHTML = `${icon} <span>${message}</span>`;
            container.appendChild(toast);

            setTimeout(() => {
                toast.style.animation = 'tb-toast-out 0.3s ease-in forwards';
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }
    };
})();
