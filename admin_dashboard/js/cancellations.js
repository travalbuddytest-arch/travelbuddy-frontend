const API_ORIGIN = APP_CONFIG.API_BASE_URL;

async function apiGet(url) {
  const token = localStorage.getItem('admin_token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API_ORIGIN}${url}`, { headers, credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, data };
  return data;
}

let currentCancelPage = 1;
let currentOutcome = 'all'; // 'all' | 'cancelled' | 'delivered'

export default function initCancellations() {
  const el = document.getElementById('cancellationList');
  if (!el) return;
  wireOutcomeTabs();
  loadCancellations();
}

function wireOutcomeTabs() {
  const tabs = document.getElementById('outcomeTabs');
  if (!tabs) return;
  tabs.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.outcome;
      if (next === currentOutcome) return;
      currentOutcome = next;
      currentCancelPage = 1;
      tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
      updateColumnHeaders();
      loadCancellations();
    });
  });
  updateColumnHeaders();
}

function updateColumnHeaders() {
  const counterpartyCol = document.getElementById('colCounterparty');
  const amountCol = document.getElementById('colAmount');
  const reasonCol = document.getElementById('colReason');
  if (!counterpartyCol || !amountCol || !reasonCol) return;
  if (currentOutcome === 'delivered') {
    counterpartyCol.textContent = 'Traveler';
    amountCol.textContent = 'Revenue';
    reasonCol.textContent = 'Notes';
  } else if (currentOutcome === 'cancelled') {
    counterpartyCol.textContent = 'Cancelled By';
    amountCol.textContent = 'Fee Charged';
    reasonCol.textContent = 'Reason';
  } else {
    counterpartyCol.textContent = 'Traveler / Cancelled By';
    amountCol.textContent = 'Amount';
    reasonCol.textContent = 'Reason';
  }
}

async function loadCancellations() {
  const list = document.getElementById('cancellationList');
  const patterns = document.getElementById('cancelPatterns');
  const pagination = document.getElementById('cancelPagination');
  if (!list) return;

  if (patterns) patterns.innerHTML = '<div class="loading" style="text-align:center;padding:20px;color:#98a2b3">Loading...</div>';
  list.innerHTML = `<tr><td colspan="8" class="loading-cell"><div class="skel-line skel-w60" style="margin:20px auto"></div></td></tr>`;

  try {
    const data = await apiGet(`/api/admin/cancellations?page=${currentCancelPage}&limit=20&outcome=${encodeURIComponent(currentOutcome)}`);
    const { cancellations: outcomes, total, patterns: pat } = data;

    if (patterns && pat) {
      const reasonsHtml = (pat.topReasons || []).map(r => `<div class="reason-item"><span>${escHtml(r._id || 'No reason')}</span><b>${r.count}</b></div>`).join('') || '<span class="cell-sub">No reasons recorded</span>';
      const rate = pat.successRate30d;
      const rateColor = rate == null ? '' : rate >= 80 ? 'metric-good' : rate >= 50 ? 'metric-warn' : 'metric-bad';

      const deliveredCard = `<div class="metric-card"><span>Delivered (30d)</span><strong>${pat.delivered30d || 0}</strong></div>`;
      const deliveredRevenueCard = `<div class="metric-card"><span>Delivered Revenue (30d)</span><strong>₹${((pat.deliveredRevenue30d || 0)/100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>`;
      const cancelledCard = `<div class="metric-card"><span>Cancelled (30d)</span><strong>${pat.total30d || 0}</strong></div>`;
      const bySenderCard = `<div class="metric-card"><span>By Sender</span><strong>${pat.bySender || 0}</strong></div>`;
      const byTravelerCard = `<div class="metric-card"><span>By Traveler</span><strong>${pat.byTraveler || 0}</strong></div>`;
      const reasonsCard = `<div class="metric-card wide"><span>Top Cancellation Reasons</span><div class="reasons-list">${reasonsHtml}</div></div>`;
      const rateCard = `<div class="metric-card ${rateColor}"><span>Delivery Success Rate</span><strong>${rate == null ? '—' : rate + '%'}</strong></div>`;

      if (currentOutcome === 'delivered') {
        // Only delivery-relevant KPIs - cancellation fee/reason cards don't apply here.
        patterns.innerHTML = deliveredCard + deliveredRevenueCard;
      } else if (currentOutcome === 'cancelled') {
        // Only cancellation-relevant KPIs - delivery revenue/success-rate don't apply here.
        patterns.innerHTML = cancelledCard + bySenderCard + byTravelerCard + reasonsCard;
      } else {
        // 'all' - the comparison view, so show everything including the success rate.
        patterns.innerHTML = deliveredCard + cancelledCard + rateCard + deliveredRevenueCard + bySenderCard + byTravelerCard + reasonsCard;
      }
    }

    if (!outcomes || outcomes.length === 0) {
      list.innerHTML = `<tr><td colspan="8" class="empty-cell">No ${currentOutcome === 'all' ? 'outcomes' : currentOutcome + ' parcels'} found.</td></tr>`;
      if (pagination) pagination.innerHTML = '';
      return;
    }

    list.innerHTML = outcomes.map(renderRow).join('');

    if (pagination) {
      const totalPages = Math.ceil(total / 20);
      if (totalPages <= 1) { pagination.innerHTML = ''; return; }
      let html = '';
      if (currentCancelPage > 1) html += `<button data-p="1">&laquo;</button><button data-p="${currentCancelPage - 1}">&lsaquo;</button>`;
      for (let i = Math.max(1, currentCancelPage - 2); i <= Math.min(totalPages, currentCancelPage + 2); i++) {
        html += `<button data-p="${i}" class="${i === currentCancelPage ? 'active' : ''}">${i}</button>`;
      }
      if (currentCancelPage < totalPages) html += `<button data-p="${currentCancelPage + 1}">&rsaquo;</button><button data-p="${totalPages}">&raquo;</button>`;
      pagination.innerHTML = html;
      pagination.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          currentCancelPage = parseInt(btn.dataset.p, 10);
          loadCancellations();
        });
      });
    }
  } catch (err) {
    console.warn('Failed to load parcel outcomes:', err);
    list.innerHTML = `<tr><td colspan="8" class="error-cell">
      <i class="fa-solid fa-cloud-exclamation"></i> Failed to load parcel outcomes.
      <button class="retry-inline">Retry</button>
    </td></tr>`;
    const retry = list.querySelector('.retry-inline');
    if (retry) retry.addEventListener('click', () => loadCancellations());
    if (pagination) pagination.innerHTML = '';
  }
}

function renderRow(o) {
  const route = `${capitalize(o.fromCity || '')} → ${capitalize(o.toCity || '')}`;
  const senderName = o.sender ? `${o.sender.firstName || ''} ${o.sender.lastName || ''}`.trim() : '—';
  const isDelivered = o.status === 'delivered';

  const outcomeBadge = isDelivered
    ? `<span class="status-tag active"><i class="fa-solid fa-circle-check"></i> Delivered</span>`
    : `<span class="status-tag danger"><i class="fa-solid fa-ban"></i> Cancelled</span>`;

  const counterparty = isDelivered
    ? (o.traveler ? `${o.traveler.firstName || ''} ${o.traveler.lastName || ''}`.trim() : '—')
    : (o.cancelledBy ? `${o.cancelledBy.firstName || ''} ${o.cancelledBy.lastName || ''}`.trim() : '—');

  const amount = isDelivered
    ? `₹${((o.chargedAmount || 0)/100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
    : `-₹${((o.cancellationFee || 0)/100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const amountClass = isDelivered ? 'amount-positive' : 'amount-negative';

  const reason = isDelivered
    ? '<span class="cell-sub">—</span>'
    : `<span class="cell-sub" title="${escHtml(o.cancellationReason || '')}">${escHtml(truncate(o.cancellationReason || '—', 40))}</span>`;

  return `<tr>
    <td><strong class="cell-mono">${escHtml(o.orderId || '—')}</strong></td>
    <td><span class="cell-sub">${escHtml(route)}</span></td>
    <td>${escHtml(senderName)}</td>
    <td>${outcomeBadge}</td>
    <td>${escHtml(counterparty)}</td>
    <td><span class="cell-mono ${amountClass}">${amount}</span></td>
    <td>${reason}</td>
    <td><span class="cell-sub">${formatDate(o.outcomeAt)}</span></td>
  </tr>`;
}

function truncate(s, max) { return s && s.length > max ? s.slice(0, max) + '…' : s; }
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
function formatDate(d) { return d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; }
function escHtml(s) { if (!s) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

try { initCancellations(); } catch (e) { console.warn('cancellations init failed', e); }
