(function () {
  'use strict';

  const { API_ORIGIN, authHeaders, escapeHTML, formatPaise, toPaise, setButtonLoading, statusBadge } = window.TravelBuddy;

  // Elements
  const availBalanceValue = document.getElementById('availBalanceValue');
  const lockedBalanceValue = document.getElementById('lockedBalanceValue');
  const unverifiedNotice = document.getElementById('unverifiedNotice');

  const withdrawRequestForm = document.getElementById('withdrawRequestForm');
  const withdrawAmount = document.getElementById('withdrawAmount');
  const quickAllBtn = document.getElementById('quickAllBtn');
  const requestOtpBtn = document.getElementById('requestOtpBtn');

  const typeUpiCard = document.getElementById('typeUpiCard');
  const typeBankCard = document.getElementById('typeBankCard');
  const upiFieldsWrap = document.getElementById('upiFieldsWrap');
  const bankFieldsWrap = document.getElementById('bankFieldsWrap');
  const upiIdInput = document.getElementById('upiIdInput');
  const bankHolderName = document.getElementById('bankHolderName');
  const bankAccountNumber = document.getElementById('bankAccountNumber');
  const bankAccountNumberConfirm = document.getElementById('bankAccountNumberConfirm');
  const bankIfsc = document.getElementById('bankIfsc');
  const bankName = document.getElementById('bankName');

  const savedMethodsWrap = document.getElementById('savedMethodsWrap');
  const savedPayoutSelect = document.getElementById('savedPayoutSelect');

  const withdrawVerifyForm = document.getElementById('withdrawVerifyForm');
  const withdrawOtpInput = document.getElementById('withdrawOtpInput');
  const cancelStep2Btn = document.getElementById('cancelStep2Btn');
  const confirmWithdrawBtn = document.getElementById('confirmWithdrawBtn');

  const withdrawalsTableBody = document.getElementById('withdrawalsTableBody');

  // State
  let availableBalancePaise = 0;
  let currentMethod = 'upi';
  let savedMethods = [];
  let currentUser = null;

  async function loadInitialData() {
    try {
      const [meRes, walletRes, methodsRes] = await Promise.allSettled([
        fetch(`${API_ORIGIN}/api/auth/me`, { headers: authHeaders() }).then(r => r.json()),
        fetch(`${API_ORIGIN}/api/payments/wallet-summary`, { headers: authHeaders() }).then(r => r.json()),
        fetch(`${API_ORIGIN}/api/withdraw/payout-methods`, { headers: authHeaders() }).then(r => r.json())
      ]);

      if (meRes.status === 'fulfilled' && meRes.value.user) {
        currentUser = meRes.value.user;
        if (!currentUser.isVerified && unverifiedNotice) {
          unverifiedNotice.classList.remove('hidden');
        }
      }

      if (walletRes.status === 'fulfilled') {
        const w = walletRes.value;
        availableBalancePaise = Number(w.walletBalance || 0);
        const lockedPaise = Number(w.lockedBalance || 0);
        if (availBalanceValue) availBalanceValue.textContent = formatPaise(availableBalancePaise);
        if (lockedBalanceValue) lockedBalanceValue.textContent = formatPaise(lockedPaise);
      }

      if (methodsRes.status === 'fulfilled' && methodsRes.value.methods) {
        savedMethods = methodsRes.value.methods;
        populateSavedMethods(savedMethods);
      }

      loadWithdrawalHistory();
    } catch (err) {
      console.error('Failed to load initial withdrawal data:', err);
    }
  }

  function populateSavedMethods(methods) {
    if (!methods.length || !savedPayoutSelect || !savedMethodsWrap) return;

    savedPayoutSelect.innerHTML = '<option value="new">+ Enter a new payout destination</option>' +
      methods.map((m, idx) => {
        const label = m.type === 'upi'
          ? `UPI: ${m.upiId}`
          : `Bank: ${m.bankDetails?.bankName || 'A/C'} •••• ${String(m.bankDetails?.accountNumber || '').slice(-4)}`;
        return `<option value="${idx}">${escapeHTML(label)}</option>`;
      }).join('');

    savedMethodsWrap.classList.remove('hidden');

    // Auto select first saved method
    if (methods.length > 0) {
      savedPayoutSelect.value = '0';
      applySavedMethod(methods[0]);
    }

    savedPayoutSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'new') {
        upiIdInput.value = '';
        bankHolderName.value = '';
        bankAccountNumber.value = '';
        bankAccountNumberConfirm.value = '';
        bankIfsc.value = '';
        bankName.value = '';
      } else {
        const m = savedMethods[parseInt(val, 10)];
        if (m) applySavedMethod(m);
      }
    });
  }

  function applySavedMethod(m) {
    setMethod(m.type);
    if (m.type === 'upi') {
      if (upiIdInput) upiIdInput.value = m.upiId || '';
    } else if (m.type === 'bank' && m.bankDetails) {
      if (bankHolderName) bankHolderName.value = m.bankDetails.accountHolderName || '';
      if (bankAccountNumber) bankAccountNumber.value = m.bankDetails.accountNumber || '';
      if (bankAccountNumberConfirm) bankAccountNumberConfirm.value = m.bankDetails.accountNumber || '';
      if (bankIfsc) bankIfsc.value = m.bankDetails.ifscCode || '';
      if (bankName) bankName.value = m.bankDetails.bankName || '';
    }
  }

  function setMethod(type) {
    currentMethod = type;
    if (type === 'upi') {
      typeUpiCard?.classList.add('active');
      typeBankCard?.classList.remove('active');
      upiFieldsWrap?.classList.remove('hidden');
      bankFieldsWrap?.classList.add('hidden');
    } else {
      typeBankCard?.classList.add('active');
      typeUpiCard?.classList.remove('active');
      bankFieldsWrap?.classList.remove('hidden');
      upiFieldsWrap?.classList.add('hidden');
    }
  }

  typeUpiCard?.addEventListener('click', () => setMethod('upi'));
  typeBankCard?.addEventListener('click', () => setMethod('bank'));

  // Quick Amount Buttons
  if (quickAllBtn) {
    quickAllBtn.addEventListener('click', () => {
      const maxRupees = Math.min(50000, Math.floor(availableBalancePaise / 100));
      if (withdrawAmount) withdrawAmount.value = maxRupees > 0 ? maxRupees : 100;
    });
  }

  document.querySelectorAll('.quick-amount-pill[data-amount]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (withdrawAmount) withdrawAmount.value = btn.dataset.amount;
    });
  });

  // Step 1: Submit Request for OTP
  if (withdrawRequestForm) {
    withdrawRequestForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (currentUser && !currentUser.isVerified) {
        window.showToast('Please complete identity verification in Profile before requesting a withdrawal.', 'error');
        return;
      }

      const rupees = Number(withdrawAmount?.value);
      if (!Number.isFinite(rupees) || rupees < 100 || rupees > 50000) {
        window.showToast('Withdrawal amount must be between ₹100 and ₹50,000.', 'warning');
        withdrawAmount?.focus();
        return;
      }

      const paise = toPaise(rupees);
      if (paise > availableBalancePaise) {
        window.showToast('Withdrawal amount exceeds your available balance.', 'error');
        return;
      }

      if (currentMethod === 'upi') {
        const upi = upiIdInput?.value.trim();
        if (!upi || !upi.includes('@')) {
          window.showToast('Please enter a valid UPI ID (e.g. yourname@bank).', 'warning');
          upiIdInput?.focus();
          return;
        }
      } else {
        const holder = bankHolderName?.value.trim();
        const acc = bankAccountNumber?.value.trim();
        const confirmAcc = bankAccountNumberConfirm?.value.trim();
        const ifsc = bankIfsc?.value.trim();

        if (!holder || !acc || !ifsc) {
          window.showToast('Please fill in all required bank details.', 'warning');
          return;
        }
        if (acc !== confirmAcc) {
          window.showToast('Account numbers do not match.', 'error');
          bankAccountNumberConfirm?.focus();
          return;
        }
        if (ifsc.length < 8) {
          window.showToast('Please enter a valid IFSC code.', 'warning');
          bankIfsc?.focus();
          return;
        }
      }

      setButtonLoading(requestOtpBtn, true, 'Sending Email OTP...');

      try {
        const res = await fetch(`${API_ORIGIN}/api/withdraw/request`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ amount: paise })
        });
        const data = await res.json();

        if (!res.ok) {
          window.showToast(data.error || 'Failed to request withdrawal OTP.', 'error');
          return;
        }

        window.showToast(data.message || 'OTP sent to your registered email address.', 'success');
        withdrawVerifyForm?.classList.remove('hidden');
        withdrawRequestForm?.classList.add('hidden');
        withdrawOtpInput?.focus();
      } catch (err) {
        console.error(err);
        window.showToast('Could not reach server to send OTP.', 'error');
      } finally {
        setButtonLoading(requestOtpBtn, false);
      }
    });
  }

  cancelStep2Btn?.addEventListener('click', () => {
    withdrawVerifyForm?.classList.add('hidden');
    withdrawRequestForm?.classList.remove('hidden');
  });

  // Step 2: Confirm OTP
  if (withdrawVerifyForm) {
    withdrawVerifyForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const otp = withdrawOtpInput?.value.trim();
      if (otp.length !== 6) {
        window.showToast('Please enter the 6-digit OTP.', 'warning');
        withdrawOtpInput?.focus();
        return;
      }

      setButtonLoading(confirmWithdrawBtn, true, 'Verifying...');

      const payload = {
        method: currentMethod,
        otp: otp
      };

      if (currentMethod === 'upi') {
        payload.upiId = upiIdInput.value.trim();
      } else {
        payload.bankDetails = {
          accountHolderName: bankHolderName.value.trim(),
          accountNumber: bankAccountNumber.value.trim(),
          ifscCode: bankIfsc.value.trim().toUpperCase(),
          bankName: bankName.value.trim()
        };
      }

      try {
        const res = await fetch(`${API_ORIGIN}/api/withdraw/verify`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (!res.ok) {
          window.showToast(data.error || 'Invalid or expired OTP.', 'error');
          return;
        }

        window.showToast('Withdrawal request confirmed successfully! Transfer will be initiated shortly.', 'success');

        withdrawVerifyForm.reset();
        withdrawRequestForm.reset();
        withdrawVerifyForm.classList.add('hidden');
        withdrawRequestForm.classList.remove('hidden');

        loadInitialData();
      } catch (err) {
        console.error(err);
        window.showToast('Network error verifying withdrawal.', 'error');
      } finally {
        setButtonLoading(confirmWithdrawBtn, false);
      }
    });
  }

  // Load Withdrawal History
  async function loadWithdrawalHistory() {
    if (!withdrawalsTableBody) return;

    try {
      const res = await fetch(`${API_ORIGIN}/api/withdraw/history`, { headers: authHeaders() });
      const data = await res.json();

      if (!res.ok) {
        withdrawalsTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--error);">Failed to load history.</td></tr>`;
        return;
      }

      const list = data.withdrawals || [];
      renderWithdrawalHistory(list);
    } catch (err) {
      console.error(err);
      withdrawalsTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--error);">Could not connect to server.</td></tr>`;
    }
  }

  function renderWithdrawalHistory(withdrawals) {
    if (!withdrawalsTableBody) return;

    if (!withdrawals.length) {
      withdrawalsTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; padding:36px; color:var(--text-muted);">
            <i class="fa-solid fa-money-bill-transfer" style="font-size:24px; color:var(--text-faint); margin-bottom:8px; display:block;"></i>
            No withdrawal requests made yet.
          </td>
        </tr>
      `;
      return;
    }

    withdrawalsTableBody.innerHTML = withdrawals.map(w => {
      const isRequested = w.status === 'requested';
      const dateStr = window.TravelBuddyDate
        ? window.TravelBuddyDate.formatDateTime(w.createdAt)
        : new Date(w.createdAt).toLocaleString('en-IN');

      const dest = w.method === 'upi'
        ? `UPI: ${escapeHTML(w.upiId || 'UPI ID')}`
        : `Bank: •••• ${escapeHTML(String(w.bankDetails?.accountNumber || '').slice(-4))}`;

      const actionBtn = isRequested
        ? `<button type="button" class="btn-ghost cancel-wd-btn" data-id="${escapeHTML(w._id)}" style="color:var(--error); padding:4px 10px; font-size:12px; height:auto;">
             Cancel
           </button>`
        : '<span style="color:var(--text-faint); font-size:12px;">—</span>';

      return `
        <tr>
          <td style="font-size:12.5px; color:var(--text-muted);">${escapeHTML(dateStr)}</td>
          <td style="font-family:monospace; font-weight:700; font-size:12.5px;">${escapeHTML(w.withdrawalId || w._id)}</td>
          <td style="font-size:13px;">${dest}</td>
          <td style="font-weight:800; font-size:14px; color:var(--text-main);">${formatPaise(w.amount)}</td>
          <td>${statusBadge(w.status)}</td>
          <td>${actionBtn}</td>
        </tr>
      `;
    }).join('');

    withdrawalsTableBody.querySelectorAll('.cancel-wd-btn').forEach(btn => {
      btn.addEventListener('click', () => cancelWithdrawal(btn.dataset.id));
    });
  }

  async function cancelWithdrawal(id) {
    if (!confirm('Are you sure you want to cancel this withdrawal request? The funds will be restored to your available balance.')) {
      return;
    }

    try {
      const res = await fetch(`${API_ORIGIN}/api/withdraw/cancel`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ withdrawalId: id })
      });
      const data = await res.json();

      if (!res.ok) {
        window.showToast(data.error || 'Failed to cancel withdrawal.', 'error');
        return;
      }

      window.showToast(data.message || 'Withdrawal cancelled successfully.', 'success');
      loadInitialData();
    } catch (err) {
      console.error(err);
      window.showToast('Could not cancel withdrawal request.', 'error');
    }
  }

  loadInitialData();
})();
