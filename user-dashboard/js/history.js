(function () {
  'use strict';

  const API_BASE = `${window.TravelBuddy.API_ORIGIN}/api/postparcel`;
  const { authHeaders, escapeHTML } = window.TravelBuddy;

  const list = document.getElementById('historyList');
  const emptyState = document.getElementById('historyEmpty');
  const filterTabs = document.getElementById('historyFilterTabs');
  const totalCountEl = document.getElementById('historyTotalCount');
  const sentCountEl = document.getElementById('historySentCount');
  const deliveredCountEl = document.getElementById('historyDeliveredCount');
  const cancelledTotalEl=document.getElementById('historyCancelledTotalCount');
  const cancelledByYouEl=document.getElementById('historyCancelledByYouCount');
  const cancelledByOtherEl=document.getElementById('historyCancelledByOtherCount');

  const modalOverlay = document.getElementById('historyModalOverlay');
  const modalClose = document.getElementById('historyModalClose');
  const modalNumber = document.getElementById('historyModalNumber');
  const modalRoutePill = document.getElementById('historyModalRoutePill');
  const modalDesc = document.getElementById('historyModalDesc');
  const modalWeight = document.getElementById('historyModalWeight');
  const modalPrice = document.getElementById('historyModalPrice');
  const modalCounterpart = document.getElementById('historyModalCounterpart');
  const modalTimeline = document.getElementById('historyModalTimeline');
  const ratingBox = document.getElementById('travelerRatingBox');
  const starRating = document.getElementById('travelerStarRating');
  const ratingComment = document.getElementById('travelerRatingComment');
  const ratingSubmit = document.getElementById('travelerRatingSubmit');
  const ratingStatus = document.getElementById('travelerRatingStatus');
  let selectedRating = 0;
  let activeParcelId = null;

  let historyCache = [];
  let activeFilter = 'all';

  function formatDateTime(value) {
    if (!value) return 'Not recorded';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not recorded';
    return date.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  function formatShortDate(value) {
    if (!value) return 'Date unavailable';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Date unavailable';
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function updateStats(parcels){
    const deliveredParcels=parcels.filter(p=>p.status==='delivered'), cancelled=parcels.filter(p=>p.status==='cancelled');
    if(totalCountEl)totalCountEl.textContent=deliveredParcels.length;
    if(sentCountEl)sentCountEl.textContent=deliveredParcels.filter(p=>p.role==='sender').length;
    if(deliveredCountEl)deliveredCountEl.textContent=deliveredParcels.filter(p=>p.role==='traveler').length;
    if(cancelledTotalEl)cancelledTotalEl.textContent=cancelled.length;
    if(cancelledByYouEl)cancelledByYouEl.textContent=cancelled.filter(p=>p.cancelledByYou).length;
    if(cancelledByOtherEl)cancelledByOtherEl.textContent=cancelled.filter(p=>!p.cancelledByYou).length;
  }

  function filteredParcels() {
    if (activeFilter === 'all') return historyCache;
    return historyCache.filter((p)=>p.status==='delivered'&&p.role===activeFilter);
  }

  function renderList() {
    if (!list) return;
    const parcels = filteredParcels();

    if (!parcels.length) {
      list.innerHTML = '';
      if (emptyState) {
        emptyState.classList.remove('hidden');
        const message = historyCache.length
          ? "No parcels match this filter yet."
          : "No delivered or cancelled parcels yet. Completed journeys will show up here.";
        emptyState.querySelector('p').textContent = message;
      }
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    list.innerHTML = parcels.map((p, i) => `
      <li class="history-card ${p.status === 'cancelled' ? 'cancelled-card' : ''}" tabindex="0" style="animation-delay:${i * 0.05}s" data-id="${escapeHTML(p.id)}">
        <span class="history-card-icon"><i class="fa-solid ${p.status === 'cancelled' ? 'fa-ban' : 'fa-box-open'}"></i></span>
        <div class="history-card-body">
          <p class="history-card-title">${escapeHTML(p.desc)}</p>
          <div class="history-card-meta">
            <span><i class="fa-solid fa-route"></i> ${escapeHTML(p.from)} &rarr; ${escapeHTML(p.to)}</span>
            <span><i class="fa-regular fa-calendar-check"></i> ${p.status==='cancelled'?'Cancelled':'Delivered'} ${escapeHTML(formatShortDate(p.status==='cancelled'?p.cancelledAt:p.deliveredAt))}</span>
            <span><i class="fa-solid fa-user"></i> ${escapeHTML(p.status==='cancelled'?p.cancelledByLabel:p.roleLabel)}</span>
          </div>
        </div>
        <div class="history-card-side">
          <span class="history-card-price"><i class="fa-solid fa-indian-rupee-sign"></i>${escapeHTML(p.price)}</span>
          <i class="fa-solid fa-chevron-right history-card-chevron"></i>
        </div>
      </li>
    `).join('');

    list.querySelectorAll('.history-card').forEach((card) => {
      const open = () => openHistoryModal(card.dataset.id);
      card.addEventListener('click', open);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      });
    });
  }

  function openHistoryModal(id) {
    const parcel = historyCache.find((p) => String(p.id) === String(id));
    if (!parcel || !modalOverlay) return;

    modalNumber.textContent = parcel.parcelNumber;
    modalRoutePill.innerHTML = `${escapeHTML(parcel.from)} <i class="fa-solid fa-arrow-right-long"></i> ${escapeHTML(parcel.to)}`;
    modalDesc.textContent = parcel.desc;
    modalWeight.textContent = `${parcel.weight}kg`;
    modalPrice.textContent = parcel.price;
    modalCounterpart.textContent = `${parcel.counterpartName} (${parcel.counterpartRole})`;

    const stages=parcel.status==='cancelled'
      ? [{icon:'fa-paper-plane',title:'Parcel Posted',time:parcel.postedAt},{icon:'fa-ban',title:parcel.cancelledByLabel,time:parcel.cancelledAt}]
      : [{icon:'fa-paper-plane',title:'Parcel Posted',time:parcel.postedAt},{icon:'fa-box',title:'Pickup Confirmed',time:parcel.pickupConfirmedAt},{icon:'fa-flag-checkered',title:'Delivered',time:parcel.deliveredAt}];

    activeParcelId = parcel.id;
    selectedRating = Number(parcel.travelerRating?.score || 0);
    if (ratingBox) {
      ratingBox.classList.toggle('hidden', parcel.role !== 'sender' || parcel.status !== 'delivered');
      if (parcel.role === 'sender' && parcel.status === 'delivered') {
        const alreadyRated = Boolean(parcel.travelerRating?.score);
        ratingComment.value = parcel.travelerRating?.comment || '';
        ratingComment.disabled = alreadyRated;
        ratingSubmit.disabled = alreadyRated;
        ratingSubmit.textContent = alreadyRated ? 'Rating Submitted' : 'Submit Rating';
        ratingStatus.textContent = alreadyRated ? `You rated this traveler ${selectedRating}/5 stars.` : '';
        updateStars();
      }
    }

    modalTimeline.innerHTML = stages.map((stage, i) => `
      <li class="history-timeline-item" style="animation-delay:${i * 0.06}s">
        <span class="history-timeline-dot"><i class="fa-solid ${stage.icon}"></i></span>
        <div>
          <h4>${escapeHTML(stage.title)}</h4>
          <p>${escapeHTML(formatDateTime(stage.time))}</p>
        </div>
      </li>
    `).join('');

    modalOverlay.classList.remove('hidden');
  }

  function updateStars() {
    if (!starRating) return;
    starRating.querySelectorAll('button').forEach((btn) => {
      const on = Number(btn.dataset.score) <= selectedRating;
      btn.classList.toggle('selected', on);
      btn.setAttribute('aria-checked', String(Number(btn.dataset.score) === selectedRating));
      btn.disabled = Boolean(ratingSubmit?.disabled);
    });
  }

  if (starRating) starRating.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-score]');
    if (!btn || btn.disabled) return;
    selectedRating = Number(btn.dataset.score);
    if (ratingStatus) ratingStatus.textContent = '';
    updateStars();
  });

  if (ratingSubmit) ratingSubmit.addEventListener('click', async () => {
    if (!activeParcelId || selectedRating < 1) {
      if (ratingStatus) ratingStatus.textContent = 'Choose 1 to 5 stars first.';
      return;
    }
    ratingSubmit.disabled = true;
    ratingSubmit.textContent = 'Submitting...';
    try {
      const res = await fetch(`${API_BASE}/${encodeURIComponent(activeParcelId)}/rate-traveler`, {
        method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: selectedRating, comment: ratingComment.value.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not submit rating.');
      const parcel = historyCache.find((p) => String(p.id) === String(activeParcelId));
      if (parcel) parcel.travelerRating = { score: selectedRating, comment: ratingComment.value.trim(), ratedAt: new Date().toISOString() };
      ratingSubmit.textContent = 'Rating Submitted';
      ratingComment.disabled = true;
      if (ratingStatus) ratingStatus.textContent = `Thank you. You rated this traveler ${selectedRating}/5 stars.`;
      updateStars();
      window.showToast(data.message || 'Rating submitted.', 'success');
    } catch (err) {
      ratingSubmit.disabled = false;
      ratingSubmit.textContent = 'Submit Rating';
      if (ratingStatus) ratingStatus.textContent = err.message;
    }
  });

  function closeHistoryModal() {
    if (modalOverlay) modalOverlay.classList.add('hidden');
  }

  if (modalClose) modalClose.addEventListener('click', closeHistoryModal);
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeHistoryModal();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeHistoryModal();
  });

  if (filterTabs) {
    filterTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;
      filterTabs.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
      activeFilter = btn.dataset.filter || 'all';
      renderList();
    });
  }

  async function loadHistory() {
    if (list) {
      list.innerHTML = `
        <li class="skeleton-row"></li>
        <li class="skeleton-row"></li>
        <li class="skeleton-row"></li>
      `;
    }
    if (emptyState) emptyState.classList.add('hidden');

    try {
      const res = await fetch(`${API_BASE}/history`, { headers: authHeaders() });
      const data = await res.json();

      if (!res.ok) {
        window.showToast(data.error || 'Could not load your history.', 'error');
        historyCache = [];
        updateStats(historyCache);
        renderList();
        return;
      }

      historyCache = data.parcels || [];
      updateStats(historyCache);
      renderList();
    } catch (err) {
      console.error(err);
      window.showToast('Could not reach the server.', 'error');
      historyCache = [];
      updateStats(historyCache);
      renderList();
    }
  }

  loadHistory();
})();
