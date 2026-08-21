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

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function addMessage(text, role) {
        const msg = document.createElement('div');
        msg.className = `tb-ai-msg ${role}`;

        // Sanitize raw text first to prevent XSS injection, then parse safe markdown
        const escaped = escapeHtml(String(text || ''));
        const formatted = escaped
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
        if (e) e.preventDefault();
        const text = input.value.trim();
        if (!text) return;

        addMessage(text, 'user');
        input.value = '';

        const startTime = Date.now();
        typingIndicator.classList.add('active');
        messages.scrollTop = messages.scrollHeight;

        const sendRequest = async () => {
            try {
                const screen = document.body.getAttribute('data-page') || 'Unknown';
                const token = localStorage.getItem('travelBuddyToken') || localStorage.getItem('travelBuddyAdminToken');

                // Robust config check
                let apiBase = '';
                if (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) {
                    apiBase = window.APP_CONFIG.API_BASE_URL;
                } else {
                    // Fallback if config is missing
                    apiBase = window.location.origin.includes('localhost') ? 'http://localhost:4000' : 'https://travelbuddy-backend-19l6.onrender.com';
                }

                const res = await fetch(`${apiBase}/api/ai/chat`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({ message: text, conversationId, screen })
                });

                // Ensure typing indicator shows for at least 800ms
                const elapsed = Date.now() - startTime;
                if (elapsed < 800) await new Promise(r => setTimeout(r, 800 - elapsed));

                typingIndicator.classList.remove('active');

                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({}));
                    const serverMsg = errorData.error || `Server error (${res.status})`;

                    if (res.status === 429) {
                        addMessage("Whoa! You're sending messages too fast. Please wait a minute.", 'bot');
                    } else {
                        addMessage(`**Technical Error**: ${serverMsg}`, 'bot');
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
                            }, 2000);
                        }
                    }
                } else {
                    throw new Error('AI Error response');
                }
            } catch (err) {
                typingIndicator.classList.remove('active');
                console.error('AI Assistant Fetch Error:', err);

                const errorMsg = document.createElement('div');
                errorMsg.className = 'tb-ai-msg bot error-msg';
                errorMsg.innerHTML = `
                    Could not connect to the assistant.
                    <a href="#" style="color: #007bff; text-decoration: underline; margin-left: 5px;" id="tbAiRetry">Try again</a>
                `;
                messages.appendChild(errorMsg);
                const retryBtn = document.getElementById('tbAiRetry');
                if (retryBtn) {
                    retryBtn.onclick = (re) => {
                        re.preventDefault();
                        errorMsg.remove();
                        input.value = text;
                        form.onsubmit();
                    };
                }
                messages.scrollTop = messages.scrollHeight;
            }
        };

        sendRequest();
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
