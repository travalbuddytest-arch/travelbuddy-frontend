(function () {
  'use strict';

  const existingConv = sessionStorage.getItem('tb_ai_conv_id');
  let conversationId = existingConv && existingConv.startsWith('web-') ? existingConv : `web-${Date.now()}`;
  if (!existingConv) {
    sessionStorage.setItem('tb_ai_conv_id', conversationId);
  } else if (!existingConv.startsWith('web-')) {
    conversationId = `web-${Date.now()}`;
    sessionStorage.setItem('tb_ai_conv_id', conversationId);
  } else {
    sessionStorage.setItem('tb_ai_conv_id', conversationId);
  }

  const widget = document.createElement('div');
  widget.className = 'tb-ai-widget';
  widget.innerHTML = `
    <div class="tb-ai-window" id="tbAiWindow" role="dialog" aria-modal="false" aria-labelledby="tbAiTitle">
      <div class="tb-ai-header">
        <div class="tb-ai-title-wrap">
          <h3 id="tbAiTitle">CarryParcel AI</h3>
          <div class="tb-ai-status">
            <span class="tb-ai-status-dot"></span>
            <span class="tb-ai-status-text">Customer Support Assistant</span>
          </div>
        </div>
        <button class="tb-ai-close" id="tbAiClose" aria-label="Close CarryParcel AI">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="tb-ai-quick-actions" id="tbAiQuickActions">
        <button class="tb-ai-chip" data-message="Track my parcel">Track Parcel</button>
        <button class="tb-ai-chip" data-message="Payment help">Payment Help</button>
        <button class="tb-ai-chip" data-message="Account help">Account Help</button>
        <button class="tb-ai-chip" data-message="Traveler help">Traveler Help</button>
        <button class="tb-ai-chip" data-message="Report an issue">Report Issue</button>
        <button class="tb-ai-chip" data-message="I want to talk to a human">Talk to Support</button>
      </div>
      <div class="tb-ai-messages" id="tbAiMessages" role="log" aria-live="polite">
        <div class="tb-ai-msg bot">
          Hi! I'm CarryParcel AI, your Customer Support Assistant. How can I help you today?
        </div>
      </div>
      <div class="tb-ai-typing" id="tbAiTyping">
        <div class="tb-ai-typing-content">
          <span>CarryParcel AI is typing</span>
          <div class="tb-ai-dot"></div>
          <div class="tb-ai-dot"></div>
          <div class="tb-ai-dot"></div>
        </div>
      </div>
      <div class="tb-ai-error" id="tbAiError">
        <span class="tb-ai-error-msg" id="tbAiErrorMsg"></span>
        <button class="tb-ai-retry" id="tbAiRetry">Retry</button>
      </div>
      <div class="tb-ai-handoff" id="tbAiHandoff">
        <div class="tb-ai-handoff-content" id="tbAiHandoffContent"></div>
        <button class="tb-ai-new-conv" id="tbAiNewConv">New conversation</button>
      </div>
      <form class="tb-ai-input-area" id="tbAiForm">
        <input type="text" id="tbAiInput" placeholder="Type your message..." autocomplete="off" maxlength="5000" />
        <button type="submit" class="tb-ai-send" aria-label="Send message">
          <i class="fa-solid fa-paper-plane"></i>
        </button>
      </form>
    </div>
    <div class="tb-ai-bubble" id="tbAiBubble" aria-label="Open CarryParcel AI" role="button">
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
  const typing = document.getElementById('tbAiTyping');
  const quickActions = document.getElementById('tbAiQuickActions');
  const errorEl = document.getElementById('tbAiError');
  const errorMsg = document.getElementById('tbAiErrorMsg');
  const retryBtn = document.getElementById('tbAiRetry');
  const handoffEl = document.getElementById('tbAiHandoff');
  const handoffContent = document.getElementById('tbAiHandoffContent');
  const newConvBtn = document.getElementById('tbAiNewConv');
  const chips = quickActions.querySelectorAll('.tb-ai-chip');

  let isOpen = false;
  let isSending = false;
  let lastError = null;

  function resolveApiBase() {
    var cfg = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) || '';
    if (!cfg) {
      if (window.location.origin && window.location.origin.indexOf('localhost') >= 0) {
        return 'http://localhost:4000/api';
      }
      return '/api';
    }
    if (cfg.charAt(cfg.length - 1) === '/') cfg = cfg.slice(0, -1);
    if (cfg.indexOf('/api') >= 0) return cfg;
    return cfg + '/api';
  }

  function addMessage(text, sender) {
    const div = document.createElement('div');
    div.className = 'tb-ai-msg ' + (sender === 'user' ? 'user' : 'bot');
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  function setTyping(v) {
    typing.style.display = v ? 'flex' : 'none';
    messages.scrollTop = messages.scrollHeight;
  }

  function setError(msg) {
    lastError = msg || 'Something went wrong. Please try again.';
    errorMsg.textContent = lastError;
    errorEl.style.display = 'flex';
  }

  function clearError() {
    lastError = null;
    errorEl.style.display = 'none';
  }

  function setHandoff(ticket) {
    let text = "You've been connected with CarryParcel Support.";
    if (ticket && ticket.ticketNumber) {
      text += ' Ticket: ' + ticket.ticketNumber + '.';
    }
    handoffContent.textContent = text;
    handoffEl.style.display = 'flex';
    input.disabled = true;
    form.querySelector('button[type="submit"]').disabled = true;
    chips.forEach((c) => (c.disabled = true));
  }

  function clearHandoff() {
    handoffEl.style.display = 'none';
    input.disabled = false;
    form.querySelector('button[type="submit"]').disabled = false;
    chips.forEach((c) => (c.disabled = false));
  }

  function resetConversation() {
    conversationId = 'web-' + Date.now();
    sessionStorage.setItem('tb_ai_conv_id', conversationId);
    messages.innerHTML = '';
    addMessage("Hi! I'm CarryParcel AI, your Customer Support Assistant. How can I help you today?", 'bot');
    clearHandoff();
    clearError();
    input.value = '';
    input.focus();
  }

  async function sendMessage(text) {
    if (!text || isSending) return;
    addMessage(text, 'user');
    input.value = '';
    setTyping(true);
    clearError();
    isSending = true;

    try {
      const base = resolveApiBase();
      const res = await fetch(base + '/support/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: text,
          conversationId: conversationId,
          screen: window.location.pathname || 'chat',
          channel: 'web',
        }),
      });

      const data = await res.json().catch(() => ({}));
      setTyping(false);

      if (!res.ok || data.success === false) {
        const msg = data.error || data.reply || 'Something went wrong. Please try again.';
        setError(msg);
        return;
      }

      const reply = data.message || data.reply || '';
      if (reply) addMessage(reply, 'bot');

      if (data.conversationId) {
        conversationId = data.conversationId;
        sessionStorage.setItem('tb_ai_conv_id', conversationId);
      }

      if (data.handoff) {
        setHandoff(data.ticket || null);
        return;
      }

      clearHandoff();
    } catch (e) {
      setTyping(false);
      setError('Network error. Please check your connection and try again.');
    } finally {
      isSending = false;
    }
  }

  bubble.addEventListener('click', function () {
    isOpen = !isOpen;
    windowEl.style.display = isOpen ? 'flex' : 'none';
    bubble.classList.toggle('active', isOpen);
    if (isOpen) {
      input.focus();
      messages.scrollTop = messages.scrollHeight;
    }
  });

  closeBtn.addEventListener('click', function () {
    isOpen = false;
    windowEl.style.display = 'none';
    bubble.classList.remove('active');
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    sendMessage(input.value.trim());
  });

  chips.forEach((chip) => {
    chip.addEventListener('click', function () {
      if (chip.disabled) return;
      sendMessage(chip.dataset.message || chip.textContent);
    });
  });

  retryBtn.addEventListener('click', function () {
    if (lastError && !isSending) {
      sendMessage(input.value.trim() || '');
    }
  });

  newConvBtn.addEventListener('click', resetConversation);

  input.addEventListener('keypress', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input.value.trim());
    }
  });

  window.TBAiAssistant = window.TBAiAssistant || {
    open: function () {
      isOpen = true;
      windowEl.style.display = 'flex';
      bubble.classList.add('active');
      input.focus();
    },
    close: function () {
      isOpen = false;
      windowEl.style.display = 'none';
      bubble.classList.remove('active');
    },
    sendMessage: sendMessage,
    reset: resetConversation,
  };
})();