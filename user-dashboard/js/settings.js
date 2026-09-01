(function () {
  'use strict';

  const { API_ORIGIN, authHeaders, escapeHTML, setButtonLoading } = window.TravelBuddy;

  // Addresses Elements
  const addressesLoading = document.getElementById('addressesLoading');
  const addressesEmpty = document.getElementById('addressesEmpty');
  const addressesList = document.getElementById('addressesList');

  const openAddAddressBtn = document.getElementById('openAddAddressBtn');
  const addAddressModal = document.getElementById('addAddressModal');
  const addAddressClose = document.getElementById('addAddressClose');
  const addAddressForm = document.getElementById('addAddressForm');
  const addressLabelInput = document.getElementById('addressLabelInput');
  const addressTextInput = document.getElementById('addressTextInput');
  const addressDefaultCheck = document.getElementById('addressDefaultCheck');
  const saveAddressBtn = document.getElementById('saveAddressBtn');

  // Feedback Elements
  const feedbackForm = document.getElementById('feedbackForm');
  const feedbackRatingSelect = document.getElementById('feedbackRatingSelect');
  const feedbackCommentInput = document.getElementById('feedbackCommentInput');
  const submitFeedbackBtn = document.getElementById('submitFeedbackBtn');

  async function loadAddresses() {
    if (addressesLoading) addressesLoading.classList.remove('hidden');
    if (addressesEmpty) addressesEmpty.classList.add('hidden');
    if (addressesList) addressesList.innerHTML = '';

    try {
      const res = await fetch(`${API_ORIGIN}/api/settings/addresses`, { headers: authHeaders() });
      const data = await res.json();

      if (!res.ok) {
        window.showToast(data.error || 'Failed to load addresses.', 'error');
        return;
      }

      const list = data.addresses || [];
      if (!list.length) {
        if (addressesEmpty) addressesEmpty.classList.remove('hidden');
        return;
      }

      renderAddresses(list);
    } catch (err) {
      console.error(err);
      window.showToast('Could not load saved addresses.', 'error');
    } finally {
      if (addressesLoading) addressesLoading.classList.add('hidden');
    }
  }

  function renderAddresses(addresses) {
    if (!addressesList) return;

    addressesList.innerHTML = addresses.map(addr => `
      <div class="address-card-item">
        <div style="flex:1;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
            <strong style="font-size:14.5px; color:var(--text-main);">${escapeHTML(addr.label)}</strong>
            ${addr.isDefault ? '<span class="tag tag--delivered">Default</span>' : ''}
          </div>
          <p style="margin:0; font-size:13px; color:var(--text-muted); line-height:1.4;">${escapeHTML(addr.address)}</p>
        </div>
        <button type="button" class="btn-ghost delete-addr-btn" data-id="${escapeHTML(addr._id)}" style="color:var(--error); padding:2px 8px; font-size:12px; height:auto;">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    `).join('');

    addressesList.querySelectorAll('.delete-addr-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteAddress(btn.dataset.id));
    });
  }

  async function deleteAddress(id) {
    if (!confirm('Remove this saved address?')) return;

    try {
      const res = await fetch(`${API_ORIGIN}/api/settings/addresses/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      const data = await res.json();

      if (!res.ok) {
        window.showToast(data.error || 'Failed to remove address.', 'error');
        return;
      }

      window.showToast('Address removed.', 'success');
      loadAddresses();
    } catch (err) {
      console.error(err);
      window.showToast('Could not reach server to delete address.', 'error');
    }
  }

  // Add Address Modal
  if (openAddAddressBtn) {
    openAddAddressBtn.addEventListener('click', () => {
      addAddressForm.reset();
      addAddressModal.classList.remove('hidden');
      addressLabelInput.focus();
    });
  }

  if (addAddressClose) {
    addAddressClose.addEventListener('click', () => addAddressModal.classList.add('hidden'));
  }

  if (addAddressForm) {
    addAddressForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const label = addressLabelInput.value.trim();
      const address = addressTextInput.value.trim();
      const isDefault = addressDefaultCheck.checked;

      if (!label || !address) {
        window.showToast('Please fill in both label and address.', 'warning');
        return;
      }

      setButtonLoading(saveAddressBtn, true, 'Saving...');

      try {
        const res = await fetch(`${API_ORIGIN}/api/settings/addresses`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ label, address, isDefault })
        });
        const data = await res.json();

        if (!res.ok) {
          window.showToast(data.error || 'Could not save address.', 'error');
          return;
        }

        window.showToast('Address saved successfully!', 'success');
        addAddressModal.classList.add('hidden');
        loadAddresses();
      } catch (err) {
        console.error(err);
        window.showToast('Network error saving address.', 'error');
      } finally {
        setButtonLoading(saveAddressBtn, false);
      }
    });
  }

  // Feedback Form
  if (feedbackForm) {
    feedbackForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const rating = Number(feedbackRatingSelect.value);
      const comment = feedbackCommentInput.value.trim();

      if (!comment) {
        window.showToast('Please write your feedback comment.', 'warning');
        return;
      }

      setButtonLoading(submitFeedbackBtn, true, 'Submitting...');

      try {
        const res = await fetch(`${API_ORIGIN}/api/settings/feedback`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ rating, comment })
        });
        const data = await res.json();

        if (!res.ok) {
          window.showToast(data.error || 'Failed to submit feedback.', 'error');
          return;
        }

        window.showToast('Thank you! Your feedback helps us make TravelBuddy better.', 'success');
        feedbackForm.reset();
      } catch (err) {
        console.error(err);
        window.showToast('Could not reach server to submit feedback.', 'error');
      } finally {
        setButtonLoading(submitFeedbackBtn, false);
      }
    });
  }

  loadAddresses();
})();
