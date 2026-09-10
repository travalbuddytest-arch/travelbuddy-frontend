(function() {
    const API_ORIGIN = APP_CONFIG.API_BASE_URL;
    const reportsList = document.getElementById('reports-list');
    const ticketsList = document.getElementById('tickets-list');
    const disputesList = document.getElementById('disputes-list');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    async function apiGet(url) {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('travelBuddyAdminToken');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_ORIGIN}${url}`, { headers, credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw { status: res.status, data };
      return data;
    }

    // Tab Switching
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const targetTab = document.getElementById(`${btn.dataset.tab}-tab`);
            if (targetTab) targetTab.classList.add('active');

            if (btn.dataset.tab === 'reports') loadReports();
            else if (btn.dataset.tab === 'tickets') loadTickets();
            else if (btn.dataset.tab === 'disputes') loadDisputes();
        });
    });

    async function loadReports() {
        if (!reportsList) return;
        reportsList.innerHTML = '<tr><td colspan="7">Loading...</td></tr>';
        try {
            const status = document.getElementById('report-status-filter').value;
            const type = document.getElementById('report-type-filter').value;
            const data = await apiGet(`/api/admin/reports?status=${status}&targetType=${type}`);
            renderReports(data.reports);
        } catch (err) {
            reportsList.innerHTML = '<tr><td colspan="7">Error loading reports.</td></tr>';
        }
    }

    async function loadDisputes() {
        if (!disputesList) return;
        disputesList.innerHTML = '<tr><td colspan="6">Loading disputes...</td></tr>';
        try {
            const data = await apiGet('/api/admin/reports-disputes?status=open');
            renderDisputes(data.reports);
        } catch (err) {
            disputesList.innerHTML = '<tr><td colspan="6">Error loading disputes.</td></tr>';
        }
    }

    function renderDisputes(reports) {
      if (!reports || reports.length === 0) {
        disputesList.innerHTML = '<tr><td colspan="6">No active disputes found.</td></tr>';
        return;
      }
      disputesList.innerHTML = reports.map(r => `
        <tr>
          <td>${new Date(r.createdAt).toLocaleDateString()}</td>
          <td>${escHtml(r.fromUser?.firstName)} ${escHtml(r.fromUser?.lastName)}</td>
          <td><span class="status-tag info">${escHtml(r.targetType)}</span></td>
          <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis">${escHtml(r.reason)}</td>
          <td><span class="status-tag danger">${escHtml(r.status)}</span></td>
          <td><button class="btn sm secondary" onclick="window.investigateParcel('${r.targetParcelId?._id || r.targetParcelId}')">Investigate</button></td>
        </tr>
      `).join('');
    }

    async function loadTickets() {
        ticketsList.innerHTML = '<tr><td colspan="7">Loading...</td></tr>';
        try {
            const status = document.getElementById('ticket-status-filter').value;
            const data = await apiGet(`/api/admin/support-tickets?status=${status}`);
            renderTickets(data.tickets);
        } catch (err) {
            ticketsList.innerHTML = '<tr><td colspan="7">Error loading tickets.</td></tr>';
        }
    }

    function escHtml(s) {
        if (!s) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function renderReports(reports) {
        if (!reports || reports.length === 0) {
            reportsList.innerHTML = '<tr><td colspan="7">No reports found.</td></tr>';
            return;
        }
        reportsList.innerHTML = reports.map(r => `
            <tr>
                <td>${new Date(r.createdAt).toLocaleDateString()}</td>
                <td>${escHtml(r.fromUser?.firstName)} ${escHtml(r.fromUser?.lastName)}</td>
                <td>${escHtml(r.targetType)}</td>
                <td>${escHtml(r.targetParcelId?.orderId || r.targetUserId?.email || 'N/A')}</td>
                <td>${escHtml(r.reason)}</td>
                <td><span class="status-tag ${escHtml(r.status)}">${escHtml(r.status)}</span></td>
                <td>
                    <button onclick="updateReportStatus('${escHtml(r._id)}', 'resolved')">Resolve</button>
                </td>
            </tr>
        `).join('');
    }

    let currentTicketId = null;
    let supportSocket = null;

    // Socket Connection
    function connectSocket() {
        const socketInstance = window.TravelBuddySocket?.admin;
        if (!socketInstance) return;

        supportSocket = socketInstance;

        supportSocket.off('admin:message', handleSupportMessage);
        supportSocket.on('admin:message', handleSupportMessage);

        supportSocket.off('admin:alert', handleSupportAlert);
        supportSocket.on('admin:alert', handleSupportAlert);
    }

    function handleSupportMessage(payload) {
        if (payload.conversationId === currentTicketId) {
            appendMessage(payload);
        }
        // Also refresh lists if it's a new ticket or status change
        loadReports();
        loadTickets();
    }

    function handleSupportAlert(alert) {
        if (alert.type === 'support_ticket') {
            showToast(`New Ticket: ${alert.title}`);
            loadTickets();
        }
    }

    /**
     * Cleanup function called by admin.js
     */
    window.destroySupportReports = function() {
        if (supportSocket) {
            supportSocket.off('admin:message', handleSupportMessage);
            supportSocket.off('admin:alert', handleSupportAlert);
        }
        console.log('[SupportReports] Cleanup complete.');
    }

    function renderTickets(tickets) {
        if (!tickets || tickets.length === 0) {
            ticketsList.innerHTML = '<tr><td colspan="7">No tickets found.</td></tr>';
            return;
        }
        ticketsList.innerHTML = tickets.map(t => `
            <tr>
                <td>${new Date(t.createdAt).toLocaleDateString()}</td>
                <td>${escHtml(t.user?.firstName)} ${escHtml(t.user?.lastName)}</td>
                <td>${escHtml(t.category)}</td>
                <td>${escHtml(t.subject)}</td>
                <td><span class="status-tag ${escHtml(t.status)}">${escHtml(t.status)}</span></td>
                <td>${escHtml(t.priority)} ${t.callRequested ? '📞' : ''}</td>
                <td>
                    <button onclick="openSupportChat('${escHtml(t._id)}', '${escHtml(t.subject)}')">Chat</button>
                    <button onclick="updateTicketStatus('${escHtml(t._id)}', 'resolved')">Close</button>
                </td>
            </tr>
        `).join('');
    }

    window.openSupportChat = async (id, subject) => {
        currentTicketId = id;
        document.getElementById('chat-title').textContent = `Chat: ${subject}`;
        document.getElementById('chat-modal').classList.add('show');
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.innerHTML = 'Loading...';

        try {
            const data = await apiGet(`/api/admin/support-tickets/${id}/messages`); // Assuming this exists or using user route
            // Actually, I should use /api/support/tickets/:id/messages if it's accessible or add admin route
            // My backend has GET /api/support/tickets/:id/messages. Admin can use it too if middleware allows.
            // Let's use the one I added to support.js

            const res = await fetch(`${APP_CONFIG.API_BASE_URL}/api/support/tickets/${id}/messages`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
            });
            const chatData = await res.json();

            messagesContainer.innerHTML = '';
            chatData.messages.forEach(appendMessage);
        } catch (err) {
            messagesContainer.innerHTML = 'Error loading chat.';
        }
    }

    function appendMessage(m) {
        const messagesContainer = document.getElementById('chat-messages');
        const div = document.createElement('div');
        div.className = `chat-msg ${m.senderType || (m.fromUser ? 'user' : 'support')}`;
        div.innerHTML = `
            <div class="msg-content">
                ${m.messageType === 'call_request' ? '<strong>📞 Call Requested</strong>' : ''}
                ${escHtml(m.content || m.message)}
                ${m.attachment ? `<br><a href="${escHtml(m.attachment)}" target="_blank">📎 Attachment</a>` : ''}
            </div>
            <div class="msg-time">${new Date(m.createdAt).toLocaleTimeString()}</div>
        `;
        messagesContainer.appendChild(div);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    document.getElementById('send-chat-btn').addEventListener('click', async () => {
        const input = document.getElementById('chat-input-field');
        const content = input.value.trim();
        if (!content || !currentTicketId) return;

        try {
            await apiPatch(`/api/admin/support-tickets/${currentTicketId}/messages`, { content });
            input.value = '';
            // appendMessage will happen via socket or I can manually append
            // For better UX, append manually
            appendMessage({
                content,
                senderType: 'support',
                createdAt: new Date().toISOString()
            });
        } catch (err) {
            alert('Failed to send message');
        }
    });

    document.getElementById('close-chat').addEventListener('click', () => {
        document.getElementById('chat-modal').classList.remove('show');
        currentTicketId = null;
    });

    // Initial Load
    loadReports();
    connectSocket();

    // Filter listeners
    document.getElementById('report-status-filter').addEventListener('change', loadReports);
    document.getElementById('report-type-filter').addEventListener('change', loadReports);
    document.getElementById('ticket-status-filter').addEventListener('change', loadTickets);
})();
