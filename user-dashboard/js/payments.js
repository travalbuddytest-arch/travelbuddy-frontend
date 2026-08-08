(function () {
  'use strict';

  const { API_ORIGIN, authHeaders, escapeHTML, formatDate, setButtonLoading } = window.TravelBuddy;
  const paymentForm = document.getElementById('razorpayPaymentForm');
  const payNowBtn = document.getElementById('payNowBtn');
  const verifyPaymentBtn = document.getElementById('verifyPaymentBtn');
  const sandboxStatus = document.getElementById('sandboxStatus');
  const pageParams = new URLSearchParams(window.location.search);

  // Holds the most recent Razorpay order id so "Verify latest order" can re-check it.
  let latestOrderId = pageParams.get('razorpay_order_id') || '';
  // Holds the payment id + signature returned by Razorpay Checkout after a successful attempt.
  let latestPaymentId = '';
  let latestSignature = '';

  function setStatus(message) {
    if (sandboxStatus) sandboxStatus.textContent = message;
  }

  function formatRupees(value) {
    return `Rs. ${Number(value || 0).toFixed(2)}`;
  }

  async function refreshWalletBalance() {
    try {
      const user = await window.TravelBuddy.getCurrentUser();
      if (!user) return;
      const walletValue = document.getElementById('walletBalanceValue');
      if (walletValue) walletValue.textContent = formatRupees(user.walletBalance || 0);
    } catch (err) {
      console.error('Wallet refresh failed:', err);
    }
  }

  // Used only for Razorpay Payment status text (from /verify-order), which has its
  // own status vocabulary (created/attempted/paid/captured) — kept separate from the
  // wallet-transaction status labels below, which use a different vocabulary.
  function statusLabel(status) {
    if (status === 'paid' || status === 'captured') return 'paid';
    if (status === 'created' || status === 'attempted') return 'pending';
    return status || 'pending';
  }

  // BUG FIX: this used to call /wallet-transactions (which returns WalletTransaction
  // documents: type/direction/status held|released|refunded|completed) but rendered
  // the rows as if they were Razorpay Payment documents (reading a .razorpayOrderId
  // field that doesn't exist here, and matching statuses like "paid"/"captured" that
  // also don't exist on this data). Every row silently fell through to "Razorpay" /
  // "pending" regardless of what actually happened. Fixed to use the real fields.
  const WALLET_TYPE_LABELS = {
    topup: 'Wallet top-up',
    order_hold: 'Payment held',
    order_refund: 'Refund',
    traveler_earning: 'Delivery earning',
    platform_commission: 'Platform commission',
    cancellation_fee: 'Cancellation fee',
    cancellation_compensation: 'Cancellation compensation',
  };

  function walletTypeLabel(type) {
    return WALLET_TYPE_LABELS[type] || (type || 'Transaction');
  }

  function walletStatusClass(status) {
    if (status === 'completed' || status === 'released') return 'delivered';
    if (status === 'refunded') return 'pending';
    if (status === 'held') return 'pending';
    return 'pending';
  }

  function walletStatusLabel(status) {
    return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Pending';
  }

  function currentTxFilters() {
    const search = document.getElementById('txSearch');
    const type = document.getElementById('txTypeFilter');
    const status = document.getElementById('txStatusFilter');
    const params = new URLSearchParams();
    if (search && search.value.trim()) params.set('search', search.value.trim());
    if (type && type.value) params.set('type', type.value);
    if (status && status.value) params.set('status', status.value);
    return params;
  }

  async function renderTransactions() {
    const body = document.getElementById('txTableBody');
    if (!body) return;

    let transactions = [];
    try {
      const params = currentTxFilters();
      const res = await fetch(`${API_ORIGIN}/api/payments/wallet-transactions?${params.toString()}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load transactions.');
      transactions = data.transactions || [];
    } catch (err) {
      console.error(err);
      body.innerHTML = `
        <tr>
          <td colspan="5">Could not load payment transactions.</td>
        </tr>
      `;
      return;
    }

    if (!transactions.length) {
      body.innerHTML = `
        <tr>
          <td colspan="5">No wallet transactions match your filters.</td>
        </tr>
      `;
      return;
    }

    body.innerHTML = transactions.map((tx, i) => `
      <tr style="animation-delay:${i * 0.05}s">
        <td>${escapeHTML(formatDate(tx.createdAt, { day: '2-digit', month: 'short', year: 'numeric' }))}</td>
        <td>${escapeHTML(tx.description || tx.orderId || walletTypeLabel(tx.type))}</td>
        <td>${escapeHTML(walletTypeLabel(tx.type))}</td>
        <td>${escapeHTML(`${tx.direction === 'debit' ? '-' : '+'}Rs. ${Number(tx.amount || 0).toFixed(2)}`)}</td>
        <td><span class="tag tag--${walletStatusClass(tx.status)}">${escapeHTML(walletStatusLabel(tx.status))}</span></td>
      </tr>
    `).join('');
  }

  function bindTxFilterControls() {
    const search = document.getElementById('txSearch');
    const type = document.getElementById('txTypeFilter');
    const status = document.getElementById('txStatusFilter');
    const exportBtn = document.getElementById('txExportBtn');

    let debounceTimer;
    if (search) search.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(renderTransactions, 300);
    });
    if (type) type.addEventListener('change', renderTransactions);
    if (status) status.addEventListener('change', renderTransactions);

    if (exportBtn) exportBtn.addEventListener('click', () => {
      // A raw navigation/download can't carry a fetch-style Authorization header,
      // but login already sets the travelbuddy_session cookie, and the browser
      // attaches cookies automatically to a normal same-site navigation like this.
      const params = currentTxFilters();
      window.open(`${API_ORIGIN}/api/payments/wallet-transactions/export?${params.toString()}`, '_blank');
    });
  }

  async function verifyLatestOrder() {
    if (!latestOrderId) return;
    if (verifyPaymentBtn) verifyPaymentBtn.disabled = true;

    try {
      const res = await fetch(`${API_ORIGIN}/api/payments/verify-order`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          razorpay_order_id: latestOrderId,
          razorpay_payment_id: latestPaymentId,
          razorpay_signature: latestSignature,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        window.showToast(data.error || 'Payment verification failed.', 'error');
        setStatus(data.error || 'Payment verification failed.');
        return;
      }

      const payment = data.payment || {};
      setStatus(`Latest order ${payment.razorpayOrderId || latestOrderId} is ${statusLabel(payment.status)}.`);
      window.showToast(payment.status === 'paid' || payment.status === 'captured' ? 'Payment verified as paid.' : 'Payment is not paid yet.', (payment.status === 'paid' || payment.status === 'captured') ? 'success' : 'error');
      await renderTransactions();
      await refreshWalletBalance();
    } catch (err) {
      console.error(err);
      window.showToast('Could not reach the server for verification.', 'error');
    } finally {
      if (verifyPaymentBtn) verifyPaymentBtn.disabled = !latestOrderId;
    }
  }

  function openRazorpayCheckout(order) {
    return new Promise((resolve, reject) => {
      if (!window.Razorpay) {
        reject(new Error('Razorpay checkout script did not load.'));
        return;
      }

      const options = {
        key: order.keyId, // Razorpay Test Key ID, returned by the backend (never the key secret)
        amount: order.amount, // amount in paise, as returned by the backend
        currency: order.currency || 'INR',
        name: 'Travel Buddy',
        description: 'Travel Buddy Razorpay test payment',
        order_id: order.orderId,
        handler: function (response) {
          resolve(response);
        },
        modal: {
          ondismiss: function () {
            reject(new Error('dismissed'));
          },
        },
        theme: { color: '#0D6EFD' },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        reject(new Error(response?.error?.description || 'Payment failed.'));
      });
      rzp.open();
    });
  }

  if (paymentForm) {
    paymentForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const amount = Number(document.getElementById('testAmount')?.value);
      if (!Number.isFinite(amount) || amount < 1) {
        window.showToast('Enter a test amount of at least Rs. 1.', 'error');
        return;
      }

      setButtonLoading(payNowBtn, true);
      try {
        const res = await fetch(`${API_ORIGIN}/api/payments/create-order`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            amount,
            description: 'Travel Buddy Razorpay test payment',
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          window.showToast(data.error || 'Could not create Razorpay order.', 'error');
          setStatus(data.error || 'Could not create Razorpay order.');
          return;
        }

        latestOrderId = data.orderId;
        if (verifyPaymentBtn) verifyPaymentBtn.disabled = false;
        setStatus(`Created order ${latestOrderId}. Complete checkout, then verification will run.`);

        const response = await openRazorpayCheckout(data);
        latestPaymentId = response.razorpay_payment_id;
        latestSignature = response.razorpay_signature;

        await verifyLatestOrder();
      } catch (err) {
        console.error(err);
        if (err.message === 'dismissed') {
          setStatus('Checkout closed before completing payment.');
        } else {
          window.showToast(err.message || 'Razorpay test payment could not start.', 'error');
        }
      } finally {
        setButtonLoading(payNowBtn, false);
      }
    });
  }

  if (verifyPaymentBtn) {
    verifyPaymentBtn.disabled = !latestOrderId;
    verifyPaymentBtn.addEventListener('click', verifyLatestOrder);
  }

  function applyRequestedTopupAmount() {
    const requested = Number(pageParams.get('topup') || sessionStorage.getItem('travelBuddyTopupAmount') || 0);
    if (!Number.isFinite(requested) || requested <= 0) return;
    const amountInput = document.getElementById('testAmount');
    if (amountInput) amountInput.value = requested.toFixed(2);
    setStatus(`Add ${formatRupees(requested)} to your wallet, then return to Post a Parcel.`);
    sessionStorage.removeItem('travelBuddyTopupAmount');
  }

  const withdrawBtn = document.getElementById('withdrawBtn');
  const addMethodBtn = document.getElementById('addMethodBtn');

  if (withdrawBtn) {
    withdrawBtn.addEventListener('click', () => {
      window.showToast('Withdrawal request submitted. Funds arrive in 1-2 business days.', 'success');
    });
  }

  if (addMethodBtn) {
    addMethodBtn.addEventListener('click', () => {
      window.showToast('Payment method setup would open here.', 'success');
    });
  }

  bindTxFilterControls();
  renderTransactions();
  refreshWalletBalance();
  applyRequestedTopupAmount();
})();
