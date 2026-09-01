(function () {
  'use strict';

  const { API_ORIGIN, authHeaders, escapeHTML, formatPaise, statusBadge } = window.TravelBuddy;
  const API_BASE = `${API_ORIGIN}/api/postparcel`;

  const parcelsGrid = document.getElementById('parcelsGrid');
  const loadingState = document.getElementById('parcelsLoadingState');
  const emptyState = document.getElementById('parcelsEmptyState');
  const emptyStateTitle = document.getElementById('emptyStateTitle');
  const emptyStateMessage = document.getElementById('emptyStateMessage');
  const filterTabs = document.getElementById('statusFilterTabs');
  const searchInput = document.getElementById('parcelSearchInput');
  const roleSelect = document.getElementById('roleFilterSelect');

  let allParcels = [];
  let currentStatusFilter = 'all';
  let currentRoleFilter = 'all';
  let currentSearchQuery = '';
  let searchDebounceTimer = null;
  let currentUserId = null;

  function initFromQueryParams() {
    const params = new URLSearchParams(window.location.search);
    const filterParam = params.get('filter');
    if (filterParam) {
      currentStatusFilter = filterParam.toLowerCase();
      filterTabs.querySelectorAll('.filter-pill').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.status === currentStatusFilter);
      });
    }
  }

  async function fetchAllParcels() {
    if (loadingState) loadingState.classList.remove('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    if (parcelsGrid) parcelsGrid.innerHTML = '';

    try {
      const user = await window.TravelBuddy.getCurrentUser();
      currentUserId = user?._id || user?.id || '';

      const [trackingRes, myParcelsRes, historyRes] = await Promise.allSettled([
        fetch(`${API_BASE}/tracking`, { headers: authHeaders() }).then(r => r.ok ? r.json() : { parcels: [] }),
        fetch(`${API_BASE}/my-parcels?limit=100`, { headers: authHeaders() }).then(r => r.ok ? r.json() : { parcels: [] }),
        fetch(`${API_BASE}/history?limit=100`, { headers: authHeaders() }).then(r => r.ok ? r.json() : { parcels: [] })
      ]);

      const trackingList = trackingRes.status === 'fulfilled' ? (trackingRes.value.parcels || []) : [];
      const sentList = myParcelsRes.status === 'fulfilled' ? (myParcelsRes.value.parcels || []) : [];
      const historyList = historyRes.status === 'fulfilled' ? (historyRes.value.parcels || []) : [];

      const map = new Map();

      function addParcel(raw, sourceHint) {
        if (!raw) return;
        const id = raw.id || raw._id;
        if (!id) return;

        if (map.has(id)) {
          // Merge details if tracking or history has richer status
          const existing = map.get(id);
          map.set(id, { ...existing, ...raw });
          return;
        }

        const isSender = raw.senderId === currentUserId || raw.role === 'sender' || sourceHint === 'my';
        const senderObj = raw.sender;
        const senderName = typeof senderObj === 'object' ? `${senderObj.firstName || ''} ${senderObj.lastName || ''}`.trim() : (raw.sender || '');

        map.set(id, {
          id: id,
          orderId: raw.orderId || raw.parcelNumber || (id.length > 10 ? `TB-${id.slice(-6).toUpperCase()}` : id),
          from: raw.from || raw.fromCity || 'Origin',
          to: raw.to || raw.toCity || 'Destination',
          desc: raw.desc || raw.description || 'General Parcel',
          status: (raw.status || 'pending').toLowerCase(),
          price: Number(raw.price || 0),
          weight: raw.weight || '1',
          date: raw.date || raw.pickupDate || raw.createdAt || new Date().toISOString(),
          updatedAt: raw.updatedAt || raw.deliveredAt || raw.cancelledAt,
          role: isSender ? 'sender' : 'traveler',
          senderName: senderName,
          recipientName: raw.recipientName || '',
        });
      }

      trackingList.forEach(p => addParcel(p, 'tracking'));
      sentList.forEach(p => addParcel(p, 'my'));
      historyList.forEach(p => addParcel(p, 'history'));

      allParcels = Array.from(map.values()).sort((a, b) => {
        const da = new Date(a.date).getTime() || 0;
        const db = new Date(b.date).getTime() || 0;
        return db - da;
      });

      renderParcels();
    } catch (err) {
      console.error('Fetch parcels failed:', err);
      window.showToast('Unable to load parcels from server.', 'error');
      if (emptyState) {
        emptyState.classList.remove('hidden');
        emptyStateTitle.textContent = 'Error Loading Parcels';
        emptyStateMessage.textContent = 'Please check your internet connection or try again shortly.';
      }
    } finally {
      if (loadingState) loadingState.classList.add('hidden');
    }
  }

  function matchesStatus(parcel, filter) {
    const s = parcel.status;
    if (filter === 'all') return true;
    if (filter === 'active') {
      return ['pending', 'accepted', 'pickup_point_pending', 'pickup_point_selected', 'pickup_confirmed', 'in_transit', 'delivery_point_pending', 'delivery_point_selected', 'out_for_delivery', 'disputed'].includes(s);
    }
    if (filter === 'pending') return s === 'pending';
    if (filter === 'accepted') return ['accepted', 'pickup_point_pending', 'pickup_point_selected'].includes(s);
    if (filter === 'awaiting_pickup') return ['pickup_point_pending', 'pickup_point_selected'].includes(s);
    if (filter === 'in_transit') return ['pickup_confirmed', 'in_transit', 'delivery_point_pending', 'delivery_point_selected', 'out_for_delivery'].includes(s);
    if (filter === 'delivered') return s === 'delivered';
    if (filter === 'cancelled') return s.includes('cancel');
    return true;
  }

  function matchesRole(parcel, filter) {
    if (filter === 'all') return true;
    return parcel.role === filter;
  }

  function matchesSearch(parcel, query) {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      (parcel.orderId && parcel.orderId.toLowerCase().includes(q)) ||
      (parcel.from && parcel.from.toLowerCase().includes(q)) ||
      (parcel.to && parcel.to.toLowerCase().includes(q)) ||
      (parcel.desc && parcel.desc.toLowerCase().includes(q)) ||
      (parcel.status && parcel.status.toLowerCase().includes(q))
    );
  }

  function renderParcels() {
    if (!parcelsGrid) return;

    const filtered = allParcels.filter(p => (
      matchesStatus(p, currentStatusFilter) &&
      matchesRole(p, currentRoleFilter) &&
      matchesSearch(p, currentSearchQuery)
    ));

    if (filtered.length === 0) {
      parcelsGrid.innerHTML = '';
      if (emptyState) {
        emptyState.classList.remove('hidden');
        if (allParcels.length === 0) {
          emptyStateTitle.textContent = 'No Parcels Yet';
          emptyStateMessage.textContent = 'You have not posted or transported any parcels yet. Post a parcel or find routes to carry!';
        } else {
          emptyStateTitle.textContent = 'No Matching Parcels';
          emptyStateMessage.textContent = 'No parcels match your selected filter and search criteria.';
        }
      }
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    parcelsGrid.innerHTML = filtered.map(p => {
      const isSender = p.role === 'sender';
      const roleBadge = isSender
        ? '<span class="parcel-role-badge is-sender"><i class="fa-solid fa-paper-plane"></i> You: Sender</span>'
        : '<span class="parcel-role-badge is-traveler"><i class="fa-solid fa-person-walking-luggage"></i> You: Traveler</span>';

      const dateStr = window.TravelBuddyDate
        ? window.TravelBuddyDate.formatDate(p.date)
        : (new Date(p.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }));

      // p.price from backend is either in rupees or paise depending on endpoint.
      // If price > 2000 and has no decimals, in backend wallet/post it's stored in paise.
      // Standardize display:
      const displayPrice = p.price > 1000 ? formatPaise(p.price) : `₹${Number(p.price || 0).toLocaleString('en-IN')}`;

      return `
        <a href="parcel-details.html?id=${encodeURIComponent(p.id)}" class="parcel-card-item" data-id="${escapeHTML(p.id)}">
          <div class="parcel-card-top">
            <span class="parcel-order-id">${escapeHTML(p.orderId)}</span>
            ${statusBadge(p.status)}
          </div>

          <div>
            <div class="parcel-route">
              <span>${escapeHTML(p.from)}</span>
              <i class="fa-solid fa-arrow-right-long"></i>
              <span>${escapeHTML(p.to)}</span>
            </div>
            <p class="parcel-desc" style="margin-top:6px;">${escapeHTML(p.desc)}</p>
          </div>

          <div class="parcel-card-meta">
            <div>
              <span style="font-size:11px; color:var(--text-faint); display:block;">Amount</span>
              <span class="parcel-price">${displayPrice}</span>
            </div>
            <div>
              <span style="font-size:11px; color:var(--text-faint); display:block; text-align:right;">Weight</span>
              <span style="font-weight:700; color:var(--text-main);">${escapeHTML(String(p.weight))} kg</span>
            </div>
          </div>

          <div class="parcel-card-footer">
            ${roleBadge}
            <span><i class="fa-regular fa-calendar"></i> ${escapeHTML(dateStr)}</span>
          </div>
        </a>
      `;
    }).join('');
  }

  // Filter Tabs Handler
  if (filterTabs) {
    filterTabs.querySelectorAll('.filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        filterTabs.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentStatusFilter = btn.dataset.status || 'all';
        renderParcels();
      });
    });
  }

  // Role Select Handler
  if (roleSelect) {
    roleSelect.addEventListener('change', (e) => {
      currentRoleFilter = e.target.value;
      renderParcels();
    });
  }

  // Search Input Handler
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        currentSearchQuery = e.target.value.trim();
        renderParcels();
      }, 250);
    });
  }

  // Listen for socket notification updates to refresh list
  document.addEventListener('travelbuddy:notification', (e) => {
    if (e.detail && (e.detail.type?.includes('parcel') || e.detail.type?.includes('status'))) {
      fetchAllParcels();
    }
  });

  initFromQueryParams();
  fetchAllParcels();
})();
