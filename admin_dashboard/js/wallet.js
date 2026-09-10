const API_ORIGIN = APP_CONFIG.API_BASE_URL;

async function apiGet(url) {
  const token = localStorage.getItem('admin_token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API_ORIGIN}${url}`, { headers, credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, data };
  return data;
}

async function apiPost(url, body) {
  const token = localStorage.getItem('admin_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_ORIGIN}${url}`, { method: 'POST', headers, credentials: 'include', body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, data };
  return data;
}

const $ = (sel) => document.querySelector(sel);

let currentWalletPage = 1;
let currentWithdrawPage = 1;
let currentTab = 'ledger';
let searchDebounce = null;
let activeWithdrawal = null;

const TYPE_LABELS = {
  topup: 'Top-up',
  order_hold: 'Order Hold',
  order_refund: 'Order Refund',
  traveler_earning: 'Traveler Earning',
  platform_commission: 'Platform Commission',
  cancellation_fee: 'Cancellation Fee',
  cancellation_compensation: 'Cancellation Compensation',
  sender_cancellation_refund: 'Cancellation Refund',
  system_cancellation_refund: 'System Refund',
  withdrawal: 'Withdrawal',
};

function getFilters() {
  return {
    type: $('#wlFilterType')?.value || 'all',
    direction: $('#wlFilterDirection')?.value || 'all',
    status: $('#wlFilterStatus')?.value || 'all',
    dateFrom: $('#wlFilterDateFrom')?.value || '',
    dateTo: $('#wlFilterDateTo')?.value || '',
    search: $('#wlSearch')?.value.trim() || '',
  };
}

function buildQuery() {
  const f = getFilters();
  const p = new URLSearchParams();
  p.set('page', currentWalletPage);
  p.set('limit', 30);
  if (f.type !== 'all') p.set('type', f.type);
  if (f.direction !== 'all') p.set('direction', f.direction);
  if (f.status !== 'all') p.set('status', f.status);
  if (f.dateFrom) p.set('dateFrom', f.dateFrom);
  if (f.dateTo) p.set('dateTo', f.dateTo);
  if (f.search) p.set('search', f.search);
  return p.toString();
}

function activeFilterEntries() {
  const f = getFilters();
  const entries = [];
  if (f.type !== 'all') entries.push({ key: 'type', label: `Type: ${TYPE_LABELS[f.type] || f.type}` });
  if (f.direction !== 'all') entries.push({ key: 'direction', label: `Direction: ${f.direction}` });
  if (f.status !== 'all') entries.push({ key: 'status', label: `Status: ${f.status}` });
  if (f.dateFrom) entries.push({ key: 'dateFrom', label: `From: ${f.dateFrom}` });
  if (f.dateTo) entries.push({ key: 'dateTo', label: `To: ${f.dateTo}` });
  if (f.search) entries.push({ key: 'search', label: `"${f.search}"` });
  return entries;
}

function hasActiveFilters() { return activeFilterEntries().length > 0; }

const FIELD_BY_KEY = {
  type: '#wlFilterType', direction: '#wlFilterDirection', status: '#wlFilterStatus',
  dateFrom: '#wlFilterDateFrom', dateTo: '#wlFilterDateTo', search: '#wlSearch',
};

function renderFilterChrome() {
  const entries = activeFilterEntries();
  const countEl = $('#wlFilterCount');
  if (countEl) {
    countEl.textContent = entries.length;
    countEl.classList.toggle('hidden', entries.length === 0);
  }
  const chipsEl = $('#wlActiveFilters');
  if (chipsEl) {
    if (entries.length === 0) {
      chipsEl.classList.add('hidden');
      chipsEl.innerHTML = '';
    } else {
      chipsEl.classList.remove('hidden');
      chipsEl.innerHTML = entries.map(e =>
        `<span class="wl-chip" data-key="${e.key}">${escHtml(e.label)} <i class="fa-solid fa-xmark"></i></span>`
      ).join('') + `<button class="wl-chip wl-chip-clear" id="wlChipClearAll">Clear all</button>`;
      chipsEl.querySelectorAll('.wl-chip[data-key]').forEach(chip => {
        chip.addEventListener('click', () => {
          const key = chip.dataset.key;
          const sel = FIELD_BY_KEY[key];
          const el = $(sel);
          if (el) el.value = key === 'type' || key === 'direction' || key === 'status' ? 'all' : '';
          currentWalletPage = 1;
          loadWallet();
        });
      });
      $('#wlChipClearAll')?.addEventListener('click', clearAllFilters);
    }
  }
}

function clearAllFilters() {
  if ($('#wlFilterType')) $('#wlFilterType').value = 'all';
  if ($('#wlFilterDirection')) $('#wlFilterDirection').value = 'all';
  if ($('#wlFilterStatus')) $('#wlFilterStatus').value = 'all';
  if ($('#wlFilterDateFrom')) $('#wlFilterDateFrom').value = '';
  if ($('#wlFilterDateTo')) $('#wlFilterDateTo').value = '';
  if ($('#wlSearch')) $('#wlSearch').value = '';
  currentWalletPage = 1;
  loadWallet();
}

export function initWallet() {
  const el = document.getElementById('walletLedger');
  if (!el) return;
  wireFilterControls();
  wireTabControls();
  wireWithdrawalActions();
  loadWallet();
  loadWithdrawals(); // Pre-load or just badge count
}

function wireTabControls() {
  const tabs = document.querySelectorAll('.wl-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      currentTab = target;
      tabs.forEach(t => t.classList.toggle('active', t === tab));
      document.getElementById('ledgerView').classList.toggle('hidden', target !== 'ledger');
      document.getElementById('withdrawalView').classList.toggle('hidden', target !== 'withdrawals');

      if (target === 'ledger') loadWallet();
      else loadWithdrawals();
    });
  });
}

function wireWithdrawalActions() {
  $('#wdFilterStatus')?.addEventListener('change', () => {
    currentWithdrawPage = 1;
    loadWithdrawals();
  });

  $('#wdModalClose')?.addEventListener('click', () => $('#wdActionModal').classList.remove('show'));

  $('#wdApproveBtn')?.addEventListener('click', async () => {
    if (!activeWithdrawal) return;
    const utr = prompt('Enter UTR/Transaction Reference:');
    if (utr === null) return;
    try {
      await apiPost('/api/admin/withdrawals/admin/complete', { withdrawalId: activeWithdrawal.withdrawalId, utr });
      window.showToast('Withdrawal marked as completed');
      $('#wdActionModal').classList.remove('show');
      loadWithdrawals();
    } catch (err) {
      window.showToast(err.data?.error || 'Failed to complete withdrawal', 'error');
    }
  });

  $('#wdRejectBtn')?.addEventListener('click', async () => {
    if (!activeWithdrawal) return;
    const reason = prompt('Enter rejection reason:');
    if (reason === null) return;
    try {
      await apiPost('/api/admin/withdrawals/admin/reject', { withdrawalId: activeWithdrawal.withdrawalId, reason });
      window.showToast('Withdrawal rejected and funds reversed');
      $('#wdActionModal').classList.remove('show');
      loadWithdrawals();
    } catch (err) {
      window.showToast(err.data?.error || 'Failed to reject withdrawal', 'error');
    }
  });
}

async function loadWithdrawals() {
  const tableBody = document.getElementById('withdrawalTableBody');
  const pagination = document.getElementById('withdrawalPagination');
  const badge = document.getElementById('withdrawalBadge');
  if (!tableBody) return;

  tableBody.innerHTML = `<tr><td colspan="7" class="loading-cell">Loading...</td></tr>`;

  try {
    const status = $('#wdFilterStatus').value;
    const data = await apiGet(`/api/admin/withdrawals?status=${status}&page=${currentWithdrawPage}&limit=20`);
    const { withdrawals, total } = data;

    if (status === 'requested' && badge) {
      badge.textContent = total;
      badge.classList.toggle('hidden', total === 0);
    }

    if (!withdrawals || withdrawals.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" class="empty-cell">No withdrawal requests found.</td></tr>`;
      if (pagination) pagination.innerHTML = '';
      return;
    }

    tableBody.innerHTML = withdrawals.map(w => {
      const userName = w.user ? `${w.user.firstName || ''} ${w.user.lastName || ''}`.trim() : '—';
      const statusClass = w.status === 'requested' ? 'orange' : w.status === 'completed' ? 'green' : w.status === 'rejected' ? 'red' : 'muted';
      return `<tr>
        <td><span class="cell-sub">${formatDate(w.createdAt)}</span></td>
        <td><span class="cell-mono">${escHtml(w.withdrawalId)}</span></td>
        <td>
          <div style="display:flex;flex-direction:column">
            <b>${escHtml(userName)}</b>
            <span class="cell-sub" style="font-size:9px">${escHtml(w.user?.email || '')}</span>
          </div>
        </td>
        <td><span class="cell-mono">${fmtMoney(w.amount)}</span></td>
        <td><span class="status-tag info">${escHtml(w.method.toUpperCase())}</span></td>
        <td><span class="status-tag ${statusClass}">${escHtml(w.status)}</span></td>
        <td>
          ${w.status === 'requested' || w.status === 'processing' ?
            `<button class="wl-btn wl-btn-sm" data-id="${w._id}">Review</button>` : '—'}
        </td>
      </tr>`;
    }).join('');

    tableBody.querySelectorAll('button[data-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const withdrawal = withdrawals.find(w => String(w._id) === btn.dataset.id);
        if (withdrawal) openWithdrawalModal(withdrawal);
      });
    });

    if (pagination) {
      const totalPages = Math.ceil(total / 20);
      let html = '';
      if (currentWithdrawPage > 1) html += `<button data-p="${currentWithdrawPage - 1}">&lsaquo; Prev</button>`;
      html += `<span class="pagi-info">Page ${currentWithdrawPage} of ${totalPages}</span>`;
      if (currentWithdrawPage < totalPages) html += `<button data-p="${currentWithdrawPage + 1}">Next &rsaquo;</button>`;
      pagination.innerHTML = html;
      pagination.querySelectorAll('button').forEach(b => {
        b.addEventListener('click', () => {
          currentWithdrawPage = parseInt(b.dataset.p, 10);
          loadWithdrawals();
        });
      });
    }
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="7" class="error-cell">Failed to load.</td></tr>`;
  }
}

function openWithdrawalModal(w) {
  activeWithdrawal = w;
  const body = $('#wdModalBody');
  const user = w.user || {};

  let payoutHtml = '';
  if (w.method === 'upi') {
    payoutHtml = `<div class="wd-info-row"><span>UPI ID</span><span>${escHtml(w.upiId || '—')}</span></div>`;
  } else {
    const b = w.bankDetails || {};
    payoutHtml = `
      <div class="wd-info-row"><span>Account Name</span><span>${escHtml(b.accountHolderName || '—')}</span></div>
      <div class="wd-info-row"><span>Account Number</span><span>${escHtml(b.accountNumber || '—')}</span></div>
      <div class="wd-info-row"><span>Bank / IFSC</span><span>${escHtml(b.bankName || '')} / ${escHtml(b.ifscCode || '')}</span></div>
    `;
  }

  body.innerHTML = `
    <div class="wd-info-row"><span>User</span><span>${escHtml(user.firstName)} ${escHtml(user.lastName)}</span></div>
    <div class="wd-info-row"><span>Amount</span><span style="color:var(--b);font-size:16px">${fmtMoney(w.amount)}</span></div>
    <div class="wd-info-row"><span>User Balance</span><span>${fmtMoney(user.walletBalance)}</span></div>
    <div style="margin-top:15px;padding-top:10px;border-top:1px solid #eee">
      <b style="font-size:10px;text-transform:uppercase;color:#98a2b3">Payout Destination (${w.method.toUpperCase()})</b>
      ${payoutHtml}
    </div>
  `;

  $('#wdActionModal').classList.add('show');
}

function wireFilterControls() {
  $('#wlFilterToggle')?.addEventListener('click', () => {
    $('#wlFilters')?.classList.toggle('hidden');
    $('#wlFilterToggle')?.classList.toggle('wl-btn-active');
  });

  ['#wlFilterType', '#wlFilterDirection', '#wlFilterStatus', '#wlFilterDateFrom', '#wlFilterDateTo'].forEach((sel) => {
    $(sel)?.addEventListener('change', () => {
      currentWalletPage = 1;
      loadWallet();
    });
  });

  $('#wlSearch')?.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      currentWalletPage = 1;
      loadWallet();
    }, 350);
  });

  $('#wlClearFilters')?.addEventListener('click', clearAllFilters);
}

function wireFilterControls() {
  const ledger = document.getElementById('walletLedger');
  const summary = document.getElementById('walletSummary');
  const pagination = document.getElementById('walletPagination');
  const recentList = document.getElementById('walletRecentList');
  if (!ledger) return;

  renderFilterChrome();

  if (summary) summary.innerHTML = '<div class="loading" style="text-align:center;padding:20px;color:#98a2b3">Loading...</div>';
  ledger.innerHTML = `<tr><td colspan="8" class="loading-cell"><div class="skel-line skel-w60" style="margin:20px auto"></div></td></tr>`;

  try {
    const filtered = hasActiveFilters();
    const data = await apiGet(`/api/admin/wallet-transactions?${buildQuery()}`);
    const { transactions, total, summary: summ, recent } = data;

    if (summary && summ) {
      summary.innerHTML = `
        <div class="metric-card">
          <span class="metric-icon green"><i class="fa-solid fa-arrow-down"></i></span>
          <span class="metric-label">Total Credits</span>
          <strong class="green">${fmtMoney(summ.totalCredits || 0)}</strong>
        </div>
        <div class="metric-card">
          <span class="metric-icon red"><i class="fa-solid fa-arrow-up"></i></span>
          <span class="metric-label">Total Debits</span>
          <strong class="red">${fmtMoney(summ.totalDebits || 0)}</strong>
        </div>
        <div class="metric-card">
          <span class="metric-icon orange"><i class="fa-solid fa-clock"></i></span>
          <span class="metric-label">Pending Holds</span>
          <strong class="orange">${fmtMoney(summ.pendingHolds || 0)}</strong>
        </div>
        <div class="metric-card metric-card-commission">
          <span class="metric-icon blue"><i class="fa-solid fa-sack-dollar"></i></span>
          <span class="metric-label">Admin Commission${filtered ? ' (filtered)' : ''}</span>
          <strong class="blue">${fmtMoney(summ.totalCommission || 0)}</strong>
          <span class="metric-note">Company earnings on completed deliveries</span>
        </div>
        <div class="metric-card">
          <span class="metric-icon muted"><i class="fa-solid fa-list"></i></span>
          <span class="metric-label">Transactions${filtered ? ' (filtered)' : ''}</span>
          <strong>${summ.totalTransactions || 0}</strong>
        </div>
      `;
    }

    // Recent activity — last 5 transactions across ALL users, site-wide (independent of filters)
    if (recentList) {
      if (!recent || recent.length === 0) {
        recentList.innerHTML = `<div class="wallet-recent-empty">No recent activity yet.</div>`;
      } else {
        const dirColors = { credit: 'green', debit: 'red', hold: 'orange', system: 'muted' };
        recentList.innerHTML = recent.map(tx => {
          const userName = tx.user ? `${tx.user.firstName || ''} ${tx.user.lastName || ''}`.trim() : '—';
          const initials = (userName !== '—' ? userName : '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
          return `<div class="wallet-recent-item">
            <span class="wr-avatar">${escHtml(initials)}</span>
            <span class="wr-user">${escHtml(userName)}</span>
            <span class="wr-type">${escHtml(TYPE_LABELS[tx.type] || tx.type || '—')}</span>
            <span class="wr-amount ${dirColors[tx.direction] || 'muted'}">${tx.direction === 'debit' ? '-' : '+'}${fmtMoney(tx.amount || 0)}</span>
            <span class="wr-date">${formatDate(tx.createdAt)}</span>
          </div>`;
        }).join('');
      }
    }

    if (!transactions || transactions.length === 0) {
      ledger.innerHTML = `<tr><td colspan="8" class="empty-cell">${filtered ? 'No transactions match the selected filters.' : 'No transactions found.'}</td></tr>`;
      if (pagination) pagination.innerHTML = '';
      return;
    }

    const dirColors = { credit: 'green', debit: 'red', hold: 'orange', system: 'muted' };
    const statusColors = { completed: 'active', held: 'info', released: 'active', refunded: 'muted' };

    ledger.innerHTML = transactions.map(tx => {
      const userName = tx.user ? `${tx.user.firstName || ''} ${tx.user.lastName || ''}`.trim() : '—';
      return `<tr>
        <td><span class="cell-sub">${formatDate(tx.createdAt)}</span></td>
        <td>${escHtml(userName)}</td>
        <td><span class="cell-sub">${escHtml(TYPE_LABELS[tx.type] || tx.type || '—')}</span></td>
        <td><span class="status-tag ${dirColors[tx.direction] || 'muted'}">${tx.direction || '—'}</span></td>
        <td><span class="cell-mono">${fmtMoney(tx.amount || 0)}</span></td>
        <td>${tx.balanceAfter != null ? `<span class="cell-mono">${fmtMoney(tx.balanceAfter)}</span>` : '—'}</td>
        <td><span class="status-tag ${statusColors[tx.status] || 'muted'}">${tx.status || '—'}</span></td>
        <td><span class="cell-sub">${escHtml(tx.referenceId || '—')}</span></td>
      </tr>`;
    }).join('');

    if (pagination) {
      const totalPages = Math.ceil(total / 30);
      if (totalPages <= 1) { pagination.innerHTML = ''; return; }
      let html = '';
      if (currentWalletPage > 1) html += `<button data-p="${currentWalletPage - 1}">&lsaquo; Prev</button>`;
      html += `<span class="pagi-info">Page ${currentWalletPage} of ${totalPages}</span>`;
      if (currentWalletPage < totalPages) html += `<button data-p="${currentWalletPage + 1}">Next &rsaquo;</button>`;
      pagination.innerHTML = html;
      pagination.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          currentWalletPage = parseInt(btn.dataset.p, 10);
          loadWallet();
        });
      });
    }
  } catch (err) {
    console.warn('Failed to load wallet:', err);
    if (summary) summary.innerHTML = '';
    ledger.innerHTML = `<tr><td colspan="8" class="error-cell">
      <i class="fa-solid fa-cloud-exclamation"></i> Failed to load transactions.
      <button class="retry-inline">Retry</button>
    </td></tr>`;
    const retry = ledger.querySelector('.retry-inline');
    if (retry) retry.addEventListener('click', () => loadWallet());
    if (pagination) pagination.innerHTML = '';
  }
}

function formatDate(d) {
  if (window.TravelBuddyDate) return window.TravelBuddyDate.formatDateTime(d);
  return d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
}
function escHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

try { initWallet(); } catch (e) { console.warn('wallet init failed', e); }
