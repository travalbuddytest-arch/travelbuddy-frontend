(function () {
  'use strict';

  const { API_ORIGIN, authHeaders, escapeHTML, getAuthToken } = window.TravelBuddy;
  const API_BASE = `${API_ORIGIN}/api/messages`;
  

  const messagesShell = document.getElementById('messagesShell');
  const threadListEl = document.getElementById('threadList');
  const conversationSearch = document.getElementById('conversationSearch');
  const chatEmpty = document.getElementById('chatEmpty');
  const chatActive = document.getElementById('chatActive');
  const chatMessages = document.getElementById('chatMessages');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  const navMsgBadge = document.getElementById('navMsgBadge');
  const chatBackBtn = document.getElementById('chatBackBtn');
  const audioCallBtn = document.getElementById('audioCallBtn');
  const attachBtn = document.getElementById('attachBtn');
  const typingIndicator = document.getElementById('typingIndicator');
  const incomingCallModal = document.getElementById('incomingCallModal');
  const activeCallBar = document.getElementById('activeCallBar');
  const remoteAudio = document.getElementById('remoteAudio');
  const chatAttachInput = document.getElementById('chatAttachInput');
  const imagePreviewModal = document.getElementById('imagePreviewModal');
  const imagePreviewImg = document.getElementById('imagePreviewImg');
  const imagePreviewClose = document.getElementById('imagePreviewClose');

  let socket = null;
  let conversations = [];
  let messagesByConversation = new Map();
  let activeConversationId = null;
  let typingTimer = null;
  let localStream = null;
  let peerConnection = null;
  let activeCall = null;
  let callTimer = null;
  let muted = false;
  let ringbackCtx = null;
  let ringbackInterval = null;
  let pendingAutoCall = new URLSearchParams(window.location.search).get('call') === 'audio';
  let pendingAcceptCallId = new URLSearchParams(window.location.search).get('acceptCall');
  let selectedImageForCompose = null;
  let lastScrollTop = 0;
  let isUserScrolling = false;
  let hasMoreMessages = true;

  // These two URL params ('call=audio' from "call this traveler" links, and
  // 'acceptCall=<id>' from the global incoming-call popup's "Answer"
  // button) are meant to fire ONCE on page load. Because they're a real
  // navigation (window.location.href = ...), the browser keeps them in the
  // address bar forever afterwards - so simply refreshing the page re-ran
  // this same code on every load and replayed the accept/start-call action
  // against a call that may have already ended, making the call bar pop
  // back up looking "active" again with no real call behind it. Stripping
  // them from the URL (without adding a history entry) right after reading
  // them means a refresh just reloads the conversation, nothing more.
  if (pendingAutoCall || pendingAcceptCallId) {
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('call');
    cleanUrl.searchParams.delete('acceptCall');
    window.history.replaceState({}, '', cleanUrl.toString());
  }

  // ============================================================
  // UTILITY FUNCTIONS
  // ============================================================

  /**
   * Resolves an image URL to ensure it uses the production backend
   * Handles: null, undefined, full URLs, relative /uploads paths, data URLs
   */
  function resolveImageUrl(url) {
    if (!url) return '';
    if (typeof url !== 'string') return '';
    if (url.startsWith('data:')) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/')) {
      return `${API_ORIGIN}${url}`;
    }
    return url;
  }

  /**
   * Validates if a file is an acceptable image (JPG/JPEG/PNG)
   */
  function isValidImageFile(file) {
    if (!file) return false;
    const validMimes = ['image/jpeg', 'image/png'];
    const validExts = ['.jpg', '.jpeg', '.png'];
    const hasValidMime = validMimes.includes(file.type);
    const hasValidExt = validExts.some(ext => file.name.toLowerCase().endsWith(ext));
    return hasValidMime && hasValidExt;
  }

  /**
   * Shows error toast for invalid image
   */
  function showImageError(type = 'format') {
    if (type === 'format') {
      window.showToast('Invalid image format. Please upload a JPG, JPEG, or PNG image.', 'error');
    } else if (type === 'size') {
      window.showToast('Image is too large. Please select a smaller file.', 'error');
    }
  }

  /**
   * Auto-scrolls to bottom only if user is near the bottom
   */
  function scrollToLatest(force = false) {
    if (!chatMessages) return;
    const isAtBottom = Math.abs(chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight) < 50;
    if (force || isAtBottom) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  /**
   * Detects if user is manually scrolling
   */
  function setupScrollDetection() {
    if (!chatMessages) return;
    chatMessages.addEventListener('scroll', () => {
      isUserScrolling = true;
      lastScrollTop = chatMessages.scrollTop;
      clearTimeout(window.scrollIdleTimer);
      window.scrollIdleTimer = setTimeout(() => {
        isUserScrolling = false;
      }, 1000);
    });
  }

  /**
   * Create an image element with error fallback
   */
  function createImageElement(src, alt = 'Message image') {
    const img = document.createElement('img');
    img.src = resolveImageUrl(src);
    img.alt = alt;
    img.className = 'msg-image';
    img.style.cursor = 'pointer';
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      showImagePreview(img.src);
    });
    img.addEventListener('error', () => {
      img.style.display = 'none';
    });
    return img;
  }

  /**
   * Show image preview modal
   */
  function showImagePreview(src) {
    if (!imagePreviewModal || !imagePreviewImg) return;
    imagePreviewImg.src = resolveImageUrl(src);
    imagePreviewModal.classList.remove('hidden');
  }

  /**
   * Close image preview modal
   */
  function closeImagePreview() {
    if (!imagePreviewModal) return;
    imagePreviewModal.classList.add('hidden');
    imagePreviewImg.src = '';
  }

  const rtcConfig = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  };

  // Classic telephone call-progress "ringback" tone - a short beep repeated
  // with a pause, i.e. "tu ... tu ... tu ...", heard only by the person who
  // placed the call while it's ringing on the other end. This is distinct
  // from the melodic incoming-call ringtone (window.TravelBuddy.playRingtone)
  // that the receiver hears - real phones use two different sounds for
  // "you're calling someone" vs. "someone is calling you", and mixing them
  // up (or reusing one for both) is what made the outgoing call feel silent/
  // unclear before.
  function playRingbackTone() {
    stopRingbackTone();
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      ringbackCtx = new Ctx();
      ringbackCtx.resume?.().catch(() => {});
      const beep = () => {
        if (!ringbackCtx) return;
        const now = ringbackCtx.currentTime;
        const osc = ringbackCtx.createOscillator();
        const gain = ringbackCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 425; // standard call-progress tone frequency
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.16, now + 0.04);
        gain.gain.linearRampToValueAtTime(0.16, now + 0.85);
        gain.gain.linearRampToValueAtTime(0, now + 0.95);
        osc.connect(gain).connect(ringbackCtx.destination);
        osc.start(now);
        osc.stop(now + 1);
      };
      beep();
      ringbackInterval = setInterval(beep, 2000); // "tu" (~1s) then ~1s silence, repeating
    } catch (err) {
      console.error('Ringback tone failed:', err);
    }
  }

  function stopRingbackTone() {
    clearInterval(ringbackInterval);
    ringbackInterval = null;
    if (ringbackCtx) {
      try { ringbackCtx.close(); } catch (err) { /* already closed */ }
      ringbackCtx = null;
    }
  }

  function formatTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const today = new Date();
    const sameDay = date.toDateString() === today.toDateString();
    return sameDay
      ? date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
      : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  function initials(identity) {
    return identity?.role === 'sender' ? 'VS' : 'VT';
  }

  function activeConversation() {
    return conversations.find((conversation) => String(conversation.id) === String(activeConversationId));
  }

  function updateBadge() {
    const count = conversations.reduce((sum, conversation) => sum + Number(conversation.unreadCount || 0), 0);
    if (!navMsgBadge) return;
    navMsgBadge.textContent = count;
    navMsgBadge.style.display = count ? '' : 'none';
  }

  function renderThreads() {
    if (!threadListEl) return;
    const query = (conversationSearch?.value || '').trim().toLowerCase();
    const filtered = conversations.filter((conversation) => {
      const haystack = [
        conversation.other.label,
        conversation.other.publicId,
        conversation.parcel.parcelNumber,
        conversation.parcel.fromCity,
        conversation.parcel.toCity,
        conversation.lastMessage,
      ].join(' ').toLowerCase();
      return !query || haystack.includes(query);
    });

    if (!filtered.length) {
      threadListEl.innerHTML = '<div class="messages-empty-state">No accepted parcel conversations yet.</div>';
      updateBadge();
      return;
    }

    threadListEl.innerHTML = filtered.map((conversation) => {
      const hasPhoto = conversation.other.profilePhoto;
      const photoStyle = hasPhoto ? `style="background-image:url(${resolveImageUrl(escapeHTML(conversation.other.profilePhoto))})" title="Profile photo"` : '';
      const photoContent = !hasPhoto ? escapeHTML(initials(conversation.other)) : '';
      return `
      <button class="thread-item ${conversation.id === activeConversationId ? 'active' : ''}" data-id="${escapeHTML(conversation.id)}">
        <div class="avatar avatar--sm" ${photoStyle}>${photoContent}</div>
        <div class="thread-meta">
          <div class="thread-name">
            <span>${escapeHTML(conversation.other.label)}</span>
            <time>${escapeHTML(formatTime(conversation.lastMessageAt))}</time>
          </div>
          <span class="thread-public">${escapeHTML(conversation.other.publicId)} - ${escapeHTML(conversation.parcel.parcelNumber)}</span>
          <span class="thread-route">${escapeHTML(conversation.parcel.fromCity)} -> ${escapeHTML(conversation.parcel.toCity)}</span>
          <span class="thread-snippet">${escapeHTML(conversation.lastMessage || 'Conversation is ready.')}</span>
        </div>
        <span class="thread-side">
          <span class="presence-dot ${conversation.other.online ? 'online' : ''}" title="${conversation.other.online ? 'Online' : 'Offline'}"></span>
          ${conversation.unreadCount ? `<span class="unread-count">${escapeHTML(conversation.unreadCount)}</span>` : ''}
        </span>
      </button>
    `;
    }).join('');

    threadListEl.querySelectorAll('.thread-item').forEach((el) => {
      el.addEventListener('click', () => openConversation(el.dataset.id));
    });
    updateBadge();
  }

  function renderHeader(conversation) {
    const chatAvatarEl = document.getElementById('chatAvatar');
    if (chatAvatarEl) {
      if (conversation.other.profilePhoto) {
        chatAvatarEl.style.backgroundImage = `url(${resolveImageUrl(conversation.other.profilePhoto)})`;
        chatAvatarEl.textContent = '';
        chatAvatarEl.classList.add('has-photo');
      } else {
        chatAvatarEl.style.backgroundImage = '';
        chatAvatarEl.textContent = initials(conversation.other);
        chatAvatarEl.classList.remove('has-photo');
      }
    }
    
    document.getElementById('chatName').textContent = conversation.other.label;
    document.getElementById('chatMeta').textContent = [
      conversation.other.publicId,
      conversation.other.online ? 'Online' : 'Offline',
      conversation.other.isVerified ? 'Identity Verified' : 'Verification pending',
      conversation.other.rating ? `${conversation.other.rating.toFixed(1)} Rating` : 'Not rated yet',
    ].join(' - ');
    const canAcceptParcel = conversation.myRole === 'traveler' && conversation.parcel.status === 'pending';
    document.getElementById('parcelBar').innerHTML = `
      <span class="parcel-bar-info">
        <strong>Parcel #${escapeHTML(conversation.parcel.parcelNumber)}</strong>
        <span>${escapeHTML(conversation.parcel.fromCity)} -> ${escapeHTML(conversation.parcel.toCity)}</span>
        <span>${escapeHTML(conversation.parcel.statusLabel)}</span>
      </span>
      ${canAcceptParcel ? `<button type="button" class="accept-parcel-btn" id="acceptParcelBtn">Accept this parcel</button>` : ''}
    `;
    audioCallBtn.disabled = conversation.status !== 'active';
    chatInput.disabled = conversation.status !== 'active';
    document.getElementById('acceptParcelBtn')?.addEventListener('click', handleAcceptParcel);
  }

  // Lets the traveler accept the parcel directly from the chat instead of
  // leaving the conversation to search for it again on the Pickup page.
  // Reuses the exact same backend endpoint the Pickup page's Accept button
  // calls (POST /api/postparcel/:id/accept), so acceptance rules (parcel
  // must still be pending, traveler can't accept their own parcel, etc.)
  // stay identical between the two entry points.
  async function handleAcceptParcel() {
    const conversation = activeConversation();
    if (!conversation || !conversation.parcel?.id) return;
    const btn = document.getElementById('acceptParcelBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Accepting...';
    }
    try {
      const res = await fetch(`${API_ORIGIN}/api/postparcel/${encodeURIComponent(conversation.parcel.id)}/accept`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not accept parcel.');
      window.showToast('Parcel accepted. You can track the journey from Track Parcel.', 'success');
      // The server also pushes a conversation:update over the socket to both
      // participants, which will refresh the parcel bar/status automatically.
      // This is just a fallback for when the socket isn't connected.
      if (!socket?.connected) {
        await loadConversations();
      }
    } catch (err) {
      window.showToast(err.message, 'error');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Accept this parcel';
      }
    }
  }

  function renderMessageTicks(status) {
    if (status === 'read') return '<i class="fa-solid fa-check-double msg-tick msg-tick--read" title="Seen"></i>';
    if (status === 'delivered') return '<i class="fa-solid fa-check-double msg-tick" title="Delivered"></i>';
    return '<i class="fa-solid fa-check msg-tick" title="Sent"></i>';
  }

  /**
   * Format call log message for display
   */
  function formatCallLogMessage(content) {
    // Convert internal call log strings to user-friendly display
    const lowerContent = (content || '').toLowerCase();
    
    if (lowerContent.includes('missed')) {
      return { icon: 'fa-phone-slash', label: '✕ Missed call', error: true };
    } else if (lowerContent.includes('declined')) {
      return { icon: 'fa-phone-slash', label: '✕ Call declined', error: true };
    } else if (lowerContent.includes('incoming')) {
      return { icon: 'fa-phone', label: '☎ Incoming call', ok: true };
    } else if (lowerContent.includes('outgoing')) {
      return { icon: 'fa-phone', label: '☎ Outgoing call', ok: true };
    } else if (lowerContent.includes('duration')) {
      // Extract duration if present: "Call - 02:34"
      const durationMatch = content.match(/\d{1,2}:\d{2}/);
      if (durationMatch) {
        return { icon: 'fa-phone', label: `☎ Voice call • ${durationMatch[0]}`, ok: true };
      }
      return { icon: 'fa-phone', label: '☎ Voice call', ok: true };
    }
    
    return { icon: 'fa-phone', label: '☎ ' + content, ok: true };
  }

  function renderMessages() {
    const messages = messagesByConversation.get(activeConversationId) || [];
    const conversation = activeConversation();
    
    chatMessages.innerHTML = messages.map((message) => {
      if (message.messageType === 'call') {
        const callInfo = formatCallLogMessage(message.content);
        return `
          <div class="call-log-row">
            <span class="call-log-pill ${callInfo.error ? 'error' : callInfo.ok ? 'success' : ''}">
              <i class="fa-solid ${callInfo.icon}"></i>
              <span>${escapeHTML(callInfo.label)}</span>
              <span class="call-log-time">${escapeHTML(formatTime(message.createdAt))}</span>
            </span>
          </div>`;
      }
      
      // Handle image messages
      if (message.messageType === 'image' || message.imageUrl) {
        return `
          <div class="msg-bubble ${message.fromMe ? 'me' : 'them'}" data-id="${escapeHTML(message.id)}">
            <img class="msg-image" src="${resolveImageUrl(escapeHTML(message.imageUrl || message.content))}" alt="Message image" style="cursor:pointer;" data-src="${resolveImageUrl(escapeHTML(message.imageUrl || message.content))}" />
            <span class="msg-time">${escapeHTML(formatTime(message.createdAt))}${message.fromMe ? ` ${renderMessageTicks(message.status)}` : ''}</span>
          </div>`;
      }
      
      // Regular text messages
      return `
        <div class="msg-bubble ${message.fromMe ? 'me' : 'them'}" data-id="${escapeHTML(message.id)}">
          ${escapeHTML(message.content)}
          <span class="msg-time">${escapeHTML(formatTime(message.createdAt))}${message.fromMe ? ` ${renderMessageTicks(message.status)}` : ''}</span>
        </div>`;
    }).join('');
    
    // Attach click handlers for images
    chatMessages.querySelectorAll('.msg-image').forEach((img) => {
      img.addEventListener('click', (e) => {
        e.stopPropagation();
        const src = img.getAttribute('data-src');
        if (src) showImagePreview(src);
      });
    });
    
    // Auto-scroll to latest
    setTimeout(() => scrollToLatest(), 0);
  }

  async function loadMessages(conversationId) {
    const res = await fetch(`${API_BASE}/conversations/${encodeURIComponent(conversationId)}/messages`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load messages.');
    messagesByConversation.set(conversationId, data.messages || []);
    renderMessages();
  }

  async function markRead(conversationId) {
    const conversation = conversations.find((item) => String(item.id) === String(conversationId));
    if (conversation) conversation.unreadCount = 0;
    renderThreads();
    socket?.emit('messages:read', { conversationId });
    await fetch(`${API_BASE}/conversations/${encodeURIComponent(conversationId)}/read`, {
      method: 'POST',
      headers: authHeaders(),
    }).catch(() => {});
  }

  async function openConversation(id) {
    activeConversationId = id;
    const conversation = activeConversation();
    if (!conversation) return;

    chatEmpty.classList.add('hidden');
    chatActive.classList.remove('hidden');
    messagesShell.classList.add('chat-open');
    renderHeader(conversation);
    renderThreads();
    socket?.emit('conversation:join', { conversationId: id });

    try {
      await loadMessages(id);
      await markRead(id);
      chatInput.focus();
    } catch (err) {
      window.showToast(err.message, 'error');
    }
  }

  async function loadConversations() {
    const params = new URLSearchParams(window.location.search);
    const parcel = params.get('parcel');
    const conversationId = params.get('conversation');
    const url = parcel
      ? `${API_BASE}/conversations?parcel=${encodeURIComponent(parcel)}`
      : `${API_BASE}/conversations`;
    const res = await fetch(url, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load conversations.');
    conversations = data.conversations || [];
    renderThreads();
    if (conversations.length) {
      const requested = conversationId && conversations.some((c) => String(c.id) === String(conversationId));
      await openConversation(requested ? conversationId : conversations[0].id);
      if (pendingAutoCall) {
        pendingAutoCall = false;
        setTimeout(startCall, 350);
      }
      if (pendingAcceptCallId) {
        const callId = pendingAcceptCallId;
        pendingAcceptCallId = null;
        autoAcceptCall(callId);
      }
    }
  }

  function mergeConversation(update) {
    const index = conversations.findIndex((conversation) => String(conversation.id) === String(update.id));
    if (index >= 0) conversations[index] = update;
    else conversations.unshift(update);
    conversations.sort((a, b) => new Date(b.lastMessageAt || b.updatedAt) - new Date(a.lastMessageAt || a.updatedAt));
    if (String(update.id) === String(activeConversationId)) renderHeader(update);
    renderThreads();
  }

  function connectSocket() {
    if (!window.io) return;
    // The REST API authenticates every request with the Bearer token from
    // localStorage (see authHeaders()) - the socket connection was only
    // sending withCredentials cookies and no token, so if the cookie wasn't
    // present/valid for any reason (cross-origin cookie settings, an older
    // session, etc.) the socket handshake had nothing to authenticate with
    // and the server rejected it with "Login required", even though the
    // page itself had already loaded fine over REST. Sending the same
    // Bearer token the REST calls use keeps both in sync.
    const token = getAuthToken();
    socket = window.io(APP_CONFIG.SOCKET_URL, {
      withCredentials: true,
      auth: token ? { token } : {},
      reconnection: true,
      reconnectionAttempts: Infinity,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      conversations.forEach((conversation) => socket.emit('conversation:join', { conversationId: conversation.id }));
    });
    socket.on('connect_error', (err) => window.showToast(err.message || 'Realtime connection failed.', 'error'));
    socket.on('conversation:update', mergeConversation);
    socket.on('presence:update', ({ userId, online }) => {
      conversations = conversations.map((conversation) => {
        if (String(conversation.other.userId) === String(userId)) conversation.other.online = online;
        return conversation;
      });
      loadConversations().catch(() => renderThreads());
    });
    socket.on('message:new', ({ message, conversationId }) => {
      const list = messagesByConversation.get(conversationId) || [];
      if (!list.some((item) => String(item.id) === String(message.id))) {
        list.push(message);
        messagesByConversation.set(conversationId, list);
      }
      if (String(conversationId) === String(activeConversationId)) {
        renderMessages();
        markRead(conversationId);
      }
    });
    socket.on('messages:read', ({ conversationId }) => {
      const list = messagesByConversation.get(conversationId) || [];
      list.forEach((message) => {
        if (message.fromMe) message.status = 'read';
      });
      if (String(conversationId) === String(activeConversationId)) renderMessages();
    });
    socket.on('typing:start', ({ conversationId }) => {
      if (String(conversationId) === String(activeConversationId)) typingIndicator.classList.remove('hidden');
    });
    socket.on('typing:stop', ({ conversationId }) => {
      if (String(conversationId) === String(activeConversationId)) typingIndicator.classList.add('hidden');
    });
    bindCallSocketEvents();
  }

  function sendViaRest(payload) {
    return fetch(`${API_BASE}/conversations/${encodeURIComponent(payload.conversationId)}/messages`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    }).then((res) => res.json().then((data) => {
      if (!res.ok) throw new Error(data.error || 'Could not send message.');
      return data.message;
    }));
  }

  async function handleSend(e) {
    e.preventDefault();
    const content = chatInput.value.trim();
    const hasImage = selectedImageForCompose !== null;
    
    if (!content && !hasImage) return;
    if (!activeConversationId) return;
    
    const clientMessageId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    
    // Send text message
    if (content && !hasImage) {
      const payload = { conversationId: activeConversationId, content, messageType: 'text', clientMessageId };
      chatInput.value = '';
      socket?.emit('typing:stop', { conversationId: activeConversationId });

      if (socket?.connected) {
        socket.emit('message:send', payload, async (ack) => {
          if (ack?.ok) return;
          window.showToast(ack?.error || 'Could not send message.', 'error');
        });
        return;
      }

      try {
        const message = await sendViaRest(payload);
        const list = messagesByConversation.get(activeConversationId) || [];
        list.push(message);
        messagesByConversation.set(activeConversationId, list);
        renderMessages();
      } catch (err) {
        window.showToast(err.message, 'error');
      }
      return;
    }
    
    // Send image message
    if (selectedImageForCompose) {
      try {
        const reader = new FileReader();
        reader.onload = (event) => {
          const imageData = event.target.result;
          const payload = {
            conversationId: activeConversationId,
            content: content || '[Image]',
            imageUrl: imageData,
            messageType: 'image',
            clientMessageId
          };
          
          chatInput.value = '';
          selectedImageForCompose = null;
          removeComposedImage();
          socket?.emit('typing:stop', { conversationId: activeConversationId });

          if (socket?.connected) {
            socket.emit('message:send', payload, async (ack) => {
              if (ack?.ok) return;
              window.showToast(ack?.error || 'Could not send image.', 'error');
            });
            return;
          }

          sendViaRest(payload).then((message) => {
            const list = messagesByConversation.get(activeConversationId) || [];
            list.push(message);
            messagesByConversation.set(activeConversationId, list);
            renderMessages();
          }).catch((err) => {
            window.showToast(err.message, 'error');
          });
        };
        reader.readAsDataURL(selectedImageForCompose);
      } catch (err) {
        window.showToast('Could not send image: ' + err.message, 'error');
      }
    }
  }

  function removeComposedImage() {
    selectedImageForCompose = null;
    const preview = document.getElementById('composeImagePreview');
    if (preview) preview.remove();
  }

  function handleAttachClick() {
    chatAttachInput?.click();
  }

  function handleAttachInputChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!isValidImageFile(file)) {
      showImageError('format');
      e.target.value = '';
      return;
    }

    // Check file size (5MB limit)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      showImageError('size');
      e.target.value = '';
      return;
    }

    // Read and display preview
    const reader = new FileReader();
    reader.onload = (event) => {
      selectedImageForCompose = file;
      const preview = document.createElement('img');
      preview.id = 'composeImagePreview';
      preview.className = 'compose-image-preview';
      preview.src = event.target.result;
      preview.alt = 'Image preview';
      
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'compose-image-remove';
      removeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      removeBtn.setAttribute('aria-label', 'Remove image');
      removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        removeComposedImage();
        chatAttachInput.value = '';
      });

      preview.style.position = 'relative';
      preview.style.display = 'inline-block';
      
      const existingPreview = document.getElementById('composeImagePreview');
      if (existingPreview) existingPreview.remove();
      
      const existingRemoveBtn = document.querySelector('.compose-image-remove');
      if (existingRemoveBtn) existingRemoveBtn.remove();

      chatForm?.insertBefore(preview, chatForm.firstChild);
      chatForm?.insertBefore(removeBtn, chatForm.firstChild);
    };
    reader.onerror = () => {
      window.showToast('Could not read image file.', 'error');
      e.target.value = '';
    };
    reader.readAsDataURL(file);
  }

  function handleTyping() {
    if (!activeConversationId || !socket?.connected) return;
    socket.emit('typing:start', { conversationId: activeConversationId });
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      socket.emit('typing:stop', { conversationId: activeConversationId });
    }, 900);
  }

  async function ensureMedia() {
    if (localStream) return localStream;
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    return localStream;
  }

  async function createPeerConnection(callId) {
    const stream = await ensureMedia();
    peerConnection = new RTCPeerConnection(rtcConfig);
    stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));
    peerConnection.ontrack = (event) => {
      remoteAudio.srcObject = event.streams[0];
    };
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) socket.emit('ice-candidate', { callId, candidate: event.candidate });
    };
    return peerConnection;
  }

  function setCallBar(visible, peerLabel) {
    activeCallBar.classList.toggle('hidden', !visible);
    if (peerLabel) document.getElementById('activeCallPeer').textContent = peerLabel;
    clearInterval(callTimer);
    if (!visible) return;
    const start = Date.now();
    callTimer = setInterval(() => {
      const seconds = Math.floor((Date.now() - start) / 1000);
      const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
      const secs = String(seconds % 60).padStart(2, '0');
      document.getElementById('activeCallTime').textContent = `${mins}:${secs}`;
    }, 1000);
  }

  // Shown the moment the callee's phone starts ringing (call-user ack'd),
  // NOT once the call is answered - so it deliberately does not start the
  // timer. Only the "connected" call actually gets a running clock; while
  // it's still ringing this just shows a static "Ringing..." label and
  // plays a ringback tone, so the caller can't mistake "the other person
  // hasn't picked up yet" for "we're already on a call".
  function setRingingBar(visible, peerLabel) {
    activeCallBar.classList.toggle('hidden', !visible);
    clearInterval(callTimer);
    if (!visible) return;
    if (peerLabel) document.getElementById('activeCallPeer').textContent = peerLabel;
    document.getElementById('activeCallTime').textContent = 'Ringing...';
    playRingbackTone();
  }

  function cleanupCall() {
    const conversationId = activeCall?.conversationId;
    peerConnection?.close();
    peerConnection = null;
    localStream?.getTracks().forEach((track) => track.stop());
    localStream = null;
    activeCall = null;
    setCallBar(false);
    incomingCallModal.classList.add('hidden');
    window.TravelBuddy.stopRingtone?.();
    stopRingbackTone();

    // The "Missed voice call" / "Voice call - 1:23" chat bubble is written
    // by the server (see logCallMessage in messagingSocket.js) and pushed
    // over the socket as a 'message:new' event, which normally lands here
    // right around the same time as the reject-call/end-call event that
    // triggers this cleanup. But that write happens right after the call
    // notification, not before it - so if this tab's socket briefly drops,
    // or the two events just interleave unluckily, the chat could be left
    // showing whatever it had before the call instead of the call summary.
    // Re-fetching the open conversation from the server a moment later
    // guarantees it catches up regardless of what happened over the socket,
    // without the person needing to refresh the page themselves.
    if (conversationId && String(conversationId) === String(activeConversationId)) {
      setTimeout(() => {
        loadMessages(conversationId).catch(() => {});
      }, 700);
    }
  }

  function bindCallSocketEvents() {
    socket.on('incoming-call', ({ callId, conversationId, caller }) => {
      activeCall = { callId, conversationId, incoming: true, caller };
      document.getElementById('incomingAvatar').textContent = initials(caller);
      document.getElementById('incomingRole').textContent = caller.label;
      document.getElementById('incomingPublicId').textContent = caller.publicId;
      incomingCallModal.classList.remove('hidden');
      window.TravelBuddy.playRingtone?.();
    });

    socket.on('accept-call', async ({ callId }) => {
      if (!activeCall || String(activeCall.callId) !== String(callId)) return;
      try {
        stopRingbackTone();
        const pc = await createPeerConnection(callId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc-offer', { callId, offer });
        setCallBar(true, activeConversation()?.other.label);
      } catch (err) {
        window.showToast('Could not start microphone audio.', 'error');
        socket.emit('end-call', { callId });
        cleanupCall();
      }
    });

    socket.on('reject-call', () => {
      window.showToast('Audio call rejected.', 'error');
      cleanupCall();
    });

    socket.on('end-call', () => cleanupCall());
    socket.on('user-busy', () => window.showToast('User is already on another call.', 'error'));

    socket.on('webrtc-offer', async ({ callId, offer }) => {
      try {
        const pc = await createPeerConnection(callId);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc-answer', { callId, answer });
        setCallBar(true, activeCall?.caller?.label || 'Private Audio Call');
      } catch (err) {
        window.showToast('WebRTC audio connection failed.', 'error');
        socket.emit('end-call', { callId });
        cleanupCall();
      }
    });

    socket.on('webrtc-answer', async ({ answer }) => {
      if (peerConnection) await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('ice-candidate', async ({ candidate }) => {
      if (peerConnection && candidate) await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    });
  }

  async function autoAcceptCall(callId) {
    if (!socket?.connected) {
      socket?.once('connect', () => autoAcceptCall(callId));
      return;
    }
    const conversation = activeConversation();
    try {
      await ensureMedia();
      activeCall = { callId, conversationId: conversation?.id, incoming: true, caller: conversation?.other };
      socket.emit('accept-call', { callId }, (ack) => {
        if (!ack?.ok) {
          window.showToast(ack?.error || 'This call has already ended.', 'error');
          cleanupCall();
        }
        // On success, the call bar/timer is started by the webrtc-offer
        // handler below once the caller's audio connection actually
        // arrives - same as the manual "Accept" button path - so both
        // ways of answering a call start the clock at the same real
        // moment instead of the moment accept-call was merely acknowledged.
      });
    } catch (err) {
      window.showToast('Microphone permission is required for audio calls.', 'error');
      socket.emit('reject-call', { callId });
      cleanupCall();
    }
  }

  async function startCall() {
    const conversation = activeConversation();
    if (!conversation || conversation.status !== 'active') {
      window.showToast('Audio calls are available only during active deliveries.', 'error');
      return;
    }
    if (!socket?.connected) {
      window.showToast('Realtime connection is not ready.', 'error');
      return;
    }
    try {
      await ensureMedia();
      socket.emit('call-user', { conversationId: conversation.id }, (ack) => {
        if (!ack?.ok) {
          window.showToast(ack?.error || 'Could not start call.', 'error');
          cleanupCall();
          return;
        }
        activeCall = { callId: ack.callId, conversationId: conversation.id, incoming: false };
        setRingingBar(true, conversation.other.label);
      });
    } catch (err) {
      window.showToast('Microphone permission is required for audio calls.', 'error');
    }
  }

  document.getElementById('acceptCallBtn')?.addEventListener('click', async () => {
    if (!activeCall) return;
    incomingCallModal.classList.add('hidden');
    window.TravelBuddy.stopRingtone?.();
    try {
      await ensureMedia();
      socket.emit('accept-call', { callId: activeCall.callId });
    } catch (err) {
      window.showToast('Microphone permission is required for audio calls.', 'error');
      socket.emit('reject-call', { callId: activeCall.callId });
      cleanupCall();
    }
  });

  document.getElementById('rejectCallBtn')?.addEventListener('click', () => {
    if (!activeCall) return;
    socket.emit('reject-call', { callId: activeCall.callId });
    cleanupCall();
  });

  document.getElementById('endCallBtn')?.addEventListener('click', () => {
    if (activeCall) socket?.emit('end-call', { callId: activeCall.callId });
    cleanupCall();
  });

  document.getElementById('muteCallBtn')?.addEventListener('click', () => {
    muted = !muted;
    localStream?.getAudioTracks().forEach((track) => { track.enabled = !muted; });
    document.getElementById('muteCallBtn').innerHTML = muted
      ? '<i class="fa-solid fa-microphone-slash"></i>'
      : '<i class="fa-solid fa-microphone"></i>';
  });

  chatForm?.addEventListener('submit', handleSend);
  chatInput?.addEventListener('input', handleTyping);
  conversationSearch?.addEventListener('input', renderThreads);
  chatBackBtn?.addEventListener('click', () => messagesShell.classList.remove('chat-open'));
  audioCallBtn?.addEventListener('click', startCall);
  attachBtn?.addEventListener('click', handleAttachClick);
  chatAttachInput?.addEventListener('change', handleAttachInputChange);

  // Image preview modal handlers
  imagePreviewClose?.addEventListener('click', closeImagePreview);
  imagePreviewModal?.addEventListener('click', (e) => {
    if (e.target === imagePreviewModal) closeImagePreview();
  });

  // Setup scroll detection
  setupScrollDetection();

  connectSocket();
  loadConversations().catch((err) => {
    threadListEl.innerHTML = `<div class="messages-empty-state">${escapeHTML(err.message)}</div>`;
  });
})();
