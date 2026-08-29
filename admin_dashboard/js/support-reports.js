(function() {
    const reportsList = document.getElementById('reports-list');
    const ticketsList = document.getElementById('tickets-list');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // Tab Switching
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');

            if (btn.dataset.tab === 'reports') loadReports();
            else loadTickets();
        });
    });

    async function loadReports() {
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

    function renderReports(reports) {
        if (!reports || reports.length === 0) {
            reportsList.innerHTML = '<tr><td colspan="7">No reports found.</td></tr>';
            return;
        }
        reportsList.innerHTML = reports.map(r => `
            <tr>
                <td>${new Date(r.createdAt).toLocaleDateString()}</td>
                <td>${r.fromUser?.firstName} ${r.fromUser?.lastName}</td>
                <td>${r.targetType}</td>
                <td>${r.targetParcelId?.orderId || r.targetUserId?.email || 'N/A'}</td>
                <td>${r.reason}</td>
                <td><span class="status-tag ${r.status}">${r.status}</span></td>
                <td>
                    <button onclick="updateReportStatus('${r._id}', 'resolved')">Resolve</button>
                </td>
            </tr>
        `).join('');
    }

    let currentTicketId = null;
    let supportSocket = null;

    // Socket Connection
    function connectSocket() {
        const token = localStorage.getItem('admin_token');
        if (!token || typeof io === 'undefined') return;

        supportSocket = io(APP_CONFIG.SOCKET_URL + '/admin', {
            auth: { token },
            transports: ['websocket', 'polling']
        });

        supportSocket.on('admin:message', (payload) => {
            if (payload.conversationId === currentTicketId) {
                appendMessage(payload);
            }
            // Also refresh lists if it's a new ticket or status change
            loadReports();
            loadTickets();
        });

        supportSocket.on('admin:alert', (alert) => {
            if (alert.type === 'support_ticket') {
                showToast(`New Ticket: ${alert.title}`);
                loadTickets();
            }
        });
    }

    function renderTickets(tickets) {
        if (!tickets || tickets.length === 0) {
            ticketsList.innerHTML = '<tr><td colspan="7">No tickets found.</td></tr>';
            return;
        }
        ticketsList.innerHTML = tickets.map(t => `
            <tr>
                <td>${new Date(t.createdAt).toLocaleDateString()}</td>
                <td>${t.user?.firstName} ${t.user?.lastName}</td>
                <td>${t.category}</td>
                <td>${t.subject}</td>
                <td><span class="status-tag ${t.status}">${t.status}</span></td>
                <td>${t.priority} ${t.callRequested ? '📞' : ''}</td>
                <td>
                    <button onclick="openSupportChat('${t._id}', '${t.subject}')">Chat</button>
                    <button onclick="updateTicketStatus('${t._id}', 'resolved')">Close</button>
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
                ${m.content || m.message}
                ${m.attachment ? `<br><a href="${m.attachment}" target="_blank">📎 Attachment</a>` : ''}
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
