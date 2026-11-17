// Frontend/admin_dashboard/js/user-profile-view.js
// Dedicated Full-Screen User Profile View Controller for Super Admin

const API_ORIGIN = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) || 'https://api.carryparcel.in';

let currentUserId = null;
let currentUserData = null;
let previousActivePage = 'users';

const $ = (s, p) => (p || document).querySelector(s);
const $$ = (s, p) => [...(p || document).querySelectorAll(s)];
const esc = s => s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') : '';
const fmtMoney = n => '₹' + ((n || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const timeAgo = d => {
  if (!d) return 'Never';
  const m = Math.floor((Date.now() - new Date(d)) / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

// Canonical Media URL Resolution for Admin Dashboard
export function resolveAdminMediaUrl(value, options) {
  const source = String(value || '').trim();
  if (!source || source.startsWith('data:')) return source;
  try {
    const url = /^https?:\/\//i.test(source) ? new URL(source) : new URL(source, `${API_ORIGIN}/`);
    const v = (options && options.cacheBust) || (options && options.updatedAt ? new Date(options.updatedAt).getTime() : null);
    if (v && !isNaN(v)) url.searchParams.set('v', String(v));
    return url.href;
  } catch (err) {
    return source;
  }
}
window.resolveAdminMediaUrl = resolveAdminMediaUrl;

function setText(selector, value) {
  const el = $(selector);
  if (el) el.textContent = value;
}

function setHtml(selector, html) {
  const el = $(selector);
  if (el) el.innerHTML = html;
}

async function apiGet(url) {
  const res = await fetch(`${API_ORIGIN}${url}`, {
    credentials: 'include',
    headers: { 'X-CP-Admin-Request': 'true' }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data;
  return data;
}

export async function openUserProfileView(userId) {
  if (!userId) return;
  currentUserId = userId;

  // Determine previous active page
  const activePageEl = $('main section.page.active') || $('main section.panel.active');
  if (activePageEl && activePageEl.id !== 'user-profile-view' && activePageEl.id !== 'user-profile-view-panel') {
    previousActivePage = activePageEl.id;
  }

  // Switch workspace to full-screen profile panel
  $$('main section.page, main section.panel').forEach(el => {
    el.classList.remove('active');
    if (el.style && el.id !== 'user-profile-view') el.style.display = '';
  });
  let upvPage = $('#user-profile-view');
  let upvPanel = $('#user-profile-view-panel');
  if (upvPage) {
    upvPage.classList.add('active');
    upvPage.style.display = 'block';
  }
  if (upvPanel) {
    upvPanel.classList.add('active');
    upvPanel.style.display = 'flex';
  }

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Render Skeleton / Loading state
  renderLoadingState();

  try {
    const data = await apiGet(`/api/admin/users/${userId}`);
    currentUserData = data;
    renderUserProfileHeader(data);
    renderAllTabs(data);
  } catch (err) {
    console.error('Failed to load full user profile:', err);
    renderErrorState(err.error || 'Could not load user profile.');
  }
}

export function backToUsersView() {
  let upvPage = $('#user-profile-view');
  let upvPanel = $('#user-profile-view-panel');
  if (upvPage) {
    upvPage.classList.remove('active');
    upvPage.style.display = 'none';
  }
  if (upvPanel) {
    upvPanel.classList.remove('active');
    upvPanel.style.display = 'none';
  }
  const prevEl = $(`#${previousActivePage}`) || $('#users');
  if (prevEl) {
    prevEl.classList.add('active');
    if (prevEl.style) prevEl.style.display = 'block';
  }
}

function renderLoadingState() {
  setText('#upvUserName', 'Loading user details...');
}

function renderErrorState(msg) {
  setText('#upvUserName', `Error: ${msg}`);
}

function renderUserProfileHeader(data) {
  const u = data.user || {};
  const name = `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'CarryParcel User';
  const initials = ((u.firstName?.[0] || '') + (u.lastName?.[0] || '')).toUpperCase() || 'CP';

  setText('#upvUserName', name);
  setText('#upvUserEmail', u.email || 'No email');
  setText('#upvUserPhone', u.phone || 'No phone');
  setText('#upvUserId', u._id || '—');
  setText('#upvPublicId', u.senderPublicId || u.travelerPublicId || '—');

  // Avatar Photo Resolution
  const imgEl = $('#upvAvatarImg');
  const initEl = $('#upvAvatarInitials');
  const photoUrl = u.profilePhoto ? resolveAdminMediaUrl(u.profilePhoto, u) : null;

  if (photoUrl && imgEl) {
    imgEl.src = photoUrl;
    imgEl.style.display = 'block';
    if (initEl) initEl.style.display = 'none';
  } else {
    if (imgEl) imgEl.style.display = 'none';
    if (initEl) { initEl.textContent = initials; initEl.style.display = 'flex'; }
  }

  // Badges
  const statusBadge = $('#upvStatusBadge');
  if (statusBadge) {
    statusBadge.className = `status-tag ${u.status === 'active' ? 'active' : 'danger'}`;
    statusBadge.textContent = u.status ? u.status.toUpperCase() : 'ACTIVE';
  }

  const authBadge = $('#upvAuthProviderBadge');
  if (authBadge) {
    authBadge.textContent = u.authProvider === 'google' ? 'Google Auth' : 'Email/Password';
  }

  const kycStatus = u.verification?.governmentId || 'not_submitted';
  setHtml('#upvMobileBadge', `<i class="fa-solid fa-mobile-screen-button"></i> Mobile: <strong>${u.isPhoneVerified ? 'Verified' : 'Unverified'}</strong>`);
  setHtml('#upvKycBadge', `<i class="fa-solid fa-shield-halved"></i> KYC: <strong>${esc(kycStatus.replace(/_/g, ' '))}</strong>`);
  setHtml('#upvRatingBadge', `<i class="fa-solid fa-star text-warning"></i> Rating: <strong>${(u.rating || 0).toFixed(1)}</strong> (${u.ratingCount || 0} reviews)`);
  setHtml('#upvRiskBadge', `<i class="fa-solid fa-triangle-exclamation"></i> Risk Score: <strong>${u.riskScore || 0}</strong>`);
  setHtml('#upvJoinedBadge', `<i class="fa-solid fa-calendar-check"></i> Joined: <strong>${fmtDate(u.createdAt)}</strong>`);
}

function renderAllTabs(data) {
  renderOverviewTab(data);
  renderPersonalTab(data);
  renderVerificationTab(data);
  renderParcelsTab(data);
  renderTripsTab(data);
  renderWalletTab(data);
  renderWithdrawalsTab(data);
  renderCommunicationTab(data);
  renderSupportTab(data);
  renderSecurityTab(data);
}

function renderOverviewTab(data) {
  const p = data.performance || {};
  const u = data.user || {};
  setText('#upvKpiPosted', p.postedParcels || 0);
  setText('#upvKpiCarried', p.acceptedDeliveries || 0);
  setText('#upvKpiCompletion', `${p.completionRate != null ? p.completionRate : 0}%`);
  setText('#upvKpiCancellation', `${p.cancellationRate || 0}%`);
  setText('#upvKpiWallet', fmtMoney(u.walletBalance || 0));

  const container = $('#upvOverviewDetails');
  if (!container) return;
  container.innerHTML = `
    <div class="upv-detail-item"><label>Account Status</label><span>${esc(u.status)}</span></div>
    <div class="upv-detail-item"><label>Risk Flags</label><span>${(u.riskFlags || []).join(', ') || 'None'}</span></div>
    <div class="upv-detail-item"><label>Last Active</label><span>${timeAgo(u.lastSeenAt)}</span></div>
    <div class="upv-detail-item"><label>Total Delivered</label><span>${p.completedDeliveries || 0}</span></div>
    <div class="upv-detail-item"><label>Total Cancelled</label><span>${p.cancelledDeliveries || 0}</span></div>
  `;
}

function renderPersonalTab(data) {
  const u = data.user || {};
  const container = $('#upvPersonalDetails');
  if (!container) return;
  container.innerHTML = `
    <div class="upv-detail-item"><label>First Name</label><span>${esc(u.firstName || '—')}</span></div>
    <div class="upv-detail-item"><label>Last Name</label><span>${esc(u.lastName || '—')}</span></div>
    <div class="upv-detail-item"><label>Email Address</label><span>${esc(u.email || '—')}</span></div>
    <div class="upv-detail-item"><label>Mobile Phone</label><span>${esc(u.phone || '—')}</span></div>
    <div class="upv-detail-item"><label>Registration Method</label><span>${esc(u.authProvider || 'local')}</span></div>
    <div class="upv-detail-item"><label>User ID</label><span class="cell-mono">${esc(u._id || '—')}</span></div>
    <div class="upv-detail-item"><label>Sender Public ID</label><span class="cell-mono">${esc(u.senderPublicId || '—')}</span></div>
    <div class="upv-detail-item"><label>Traveler Public ID</label><span class="cell-mono">${esc(u.travelerPublicId || '—')}</span></div>
  `;
}

function renderVerificationTab(data) {
  const docs = data.documents || [];
  const container = $('#upvKycDetails');
  if (!container) return;
  if (!docs.length) {
    container.innerHTML = '<p class="text-muted">No government verification documents submitted yet.</p>';
    return;
  }
  container.innerHTML = `
    <table class="upv-table">
      <thead><tr><th>Document Type</th><th>Status</th><th>Uploaded Date</th><th>Action</th></tr></thead>
      <tbody>
        ${docs.map(d => `
          <tr>
            <td>${esc(d.type || 'ID Document')}</td>
            <td><span class="status-tag ${d.status === 'verified' ? 'active' : 'warning'}">${esc(d.status)}</span></td>
            <td>${fmtDate(d.uploadedAt)}</td>
            <td>${d.url ? `<button class="btn sm secondary" onclick="window.openUpvLightbox('${esc(resolveAdminMediaUrl(d.url))}')">View Image</button>` : '—'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderParcelsTab(data) {
  const sent = data.sentParcels || [];
  const carried = data.travelerParcels || [];
  const container = $('#upvParcelsList');
  if (!container) return;

  container.innerHTML = `
    <h4>Posted Parcels (${sent.length})</h4>
    ${sent.length ? `
      <table class="upv-table">
        <thead><tr><th>Order ID</th><th>Route</th><th>Price</th><th>Status</th><th>Traveler</th><th>Date</th></tr></thead>
        <tbody>
          ${sent.map(p => `
            <tr>
              <td class="cell-mono">${esc(p.orderId)}</td>
              <td>${esc(p.fromCity)} → ${esc(p.toCity)}</td>
              <td>${fmtMoney(p.price)}</td>
              <td><span class="status-tag">${esc(p.status)}</span></td>
              <td>${esc(p.traveler || 'Unassigned')}</td>
              <td>${fmtDate(p.createdAt)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<p class="text-muted">No posted parcels found.</p>'}

    <h4 style="margin-top:20px;">Carried Parcels (${carried.length})</h4>
    ${carried.length ? `
      <table class="upv-table">
        <thead><tr><th>Order ID</th><th>Route</th><th>Earning</th><th>Status</th><th>Sender</th><th>Date</th></tr></thead>
        <tbody>
          ${carried.map(p => `
            <tr>
              <td class="cell-mono">${esc(p.orderId)}</td>
              <td>${esc(p.fromCity)} → ${esc(p.toCity)}</td>
              <td>${fmtMoney(p.travelerEarning)}</td>
              <td><span class="status-tag">${esc(p.status)}</span></td>
              <td>${esc(p.sender || 'Sender')}</td>
              <td>${fmtDate(p.createdAt)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<p class="text-muted">No carried parcels found.</p>'}
  `;
}

function renderTripsTab(data) {
  const trips = data.trips || [];
  const container = $('#upvTripsList');
  if (!container) return;

  if (!trips.length) {
    container.innerHTML = '<p class="text-muted">No posted traveler trips found.</p>';
    return;
  }

  container.innerHTML = `
    <table class="upv-table">
      <thead><tr><th>Route</th><th>Travel Date</th><th>Capacity</th><th>Status</th></tr></thead>
      <tbody>
        ${trips.map(t => `
          <tr>
            <td>${esc(t.fromCity)} → ${esc(t.toCity)}</td>
            <td>${fmtDate(t.travelDate)}</td>
            <td>${t.capacityKg || 0} kg</td>
            <td><span class="status-tag">${esc(t.status)}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderWalletTab(data) {
  const w = data.wallet || {};
  const txns = w.transactions || [];
  const container = $('#upvWalletDetails');
  if (!container) return;

  container.innerHTML = `
    <div class="upv-detail-grid" style="margin-bottom:16px;">
      <div class="upv-detail-item"><label>Total Credits</label><span>${fmtMoney(w.summary?.totalCredits || 0)}</span></div>
      <div class="upv-detail-item"><label>Total Debits</label><span>${fmtMoney(w.summary?.totalDebits || 0)}</span></div>
      <div class="upv-detail-item"><label>Total Transactions</label><span>${w.summary?.txCount || 0}</span></div>
    </div>
    <table class="upv-table">
      <thead><tr><th>Date</th><th>Type</th><th>Direction</th><th>Amount</th><th>Balance After</th><th>Status</th></tr></thead>
      <tbody>
        ${txns.map(t => `
          <tr>
            <td>${fmtDate(t.createdAt)}</td>
            <td>${esc(t.type)}</td>
            <td><strong class="${t.direction === 'credit' ? 'success-text' : 'danger-text'}">${t.direction === 'credit' ? '+' : '-'}${fmtMoney(t.amount)}</strong></td>
            <td>${fmtMoney(t.amount)}</td>
            <td>${fmtMoney(t.balanceAfter)}</td>
            <td><span class="status-tag ${t.status === 'completed' ? 'active' : 'warning'}">${esc(t.status)}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderWithdrawalsTab(data) {
  const withdrawals = data.withdrawals || [];
  const container = $('#upvWithdrawalsList');
  if (!container) return;

  if (!withdrawals.length) {
    container.innerHTML = '<p class="text-muted">No withdrawal requests found.</p>';
    return;
  }

  container.innerHTML = `
    <table class="upv-table">
      <thead><tr><th>Withdrawal ID</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th></tr></thead>
      <tbody>
        ${withdrawals.map(w => `
          <tr>
            <td class="cell-mono">${esc(w.withdrawalId || w._id)}</td>
            <td>${fmtMoney(w.amount)}</td>
            <td>${esc(w.method || 'Bank Transfer')}</td>
            <td><span class="status-tag ${w.status === 'completed' ? 'active' : 'warning'}">${esc(w.status)}</span></td>
            <td>${fmtDate(w.createdAt)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderCommunicationTab(data) {
  const notifications = data.notifications || [];
  const container = $('#upvCommunicationDetails');
  if (!container) return;

  container.innerHTML = `
    <h4>Recent System Notifications (${notifications.length})</h4>
    ${notifications.length ? `
      <table class="upv-table">
        <thead><tr><th>Date</th><th>Type</th><th>Message</th><th>Read</th></tr></thead>
        <tbody>
          ${notifications.map(n => `
            <tr>
              <td>${fmtDate(n.createdAt)}</td>
              <td>${esc(n.type)}</td>
              <td>${esc(n.text)}</td>
              <td>${n.isRead ? 'Yes' : 'No'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<p class="text-muted">No communication logs recorded.</p>'}
  `;
}

function renderSupportTab(data) {
  const reports = data.reports || [];
  const reviews = data.reviewsReceived || [];
  const container = $('#upvSupportDetails');
  if (!container) return;

  container.innerHTML = `
    <h4>Disputes &amp; User Reports (${reports.length})</h4>
    ${reports.length ? `
      <table class="upv-table">
        <thead><tr><th>Date</th><th>Type</th><th>Reason</th><th>Status</th></tr></thead>
        <tbody>
          ${reports.map(r => `
            <tr>
              <td>${fmtDate(r.createdAt)}</td>
              <td>${esc(r.type || 'Dispute')}</td>
              <td>${esc(r.reason || r.description)}</td>
              <td><span class="status-tag">${esc(r.status || 'open')}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<p class="text-muted">No disputes or support reports filed against this user.</p>'}

    <h4 style="margin-top:20px;">Reviews Received (${reviews.length})</h4>
    ${reviews.length ? `
      <table class="upv-table">
        <thead><tr><th>Rating</th><th>Comment</th><th>From User</th><th>Date</th></tr></thead>
        <tbody>
          ${reviews.map(r => `
            <tr>
              <td>⭐ ${r.rating || 5}</td>
              <td>${esc(r.comment || '—')}</td>
              <td>${esc(r.fromUserName || 'Verified User')}</td>
              <td>${fmtDate(r.createdAt)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<p class="text-muted">No reviews recorded yet.</p>'}
  `;
}

function renderSecurityTab(data) {
  const timeline = data.timeline || [];
  const container = $('#upvSecurityDetails');
  if (!container) return;

  container.innerHTML = `
    <div class="timeline-360">
      ${timeline.map(item => `
        <div class="tl-item ${item.type}">
          <div class="tl-dot"></div>
          <div class="tl-content">
            <span class="tl-time">${timeAgo(item.at)}</span>
            <span class="tl-label">${esc(item.label)}</span>
            ${item.meta?.reason ? `<small style="display:block;color:var(--text-sub);font-size:11px;">Meta: ${esc(item.meta.reason)}</small>` : ''}
          </div>
        </div>
      `).join('') || '<p class="text-muted">No security timeline events found.</p>'}
    </div>
  `;
}

// Global Lightbox Handler
window.openUpvLightbox = function(url) {
  const modal = $('#upvImageLightbox');
  const img = $('#upvLightboxImg');
  if (modal && img) {
    img.src = resolveAdminMediaUrl(url);
    modal.classList.remove('hidden');
  }
};

// Bind UI Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  $('#upvBackBtn')?.addEventListener('click', backToUsersView);

  // Tab switching
  $$('.upv-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.upv-tab-btn').forEach(b => b.classList.remove('active'));
      $$('.upv-tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const tabName = btn.dataset.upvTab;
      const targetPane = $(`#upvTab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // Actions
  $('#upvActionAdjustWallet')?.addEventListener('click', () => {
    if (currentUserId && currentUserData?.user) {
      window.adminAdjustWallet?.(currentUserId, `${currentUserData.user.firstName} ${currentUserData.user.lastName}`);
    }
  });

  $('#upvActionChangeStatus')?.addEventListener('click', () => {
    if (currentUserId && currentUserData?.user) {
      window.adminChangeUserStatus?.(currentUserId, currentUserData.user.status);
    }
  });

  $('#upvLightboxClose')?.addEventListener('click', () => {
    $('#upvImageLightbox')?.classList.add('hidden');
  });
});

window.openUserProfileView = openUserProfileView;
window.backToUsersView = backToUsersView;
