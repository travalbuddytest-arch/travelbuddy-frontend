(function () {
  'use strict';

  const { API_ORIGIN, authHeaders, escapeHTML, formatPaise, statusBadge } = window.TravelBuddy;

  const earnTotalLifetime = document.getElementById('earnTotalLifetime');
  const earnWithdrawable = document.getElementById('earnWithdrawable');
  const earnCompletedTrips = document.getElementById('earnCompletedTrips');
  const earnActiveTransits = document.getElementById('earnActiveTransits');
  const earningsTableBody = document.getElementById('earningsTableBody');
  const exportEarningsBtn = document.getElementById('exportEarningsBtn');

  async function loadEarningsData() {
    try {
      const [walletRes, statsRes, txRes] = await Promise.allSettled([
        fetch(`${API_ORIGIN}/api/payments/wallet-summary`, { headers: authHeaders() }).then(r => r.json()),
        fetch(`${API_ORIGIN}/api/postparcel/stats`, { headers: authHeaders() }).then(r => r.json()),
        fetch(`${API_ORIGIN}/api/payments/wallet-transactions?type=traveler_earning`, { headers: authHeaders() }).then(r => r.json())
      ]);

      if (walletRes.status === 'fulfilled') {
        const w = walletRes.value;
        if (earnTotalLifetime) earnTotalLifetime.textContent = formatPaise(w.totalEarnings || 0);
        if (earnWithdrawable) earnWithdrawable.textContent = formatPaise(w.walletBalance || 0);
      }

      if (statsRes.status === 'fulfilled') {
        const s = statsRes.value;
        if (earnCompletedTrips) earnCompletedTrips.textContent = s.completedDeliveries || 0;
        if (earnActiveTransits) earnActiveTransits.textContent = s.activeDeliveries || 0;
      }

      if (txRes.status === 'fulfilled') {
        const txList = txRes.value.transactions || [];
        renderEarningsLedger(txList);
      } else {
        if (earningsTableBody) {
          earningsTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--error);">Failed to load earnings ledger.</td></tr>`;
        }
      }
    } catch (err) {
      console.error('Earnings load failed:', err);
    }
  }

  function renderEarningsLedger(transactions) {
    if (!earningsTableBody) return;

    if (!transactions.length) {
      earningsTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; padding:36px; color:var(--text-muted);">
            <i class="fa-solid fa-hand-holding-dollar" style="font-size:24px; color:var(--text-faint); margin-bottom:8px; display:block;"></i>
            No traveler delivery earnings recorded yet. Carry parcels to start earning!
          </td>
        </tr>
      `;
      return;
    }

    earningsTableBody.innerHTML = transactions.map(tx => {
      const dateStr = window.TravelBuddyDate
        ? window.TravelBuddyDate.formatDateTime(tx.createdAt)
        : new Date(tx.createdAt).toLocaleString('en-IN');

      const refId = tx.referenceId || tx.meta?.orderId || '';
      const parcelId = tx.meta?.parcelId || (refId.startsWith('TB-') ? refId : '');

      const actionCell = parcelId
        ? `<a href="parcel-details.html?id=${encodeURIComponent(parcelId)}" class="link-btn" style="font-size:12.5px;">View Parcel &rarr;</a>`
        : '<span style="color:var(--text-faint); font-size:12px;">—</span>';

      return `
        <tr>
          <td style="font-size:12.5px; color:var(--text-muted);">${escapeHTML(dateStr)}</td>
          <td style="font-family:monospace; font-weight:700; font-size:12.5px; color:var(--primary);">${escapeHTML(refId || 'N/A')}</td>
          <td>
            <strong style="font-size:13.5px; color:var(--text-main); display:block;">${escapeHTML(tx.description || 'Delivery Earning')}</strong>
          </td>
          <td style="font-weight:800; font-size:14px; color:var(--success);">
            +${formatPaise(tx.amount)}
          </td>
          <td>${statusBadge(tx.status || 'completed')}</td>
          <td>${actionCell}</td>
        </tr>
      `;
    }).join('');
  }

  if (exportEarningsBtn) {
    exportEarningsBtn.addEventListener('click', () => {
      window.open(`${API_ORIGIN}/api/payments/wallet-transactions/export?type=traveler_earning`, '_blank');
    });
  }

  loadEarningsData();
})();
