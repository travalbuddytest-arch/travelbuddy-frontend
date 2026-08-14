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
            <div class="tb-ai-typing" id="tbAiTyping">
                <div class="tb-ai-dot"></div>
                <div class="tb-ai-dot"></div>
                <div class="tb-ai-dot"></div>
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
    const typingIndicator = document.getElementById('tbAiTyping');

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

        // Simple markdown: bold (**text**) and newlines (\n)
        let formatted = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');

        msg.innerHTML = formatted;
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
        typingIndicator.classList.add('active');
        messages.scrollTop = messages.scrollHeight;

        try {
            const screen = document.body.getAttribute('data-page') || 'Unknown';

            // Get the appropriate token for authentication
            const token = localStorage.getItem('travelBuddyToken') || localStorage.getItem('travelBuddyAdminToken');

            const apiBase = window.APP_CONFIG ? window.APP_CONFIG.API_BASE_URL : '';
            if (!apiBase) throw new Error('API Configuration missing');

            const res = await fetch(`${apiBase}/api/ai/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ message: text, conversationId, screen })
            });

            typingIndicator.classList.remove('active');

            if (!res.ok) {
                if (res.status === 429) {
                    addMessage("You're sending messages too fast. Please wait a bit.", 'bot');
                } else {
                    throw new Error('Server error');
                }
                return;
            }

            const data = await res.json();
            if (data.success) {
                addMessage(data.reply, 'bot');
                if (data.action && data.action.type === 'NAVIGATE') {
                    const target = NAV_MAP[data.action.target];
                    if (target) {
                        setTimeout(() => {
                            window.location.href = target;
                        }, 1800);
                    }
                }
            } else {
                addMessage('Sorry, I encountered an error. Please try again.', 'bot');
            }
        } catch (err) {
            typingIndicator.classList.remove('active');
            console.error('AI Assistant Fetch Error:', err);
            addMessage('Could not connect to the assistant. Please check your internet.', 'bot');
        }
    };

    // Auto-open logic: 10 seconds on Home Page
    const currentPage = document.body.getAttribute('data-page');
    if (currentPage === 'home' && !sessionStorage.getItem('tb_ai_auto_opened')) {
        setTimeout(() => {
            if (!windowEl.classList.contains('active')) {
                windowEl.classList.add('active');
                sessionStorage.setItem('tb_ai_auto_opened', 'true');
            }
        }, 10000);
    }
})();
