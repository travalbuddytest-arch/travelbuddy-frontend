const API_ORIGIN = APP_CONFIG.API_BASE_URL;
const SOCKET_ORIGIN = APP_CONFIG.SOCKET_URL;

async function apiGet(url) {
  const token = localStorage.getItem('admin_token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API_ORIGIN}${url}`, { headers, credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, data };
  return data;
}

const $ = (sel) => document.querySelector(sel);

let currentMsgPage = 1;
let searchDebounce = null;

// ── Live state (kept in sync with the last successful REST load, then
// patched in-place by socket events so the page updates instantly without
// a full reload; a debounced background refetch keeps it fully accurate) ──
let msgSocket = null;
let summaryCache = null;
let recentCache = [];
let liveRefreshDebounce = null;

const STATUS_LABELS = {
  active: 'Active',
  completed: 'Completed',
  read_only: 'Read only',
  blocked: 'Blocked',
};
const STATUS_COLORS = {
  active: 'active',
  completed: 'info',
  read_only: 'muted',
  blocked: 'red',
};

function getFilters() {
  return {
    status: $('#msgFilterStatus')?.value || 'all',
    dateFrom: $('#msgFilterDateFrom')?.value || '',
    dateTo: $('#msgFilterDateTo')?.value || '',
    search: $('#msgSearch')?.value.trim() || '',
  };
}

function buildQuery() {
  const f = getFilters();
  const p = new URLSearchParams();
  p.set('page', currentMsgPage);
  p.set('limit', 30);
  if (f.status !== 'all') p.set('status', f.status);
  if (f.dateFrom) p.set('dateFrom', f.dateFrom);
  if (f.dateTo) p.set('dateTo', f.dateTo);
  if (f.search) p.set('search', f.search);
  return p.toString();
}

function activeFilterEntries() {
  const f = getFilters();
  const entries = [];
  if (f.status !== 'all') entries.push({ key: 'status', label: `Status: ${STATUS_LABELS[f.status] || f.status}` });
  if (f.dateFrom) entries.push({ key: 'dateFrom', label: `From: ${f.dateFrom}` });
  if (f.dateTo) entries.push({ key: 'dateTo', label: `To: ${f.dateTo}` });
  if (f.search) entries.push({ key: 'search', label: `"${f.search}"` });
  return entries;
}

function hasActiveFilters() { return activeFilterEntries().length > 0; }

const FIELD_BY_KEY = {
  status: '#msgFilterStatus', dateFrom: '#msgFilterDateFrom', dateTo: '#msgFilterDateTo', search: '#msgSearch',
};

function renderFilterChrome() {
  const entries = activeFilterEntries();
  const countEl = $('#msgFilterCount');
  if (countEl) {
    countEl.textContent = entries.length;
    countEl.classList.toggle('hidden', entries.length === 0);
  }
  const chipsEl = $('#msgActiveFilters');
  if (chipsEl) {
    if (entries.length === 0) {
      chipsEl.classList.add('hidden');
      chipsEl.innerHTML = '';
    } else {
      chipsEl.classList.remove('hidden');
      chipsEl.innerHTML = entries.map((e) =>
        `<span class="wl-chip" data-key="${e.key}">${escHtml(e.label)} <i class="fa-solid fa-xmark"></i></span>`
      ).join('') + `<button class="wl-chip wl-chip-clear" id="msgChipClearAll">Clear all</button>`;
      chipsEl.querySelectorAll('.wl-chip[data-key]').forEach((chip) => {
        chip.addEventListener('click', () => {
          const key = chip.dataset.key;
          const sel = FIELD_BY_KEY[key];
          const el = $(sel);
          if (el) el.value = key === 'status' ? 'all' : '';
          currentMsgPage = 1;
          loadMessages();
        });
      });
      $('#msgChipClearAll')?.addEventListener('click', clearAllFilters);
    }
  }
}

function clearAllFilters() {
  if ($('#msgFilterStatus')) $('#msgFilterStatus').value = 'all';
  if ($('#msgFilterDateFrom')) $('#msgFilterDateFrom').value = '';
  if ($('#msgFilterDateTo')) $('#msgFilterDateTo').value = '';
  if ($('#msgSearch')) $('#msgSearch').value = '';
  currentMsgPage = 1;
  loadMessages();
}

export function initMessages() {
  const el = document.getElementById('msgLedger');
  if (!el) return;
  wireFilterControls();
  wireThreadModal();
  loadMessages();
  connectLiveSocket();
}

// ══════════════════════════════════════════════
// REAL-TIME — Socket.IO admin namespace. Pushes new messages/calls onto
// this page the instant they happen (see socket/adminSocket.js's
// emitMessageActivity, fired from socket/messagingSocket.js and the
// messages REST fallback), instead of admins having to refresh.
// ══════════════════════════════════════════════
function connectLiveSocket() {
  const token = localStorage.getItem('admin_token');
  if (!token || typeof io === 'undefined') {
    setLiveDot(false);
    return;
  }

  msgSocket = io(SOCKET_ORIGIN + '/admin', {
    auth: { token },
    withCredentials: true,
    transports: ['websocket', 'polling'],
  });

  msgSocket.on('connect', () => setLiveDot(true));
  msgSocket.on('disconnect', () => setLiveDot(false));
  msgSocket.on('connect_error', () => setLiveDot(false));
  msgSocket.on('admin:message', (payload) => handleLiveMessage(payload));
}

function setLiveDot(online) {
  document.querySelectorAll('#msgRecent .wr-live-dot').forEach((dot) => {
    dot.classList.toggle('msg-offline', !online);
    dot.title = online ? 'Live' : 'Reconnecting…';
  });
}

function isToday(d) {
  const now = new Date();
  const dt = new Date(d);
  return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth() && dt.getDate() === now.getDate();
}

function handleLiveMessage(payload) {
  // 1) Bump the summary counters we can know for certain from this single
  // event, and re-render the summary cards from the patched cache.
  if (summaryCache) {
    summaryCache.totalMessages = (summaryCache.totalMessages || 0) + 1;
    if (payload.messageType === 'call') summaryCache.totalCalls = (summaryCache.totalCalls || 0) + 1;
    if (isToday(payload.createdAt)) summaryCache.messagesToday = (summaryCache.messagesToday || 0) + 1;
    renderSummary(summaryCache);
    const cards = document.querySelectorAll('#msgSummary .metric-card');
    cards.forEach((c) => {
      if (c.textContent.includes('Total Messages') || (payload.messageType === 'call' && c.textContent.includes('Total Calls')) || c.textContent.includes('Messages Today')) {
        c.classList.add('msg-flash');
        setTimeout(() => c.classList.remove('msg-flash'), 900);
      }
    });
  }

  // 2) Prepend onto the "Recent Activity" feed (max 8, newest first) —
  // same markup shape loadMessages() renders from the REST `recent` array.
  recentCache = [payload, ...recentCache].slice(0, 8);
  renderRecentList(recentCache, { highlightFirst: true });

  // 3) The ledger table (conversation counts, last-message preview,
  // pagination) is trickier to patch precisely client-side — schedule a
  // quiet background resync a moment after the last live event instead of
  // reloading on every single message during a burst.
  clearTimeout(liveRefreshDebounce);
  liveRefreshDebounce = setTimeout(() => loadMessages({ silent: true }), 2500);
}

function renderSummary(summ) {
  const summary = document.getElementById('msgSummary');
  if (!summary || !summ) return;
  summary.innerHTML = `
    <div class="metric-card">
      <span class="metric-icon blue"><i class="fa-solid fa-comments"></i></span>
      <span class="metric-label">Conversations</span>
      <strong class="blue">${(summ.totalConversations || 0).toLocaleString()}</strong>
    </div>
    <div class="metric-card">
      <span class="metric-icon green"><i class="fa-solid fa-message"></i></span>
      <span class="metric-label">Total Messages</span>
      <strong class="green">${(summ.totalMessages || 0).toLocaleString()}</strong>
    </div>
    <div class="metric-card">
      <span class="metric-icon orange"><i class="fa-solid fa-mobile-screen-button"></i></span>
      <span class="metric-label">Total Calls</span>
      <strong class="orange">${(summ.totalCalls || 0).toLocaleString()}</strong>
    </div>
    <div class="metric-card">
      <span class="metric-icon muted"><i class="fa-solid fa-bolt"></i></span>
      <span class="metric-label">Messages Today</span>
      <strong>${(summ.messagesToday || 0).toLocaleString()}</strong>
    </div>
  `;
}

function renderRecentList(recent, { highlightFirst = false } = {}) {
  const recentList = document.getElementById('msgRecentList');
  if (!recentList) return;
  if (!recent || recent.length === 0) {
    recentList.innerHTML = `<div class="wallet-recent-empty">No activity yet.</div>`;
    return;
  }
  recentList.innerHTML = recent.map((item, idx) => {
    const name = item.fromUser?.name || '—';
    const initials = (name !== '—' ? name : '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    const isCall = item.messageType === 'call';
    const liveClass = highlightFirst && idx === 0 ? ' msg-live-new' : '';
    return `<div class="wallet-recent-item msg-recent-item${liveClass}">
      <span class="wr-avatar">${escHtml(initials)}</span>
      <span class="wr-user">${escHtml(name)}</span>
      <span class="wr-type"><i class="fa-solid ${isCall ? 'fa-mobile-screen-button' : 'fa-message'}"></i> ${escHtml(item.content || (isCall ? 'Call' : 'Message'))}</span>
      <span class="wr-date">${formatDate(item.createdAt)}</span>
    </div>`;
  }).join('');
  if (highlightFirst) {
    const first = recentList.querySelector('.msg-live-new');
    if (first) setTimeout(() => first.classList.remove('msg-live-new'), 1200);
  }
}

function wireFilterControls() {
  $('#msgFilterToggle')?.addEventListener('click', () => {
    $('#msgFilters')?.classList.toggle('hidden');
    $('#msgFilterToggle')?.classList.toggle('wl-btn-active');
  });

  ['#msgFilterStatus', '#msgFilterDateFrom', '#msgFilterDateTo'].forEach((sel) => {
    $(sel)?.addEventListener('change', () => {
      currentMsgPage = 1;
      loadMessages();
    });
  });

  $('#msgSearch')?.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      currentMsgPage = 1;
      loadMessages();
    }, 350);
  });

  $('#msgClearFilters')?.addEventListener('click', clearAllFilters);
}

async function loadMessages(opts = {}) {
  const { silent = false } = opts;
  const ledger = document.getElementById('msgLedger');
  const summary = document.getElementById('msgSummary');
  const pagination = document.getElementById('msgPagination');
  if (!ledger) return;

  renderFilterChrome();

  // A silent background resync (triggered after live socket events) keeps
  // whatever the admin is currently looking at on screen instead of
  // flashing a loading skeleton over it every couple of seconds.
  if (!silent) {
    if (summary) summary.innerHTML = '<div class="loading" style="text-align:center;padding:20px;color:#98a2b3">Loading...</div>';
    ledger.innerHTML = `<tr><td colspan="9" class="loading-cell"><div class="skel-line skel-w60" style="margin:20px auto"></div></td></tr>`;
  }

  try {
    const filtered = hasActiveFilters();
    const data = await apiGet(`/api/admin/messages?${buildQuery()}`);
    const { conversations, total, summary: summ, recent } = data;

    // Keep the live-patch caches in sync with the source of truth every
    // time we successfully load from the server, whether that's the
    // initial load, a filter change, or a background resync.
    summaryCache = summ || summaryCache;
    recentCache = recent || recentCache;

    if (summary) renderSummary(summaryCache);
    renderRecentList(recentCache);

    if (!conversations || conversations.length === 0) {
      ledger.innerHTML = `<tr><td colspan="9" class="empty-cell">${filtered ? 'No conversations match the selected filters.' : 'No conversations found.'}</td></tr>`;
      if (pagination) pagination.innerHTML = '';
      return;
    }

    ledger.innerHTML = conversations.map((c) => {
      const preview = c.lastMessage ? escHtml(c.lastMessage) : '<span class="cell-sub">No messages yet</span>';
      return `<tr>
        <td><span class="cell-sub">${formatDate(c.createdAt)}</span></td>
        <td>${escHtml(c.sender?.name || '—')}<br><span class="cell-sub">${escHtml(c.sender?.email || '')}</span></td>
        <td>${escHtml(c.traveler?.name || '—')}<br><span class="cell-sub">${escHtml(c.traveler?.email || '')}</span></td>
        <td><span class="cell-mono">${escHtml(c.orderId || '—')}</span></td>
        <td>${formatDate(c.lastMessageAt)}<br>${preview}</td>
        <td><span class="cell-mono">${c.messageCount}</span></td>
        <td><span class="cell-mono">${c.callCount}</span></td>
        <td><span class="status-tag ${STATUS_COLORS[c.status] || 'muted'}">${STATUS_LABELS[c.status] || c.status || '—'}</span></td>
        <td><button class="wl-btn wl-btn-sm msg-view-btn" data-id="${c.id}"><i class="fa-solid fa-eye"></i> View</button></td>
      </tr>`;
    }).join('');

    ledger.querySelectorAll('.msg-view-btn').forEach((btn) => {
      btn.addEventListener('click', () => openThread(btn.dataset.id));
    });

    if (pagination) {
      const totalPages = Math.ceil(total / 30);
      if (totalPages <= 1) { pagination.innerHTML = ''; return; }
      let html = '';
      if (currentMsgPage > 1) html += `<button data-p="${currentMsgPage - 1}">&lsaquo; Prev</button>`;
      html += `<span class="pagi-info">Page ${currentMsgPage} of ${totalPages}</span>`;
      if (currentMsgPage < totalPages) html += `<button data-p="${currentMsgPage + 1}">Next &rsaquo;</button>`;
      pagination.innerHTML = html;
      pagination.querySelectorAll('button').forEach((btn) => {
        btn.addEventListener('click', () => {
          currentMsgPage = parseInt(btn.dataset.p, 10);
          loadMessages();
        });
      });
    }
  } catch (err) {
    console.warn('Failed to load messages:', err);
    if (silent) return; // background resync failed quietly — leave the current view as-is, don't clobber it with an error state
    if (summary) summary.innerHTML = '';
    ledger.innerHTML = `<tr><td colspan="9" class="error-cell">
      <i class="fa-solid fa-cloud-exclamation"></i> Failed to load conversations.
      <button class="retry-inline">Retry</button>
    </td></tr>`;
    const retry = ledger.querySelector('.retry-inline');
    if (retry) retry.addEventListener('click', () => loadMessages());
    if (pagination) pagination.innerHTML = '';
  }
}

// ══════════════════════════════════════════════
// THREAD MODAL — full read-only message thread for one conversation
// ══════════════════════════════════════════════
function wireThreadModal() {
  $('#msgThreadClose')?.addEventListener('click', closeThread);
  $('#msgThreadModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'msgThreadModal') closeThread();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('#msgThreadModal')?.classList.contains('show')) closeThread();
  });
}

function closeThread() {
  $('#msgThreadModal')?.classList.remove('show');
}

async function openThread(conversationId) {
  const modal = $('#msgThreadModal');
  const body = $('#msgThreadBody');
  const title = $('#msgThreadTitle');
  const sub = $('#msgThreadSub');
  if (!modal || !body) return;

  title.textContent = 'Conversation';
  sub.textContent = '';
  body.innerHTML = `<div class="msg-thread-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading thread...</div>`;
  modal.classList.add('show');

  try {
    const data = await apiGet(`/api/admin/messages/${encodeURIComponent(conversationId)}/thread`);
    const { conversation, messages } = data;
    const senderName = conversation.sender?.name || 'Sender';
    const travelerName = conversation.traveler?.name || 'Traveler';
    title.textContent = `${senderName} ↔ ${travelerName}`;
    sub.textContent = conversation.orderId ? `Order ${conversation.orderId}` : `Conversation started ${formatDate(conversation.createdAt)}`;

    if (!messages || messages.length === 0) {
      body.innerHTML = `<div class="msg-thread-empty">No messages in this conversation yet.</div>`;
      return;
    }

    const senderId = String(conversation.sender?.id || '');
    body.innerHTML = messages.map((m) => {
      if (m.messageType === 'call') {
        const missed = /missed|declined|busy/i.test(m.content || '');
        return `<div class="msg-thread-call-row">
          <span class="msg-thread-call-pill">
            <i class="fa-solid ${missed ? 'fa-phone-slash' : 'fa-mobile-screen-button'}"></i>
            ${escHtml(m.content)}
            <span class="msg-thread-call-time">${formatDate(m.createdAt)}</span>
          </span>
        </div>`;
      }
      const isSender = String(m.senderId) === senderId;
      return `<div class="msg-thread-bubble ${isSender ? 'from-sender' : 'from-traveler'}">
        <span class="msg-thread-who">${escHtml(isSender ? senderName : travelerName)}</span>
        ${escHtml(m.content)}
        <span class="msg-thread-time">${formatDate(m.createdAt)}</span>
      </div>`;
    }).join('');
  } catch (err) {
    console.warn('Failed to load thread:', err);
    body.innerHTML = `<div class="msg-thread-error"><i class="fa-solid fa-cloud-exclamation"></i> Failed to load this conversation. <button class="retry-inline" id="msgThreadRetry">Retry</button></div>`;
    $('#msgThreadRetry')?.addEventListener('click', () => openThread(conversationId));
  }
}

function formatDate(d) { return d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; }
function escHtml(s) { if (!s) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

try { initMessages(); } catch (e) { console.warn('messages init failed', e); }
