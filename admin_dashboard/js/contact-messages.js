/**
 * TravelBuddy Admin — Contact Messages Management
 */

(function() {
    'use strict';

    // API Helpers (reusing globals from admin.js)
    const { apiGet, apiPatch, fmtMoney, showToast } = window;

    // State
    let state = {
        inquiries: [],
        total: 0,
        page: 1,
        limit: 20,
        status: 'all',
        search: '',
        sortBy: 'createdAt',
        sortDir: 'desc'
    };

    // DOM Elements
    const elements = {
        tableBody: document.getElementById('cmTableBody'),
        statusFilter: document.getElementById('cmStatusFilter'),
        search: document.getElementById('cmSearch'),
        refreshBtn: document.getElementById('cmRefreshBtn'),
        resultCount: document.getElementById('cmResultCount'),
        pagination: document.getElementById('cmPagination'),
        drawerOverlay: document.getElementById('cmDrawerOverlay'),
        drawer: document.getElementById('cmDrawer'),
        drawerBody: document.getElementById('cmDrawerBody'),
        drawerClose: document.getElementById('cmDrawerClose'),
        kpiTotal: document.getElementById('cmCountTotal'),
        kpiUnread: document.getElementById('cmCountUnread'),
        kpiInProgress: document.getElementById('cmCountInProgress'),
        kpiReplied: document.getElementById('cmCountReplied'),
        kpiClosed: document.getElementById('cmCountClosed')
    };

    async function init() {
        bindEvents();
        await Promise.all([
            fetchStats(),
            fetchInquiries()
        ]);
    }

    function bindEvents() {
        elements.statusFilter?.addEventListener('change', (e) => {
            state.status = e.target.value;
            state.page = 1;
            fetchInquiries();
        });

        let searchTimeout;
        elements.search?.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                state.search = e.target.value.trim();
                state.page = 1;
                fetchInquiries();
            }, 400);
        });

        elements.refreshBtn?.addEventListener('click', () => {
            fetchStats();
            fetchInquiries();
        });

        elements.drawerClose?.addEventListener('click', closeDrawer);
        elements.drawerOverlay?.addEventListener('click', (e) => {
            if (e.target === elements.drawerOverlay) closeDrawer();
        });

        // Delegate table row clicks
        elements.tableBody?.addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            if (!row || e.target.closest('.pc-th-actions')) return;
            const id = row.dataset.id;
            if (id) viewInquiry(id);
        });
    }

    async function fetchStats() {
        try {
            const stats = await apiGet('/api/admin/contact-inquiries/stats');
            if (elements.kpiTotal) elements.kpiTotal.textContent = stats.total || 0;
            if (elements.kpiUnread) elements.kpiUnread.textContent = stats.unread || 0;
            if (elements.kpiInProgress) elements.kpiInProgress.textContent = stats.in_progress || 0;
            if (elements.kpiReplied) elements.kpiReplied.textContent = stats.replied || 0;
            if (elements.kpiClosed) elements.kpiClosed.textContent = stats.closed || 0;
        } catch (err) {
            console.error('Stats fetch failed:', err);
        }
    }

    async function fetchInquiries() {
        showSkeleton();
        try {
            const query = new URLSearchParams({
                page: state.page,
                limit: state.limit,
                status: state.status,
                search: state.search,
                sortBy: state.sortBy,
                sortDir: state.sortDir
            });

            const data = await apiGet(`/api/admin/contact-inquiries?${query.toString()}`);
            state.inquiries = data.inquiries || [];
            state.total = data.total || 0;

            renderInquiries();
            renderPagination();
        } catch (err) {
            console.error('Inquiries fetch failed:', err);
            elements.tableBody.innerHTML = `<tr><td colspan="7" class="pc-empty">Failed to load messages. <button class="pc-btn pc-btn-sm" id="cmRetryBtn">Retry</button></td></tr>`;
            document.getElementById('cmRetryBtn')?.addEventListener('click', fetchInquiries);
        }
    }

    function renderInquiries() {
        if (!elements.tableBody) return;

        if (state.inquiries.length === 0) {
            elements.tableBody.innerHTML = `<tr><td colspan="7" class="pc-empty">No contact messages found.</td></tr>`;
            if (elements.resultCount) elements.resultCount.textContent = '0 inquiries';
            return;
        }

        if (elements.resultCount) elements.resultCount.textContent = `${state.total} inquiries`;

        elements.tableBody.innerHTML = state.inquiries.map(inq => {
            const date = new Date(inq.createdAt).toLocaleString('en-IN', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
            });
            const userType = inq.userId ? '<span class="status-tag active">Registered</span>' : '<span class="status-tag">Anonymous</span>';
            const statusClass = inq.status === 'unread' ? 'pending' : inq.status === 'replied' ? 'delivered' : inq.status === 'closed' ? 'cancelled' : 'accepted';

            return `
                <tr data-id="${inq._id}" class="${inq.status === 'unread' ? 'unread-row' : ''}">
                    <td><strong>${esc(inq.fullName)}</strong></td>
                    <td class="cell-mono">${esc(inq.email)}</td>
                    <td><div class="pc-text-truncate" style="max-width: 200px;">${esc(inq.subject)}</div></td>
                    <td><small>${date}</small></td>
                    <td>${userType}</td>
                    <td><span class="status-tag ${statusClass}">${esc(inq.status.replace('_', ' '))}</span></td>
                    <td class="pc-th-actions">
                        <button class="pc-btn pc-btn-icon cm-view-btn" data-id="${inq._id}"><i class="fa-solid fa-eye"></i></button>
                    </td>
                </tr>
            `;
        }).join('');

        // Re-bind action buttons
        elements.tableBody.querySelectorAll('.cm-view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                viewInquiry(btn.dataset.id);
            });
        });
    }

    function renderPagination() {
        if (!elements.pagination) return;
        const totalPages = Math.ceil(state.total / state.limit);
        if (totalPages <= 1) {
            elements.pagination.innerHTML = '';
            return;
        }

        let html = `<button class="pc-btn pc-btn-sm" ${state.page === 1 ? 'disabled' : ''} data-page="${state.page - 1}">Prev</button>`;

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= state.page - 2 && i <= state.page + 2)) {
                html += `<button class="pc-btn pc-btn-sm ${state.page === i ? 'pc-btn-primary' : ''}" data-page="${i}">${i}</button>`;
            } else if (i === state.page - 3 || i === state.page + 3) {
                html += `<span class="pc-pagination-dots">...</span>`;
            }
        }

        html += `<button class="pc-btn pc-btn-sm" ${state.page === totalPages ? 'disabled' : ''} data-page="${state.page + 1}">Next</button>`;
        elements.pagination.innerHTML = html;

        elements.pagination.querySelectorAll('button[data-page]').forEach(btn => {
            btn.addEventListener('click', () => {
                state.page = parseInt(btn.dataset.page);
                fetchInquiries();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
    }

    async function viewInquiry(id) {
        if (!elements.drawerBody) return;
        elements.drawerBody.innerHTML = '<div class="pc-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading detail…</div>';
        openDrawer();

        try {
            const data = await apiGet(`/api/admin/contact-inquiries/${id}`);
            renderInquiryDetail(data.inquiry);

            // If it was unread, it's now read. Refresh list in background.
            const originalInq = state.inquiries.find(i => i._id === id);
            if (originalInq && originalInq.status === 'unread') {
                originalInq.status = 'read';
                renderInquiries();
                fetchStats();
            }
        } catch (err) {
            console.error('Detail fetch failed:', err);
            elements.drawerBody.innerHTML = `<div class="pc-empty">Error loading details.</div>`;
        }
    }

    function renderInquiryDetail(inq) {
        const date = new Date(inq.createdAt).toLocaleString('en-IN', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        let userBlock = '';
        if (inq.userId) {
            const u = inq.userId;
            userBlock = `
                <div class="drawer-section" style="background: var(--bg); border-radius: 12px; padding: 15px; border: 1px solid var(--l);">
                    <h3 style="font-size: 11px; text-transform: uppercase; color: var(--m); margin-bottom: 10px;">Linked User Account</h3>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div class="avatar" style="width: 40px; height: 40px; background: var(--p); color: #fff; display: grid; place-items: center; border-radius: 50%; font-weight: 700;">
                            ${(u.firstName?.[0] || '')}${(u.lastName?.[0] || '')}
                        </div>
                        <div>
                            <strong style="display: block; font-size: 13px;">${esc(u.firstName)} ${esc(u.lastName)}</strong>
                            <small style="color: var(--m); font-size: 11px;">${esc(u.email)}</small>
                        </div>
                    </div>
                </div>
            `;
        }

        elements.drawerBody.innerHTML = `
            <div class="drawer-header-meta" style="margin-bottom: 25px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                    <div>
                        <h3 style="font-size: 18px; font-weight: 800; margin-bottom: 4px;">${esc(inq.fullName)}</h3>
                        <p style="color: var(--m); font-size: 13px;">${esc(inq.email)} ${inq.phone ? `• ${esc(inq.phone)}` : ''}</p>
                    </div>
                    <span class="status-tag ${inq.status}">${esc(inq.status.replace('_', ' '))}</span>
                </div>
                <div style="font-size: 11px; color: var(--m);"><i class="fa-solid fa-clock"></i> Submitted on ${date}</div>
            </div>

            ${userBlock}

            <div class="drawer-section">
                <h4 style="font-size: 12px; color: var(--m); margin-bottom: 8px;">Subject</h4>
                <div style="font-weight: 700; font-size: 15px; margin-bottom: 20px; line-height: 1.4;">${esc(inq.subject)}</div>

                <h4 style="font-size: 12px; color: var(--m); margin-bottom: 8px;">Message</h4>
                <div style="background: #fcfdfe; border: 1px solid var(--l); border-radius: 12px; padding: 20px; font-size: 14px; line-height: 1.6; white-space: pre-wrap; color: var(--t);">
                    ${esc(inq.message)}
                </div>
            </div>

            <div class="drawer-section">
                <h4 style="font-size: 12px; color: var(--m); margin-bottom: 12px;">Admin Actions</h4>
                <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px;">
                    <select id="cmDetailStatus" class="pc-select" style="flex: 1;">
                        <option value="read" ${inq.status === 'read' ? 'selected' : ''}>Mark as Read</option>
                        <option value="in_progress" ${inq.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                        <option value="replied" ${inq.status === 'replied' ? 'selected' : ''}>Mark as Replied</option>
                        <option value="closed" ${inq.status === 'closed' ? 'selected' : ''}>Close Inquiry</option>
                    </select>
                    <button class="pc-btn pc-btn-primary" id="cmUpdateStatusBtn">Update Status</button>
                </div>
                <textarea id="cmAdminNote" class="pc-filter-input" style="width: 100%; height: 80px; padding: 12px; margin-bottom: 10px;" placeholder="Add internal admin note..."></textarea>
            </div>

            <div class="drawer-section">
                <h4 style="font-size: 11px; text-transform: uppercase; color: var(--m); margin-bottom: 12px;">History & Notes</h4>
                <div id="cmNoteList" style="display: flex; flex-direction: column; gap: 10px;">
                    ${(inq.adminNotes || []).reverse().map(n => `
                        <div style="background: #f9fafb; padding: 12px; border-radius: 8px; border: 1px solid var(--l);">
                            <p style="font-size: 12px; margin-bottom: 5px;">${esc(n.note)}</p>
                            <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--m);">
                                <b>${esc(n.adminName)}</b>
                                <span>${new Date(n.createdAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                    `).join('') || '<p style="font-size: 11px; color: var(--m); font-style: italic;">No notes yet.</p>'}
                </div>
            </div>
        `;

        // Bind update status
        document.getElementById('cmUpdateStatusBtn')?.addEventListener('click', async () => {
            const newStatus = document.getElementById('cmDetailStatus').value;
            const note = document.getElementById('cmAdminNote').value.trim();

            try {
                const btn = document.getElementById('cmUpdateStatusBtn');
                btn.disabled = true;
                btn.textContent = 'Updating...';

                await apiPatch(`/api/admin/contact-inquiries/${inq._id}/status`, { status: newStatus, note });

                showToast('Status updated successfully');
                viewInquiry(inq._id); // Reload detail
                fetchInquiries(); // Reload list
                fetchStats(); // Reload KPIs
            } catch (err) {
                console.error('Status update failed:', err);
                showToast('Failed to update status', 'error');
            }
        });
    }

    function openDrawer() {
        elements.drawerOverlay.classList.remove('hidden');
        elements.drawer.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeDrawer() {
        elements.drawerOverlay.classList.add('hidden');
        elements.drawer.classList.remove('open');
        document.body.style.overflow = '';
    }

    function showSkeleton() {
        if (!elements.tableBody) return;
        elements.tableBody.innerHTML = Array(5).fill(0).map(() => `
            <tr><td colspan="7"><div class="pc-skeleton-row"></div></td></tr>
        `).join('');
    }

    function esc(s) {
        if (!s) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Export to window for admin.js lazy loader
    window.initContactMessages = init;

    // Auto-run if element exists (fragment already in DOM or injected)
    if (document.getElementById('contact-messages-panel')) {
        init();
    }

})();
