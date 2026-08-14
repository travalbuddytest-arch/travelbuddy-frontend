(function() {
    'use strict';

    const conversationId = sessionStorage.getItem('tb_ai_conv_id') || `web-${Date.now()}`;
    sessionStorage.setItem('tb_ai_conv_id', conversationId);

    const widget = document.createElement('div');
    widget.className = 'tb-ai-widget';
    widget.innerHTML = `
        <div class="tb-ai-window" id="tbAiWindow">
            <div class="tb-ai-header">
                <h3>TravelBuddy Assistant</h3>
                <div class="tb-ai-close" id="tbAiClose"><i class="fa-solid fa-xmark"></i></div>
            </div>
            <div class="tb-ai-messages" id="tbAiMessages">
                <div class="tb-ai-msg bot">Hi! I'm your TravelBuddy assistant. How can I help you today?</div>
            </div>
            <form class="tb-ai-input-area" id="tbAiForm">
                <input type="text" id="tbAiInput" placeholder="Type a message..." autocomplete="off">
                <button type="submit" class="tb-ai-send"><i class="fa-solid fa-paper-plane"></i></button>
            </form>
        </div>
        <div class="tb-ai-bubble" id="tbAiBubble">
            <i class="fa-solid fa-robot"></i>
        </div>
    `;

    document.body.appendChild(widget);

    const bubble = document.getElementById('tbAiBubble');
    const windowEl = document.getElementById('tbAiWindow');
    const closeBtn = document.getElementById('tbAiClose');
    const form = document.getElementById('tbAiForm');
    const input = document.getElementById('tbAiInput');
    const messages = document.getElementById('tbAiMessages');

    bubble.onclick = () => windowEl.classList.toggle('active');
    closeBtn.onclick = () => windowEl.classList.remove('active');

    window.TBAiAssistant = {
        open() {
            windowEl.classList.add('active');
            input.focus();
        },
        close() {
            windowEl.classList.remove('active');
        }
    };

    function addMessage(text, role) {
        const msg = document.createElement('div');
        msg.className = `tb-ai-msg ${role}`;
        msg.textContent = text;
        messages.appendChild(msg);
        messages.scrollTop = messages.scrollHeight;
    }

    const NAV_MAP = {
        'HOME': '../home/index.html',
        'POST_PARCEL': '../post-parcel/post.html',
        'PICKUP_PARCEL': '../carry-parcel/search.html',
        'TRACK_PARCEL': '../parcel-delivery/tracking.html',
        'WALLET': '../user-dashboard/wallet.html',
        'MESSAGES': '../user-dashboard/messages.html',
        'NOTIFICATIONS': '../user-dashboard/notifications.html',
        'PROFILE': '../user-dashboard/profile.html',
        'SETTINGS': '../user-dashboard/settings.html',
        'HELP': '../support/support.html'
    };

    form.onsubmit = async (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;

        addMessage(text, 'user');
        input.value = '';

        try {
            const screen = document.body.getAttribute('data-page') || 'Unknown';
            const res = await fetch(`${window.APP_CONFIG.API_BASE_URL}/api/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, conversationId, screen })
            });

            const data = await res.json();
            if (data.success) {
                addMessage(data.reply, 'bot');
                if (data.action && data.action.type === 'NAVIGATE') {
                    const target = NAV_MAP[data.action.target];
                    if (target) {
                        setTimeout(() => {
                            window.location.href = target;
                        }, 1500);
                    }
                }
            } else {
                addMessage('Sorry, I encountered an error. Please try again.', 'bot');
            }
        } catch (err) {
            addMessage('Could not connect to the assistant.', 'bot');
        }
    };
})();
