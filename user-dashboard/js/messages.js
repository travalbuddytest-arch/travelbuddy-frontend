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

  let pendingPhoto = null;

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
  let dynamicIceServers = null;
  const failedMediaUrls = new Set();

  if (pendingAutoCall || pendingAcceptCallId) {
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('call');
    cleanUrl.searchParams.delete('acceptCall');
    window.history.replaceState({}, '', cleanUrl.toString());
  }

  const rtcConfig = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  };

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
        osc.frequency.value = 425;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.16, now + 0.04);
        gain.gain.linearRampToValueAtTime(0.16, now + 0.85);
        gain.gain.linearRampToValueAtTime(0, now + 0.95);
        osc.connect(gain).connect(ringbackCtx.destination);
        osc.start(now);
        osc.stop(now + 1);
      };
      beep();
      ringbackInterval = setInterval(beep, 2000);
    } catch (err) {
      console.error('Ringback tone failed:', err);
    }
  }

  function stopRingbackTone() {
    clearInterval(ringbackInterval);
    ringbackInterval = null;
    if (ringbackCtx) {
      try { ringbackCtx.close(); } catch (err) { }
      ringbackCtx = null;
    }
  }

  function formatTime(value) {
    if (window.TravelBuddyDate) return window.TravelBuddyDate.formatDateTime(value);
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
            <i class="fa-solid ${missed ? 'fa-phone-slash' : 'fa-mobile-screen-button'}"></i>
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
    socket = window.TravelBuddy.socket;
    if (!socket) return;

    socket.on('connect', () => {
      conversations.forEach((conversation) => socket.emit('conversation:join', { conversationId: conversation.id }));
    });
    socket.on('connect_error', (err) => window.showToast(err.message || 'Realtime connection failed.', 'error'));
    socket.on('conversation:update', mergeConversation);
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

  function bindCallSocketEvents() {
    socket.on('call:incoming', (payload) => {
      const { callId, conversationId, fromName, fromPhoto, fromCity, toCity, parcelNumber, iceServers } = payload;
      activeCall = { callId, conversationId, incoming: true, caller: { label: fromName, photo: fromPhoto } };
      dynamicIceServers = iceServers || null;

      const avatarEl = document.getElementById('incomingAvatar');
      if (fromPhoto) {
        avatarEl.innerHTML = `<img src="${escapeHTML(resolveMediaUrl(fromPhoto))}" class="tb-profile-photo">`;
      } else {
        avatarEl.textContent = fromName.split(' ').map(n => n[0]).join('').toUpperCase();
      }

      document.getElementById('incomingRole').textContent = fromName;
      document.getElementById('incomingPublicId').textContent = `Parcel #${parcelNumber}`;

      const routeInfo = document.getElementById('incomingRouteInfo');
      if (routeInfo && fromCity && toCity) {
        routeInfo.textContent = `${fromCity} -> ${toCity}`;
        routeInfo.classList.remove('hidden');
      }

      incomingCallModal.classList.remove('hidden');
      window.TravelBuddy.playRingtone?.();
    });

    socket.on('call:accept', async ({ callId }) => {
      if (!activeCall || String(activeCall.callId) !== String(callId)) return;
      try {
        stopRingbackTone();
        const pc = await createWebRTCPeerConnection(callId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc:offer', { callId, offer });
        setCallBar(true, activeConversation()?.other.label);
      } catch (err) {
        window.showToast('Could not start microphone audio.', 'error');
        socket.emit('call:end', { callId });
        cleanupCall();
      }
    });

    socket.on('call:reject', () => {
      window.showToast('Audio call rejected.', 'error');
      cleanupCall();
    });

    socket.on('call:end', () => cleanupCall());
    socket.on('call:busy', () => window.showToast('User is already on another call.', 'error'));

    socket.on('webrtc:offer', async ({ callId, offer }) => {
      try {
        const pc = await createWebRTCPeerConnection(callId);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc:answer', { callId, answer });
        setCallBar(true, activeCall?.caller?.label || 'Private Audio Call');
      } catch (err) {
        window.showToast('WebRTC audio connection failed.', 'error');
        socket.emit('call:end', { callId });
        cleanupCall();
      }
    });

    socket.on('webrtc:answer', async ({ answer }) => {
      if (peerConnection) await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('webrtc:ice-candidate', async ({ candidate }) => {
      if (peerConnection && candidate) await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    });
  }

  async function createWebRTCPeerConnection(callId) {
    const stream = await ensureMedia();
    const pcConfig = dynamicIceServers ? { iceServers: dynamicIceServers } : rtcConfig;
    peerConnection = new RTCPeerConnection(pcConfig);
    stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));
    peerConnection.ontrack = (event) => {
      remoteAudio.srcObject = event.streams[0];
    };
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) socket.emit('webrtc:ice-candidate', { callId, candidate: event.candidate });
    };
    return peerConnection;
  }

  async function ensureMedia() {
    if (localStream) return localStream;
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    return localStream;
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
    dynamicIceServers = null;
    setCallBar(false);
    incomingCallModal.classList.add('hidden');
    window.TravelBuddy.stopRingtone?.();
    stopRingbackTone();

    if (conversationId && String(conversationId) === String(activeConversationId)) {
      setTimeout(() => {
        loadMessages(conversationId).catch(() => {});
      }, 700);
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
      socket.emit('call:start', { conversationId: conversation.id }, (ack) => {
        if (!ack?.ok) {
          window.showToast(ack?.error || 'Could not start call.', 'error');
          cleanupCall();
          return;
        }
        activeCall = { callId: ack.callId, conversationId: conversation.id, incoming: false };
        dynamicIceServers = ack.iceServers || null;
        setRingingBar(true, conversation.other.label);
      });
    } catch (err) {
      window.showToast('Microphone permission is required for audio calls.', 'error');
    }
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
      socket.emit('call:accept', { callId }, (ack) => {
        if (!ack?.ok) {
          window.showToast(ack?.error || 'This call has already ended.', 'error');
          cleanupCall();
        }
      });
    } catch (err) {
      window.showToast('Microphone permission is required for audio calls.', 'error');
      socket.emit('call:reject', { callId });
      cleanupCall();
    }
  }

  document.getElementById('acceptCallBtn')?.addEventListener('click', async () => {
    if (!activeCall) return;
    incomingCallModal.classList.add('hidden');
    window.TravelBuddy.stopRingtone?.();
    try {
      await ensureMedia();
      socket.emit('call:accept', { callId: activeCall.callId });
    } catch (err) {
      window.showToast('Microphone permission is required for audio calls.', 'error');
      socket.emit('call:reject', { callId: activeCall.callId });
      cleanupCall();
    }
  });

  document.getElementById('rejectCallBtn')?.addEventListener('click', () => {
    if (!activeCall) return;
    socket.emit('call:reject', { callId: activeCall.callId });
    cleanupCall();
  });

  document.getElementById('endCallBtn')?.addEventListener('click', () => {
    if (activeCall) socket?.emit('call:end', { callId: activeCall.callId });
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

  async function handleSend(e) {
    e.preventDefault();
    const content = chatInput.value.trim();
    if ((!content && !pendingPhoto) || !activeConversationId) return;
    socket?.emit('typing:stop', { conversationId: activeConversationId });

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
        window.showToast(err.message || 'Could not send photo.', 'error');
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

  function handleTyping() {
    if (!activeConversationId || !socket?.connected) return;
    socket.emit('typing:start', { conversationId: activeConversationId });
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      socket.emit('typing:stop', { conversationId: activeConversationId });
    }, 900);
  }

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
    const deliveredEl = document.getElementById('contactProfileDelivered');
    deliveredEl.textContent = '-';
    document.getElementById('contactProfileInfo').innerHTML = `
      <div><strong>Route</strong><br>${escapeHTML(conversation.parcel.fromCity)} -> ${escapeHTML(conversation.parcel.toCity)}</div>
      <div><strong>Parcel</strong><br>${escapeHTML(conversation.parcel.parcelNumber)}</div>
    `;
    contactProfileOverlay.classList.remove('hidden');
    bindAvatarFallbacks(contactProfileOverlay);
  }

  chatAvatarBtn?.addEventListener('click', openContactProfile);
  chatIdentity?.addEventListener('click', openContactProfile);
  contactProfileClose?.addEventListener('click', () => contactProfileOverlay.classList.add('hidden'));

  connectSocket();
  loadConversations().catch((err) => {
    threadListEl.innerHTML = `<div class="messages-empty-state">${escapeHTML(err.message)}</div>`;
  });
})();
