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

  chatMessages?.addEventListener('scroll', () => {
    const isAtBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 50;
    if (isAtBottom) {
      document.getElementById('newMessagesIndicator')?.remove();
    }
  });

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
  const chatMenuViewParcel = document.getElementById('chatMenuViewParcel');
  const contactProfileOverlay = document.getElementById('contactProfileOverlay');
  const contactProfileClose = document.getElementById('contactProfileClose');
  const chatConfirmOverlay = document.getElementById('chatConfirmOverlay');
  const chatConfirmTitle = document.getElementById('chatConfirmTitle');
  const chatConfirmText = document.getElementById('chatConfirmText');
  const chatConfirmCancel = document.getElementById('chatConfirmCancel');
  const chatConfirmOk = document.getElementById('chatConfirmOk');

  // Review & Receipt Elements
  const reviewModal = document.getElementById('reviewModal');
  const reviewModalClose = document.getElementById('reviewModalClose');
  const reviewTargetName = document.getElementById('reviewTargetName');
  const starRatingBox = document.getElementById('starRatingBox');
  const starRatingLabel = document.getElementById('starRatingLabel');
  const reviewComment = document.getElementById('reviewComment');
  const submitReviewBtn = document.getElementById('submitReviewBtn');

  const receiptGenModal = document.getElementById('receiptGenModal');
  const receiptPreviewModal = document.getElementById('receiptPreviewModal');
  const receiptPreviewContent = document.getElementById('receiptPreviewContent');
  const downloadReceiptBtn = document.getElementById('downloadReceiptBtn');
  const closeReceiptPreviewBtn = document.getElementById('closeReceiptPreviewBtn');
  const receiptPreviewModalClose = document.getElementById('receiptPreviewModalClose');

  let pendingPhoto = null;
  let currentRating = 0;
  let activeParcelFullData = null;

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

  // Pagination state
  let currentPages = new Map(); // conversationId -> lastLoadedPage
  let loadingOlder = false;
  let hasMoreMessages = new Map(); // conversationId -> boolean

  chatMessages?.addEventListener('scroll', () => {
    const isAtBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 50;
    if (isAtBottom) {
      document.getElementById('newMessagesIndicator')?.remove();
    }

    // Load older messages when scrolling near top
    if (chatMessages.scrollTop < 100 && !loadingOlder && activeConversationId && hasMoreMessages.get(activeConversationId) !== false) {
      loadOlderMessages(activeConversationId);
    }
  });

  async function loadOlderMessages(conversationId) {
    if (loadingOlder) return;
    loadingOlder = true;

    const nextPage = (currentPages.get(conversationId) || 1) + 1;
    const oldScrollHeight = chatMessages.scrollHeight;

    try {
      const res = await fetch(`${API_BASE}/conversations/${encodeURIComponent(conversationId)}/messages?page=${nextPage}&limit=30`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load older messages.');

      const newMessages = data.messages || [];
      if (newMessages.length === 0) {
        hasMoreMessages.set(conversationId, false);
      } else {
        const existing = messagesByConversation.get(conversationId) || [];
        // Prepend new messages, avoiding duplicates
        const combined = [...newMessages, ...existing].filter((msg, index, self) =>
          index === self.findIndex((m) => String(m.id) === String(msg.id))
        );
        messagesByConversation.set(conversationId, combined);
        currentPages.set(conversationId, nextPage);

        renderMessages(false); // Don't auto-scroll to bottom

        // Adjust scroll to maintain position
        const newScrollHeight = chatMessages.scrollHeight;
        chatMessages.scrollTop = newScrollHeight - oldScrollHeight;
      }
    } catch (err) {
      console.error(err);
    } finally {
      loadingOlder = false;
    }
  }

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
    if (sameDay) {
      return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
    }
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  function formatDateHeader(value) {
    const date = new Date(value);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return 'Today';
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
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
    const query = (conversationSearch?.value || '').trim();

    // If backend search is supported, we already have filtered list from API
    // but we can still do a local filter for responsiveness.
    const localQuery = query.toLowerCase();
    const filtered = conversations.filter((conversation) => {
      const haystack = [
        conversation.other.label,
        conversation.other.publicId,
        conversation.parcel.parcelNumber,
        conversation.parcel.fromCity,
        conversation.parcel.toCity,
        conversation.lastMessage,
      ].join(' ').toLowerCase();
      return !localQuery || haystack.includes(localQuery);
    });

    if (!filtered.length) {
      const msg = query ? 'No results found for your search.' : 'No accepted parcel conversations yet.';
      threadListEl.innerHTML = `<div class="messages-empty-state">${escapeHTML(msg)}</div>`;
      updateBadge();
      return;
    }

    threadListEl.innerHTML = filtered.map((conversation) => {
      const isOnline = conversation.other?.online;
      const statusLabel = conversation.parcel.statusLabel;
      const statusClass = conversation.parcel.status === 'delivered' ? 'success' : '';

      return `
        <button class="thread-item ${conversation.id === activeConversationId ? 'active' : ''}" data-id="${escapeHTML(conversation.id)}">
          <div class="avatar avatar--sm ${conversation.other?.profilePhoto ? 'has-photo' : ''}">
            ${avatarMarkup(conversation.other)}
            <span class="presence-dot ${isOnline ? 'online' : ''}"></span>
          </div>
          <div class="thread-meta">
            <div class="thread-name">
              <span>${escapeHTML(conversation.other.label)}</span>
              <time>${escapeHTML(formatTime(conversation.lastMessageAt))}</time>
            </div>
            <div class="thread-public">
              <span class="role-tag ${conversation.other.role}">${conversation.other.role === 'sender' ? 'Sender' : 'Traveler'}</span>
              ${escapeHTML(conversation.other.publicId)} • ${escapeHTML(conversation.parcel.parcelNumber)}
            </div>
            <span class="thread-route">${escapeHTML(conversation.parcel.fromCity)} → ${escapeHTML(conversation.parcel.toCity)}</span>
            <span class="thread-snippet">${escapeHTML(conversation.lastMessage || 'Conversation is ready.')}</span>
            <div class="thread-status ${statusClass}">● ${escapeHTML(statusLabel)}</div>
          </div>
          <span class="thread-side">
            ${conversation.unreadCount ? `<span class="unread-count">${escapeHTML(conversation.unreadCount)}</span>` : ''}
          </span>
        </button>
      `;
    }).join('');

    threadListEl.querySelectorAll('.thread-item').forEach((el) => {
      el.addEventListener('click', () => openConversation(el.dataset.id));
    });
    bindAvatarFallbacks(threadListEl);
    updateBadge();
  }

  function renderHeader(conversation) {
    const chatAvatar = document.getElementById('chatAvatar');
    chatAvatar.innerHTML = avatarMarkup(conversation.other);
    chatAvatar.classList.toggle('has-photo', Boolean(conversation.other?.profilePhoto));

    document.getElementById('chatName').textContent = conversation.other.label;

    const roleLabel = conversation.other.role === 'sender' ? 'Sender' : 'Traveler';
    const ratingText = conversation.other.rating ? ` • ${conversation.other.rating.toFixed(1)} ★` : '';
    const verifiedText = conversation.other.isVerified ? ' • Verified' : '';

    document.getElementById('chatMeta').textContent = `${roleLabel}${ratingText}${verifiedText}`;

    const isTerminal = ['delivered', 'cancelled', 'cancelled_by_sender', 'cancelled_by_traveler', 'cancelled_by_system'].includes(conversation.parcel.status);
    const canAcceptParcel = conversation.myRole === 'traveler' && conversation.parcel.status === 'pending';

    let parcelBarContent = `
      <div class="parcel-bar-info">
        <span class="parcel-bar-icon"><i class="fa-solid fa-box"></i></span>
        <div class="parcel-bar-text">
          <strong>Parcel #${escapeHTML(conversation.parcel.parcelNumber)}</strong>
          <span>${escapeHTML(conversation.parcel.fromCity)} → ${escapeHTML(conversation.parcel.toCity)}</span>
        </div>
        <div class="parcel-bar-status ${isTerminal ? 'terminal' : ''}">
          ${isTerminal ? '<i class="fa-solid fa-lock"></i> ' : ''}${escapeHTML(conversation.parcel.statusLabel)}
        </div>
      </div>
      <div class="parcel-bar-actions">
        ${canAcceptParcel ? `<button type="button" class="accept-parcel-btn" id="acceptParcelBtn">Accept this parcel</button>` : ''}
        <button type="button" class="btn-ghost btn-sm" id="viewParcelDetailBtn"><i class="fa-solid fa-up-right-from-square"></i> Details</button>
      </div>
    `;

    if (isTerminal && conversation.parcel.status === 'delivered') {
      parcelBarContent += `
        <div class="parcel-bar-delivered-actions">
          <button type="button" class="btn-primary btn-sm" id="chatReviewBtn"><i class="fa-solid fa-star"></i> Rate Experience</button>
          <button type="button" class="btn-ghost btn-sm" id="chatReceiptBtn"><i class="fa-solid fa-receipt"></i> Receipt</button>
        </div>
      `;
    }

    document.getElementById('parcelBar').innerHTML = parcelBarContent;
    document.getElementById('parcelBar').classList.toggle('is-terminal', isTerminal);

    audioCallBtn.disabled = isTerminal || conversation.status !== 'active';
    chatInput.disabled = isTerminal || conversation.status !== 'active';
    attachBtn.disabled = isTerminal || conversation.status !== 'active';

    if (isTerminal) {
      chatInput.placeholder = 'Conversation is closed.';
      chatForm.classList.add('is-closed');
      const closedHint = document.createElement('div');
      closedHint.className = 'chat-closed-hint';
      closedHint.innerHTML = `<i class="fa-solid fa-lock"></i> This conversation is closed for new messages. You can still view your previous history.`;
      const existingHint = chatActive.querySelector('.chat-closed-hint');
      if (existingHint) existingHint.remove();
      chatActive.insertBefore(closedHint, chatForm);
    } else {
      chatInput.placeholder = 'Type a message...';
      chatForm.classList.remove('is-closed');
      chatActive.querySelector('.chat-closed-hint')?.remove();
    }

    // Bind actions
    document.getElementById('acceptParcelBtn')?.addEventListener('click', handleAcceptParcel);
    document.getElementById('viewParcelDetailBtn')?.addEventListener('click', () => {
      window.location.href = `parcel-details.html?id=${encodeURIComponent(conversation.parcel.id)}`;
    });
    document.getElementById('chatReviewBtn')?.addEventListener('click', openReviewModal);
    document.getElementById('chatReceiptBtn')?.addEventListener('click', handleGenerateReceipt);

    bindAvatarFallbacks(document.getElementById('chatActive'));
  }

  function renderMessageTicks(status) {
    if (status === 'read') return '<i class="fa-solid fa-check-double msg-tick msg-tick--read" title="Seen"></i>';
    if (status === 'delivered') return '<i class="fa-solid fa-check-double msg-tick" title="Delivered"></i>';
    return '<i class="fa-solid fa-check msg-tick" title="Sent"></i>';
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
      const icon = missed ? 'fa-phone-slash' : 'fa-phone';
      return `
        <div class="call-log-row">
          <div class="call-log-pill ${missed ? 'missed' : ''}">
            <i class="fa-solid ${icon}"></i>
            <span>${escapeHTML(message.content)}</span>
            <span class="call-log-time">${escapeHTML(new Date(message.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }))}</span>
          </div>
        </div>`;
    }
    if (message.messageType === 'image') {
      const imageUrl = resolveMediaUrl ? resolveMediaUrl(message.content) : message.content;
      if (!imageUrl || failedMediaUrls.has(imageUrl)) {
        return `
          <div class="msg-bubble has-image media-unavailable ${message.fromMe ? 'me' : 'them'}" data-id="${escapeHTML(message.id)}">
            <span class="media-unavailable-text">Media unavailable</span>
            <span class="msg-time">${escapeHTML(new Date(message.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }))}${message.fromMe ? ` ${renderMessageTicks(message.status)}` : ''}</span>
          </div>`;
      }
      return `
        <div class="msg-bubble has-image ${message.fromMe ? 'me' : 'them'}" data-id="${escapeHTML(message.id)}">
          <img class="msg-bubble-image" src="${escapeHTML(imageUrl)}" alt="Photo" loading="lazy" />
          <span class="media-unavailable-text hidden">Media unavailable</span>
          <span class="msg-time">${escapeHTML(new Date(message.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }))}${message.fromMe ? ` ${renderMessageTicks(message.status)}` : ''}</span>
        </div>`;
    }
    return `
      <div class="msg-bubble ${message.fromMe ? 'me' : 'them'}" data-id="${escapeHTML(message.id)}">
        <div class="msg-content">${escapeHTML(message.content)}</div>
        <span class="msg-time">${escapeHTML(new Date(message.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }))}${message.fromMe ? ` ${renderMessageTicks(message.status)}` : ''}</span>
      </div>`;
  }

  function renderMessages(shouldScrollToBottom = true) {
    const messages = messagesByConversation.get(activeConversationId) || [];
    if (!messages.length) {
      chatMessages.innerHTML = '<div class="messages-empty-state">No messages yet. Start the conversation!</div>';
      return;
    }

    let html = '';
    let lastDate = null;

    messages.forEach((message) => {
      const msgDate = new Date(message.createdAt).toDateString();
      if (msgDate !== lastDate) {
        html += `<div class="date-separator"><span>${escapeHTML(formatDateHeader(message.createdAt))}</span></div>`;
        lastDate = msgDate;
      }
      html += renderMessage(message);
    });

    chatMessages.innerHTML = html;

    if (shouldScrollToBottom) {
      // Scroll to bottom immediately and also after a short delay for safety
      chatMessages.scrollTop = chatMessages.scrollHeight;
      setTimeout(() => { chatMessages.scrollTop = chatMessages.scrollHeight; }, 50);
    }
  }

  function showNewMessagesIndicator() {
    if (document.getElementById('newMessagesIndicator')) return;
    const indicator = document.createElement('button');
    indicator.type = 'button';
    indicator.id = 'newMessagesIndicator';
    indicator.className = 'new-messages-indicator';
    indicator.innerHTML = '<i class="fa-solid fa-arrow-down"></i> New messages';
    indicator.addEventListener('click', () => {
      chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
      indicator.remove();
    });
    chatActive.appendChild(indicator); // Append to chatActive, not chatMessages so it stays fixed
  }

  function appendMessage(message, conversationId) {
    const list = messagesByConversation.get(conversationId) || [];
    // Deduplication by ID
    if (list.some(m => String(m.id) === String(message.id))) return false;

    list.push(message);
    messagesByConversation.set(conversationId, list);

    if (String(conversationId) === String(activeConversationId)) {
      const isNearBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 150;

      const lastMsgDate = list.length > 1 ? new Date(list[list.length - 2].createdAt).toDateString() : null;
      const newMsgDate = new Date(message.createdAt).toDateString();

      if (newMsgDate !== lastMsgDate) {
        chatMessages.insertAdjacentHTML('beforeend', `<div class="date-separator"><span>${escapeHTML(formatDateHeader(message.createdAt))}</span></div>`);
      }

      chatMessages.insertAdjacentHTML('beforeend', renderMessage(message));

      if (message.fromMe) {
        // Immediate scroll for own messages
        chatMessages.scrollTop = chatMessages.scrollHeight;
        document.getElementById('newMessagesIndicator')?.remove();
        return true;
      } else if (isNearBottom) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return true;
      } else {
        showNewMessagesIndicator();
      }
    }
    return false;
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
    currentPages.set(conversationId, 1);
    hasMoreMessages.set(conversationId, true);

    const res = await fetch(`${API_BASE}/conversations/${encodeURIComponent(conversationId)}/messages?page=1&limit=50`, {
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

  async function loadConversations(q = '') {
    const params = new URLSearchParams(window.location.search);
    const parcel = params.get('parcel');
    const conversationId = params.get('conversation');

    let url = `${API_BASE}/conversations`;
    const searchParams = new URLSearchParams();
    if (parcel) searchParams.set('parcel', parcel);
    if (q) searchParams.set('q', q);

    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;

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
      // On desktop, auto-open the first one if none requested.
      // On mobile, only auto-open if specifically requested via URL.
      const mustOpen = requested || (!isMobileLayout && !q) || pendingAutoCall || pendingAcceptCallId;
      if (mustOpen) {
        await openConversation(requested ? conversationId : conversations[0].id);
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
      const wasNearBottom = appendMessage(message, conversationId);
      if (wasNearBottom && String(conversationId) === String(activeConversationId)) {
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

  chatBackBtn?.addEventListener('click', () => {
    messagesShell.classList.remove('chat-open');
    activeConversationId = null;
    renderThreads();
  });

  audioCallBtn?.addEventListener('click', startCall);

  let conversationSearchTimer;
  conversationSearch?.addEventListener('input', () => {
    clearTimeout(conversationSearchTimer);
    const q = (conversationSearch.value || '').trim();
    conversationSearchTimer = setTimeout(() => {
      loadConversations(q).catch(err => {
        window.showToast('Search failed: ' + err.message, 'error');
      });
    }, 400);
  });

  chatMenuViewParcel?.addEventListener('click', () => {
    const conv = activeConversation();
    if (conv) window.location.href = `parcel-details.html?id=${encodeURIComponent(conv.parcel.id)}`;
    chatMenuWrap.classList.remove('open');
  });

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
    contactAvatar.classList.toggle('has-photo', Boolean(conversation.other?.profilePhoto));
    document.getElementById('contactProfileName').textContent = conversation.other.label;
    document.getElementById('contactProfileRole').textContent = [
      conversation.other.publicId,
      conversation.other.isVerified ? 'Identity Verified' : 'Verification pending',
    ].join(' - ');
    document.getElementById('contactProfileRating').textContent = conversation.other.rating ? conversation.other.rating.toFixed(1) : '-';

    document.getElementById('contactProfileInfo').innerHTML = `
      <div><strong>Route</strong><br>${escapeHTML(conversation.parcel.fromCity)} → ${escapeHTML(conversation.parcel.toCity)}</div>
      <div><strong>Parcel ID</strong><br>${escapeHTML(conversation.parcel.parcelNumber)}</div>
      <div><strong>Status</strong><br>${escapeHTML(conversation.parcel.statusLabel)}</div>
    `;
    contactProfileOverlay.classList.remove('hidden');
    bindAvatarFallbacks(contactProfileOverlay);
  }

  chatAvatarBtn?.addEventListener('click', openContactProfile);
  chatIdentity?.addEventListener('click', openContactProfile);
  contactProfileClose?.addEventListener('click', () => contactProfileOverlay.classList.add('hidden'));

  chatMenuBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    chatMenuWrap.classList.toggle('open');
  });

  document.addEventListener('click', () => {
    chatMenuWrap.classList.remove('open');
  });

  document.getElementById('chatMenuViewProfile')?.addEventListener('click', () => {
    openContactProfile();
    chatMenuWrap.classList.remove('open');
  });

  document.getElementById('chatMenuClear')?.addEventListener('click', () => {
    chatMenuWrap.classList.remove('open');
    chatConfirmTitle.textContent = 'Clear Chat History';
    chatConfirmText.textContent = 'Are you sure you want to clear all messages in this conversation? This cannot be undone.';
    chatConfirmOverlay.classList.remove('hidden');
    chatConfirmOk.onclick = async () => {
      try {
        const res = await fetch(`${API_BASE}/conversations/${encodeURIComponent(activeConversationId)}/messages`, {
          method: 'DELETE',
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error('Failed to clear chat.');
        messagesByConversation.set(activeConversationId, []);
        renderMessages();
        chatConfirmOverlay.classList.add('hidden');
      } catch (err) {
        window.showToast(err.message, 'error');
      }
    };
  });

  document.getElementById('chatMenuDelete')?.addEventListener('click', () => {
    chatMenuWrap.classList.remove('open');
    chatConfirmTitle.textContent = 'Delete Conversation';
    chatConfirmText.textContent = 'Permanently delete this conversation and all its messages?';
    chatConfirmOverlay.classList.remove('hidden');
    chatConfirmOk.onclick = async () => {
      try {
        const res = await fetch(`${API_BASE}/conversations/${encodeURIComponent(activeConversationId)}`, {
          method: 'DELETE',
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error('Failed to delete conversation.');
        conversations = conversations.filter(c => String(c.id) !== String(activeConversationId));
        activeConversationId = null;
        chatActive.classList.add('hidden');
        chatEmpty.classList.remove('hidden');
        messagesShell.classList.remove('chat-open');
        renderThreads();
        chatConfirmOverlay.classList.add('hidden');
      } catch (err) {
        window.showToast(err.message, 'error');
      }
    };
  });

  chatConfirmCancel?.addEventListener('click', () => chatConfirmOverlay.classList.add('hidden'));

  // ---------- Attachment Handling ----------
  attachBtn?.addEventListener('click', () => chatPhotoInput.click());

  chatPhotoInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return window.showToast('Please select an image file.', 'error');
    if (file.size > 5 * 1024 * 1024) return window.showToast('Image size should be less than 5MB.', 'error');

    const reader = new FileReader();
    reader.onload = (ev) => {
      pendingPhoto = { file, dataUrl: ev.target.result };
      document.getElementById('attachPreviewImg').src = pendingPhoto.dataUrl;
      document.getElementById('attachPreviewName').textContent = file.name;
      document.getElementById('attachPreview').classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('attachPreviewRemove')?.addEventListener('click', clearPendingPhoto);

  // ---------- Review Logic ----------
  function openReviewModal() {
    const conv = activeConversation();
    if (!conv) return;
    reviewTargetName.textContent = conv.other.label;
    currentRating = 0;
    updateStarUI(0);
    reviewComment.value = '';
    reviewModal.classList.remove('hidden');
  }

  function updateStarUI(rating) {
    starRatingBox.querySelectorAll('i').forEach(star => {
      const r = parseInt(star.dataset.rating);
      star.className = r <= rating ? 'fa-solid fa-star' : 'fa-regular fa-star';
    });
    const labels = ['Select a rating', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
    starRatingLabel.textContent = labels[rating] || labels[0];
  }

  starRatingBox?.addEventListener('click', (e) => {
    const star = e.target.closest('i');
    if (star) {
      currentRating = parseInt(star.dataset.rating);
      updateStarUI(currentRating);
    }
  });

  submitReviewBtn?.addEventListener('click', async () => {
    if (!currentRating) return window.showToast('Please select a star rating.', 'warning');
    const conv = activeConversation();
    if (!conv) return;

    window.TravelBuddy.setButtonLoading(submitReviewBtn, true, 'Submitting...');
    try {
      const res = await fetch(`${API_ORIGIN}/api/postparcel/review`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          parcelId: conv.parcel.id,
          rating: currentRating,
          comment: reviewComment.value.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not submit review.');
      window.showToast('Review submitted successfully!', 'success');
      reviewModal.classList.add('hidden');
      // Hide review button from UI if needed
      document.getElementById('chatReviewBtn')?.remove();
    } catch (err) {
      window.showToast(err.message, 'error');
    } finally {
      window.TravelBuddy.setButtonLoading(submitReviewBtn, false);
    }
  });

  reviewModalClose?.addEventListener('click', () => reviewModal.classList.add('hidden'));

  // ---------- Receipt Logic ----------
  async function handleGenerateReceipt() {
    const conv = activeConversation();
    if (!conv) return;

    receiptGenModal.classList.remove('hidden');
    const runStage = async (id, ms) => {
      const el = document.getElementById(`stage-${id}`);
      await new Promise(r => setTimeout(r, ms));
      el.classList.add('completed');
      el.querySelector('i').className = 'fa-solid fa-circle-check';
    };

    try {
      // Fetch full parcel data for receipt
      const res = await fetch(`${API_ORIGIN}/api/postparcel/${encodeURIComponent(conv.parcel.id)}`, {
        headers: authHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not fetch parcel details.');
      activeParcelFullData = data.parcel;

      await runStage('details', 600);
      await runStage('timeline', 800);
      await runStage('financials', 600);
      await runStage('final', 1000);

      renderReceiptPreview(activeParcelFullData);
      receiptGenModal.classList.add('hidden');
      receiptPreviewModal.classList.remove('hidden');
    } catch (err) {
      window.showToast(err.message, 'error');
      receiptGenModal.classList.add('hidden');
    }
  }

  function renderReceiptPreview(p) {
    const user = JSON.parse(localStorage.getItem('travelBuddyUser') || '{}');
    const isSender = String(p.sender?._id || p.sender) === String(user.id || user._id);
    const timelineHtml = [
      { l: 'Parcel Posted', t: p.createdAt },
      { l: 'Accepted by Traveler', t: p.acceptedAt },
      { l: 'Pickup Confirmed', t: p.pickupConfirmedAt },
      { l: 'In Transit', t: p.inTransitAt },
      { l: 'Delivered', t: p.deliveredAt }
    ].filter(x => x.t).map(x => `
      <div class="receipt-timeline-item">
        <i class="fa-solid fa-check-circle receipt-timeline-icon"></i>
        <div>
          <div style="font-weight:700;">${x.l}</div>
          <div style="font-size:11px; color:var(--text-faint);">${window.TravelBuddy.formatDate(x.t, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
        </div>
      </div>
    `).join('');

    receiptPreviewContent.innerHTML = `
      <div class="receipt-preview-section">
        <h4>General Information</h4>
        <div class="receipt-row"><span class="receipt-label">Receipt ID</span><span class="receipt-value">${p.orderId || p._id}</span></div>
        <div class="receipt-row"><span class="receipt-label">Status</span><span class="receipt-value" style="color:var(--success);">Delivered</span></div>
        <div class="receipt-row"><span class="receipt-label">User Role</span><span class="receipt-value">${isSender ? 'Sender' : 'Traveler'}</span></div>
      </div>
      <div class="receipt-preview-section">
        <h4>Participants</h4>
        <div class="receipt-row"><span class="receipt-label">Sender</span><span class="receipt-value">${escapeHTML(p.sender?.firstName || 'TravelBuddy')} ${escapeHTML(p.sender?.lastName || 'User')}</span></div>
        <div class="receipt-row"><span class="receipt-label">Traveler</span><span class="receipt-value">${escapeHTML(p.acceptedBy?.firstName || 'TravelBuddy')} ${escapeHTML(p.acceptedBy?.lastName || 'User')}</span></div>
      </div>
      <div class="receipt-preview-section">
        <h4>Route Details</h4>
        <div class="receipt-row"><span class="receipt-label">Origin</span><span class="receipt-value">${escapeHTML(p.fromCity)}</span></div>
        <div class="receipt-row"><span class="receipt-label">Destination</span><span class="receipt-value">${escapeHTML(p.toCity)}</span></div>
        <div class="receipt-row"><span class="receipt-label">Weight</span><span class="receipt-value">${p.weight} kg</span></div>
      </div>
      <div class="receipt-preview-section">
        <h4>Financials</h4>
        <div class="receipt-row"><span class="receipt-label">Amount</span><span class="receipt-value">${window.TravelBuddy.formatPaise(p.price)}</span></div>
        <div class="receipt-row"><span class="receipt-label">Status</span><span class="receipt-value">Released</span></div>
      </div>
      <div class="receipt-preview-section">
        <h4>Timeline</h4>
        <div style="margin-top:10px;">${timelineHtml}</div>
      </div>
    `;
  }

  async function downloadReceiptPDF() {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF || !activeParcelFullData) return;
    const doc = new jsPDF();
    const p = activeParcelFullData;

    doc.setFillColor(13, 110, 253);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('TRAVELBUDDY', 20, 20);
    doc.setFontSize(10);
    doc.text('Official Delivery Receipt', 20, 30);

    doc.setTextColor(0,0,0);
    doc.text(`Receipt ID: ${p.orderId || p._id}`, 20, 50);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 56);

    doc.text('From:', 20, 70);
    doc.text(p.fromCity.toUpperCase(), 20, 76);
    doc.text('To:', 120, 70);
    doc.text(p.toCity.toUpperCase(), 120, 76);

    doc.line(20, 85, 190, 85);
    doc.text('Description:', 20, 95);
    doc.text(p.description, 20, 101);

    doc.text('Total Amount Paid:', 20, 120);
    doc.setFontSize(16);
    doc.text(window.TravelBuddy.formatPaise(p.price), 20, 128);

    doc.save(`TravelBuddy-Receipt-${p.orderId || p._id}.pdf`);
  }

  downloadReceiptBtn?.addEventListener('click', downloadReceiptPDF);
  closeReceiptPreviewBtn?.addEventListener('click', () => receiptPreviewModal.classList.add('hidden'));
  receiptPreviewModalClose?.addEventListener('click', () => receiptPreviewModal.classList.add('hidden'));

  connectSocket();
  loadConversations().catch((err) => {
    threadListEl.innerHTML = `<div class="messages-empty-state">${escapeHTML(err.message)}</div>`;
  });
})();
