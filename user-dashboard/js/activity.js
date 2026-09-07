(function () {
  'use strict';

  const { API_ORIGIN, authHeaders, escapeHTML, formatPaise } = window.TravelBuddy;

  // Elements
  const filterTabs = document.getElementById('filterTabs');
  const timeline = document.getElementById('activityTimeline');
  const loading = document.getElementById('activityLoading');
  const empty = document.getElementById('activityEmpty');
  const loadMoreWrap = document.getElementById('loadMoreWrap');
  const loadMoreBtn = document.getElementById('loadMoreBtn');

  // State
  let currentPage = 1;
  let currentCategory = 'all';
  let hasMore = true;

  async function loadActivity(append = false) {
    if (!append) {
      currentPage = 1;
      timeline.innerHTML = '';
      empty.classList.add('hidden');
    }

    loading.classList.remove('hidden');
    if (!append && window.TravelBuddySkeleton) {
      window.TravelBuddySkeleton.show('#activityTimeline', 'list-item', 10);
    }
    loadMoreWrap.classList.add('hidden');

    try {
      const res = await fetch(`${API_ORIGIN}/api/activity/history?category=${currentCategory}&page=${currentPage}&limit=15`, {
        headers: authHeaders()
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to load activity');

      if (data.items.length === 0 && currentPage === 1) {
        empty.classList.remove('hidden');
      } else {
        renderActivityItems(data.items, append);
        hasMore = data.items.length === 15;
        if (hasMore) loadMoreWrap.classList.remove('hidden');
      }
    } catch (err) {
      console.error(err);
      window.showToast('Could not load activity history.', 'error');
    } finally {
      loading.classList.add('hidden');
    }
  }

  function groupItemsByDate(items) {
    const groups = {};
    items.forEach(item => {
      const date = new Date(item.timestamp).toDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(item);
    });
    return groups;
  }

  function renderActivityItems(items, append) {
    const groups = groupItemsByDate(items);

    let html = '';
    for (const [date, dayItems] of Object.entries(groups)) {
      const dateLabel = getDateLabel(new Date(date));

      // Check if this date group already exists in the timeline
      let groupEl = Array.from(timeline.querySelectorAll('.tl-date')).find(el => el.textContent === dateLabel);

      if (!groupEl) {
        html += `<div class="tl-group">
          <div class="tl-date">${dateLabel}</div>
          <div class="tl-items-container">
            ${dayItems.map(item => renderItem(item)).join('')}
          </div>
        </div>`;
      } else {
        // Append to existing group container
        const container = groupEl.nextElementSibling;
        dayItems.forEach(item => {
          container.insertAdjacentHTML('beforeend', renderItem(item));
        });
      }
    }

    if (html) {
      timeline.insertAdjacentHTML('beforeend', html);
    }
  }

  function getDateLabel(date) {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  function renderItem(item) {
    const time = new Date(item.timestamp).toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit'
    });

    let metaHtml = '';
    if (item.amount) {
      const directionClass = item.direction === 'debit' || item.type.includes('WITHDRAWAL') ? 'debit' : 'credit';
      const prefix = item.direction === 'debit' ? '-' : '+';
      metaHtml += `<span class="tl-amount ${directionClass}">${prefix}${formatPaise(item.amount)}</span>`;
    }
    if (item.status) {
      metaHtml += `<span class="tl-status status-${item.status}">${item.status.replace('_', ' ')}</span>`;
    }

    return `
      <a href="${item.link || '#'}" class="tl-item">
        <div class="tl-icon"><i class="fa-solid ${item.icon || 'fa-circle'}"></i></div>
        <div class="tl-content">
          <div class="tl-header">
            <span class="tl-title">${escapeHTML(item.title)}</span>
            <span class="tl-time">${time}</span>
          </div>
          <div class="tl-desc">${escapeHTML(item.description)}</div>
          ${metaHtml ? `<div class="tl-meta">${metaHtml}</div>` : ''}
        </div>
      </a>
    `;
  }

  // Event Listeners
  filterTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;

    filterTabs.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    currentCategory = btn.dataset.cat;
    loadActivity();
  });

  loadMoreBtn.addEventListener('click', () => {
    currentPage++;
    loadActivity(true);
  });

  // Initial load
  loadActivity();

})();
