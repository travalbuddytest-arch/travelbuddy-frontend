(function () {
  'use strict';

  const { API_ORIGIN, authHeaders, escapeHTML, getAuthToken, resolveMediaUrl } = window.TravelBuddy;
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
  const chatPhotoInput = document.getElementById('chatPhotoInput');
  const typingIndicator = document.getElementById('typingIndicator');
  const incomingCallModal = document.getElementById('incomingCallModal');
  const activeCallBar = document.getElementById('activeCallBar');
  const remoteAudio = document.getElementById('remoteAudio');
  const chatAvatarBtn = document.getElementById('chatAvatar');
  const chatIdentity = document.getElementById('chatIdentity');
  const chatMenuWrap = document.getElementById('chatMenuWrap');
  const chatMenuBtn = document.getElementById('chatMenuBtn');
  const contactProfileOverlay = document.getElementById('contactProfileOverlay');
  const contactProfileClose = document.getElementById('contactProfileClose');
  const chatConfirmOverlay = document.getElementById('chatConfirmOverlay');
  const chatConfirmTitle = document.getElementById('chatConfirmTitle');
  const chatConfirmText = document.getElementById('chatConfirmText');
  const chatConfirmCancel = document.getElementById('chatConfirmCancel');
  const chatConfirmOk = document.getElementById('chatConfirmOk');

  let pendingPhoto = null; // { file, dataUrl } staged for the next send

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
  const failedMediaUrls = new Set();

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
    if (!identity) return 'TB';
    const label = (identity.label || '').trim();
    const genericLabels = ['Verified Traveler', 'Verified Sender', 'Admin', ''];
    if (label && !genericLabels.includes(label)) {
      return label.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
    }
    return identity.role === 'sender' ? 'VS' : 'VT';
  }

  function avatarMarkup(identity) {
    const photo = identity?.profilePhoto || identity?.avatar || identity?.photo;
    if (!photo) return escapeHTML(initials(identity));
    const src = resolveMediaUrl ? resolveMediaUrl(photo) : photo;
    return `<img class="tb-profile-photo" src="${escapeHTML(src)}" alt="Profile photo" data-fallback="${escapeHTML(initials(identity))}">`;
  }

  function bindAvatarFallbacks(root) {
    (root || document).querySelectorAll('.avatar img.tb-profile-photo').forEach((img) => {
      if (img.dataset.fallbackBound) return;
      img.dataset.fallbackBound = '1';
      img.addEventListener('error', () => {
        const avatar = img.closest('.avatar');
        if (!avatar) return;
        avatar.classList.remove('has-photo');
        avatar.textContent = img.dataset.fallback || 'TB';
      }, { once: true });
    });
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

    threadListEl.innerHTML = filtered.map((conversation) => `
      <button class="thread-item ${conversation.id === activeConversationId ? 'active' : ''}" data-id="${escapeHTML(conversation.id)}">
        <div class="avatar avatar--sm ${conversation.other?.profilePhoto || conversation.other?.avatar || conversation.other?.photo ? 'has-photo' : ''}">${avatarMarkup(conversation.other)}</div>
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
    `).join('');

    threadListEl.querySelectorAll('.thread-item').forEach((el) => {
      el.addEventListener('click', () => openConversation(el.dataset.id));
    });
    bindAvatarFallbacks(threadListEl);
    updateBadge();
  }

  function renderHeader(conversation) {
    const chatAvatar = document.getElementById('chatAvatar');
    chatAvatar.innerHTML = avatarMarkup(conversation.other);
    chatAvatar.classList.toggle('has-photo', Boolean(conversation.other?.profilePhoto || conversation.other?.avatar || conversation.other?.photo));
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
    bindAvatarFallbacks(document.getElementById('chatActive'));
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

  function renderMessage(message) {
    if (message.messageType === 'call') {
      const missed = /missed|declined|busy/i.test(message.content);
      return `
        <div class="call-log-row">
          <span class="call-log-pill">
            <i class="fa-solid ${missed ? 'fa-phone-slash' : 'fa-phone'}"></i>
            ${escapeHTML(message.content)}
            <span class="call-log-time">${escapeHTML(formatTime(message.createdAt))}</span>
          </span>
        </div>`;
    }
    if (message.messageType === 'image') {
      const imageUrl = resolveMediaUrl ? resolveMediaUrl(message.content) : message.content;
      if (!imageUrl || failedMediaUrls.has(imageUrl)) {
        return `
          <div class="msg-bubble has-image media-unavailable ${message.fromMe ? 'me' : 'them'}" data-id="${escapeHTML(message.id)}">
            <span class="media-unavailable-text">Media unavailable</span>
            <span class="msg-time">${escapeHTML(formatTime(message.createdAt))}${message.fromMe ? ` ${renderMessageTicks(message.status)}` : ''}</span>
          </div>`;
      }
      return `
        <div class="msg-bubble has-image ${message.fromMe ? 'me' : 'them'}" data-id="${escapeHTML(message.id)}">
          <img class="msg-bubble-image" src="${escapeHTML(imageUrl)}" alt="Photo" loading="lazy" />
          <span class="media-unavailable-text hidden">Media unavailable</span>
          <span class="msg-time">${escapeHTML(formatTime(message.createdAt))}${message.fromMe ? ` ${renderMessageTicks(message.status)}` : ''}</span>
        </div>`;
    }
    return `
      <div class="msg-bubble ${message.fromMe ? 'me' : 'them'}" data-id="${escapeHTML(message.id)}">
        ${escapeHTML(message.content)}
        <span class="msg-time">${escapeHTML(formatTime(message.createdAt))}${message.fromMe ? ` ${renderMessageTicks(message.status)}` : ''}</span>
      </div>`;
  }

  function renderMessages() {
    const messages = messagesByConversation.get(activeConversationId) || [];
    chatMessages.innerHTML = messages.length
      ? messages.map(renderMessage).join('')
      : '<div class="messages-empty-state">No messages in this chat.</div>';
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function showNewMessagesIndicator() {
    if (document.getElementById('newMessagesIndicator')) return;
    const indicator = document.createElement('button');
    indicator.type = 'button';
    indicator.id = 'newMessagesIndicator';
    indicator.className = 'new-messages-indicator';
    indicator.textContent = 'New messages';
    indicator.addEventListener('click', () => {
      chatMessages.scrollTop = chatMessages.scrollHeight;
      indicator.remove();
    });
    chatMessages.appendChild(indicator);
  }

  function appendMessage(message) {
    chatMessages.querySelector('.messages-empty-state')?.remove();
    const isNearBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 80;
    chatMessages.insertAdjacentHTML('beforeend', renderMessage(message));
    if (isNearBottom || message.fromMe) chatMessages.scrollTop = chatMessages.scrollHeight;
    else showNewMessagesIndicator();
    return isNearBottom;
  }

  chatMessages?.addEventListener('error', (e) => {
    const img = e.target.closest?.('.msg-bubble-image');
    if (!img) return;
    failedMediaUrls.add(img.src);
    const bubble = img.closest('.msg-bubble');
    bubble?.classList.add('media-unavailable');
    bubble?.querySelector('.media-unavailable-text')?.classList.remove('hidden');
    img.remove();
  }, true);

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
    if (socket?.connected) {
      conversations.forEach((conversation) => socket.emit('conversation:join', { conversationId: conversation.id }));
    }
    if (conversations.length) {
      const requested = conversationId && conversations.some((c) => String(c.id) === String(conversationId));
      const isMobileLayout = window.matchMedia('(max-width: 720px)').matches;
      // On mobile the thread list and an open chat can't share the screen, so
      // landing on a chat automatically (instead of the conversation list)
      // made it look like the two views were stuck open together. Only
      // auto-open a conversation on mobile when the person deep-linked to
      // one specifically (?conversation=<id>); otherwise let them pick from
      // the list first, same as WhatsApp/Telegram. Desktop still has room
      // for both panels, so it keeps auto-selecting the first conversation.
      const mustOpen = requested || !isMobileLayout || pendingAutoCall || pendingAcceptCallId;
      if (mustOpen) {
        await openConversation(requested ? conversationId : conversations[0].id);
      }
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
    // common.js has already created the authenticated dashboard socket. Reuse
    // it for messages/calls so this page does not maintain two connections.
    socket = window.TravelBuddy.socket;
    if (!socket) return;

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
      renderThreads();
    });
    socket.on('message:new', ({ message, conversationId }) => {
      const list = messagesByConversation.get(conversationId) || [];
      const isNew = !list.some((item) => String(item.id) === String(message.id));
      if (isNew) {
        list.push(message);
        messagesByConversation.set(conversationId, list);
      }
      if (isNew && String(conversationId) === String(activeConversationId)) {
        const wasNearBottom = appendMessage(message);
        if (wasNearBottom || message.fromMe) markRead(conversationId);
      }
    });
    socket.on('messages:read', ({ conversationId }) => {
      const list = messagesByConversation.get(conversationId) || [];
      list.forEach((message) => {
        if (message.fromMe) message.status = 'read';
      });
      if (String(conversationId) === String(activeConversationId)) renderMessages();
    });
    socket.on('messages:cleared', ({ conversationId }) => {
      applyClearedConversation(conversationId, false);
    });
    socket.on('conversation:deleted', ({ conversationId }) => {
      applyDeletedConversation(conversationId, false);
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

  function sendMediaViaRest(payload) {
    return fetch(`${API_BASE}/conversations/${encodeURIComponent(payload.conversationId)}/media`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        base64: payload.content,
        messageType: payload.messageType,
        clientMessageId: payload.clientMessageId,
      }),
    }).then((res) => res.json().then((data) => {
      if (!res.ok) throw new Error(data.error || 'Could not send media.');
      return data.message;
    }));
  }

  function sendOneMessage(payload) {
    return new Promise((resolve, reject) => {
      if (socket?.connected) {
        socket.emit('message:send', payload, (ack) => {
          if (ack?.ok) resolve(ack.message || null);
          else reject(new Error(ack?.error || 'Could not send message.'));
        });
        return;
      }
      sendViaRest(payload).then(resolve).catch(reject);
    });
  }

  async function handleSend(e) {
    e.preventDefault();
    const content = chatInput.value.trim();
    if ((!content && !pendingPhoto) || !activeConversationId) return;
    socket?.emit('typing:stop', { conversationId: activeConversationId });

    // A staged photo goes out as its own image message first, then any
    // typed caption follows as a normal text message — mirrors how
    // WhatsApp/Telegram handle "photo + caption" without needing a
    // combined message type the backend doesn't have yet.
    if (pendingPhoto) {
      const photoPayload = {
        conversationId: activeConversationId,
        content: pendingPhoto.dataUrl,
        messageType: 'image',
        clientMessageId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      };
      clearPendingPhoto();
      try {
        const message = await sendMediaViaRest(photoPayload);
        if (message) {
          const list = messagesByConversation.get(activeConversationId) || [];
          if (!list.some((item) => String(item.id) === String(message.id))) list.push(message);
          messagesByConversation.set(activeConversationId, list);
          renderMessages();
        }
      } catch (err) {
        window.showToast(err.message || 'Could not send photo. Ask the backend team to accept messageType "image".', 'error');
      }
    }

    if (!content) return;
    chatInput.value = '';
    const textPayload = {
      conversationId: activeConversationId,
      content,
      messageType: 'text',
      clientMessageId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    };
    try {
      const message = await sendOneMessage(textPayload);
      if (message) {
        const list = messagesByConversation.get(activeConversationId) || [];
        if (!list.some((item) => String(item.id) === String(message.id))) list.push(message);
        messagesByConversation.set(activeConversationId, list);
        renderMessages();
      }
    } catch (err) {
      window.showToast(err.message, 'error');
    }
  }

  function clearPendingPhoto() {
    pendingPhoto = null;
    chatPhotoInput.value = '';
    document.getElementById('attachPreview')?.classList.add('hidden');
  }

  function stagePhotoFile(file) {
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png'];
    const validExtension = ['.jpg', '.jpeg', '.png'].some((extension) => file.name.toLowerCase().endsWith(extension));
    if (!allowed.includes(file.type) || !validExtension) {
      window.showToast('Invalid image format\nPlease upload a JPG, JPEG, or PNG image.', 'error');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      window.showToast('Choose an image smaller than 8 MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Downscale to a reasonable chat-photo size before turning it into
        // a data URL so a full-resolution phone photo doesn't blow past
        // the backend's JSON body-size limit.
        const maxSide = 1280;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        pendingPhoto = { dataUrl: canvas.toDataURL('image/jpeg', 0.8), name: file.name };
        const preview = document.getElementById('attachPreview');
        document.getElementById('attachPreviewImg').src = pendingPhoto.dataUrl;
        document.getElementById('attachPreviewName').textContent = file.name;
        preview?.classList.remove('hidden');
        chatInput.focus();
      };
      img.src = reader.result;
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
  let conversationSearchTimer;
  conversationSearch?.addEventListener('input', () => {
    clearTimeout(conversationSearchTimer);
    conversationSearchTimer = setTimeout(renderThreads, 180);
  });
  chatBackBtn?.addEventListener('click', () => messagesShell.classList.remove('chat-open'));
  audioCallBtn?.addEventListener('click', startCall);

  // ---------- Photo attachment ----------
  attachBtn?.addEventListener('click', () => chatPhotoInput.click());
  chatPhotoInput?.addEventListener('change', (e) => stagePhotoFile(e.target.files?.[0]));
  document.getElementById('attachPreviewRemove')?.addEventListener('click', clearPendingPhoto);
  chatMessages?.addEventListener('click', (e) => {
    const img = e.target.closest('.msg-bubble-image');
    if (img) window.open(img.src, '_blank', 'noopener');
  });

  // ---------- Chat header "more" menu ----------
  chatMenuBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    chatMenuWrap.classList.toggle('open');
    chatMenuBtn.setAttribute('aria-expanded', chatMenuWrap.classList.contains('open') ? 'true' : 'false');
  });
  document.addEventListener('click', () => chatMenuWrap?.classList.remove('open'));

  // ---------- Contact profile popup (item 3) ----------
  function openContactProfile() {
    const conversation = activeConversation();
    if (!conversation) return;
    const contactAvatar = document.getElementById('contactProfileAvatar');
    contactAvatar.innerHTML = avatarMarkup(conversation.other);
    contactAvatar.classList.toggle('has-photo', Boolean(conversation.other?.profilePhoto || conversation.other?.avatar || conversation.other?.photo));
    document.getElementById('contactProfileName').textContent = conversation.other.label;
    document.getElementById('contactProfileRole').textContent = [
      conversation.other.publicId,
      conversation.other.isVerified ? 'Identity Verified' : 'Verification pending',
    ].join(' - ');
    document.getElementById('contactProfileRating').textContent = conversation.other.rating ? conversation.other.rating.toFixed(1) : '-';
    // deliveredCount isn't part of the conversation payload today - show a
    // sensible placeholder and try to fetch the real figure if the backend
    // exposes it, without blocking the popup from opening.
    const deliveredEl = document.getElementById('contactProfileDelivered');
    deliveredEl.textContent = conversation.other.deliveredCount ?? '-';
    document.getElementById('contactProfileInfo').innerHTML = `
      <div><strong>Route</strong><br>${escapeHTML(conversation.parcel.fromCity)} -> ${escapeHTML(conversation.parcel.toCity)}</div>
      <div><strong>Parcel</strong><br>${escapeHTML(conversation.parcel.parcelNumber)}</div>
    `;
    contactProfileOverlay.classList.remove('hidden');
    bindAvatarFallbacks(contactProfileOverlay);
    if (conversation.other.id) {
      fetch(`${API_ORIGIN}/api/users/${encodeURIComponent(conversation.other.id)}/profile-summary`, { headers: authHeaders() })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.deliveredCount != null) deliveredEl.textContent = data.deliveredCount;
        })
        .catch(() => {}); // profile-summary endpoint may not exist yet - popup already shows what we have
    }
  }
  chatAvatarBtn?.addEventListener('click', openContactProfile);
  chatIdentity?.addEventListener('click', openContactProfile);
  chatIdentity?.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openContactProfile(); } });
  contactProfileClose?.addEventListener('click', () => contactProfileOverlay.classList.add('hidden'));
  contactProfileOverlay?.addEventListener('click', (e) => { if (e.target === contactProfileOverlay) contactProfileOverlay.classList.add('hidden'); });
  document.getElementById('chatMenuViewProfile')?.addEventListener('click', () => { chatMenuWrap.classList.remove('open'); openContactProfile(); });

  // ---------- Clear chat / Delete chat (item 7) ----------
  function chatActionErrorMessage(status, fallback) {
    if (status === 401) return 'Please log in again.';
    if (status === 403) return fallback === 'clear' ? "You don't have permission to clear this chat." : "You don't have permission to delete this chat.";
    if (status === 404) return 'Conversation not found.';
    if (status >= 500) return fallback === 'clear' ? 'Unable to clear the chat.' : 'Unable to delete the chat.';
    return fallback === 'clear' ? 'Unable to clear the chat.' : 'Unable to delete the chat.';
  }

  function applyClearedConversation(conversationId, notify) {
    if (!conversationId) return;
    messagesByConversation.set(String(conversationId), []);
    const conversation = conversations.find((c) => String(c.id) === String(conversationId));
    if (conversation) {
      conversation.lastMessage = '';
      conversation.lastMessageAt = new Date().toISOString();
      conversation.unreadCount = 0;
    }
    if (String(conversationId) === String(activeConversationId)) renderMessages();
    renderThreads();
    if (notify) window.showToast('Chat cleared.', 'success');
  }

  function applyDeletedConversation(conversationId, notify) {
    if (!conversationId) return;
    const deletedId = String(conversationId);
    conversations = conversations.filter((c) => String(c.id) !== deletedId);
    messagesByConversation.delete(deletedId);
    if (String(activeConversationId) === deletedId) {
      activeConversationId = null;
      chatActive.classList.add('hidden');
      chatEmpty.classList.remove('hidden');
      messagesShell.classList.remove('chat-open');
    }
    renderThreads();
    if (notify) window.showToast('Chat deleted.', 'success');
  }

  function askConfirm(title, text) {
    return new Promise((resolve) => {
      chatConfirmTitle.textContent = title;
      chatConfirmText.textContent = text;
      chatConfirmOverlay.classList.remove('hidden');
      const cleanup = (result) => {
        chatConfirmOverlay.classList.add('hidden');
        chatConfirmOk.removeEventListener('click', onOk);
        chatConfirmCancel.removeEventListener('click', onCancel);
        resolve(result);
      };
      const onOk = () => cleanup(true);
      const onCancel = () => cleanup(false);
      chatConfirmOk.addEventListener('click', onOk);
      chatConfirmCancel.addEventListener('click', onCancel);
    });
  }

  document.getElementById('chatMenuClear')?.addEventListener('click', async () => {
    chatMenuWrap.classList.remove('open');
    if (!activeConversationId) return;
    const ok = await askConfirm('Clear this chat?', 'This removes every message in this conversation for both of you. This cannot be undone.');
    if (!ok) return;
    const clearBtn = document.getElementById('chatMenuClear');
    clearBtn.disabled = true;
    try {
      const targetId = activeConversationId;
      const res = await fetch(`${API_BASE}/conversations/${encodeURIComponent(activeConversationId)}/messages`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) {
        throw new Error(chatActionErrorMessage(res.status, 'clear'));
      }
      await res.json().catch(() => ({}));
      applyClearedConversation(targetId, true);
    } catch (err) {
      window.showToast(err.name === 'TypeError' ? 'Unable to connect. Please try again.' : (err.message || 'Unable to clear the chat.'), 'error');
    } finally {
      clearBtn.disabled = false;
    }
  });

  document.getElementById('chatMenuDelete')?.addEventListener('click', async () => {
    chatMenuWrap.classList.remove('open');
    if (!activeConversationId) return;
    const ok = await askConfirm('Delete this chat?', 'This deletes the entire conversation for both of you, like deleting a chat in WhatsApp. This cannot be undone.');
    if (!ok) return;
    const deleteBtn = document.getElementById('chatMenuDelete');
    deleteBtn.disabled = true;
    try {
      const targetId = activeConversationId;
      const res = await fetch(`${API_BASE}/conversations/${encodeURIComponent(targetId)}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) {
        throw new Error(chatActionErrorMessage(res.status, 'delete'));
      }
      await res.json().catch(() => ({}));
      applyDeletedConversation(targetId, true);
    } catch (err) {
      window.showToast(err.name === 'TypeError' ? 'Unable to connect. Please try again.' : (err.message || 'Unable to delete the chat.'), 'error');
    } finally {
      deleteBtn.disabled = false;
    }
  });

  connectSocket();
  loadConversations().catch((err) => {
    threadListEl.innerHTML = `<div class="messages-empty-state">${escapeHTML(err.message)}</div>`;
  });
})();
