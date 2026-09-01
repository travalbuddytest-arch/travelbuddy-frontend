(function () {
  'use strict';

  const { API_ORIGIN, authHeaders, escapeHTML, setButtonLoading } = window.TravelBuddy;

  // Elements
  const payoutMethodsLoading = document.getElementById('payoutMethodsLoading');
  const payoutMethodsEmpty = document.getElementById('payoutMethodsEmpty');
  const payoutMethodsGrid = document.getElementById('payoutMethodsGrid');

  const paymentMethodsLoading = document.getElementById('paymentMethodsLoading');
  const paymentMethodsEmpty = document.getElementById('paymentMethodsEmpty');
  const paymentMethodsGrid = document.getElementById('paymentMethodsGrid');

  const openAddMethodBtn = document.getElementById('openAddMethodBtn');
  const addMethodModal = document.getElementById('addMethodModal');
  const addMethodClose = document.getElementById('addMethodClose');
  const addMethodForm = document.getElementById('addMethodForm');
  const methodTypeSelect = document.getElementById('methodTypeSelect');
  const methodProviderInput = document.getElementById('methodProviderInput');
  const methodLabelInput = document.getElementById('methodLabelInput');
  const methodDefaultCheck = document.getElementById('methodDefaultCheck');
  const saveMethodBtn = document.getElementById('saveMethodBtn');

  async function loadPayoutMethods() {
    if (payoutMethodsLoading) payoutMethodsLoading.classList.remove('hidden');
    if (payoutMethodsEmpty) payoutMethodsEmpty.classList.add('hidden');
    if (payoutMethodsGrid) payoutMethodsGrid.innerHTML = '';

    try {
      const res = await fetch(`${API_ORIGIN}/api/withdraw/payout-methods`, { headers: authHeaders() });
      const data = await res.json();

      if (!res.ok) {
        window.showToast(data.error || 'Failed to load payout methods.', 'error');
        return;
      }

      const list = data.methods || [];
      renderPayoutMethods(list);
    } catch (err) {
      console.error(err);
      window.showToast('Could not load payout destinations.', 'error');
    } finally {
      if (payoutMethodsLoading) payoutMethodsLoading.classList.add('hidden');
    }
  }

  function renderPayoutMethods(methods) {
    if (!payoutMethodsGrid) return;

    if (!methods.length) {
      if (payoutMethodsEmpty) payoutMethodsEmpty.classList.remove('hidden');
      return;
    }

    if (payoutMethodsEmpty) payoutMethodsEmpty.classList.add('hidden');

    payoutMethodsGrid.innerHTML = methods.map(m => {
      const isUpi = m.type === 'upi';
      const icon = isUpi
        ? '<i class="fa-solid fa-mobile-screen-button"></i>'
        : '<i class="fa-solid fa-building-columns"></i>';

      const title = isUpi ? 'UPI Payout' : (m.bankDetails?.bankName || 'Bank Account');
      const detail = isUpi
        ? escapeHTML(m.upiId || '')
        : `A/C •••• ${escapeHTML(String(m.bankDetails?.accountNumber || '').slice(-4))} (${escapeHTML(m.bankDetails?.ifscCode || '')})`;
      const holder = isUpi ? '' : `<span style="font-size:12px; color:var(--text-muted);">${escapeHTML(m.bankDetails?.accountHolderName || '')}</span>`;

      return `
        <div class="method-card">
          <div class="method-card-top">
            <div class="method-icon-wrap">${icon}</div>
            ${m.isDefault ? '<span class="tag tag--delivered">Default Payout</span>' : ''}
          </div>

          <div>
            <strong style="font-size:15px; display:block; color:var(--text-main);">${escapeHTML(title)}</strong>
            <span style="font-size:13.5px; font-family:monospace; color:var(--text-muted); display:block; margin:4px 0;">${detail}</span>
            ${holder}
          </div>

          <div class="method-card-footer">
            <span style="font-size:11.5px; color:var(--text-faint);">
              <i class="fa-solid fa-circle-check" style="color:var(--success);"></i> Verified
            </span>
            <a href="withdraw.html" class="link-btn" style="font-size:12px;">Withdraw Here &rarr;</a>
          </div>
        </div>
      `;
    }).join('');
  }

  async function loadPaymentMethods() {
    if (paymentMethodsLoading) paymentMethodsLoading.classList.remove('hidden');
    if (paymentMethodsEmpty) paymentMethodsEmpty.classList.add('hidden');
    if (paymentMethodsGrid) paymentMethodsGrid.innerHTML = '';

    try {
      const res = await fetch(`${API_ORIGIN}/api/settings/payment-methods`, { headers: authHeaders() });
      const data = await res.json();

      if (!res.ok) {
        window.showToast(data.error || 'Failed to load payment instruments.', 'error');
        return;
      }

      const list = data.methods || [];
      renderPaymentMethods(list);
    } catch (err) {
      console.error(err);
      window.showToast('Could not load payment methods.', 'error');
    } finally {
      if (paymentMethodsLoading) paymentMethodsLoading.classList.add('hidden');
    }
  }

  function renderPaymentMethods(methods) {
    if (!paymentMethodsGrid) return;

    if (!methods.length) {
      if (paymentMethodsEmpty) paymentMethodsEmpty.classList.remove('hidden');
      return;
    }

    if (paymentMethodsEmpty) paymentMethodsEmpty.classList.add('hidden');

    paymentMethodsGrid.innerHTML = methods.map(m => {
      const isCard = m.type === 'card';
      const icon = isCard
        ? '<i class="fa-solid fa-credit-card"></i>'
        : '<i class="fa-solid fa-wallet"></i>';

      return `
        <div class="method-card">
          <div class="method-card-top">
            <div class="method-icon-wrap">${icon}</div>
            ${m.isDefault ? '<span class="tag tag--delivered">Default</span>' : ''}
          </div>

          <div>
            <strong style="font-size:15px; display:block; color:var(--text-main);">${escapeHTML(m.provider)}</strong>
            <span style="font-size:14px; font-family:monospace; color:var(--text-muted); margin-top:4px; display:block;">${escapeHTML(m.label)}</span>
          </div>

          <div class="method-card-footer">
            <span style="font-size:11.5px; color:var(--text-faint); text-transform:uppercase;">${escapeHTML(m.type)}</span>
            <button type="button" class="btn-ghost delete-method-btn" data-id="${escapeHTML(m._id)}" style="color:var(--error); padding:2px 8px; font-size:12px; height:auto;">
              <i class="fa-solid fa-trash"></i> Remove
            </button>
          </div>
        </div>
      `;
    }).join('');

    paymentMethodsGrid.querySelectorAll('.delete-method-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteMethod(btn.dataset.id));
    });
  }

  async function deleteMethod(id) {
    if (!confirm('Are you sure you want to remove this payment method?')) return;

    try {
      const res = await fetch(`${API_ORIGIN}/api/settings/payment-methods/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      const data = await res.json();

      if (!res.ok) {
        window.showToast(data.error || 'Failed to remove method.', 'error');
        return;
      }

      window.showToast('Payment method removed.', 'success');
      loadPaymentMethods();
    } catch (err) {
      console.error(err);
      window.showToast('Could not delete payment method.', 'error');
    }
  }

  // Modal Handlers
  if (openAddMethodBtn) {
    openAddMethodBtn.addEventListener('click', () => {
      addMethodForm.reset();
      addMethodModal.classList.remove('hidden');
      methodProviderInput.focus();
    });
  }

  if (addMethodClose) {
    addMethodClose.addEventListener('click', () => addMethodModal.classList.add('hidden'));
  }

  if (addMethodForm) {
    addMethodForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const type = methodTypeSelect.value;
      const provider = methodProviderInput.value.trim();
      const label = methodLabelInput.value.trim();
      const isDefault = methodDefaultCheck.checked;

      if (!provider || !label) {
        window.showToast('Please fill in provider and identifier.', 'warning');
        return;
      }

      setButtonLoading(saveMethodBtn, true, 'Saving...');

      try {
        const res = await fetch(`${API_ORIGIN}/api/settings/payment-methods`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ type, provider, label, isDefault })
        });
        const data = await res.json();

        if (!res.ok) {
          window.showToast(data.error || 'Could not save payment method.', 'error');
          return;
        }

        window.showToast('Payment method saved successfully!', 'success');
        addMethodModal.classList.add('hidden');
        loadPaymentMethods();
      } catch (err) {
        console.error(err);
        window.showToast('Failed to save payment method.', 'error');
      } finally {
        setButtonLoading(saveMethodBtn, false);
      }
    });
  }

  loadPayoutMethods();
  loadPaymentMethods();
})();
