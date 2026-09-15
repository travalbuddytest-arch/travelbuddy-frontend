/**
 * TravelBuddy Admin — KYC Verification Management
 */

(function() {
    'use strict';

    const { apiGet, apiPatch, showToast, API_ORIGIN } = window;

    let state = {
        users: [],
        total: 0,
        page: 1,
        limit: 20,
        status: 'pending',
        search: ''
    };

    const elements = {
        tableBody: document.getElementById('vkTableBody'),
        statusFilter: document.getElementById('vkStatusFilter'),
        search: document.getElementById('vkSearch'),
        refreshBtn: document.getElementById('vkRefreshBtn'),
        resultCount: document.getElementById('vkResultCount'),
        pagination: document.getElementById('vkPagination'),
        drawerOverlay: document.getElementById('vkDrawerOverlay'),
        drawer: document.getElementById('vkDrawer'),
        drawerBody: document.getElementById('vkDrawerBody'),
        drawerClose: document.getElementById('vkDrawerClose')
    };

    async function init() {
        bindEvents();
        await fetchRequests();
    }

    function bindEvents() {
        elements.statusFilter?.addEventListener('change', (e) => {
            state.status = e.target.value;
            state.page = 1;
            fetchRequests();
        });

        let searchTimeout;
        elements.search?.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                state.search = e.target.value.trim();
                state.page = 1;
                fetchRequests();
            }, 400);
        });

        elements.refreshBtn?.addEventListener('click', fetchRequests);
        elements.drawerClose?.addEventListener('click', closeDrawer);
        elements.drawerOverlay?.addEventListener('click', (e) => {
            if (e.target === elements.drawerOverlay) closeDrawer();
        });
    }

    async function fetchRequests() {
        showSkeleton();
        try {
            const query = new URLSearchParams({
                page: state.page,
                limit: state.limit,
                status: state.status,
                search: state.search
            });

            const data = await apiGet(`/api/admin/verification-requests?${query.toString()}`);
            state.users = data.users || [];
            state.total = data.total || 0;

            renderTable();
            renderPagination();
        } catch (err) {
            console.error('KYC list fetch failed:', err);
            elements.tableBody.innerHTML = `<tr><td colspan="6" class="pc-empty">Error loading requests.</td></tr>`;
        }
    }

    function renderTable() {
        if (!elements.tableBody) return;
        if (elements.resultCount) elements.resultCount.textContent = `${state.total} requests`;

        if (!state.users.length) {
            elements.tableBody.innerHTML = `<tr><td colspan="6" class="pc-empty">No ${state.status} verification requests.</td></tr>`;
            return;
        }

        elements.tableBody.innerHTML = state.users.map(user => {
            const date = new Date(user.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
            const docsCount = (user.kyc?.selfie?.url ? 1 : 0) + (user.kyc?.governmentId?.url ? 1 : 0) + (user.kyc?.selfieWithId?.url ? 1 : 0);

            return `
                <tr>
                    <td><strong>${esc(user.firstName)} ${esc(user.lastName)}</strong></td>
                    <td class="cell-mono">${esc(user.email)}</td>
                    <td><small>${date}</small></td>
                    <td><span class="pc-badge">${docsCount} Files</span></td>
                    <td><span class="status-tag ${user.kyc?.status}">${user.kyc?.status}</span></td>
                    <td class="pc-th-actions">
                        <button class="pc-btn pc-btn-icon vk-view-btn" data-id="${user._id}"><i class="fa-solid fa-user-shield"></i></button>
                    </td>
                </tr>
            `;
        }).join('');

        elements.tableBody.querySelectorAll('.vk-view-btn').forEach(btn => {
            btn.addEventListener('click', () => openReview(btn.dataset.id));
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
            html += `<button class="pc-btn pc-btn-sm ${state.page === i ? 'pc-btn-primary' : ''}" data-page="${i}">${i}</button>`;
        }
        html += `<button class="pc-btn pc-btn-sm" ${state.page === totalPages ? 'disabled' : ''} data-page="${state.page + 1}">Next</button>`;
        elements.pagination.innerHTML = html;

        elements.pagination.querySelectorAll('button[data-page]').forEach(btn => {
            btn.addEventListener('click', () => {
                state.page = parseInt(btn.dataset.page);
                fetchRequests();
            });
        });
    }

    function getDocUrl(filename) {
        if (!filename) return '';
        return `${API_ORIGIN}/api/admin/docs/${filename}`;
    }

    async function openReview(userId) {
        const user = state.users.find(u => u._id === userId);
        if (!user) return;

        elements.drawerBody.innerHTML = `
            <div class="drawer-header-meta" style="margin-bottom: 24px;">
                <h3 style="font-size: 18px; font-weight: 800; margin-bottom: 4px;">${esc(user.firstName)} ${esc(user.lastName)}</h3>
                <p style="color: var(--m); font-size: 13px;">${esc(user.email)}</p>
            </div>

            <div class="vd-review-grid">
                <div class="vd-doc-box">
                    <span class="vd-doc-label">Face Selfie</span>
                    <div class="vd-img-wrap" onclick="window.open('${getDocUrl(user.kyc.selfie.url)}', '_blank')">
                        <img src="${getDocUrl(user.kyc.selfie.url)}" alt="Selfie" />
                    </div>
                </div>
                <div class="vd-doc-box">
                    <span class="vd-doc-label">Government ID</span>
                    <div class="vd-img-wrap" onclick="window.open('${getDocUrl(user.kyc.governmentId.url)}', '_blank')">
                        <img src="${getDocUrl(user.kyc.governmentId.url)}" alt="ID" />
                    </div>
                </div>
                ${user.kyc.selfieWithId?.url ? `
                <div class="vd-doc-box">
                    <span class="vd-doc-label">ID + Face Selfie</span>
                    <div class="vd-img-wrap" onclick="window.open('${getDocUrl(user.kyc.selfieWithId.url)}', '_blank')">
                        <img src="${getDocUrl(user.kyc.selfieWithId.url)}" alt="Selfie with ID" />
                    </div>
                </div>
                ` : ''}
            </div>

            <div class="vd-review-footer">
                <h4 style="font-size: 12px; color: var(--m); margin-bottom: 12px;">Verification Decision</h4>
                <div class="vd-action-row">
                    <button class="pc-btn pc-btn-success" id="btnApprove" style="flex:1"><i class="fa-solid fa-check-circle"></i> Approve & Verify</button>
                    <button class="pc-btn pc-btn-danger" id="btnReject" style="flex:1"><i class="fa-solid fa-times-circle"></i> Reject Submission</button>
                </div>
                <div class="vd-action-row">
                    <button class="pc-btn" id="btnReqChanges" style="flex:1"><i class="fa-solid fa-rotate-left"></i> Request Changes</button>
                </div>
                <div style="margin-top: 16px;">
                    <textarea id="reviewReason" class="pc-filter-input" style="width: 100%; height: 80px; padding: 12px;" placeholder="Reason for rejection or changes (required for non-approval)..."></textarea>
                </div>
            </div>
        `;

        openDrawer();

        document.getElementById('btnApprove')?.addEventListener('click', () => processReview(userId, 'verified'));
        document.getElementById('btnReject')?.addEventListener('click', () => processReview(userId, 'rejected'));
        document.getElementById('btnReqChanges')?.addEventListener('click', () => processReview(userId, 'requires_changes'));
    }

    async function processReview(userId, status) {
        const reason = document.getElementById('reviewReason')?.value.trim();
        if (status !== 'verified' && !reason) {
            showToast('Please provide a reason for this decision.', 'error');
            return;
        }

        try {
            await apiPatch(`/api/admin/verification-requests/${userId}/review`, { status, reason });
            showToast(`User verification ${status}.`, 'success');
            closeDrawer();
            fetchRequests();
        } catch (err) {
            showToast('Failed to process review.', 'error');
        }
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
        elements.tableBody.innerHTML = `<tr><td colspan="6"><div class="pc-skeleton-row"></div></td></tr>`;
    }

    function esc(s) {
        if (!s) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    window.initVerification = init;
    if (document.getElementById('verification-panel')) init();

})();
