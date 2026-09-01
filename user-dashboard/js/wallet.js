(function () {
  'use strict';

  const { API_ORIGIN, authHeaders, escapeHTML, formatPaise, setButtonLoading, statusBadge } = window.TravelBuddy;

  // Metric Elements
  const walletAvailableBalance = document.getElementById('walletAvailableBalance');
  const walletLockedBalance = document.getElementById('walletLockedBalance');
  const walletTotalEarnings = document.getElementById('walletTotalEarnings');
  const walletPendingWithdrawal = document.getElementById('walletPendingWithdrawal');

  // Transaction Table Elements
  const txTableBody = document.getElementById('txTableBody');
  const txTypeSelect = document.getElementById('txTypeSelect');
  const txStatusSelect = document.getElementById('txStatusSelect');
  const txSearchInput = document.getElementById('txSearchInput');
  const txExportBtn = document.getElementById('txExportBtn');

  // Modal Elements
  const openAddMoneyBtn = document.getElementById('openAddMoneyBtn');
  const addMoneyModal = document.getElementById('addMoneyModal');
  const addMoneyClose = document.getElementById('addMoneyClose');
  const addMoneyAmount = document.getElementById('addMoneyAmount');
  const proceedPaymentBtn = document.getElementById('proceedPaymentBtn');
  const presetButtons = document.querySelectorAll('.preset-btn');

  let transactionsCache = [];
  let searchDebounceTimer = null;

  async function loadWalletSummary() {
    try {
      const [walletRes, withdrawRes] = await Promise.allSettled([
        fetch(`${API_ORIGIN}/api/payments/wallet-summary`, { headers: authHeaders() }).then(r => r.json()),
        fetch(`${API_ORIGIN}/api/withdraw/history`, { headers: authHeaders() }).then(r => r.json())
      ]);

      const wallet = walletRes.status === 'fulfilled' ? walletRes.value : {};
      const withdrawals = withdrawRes.status === 'fulfilled' ? (withdrawRes.value.withdrawals || []) : [];

      const availablePaise = Number(wallet.walletBalance || 0);
      const lockedPaise = Number(wallet.lockedBalance || 0);
      const earningsPaise = Number(wallet.totalEarnings || 0);

      // Sum pending withdrawals in paise
      const pendingPaise = withdrawals
        .filter(w => w.status === 'requested' || w.status === 'processing')
        .reduce((sum, w) => sum + Number(w.amount || 0), 0);

      if (walletAvailableBalance) walletAvailableBalance.textContent = formatPaise(availablePaise);
      if (walletLockedBalance) walletLockedBalance.textContent = formatPaise(lockedPaise);
      if (walletTotalEarnings) walletTotalEarnings.textContent = formatPaise(earningsPaise);
      if (walletPendingWithdrawal) walletPendingWithdrawal.textContent = formatPaise(pendingPaise);
    } catch (err) {
      console.error('Wallet summary load failed:', err);
    }
  }

  async function loadTransactions() {
    if (!txTableBody) return;

    try {
      const type = txTypeSelect?.value || '';
      const status = txStatusSelect?.value || '';
      const search = txSearchInput?.value.trim() || '';

      const query = new URLSearchParams();
      if (type) query.set('type', type);
      if (status) query.set('status', status);
      if (search) query.set('search', search);

      const res = await fetch(`${API_ORIGIN}/api/payments/wallet-transactions?${query.toString()}`, {
        headers: authHeaders()
      });
      const data = await res.json();

      if (!res.ok) {
        txTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--error);">Failed to load transactions.</td></tr>`;
        return;
      }

      transactionsCache = data.transactions || [];
      renderTransactions(transactionsCache);
    } catch (err) {
      console.error('Transactions load failed:', err);
      txTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--error);">Network error loading transactions.</td></tr>`;
    }
  }

  function renderTransactions(transactions) {
    if (!txTableBody) return;

    if (!transactions.length) {
      txTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center; padding:36px; color:var(--text-muted);">
            <i class="fa-solid fa-receipt" style="font-size:24px; margin-bottom:8px; display:block; color:var(--text-faint);"></i>
            No wallet transactions found.
          </td>
        </tr>
      `;
      return;
    }

    txTableBody.innerHTML = transactions.map(tx => {
      const isCredit = tx.direction === 'credit';
      const sign = isCredit ? '+' : '-';
      const colorStyle = isCredit ? 'color:var(--success);' : 'color:var(--text-main);';
      const amountPaise = Number(tx.amount || 0);

      const dateStr = window.TravelBuddyDate
        ? window.TravelBuddyDate.formatDateTime(tx.createdAt)
        : new Date(tx.createdAt).toLocaleString('en-IN');

      const typeLabel = (tx.type || 'transaction').replace(/_/g, ' ');

      return `
        <tr>
          <td style="font-size:12.5px; color:var(--text-muted);">${escapeHTML(dateStr)}</td>
          <td>
            <strong style="display:block; font-size:13.5px; color:var(--text-main);">${escapeHTML(tx.description || 'Transaction')}</strong>
            <span style="font-size:11.5px; font-family:monospace; color:var(--text-faint);">${escapeHTML(tx.referenceId || '')}</span>
          </td>
          <td style="text-transform:capitalize; font-size:13px;">${escapeHTML(typeLabel)}</td>
          <td style="font-weight:800; font-size:14px; ${colorStyle}">
            ${sign}${formatPaise(amountPaise)}
          </td>
          <td>${statusBadge(tx.status || 'completed')}</td>
        </tr>
      `;
    }).join('');
  }

  // Filter Listeners
  if (txTypeSelect) txTypeSelect.addEventListener('change', loadTransactions);
  if (txStatusSelect) txStatusSelect.addEventListener('change', loadTransactions);
  if (txSearchInput) {
    txSearchInput.addEventListener('input', () => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(loadTransactions, 300);
    });
  }

  // Export CSV
  if (txExportBtn) {
    txExportBtn.addEventListener('click', () => {
      const type = txTypeSelect?.value || '';
      const status = txStatusSelect?.value || '';
      const query = new URLSearchParams();
      if (type) query.set('type', type);
      if (status) query.set('status', status);
      window.open(`${API_ORIGIN}/api/payments/wallet-transactions/export?${query.toString()}`, '_blank');
    });
  }

  // Add Money Modal Handlers
  if (openAddMoneyBtn) {
    openAddMoneyBtn.addEventListener('click', () => {
      addMoneyModal.classList.remove('hidden');
      if (addMoneyAmount) {
        addMoneyAmount.value = '500';
        addMoneyAmount.focus();
      }
    });
  }

  if (addMoneyClose) {
    addMoneyClose.addEventListener('click', () => addMoneyModal.classList.add('hidden'));
  }

  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      presetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (addMoneyAmount) addMoneyAmount.value = btn.dataset.val;
    });
  });

  // Razorpay Checkout
  if (proceedPaymentBtn) {
    proceedPaymentBtn.addEventListener('click', async () => {
      const amountRupees = Number(addMoneyAmount?.value);
      if (!Number.isFinite(amountRupees) || amountRupees < 1) {
        window.showToast('Please enter an amount of at least ₹1.', 'warning');
        return;
      }

      setButtonLoading(proceedPaymentBtn, true, 'Initializing...');
      const amountPaise = Math.round(amountRupees * 100);

      try {
        const orderRes = await fetch(`${API_ORIGIN}/api/payments/create-order`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ amount: amountPaise, description: 'Wallet Top-up' })
        });
        const orderData = await orderRes.json();

        if (!orderRes.ok) {
          window.showToast(orderData.error || 'Could not initiate payment.', 'error');
          setButtonLoading(proceedPaymentBtn, false);
          return;
        }

        if (!window.Razorpay) {
          window.showToast('Payment gateway script failed to load. Please refresh.', 'error');
          setButtonLoading(proceedPaymentBtn, false);
          return;
        }

        const options = {
          key: orderData.keyId,
          amount: orderData.amount, // in paise
          currency: orderData.currency || 'INR',
          name: 'TravelBuddy',
          description: 'Wallet Top-up',
          order_id: orderData.orderId,
          handler: async function (response) {
            setButtonLoading(proceedPaymentBtn, true, 'Verifying payment...');
            try {
              const verifyRes = await fetch(`${API_ORIGIN}/api/payments/verify-order`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature
                })
              });
              const verifyData = await verifyRes.json();

              if (!verifyRes.ok) {
                window.showToast(verifyData.error || 'Verification failed.', 'error');
                return;
              }

              window.showToast('Payment successful! Your wallet balance has been updated.', 'success');
              addMoneyModal.classList.add('hidden');
              loadWalletSummary();
              loadTransactions();
            } catch (vErr) {
              console.error(vErr);
              window.showToast('Could not verify payment with server.', 'error');
            } finally {
              setButtonLoading(proceedPaymentBtn, false);
            }
          },
          theme: { color: '#0D6EFD' }
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (resp) {
          window.showToast(resp.error?.description || 'Payment was unsuccessful.', 'error');
          setButtonLoading(proceedPaymentBtn, false);
        });
        rzp.open();
      } catch (err) {
        console.error(err);
        window.showToast('Network error initializing payment.', 'error');
        setButtonLoading(proceedPaymentBtn, false);
      }
    });
  }

  // Pre-fill topup if coming from another page
  const urlParams = new URLSearchParams(window.location.search);
  const topupParam = urlParams.get('topup');
  if (topupParam && addMoneyAmount) {
    addMoneyModal?.classList.remove('hidden');
    addMoneyAmount.value = topupParam;
  }

  loadWalletSummary();
  loadTransactions();
})();
