(function () {
  'use strict';

  const { API_ORIGIN, authHeaders, escapeHTML, setButtonLoading, statusBadge } = window.TravelBuddy;

  // Tabs
  const tabFaqBtn = document.getElementById('tabFaqBtn');
  const tabTicketsBtn = document.getElementById('tabTicketsBtn');
  const sectionFaq = document.getElementById('sectionFaq');
  const sectionTickets = document.getElementById('sectionTickets');
  const ticketCountBadge = document.getElementById('ticketCountBadge');

  // FAQs
  const faqLoading = document.getElementById('faqLoading');
  const faqList = document.getElementById('faqList');
  const faqSearchInput = document.getElementById('faqSearchInput');

  // Tickets
  const ticketsLoading = document.getElementById('ticketsLoading');
  const ticketsEmpty = document.getElementById('ticketsEmpty');
  const ticketsTableWrap = document.getElementById('ticketsTableWrap');
  const ticketsTableBody = document.getElementById('ticketsTableBody');

  // Create Modal
  const openCreateTicketBtn = document.getElementById('openCreateTicketBtn');
  const emptyOpenTicketBtn = document.getElementById('emptyOpenTicketBtn');
  const createTicketModal = document.getElementById('createTicketModal');
  const createTicketClose = document.getElementById('createTicketClose');
  const createTicketForm = document.getElementById('createTicketForm');
  const ticketSubject = document.getElementById('ticketSubject');
  const ticketCategory = document.getElementById('ticketCategory');
  const ticketParcelId = document.getElementById('ticketParcelId');
  const ticketDescription = document.getElementById('ticketDescription');
  const submitTicketBtn = document.getElementById('submitTicketBtn');

  // Thread Modal
  const ticketThreadModal = document.getElementById('ticketThreadModal');
  const ticketThreadClose = document.getElementById('ticketThreadClose');
  const threadSubject = document.getElementById('threadSubject');
  const threadStatusBadge = document.getElementById('threadStatusBadge');
  const ticketMessagesContainer = document.getElementById('ticketMessagesContainer');
  const replyTicketForm = document.getElementById('replyTicketForm');
  const replyTicketInput = document.getElementById('replyTicketInput');

  let allFaqs = [];
  let userTickets = [];
  let currentActiveTicket = null;

  // ---------------- Tabs ----------------
  function switchTab(tab) {
    if (tab === 'tickets') {
      tabTicketsBtn.classList.add('active');
      tabFaqBtn.classList.remove('active');
      sectionTickets.classList.remove('hidden');
      sectionFaq.classList.add('hidden');
      loadTickets();
    } else {
      tabFaqBtn.classList.add('active');
      tabTicketsBtn.classList.remove('active');
      sectionFaq.classList.remove('hidden');
      sectionTickets.classList.add('hidden');
    }
  }

  tabFaqBtn?.addEventListener('click', () => switchTab('faq'));
  tabTicketsBtn?.addEventListener('click', () => switchTab('tickets'));

  // ---------------- FAQs ----------------
  async function loadFaqs() {
    if (faqLoading) faqLoading.classList.remove('hidden');

    try {
      const res = await fetch(`${API_ORIGIN}/api/support/faq`, { headers: authHeaders() });
      const data = await res.json();

      allFaqs = data.faqs || [];

      // Fallback default FAQs if none created in database yet
      if (!allFaqs.length) {
        allFaqs = [
          { question: 'How does parcel escrow protection work?', answer: 'When a parcel is posted, the offer amount is held securely in TravelBuddy escrow. Funds are never released to the traveler until pickup and delivery OTP or QR verification is completed.' },
          { question: 'How are traveler earnings calculated?', answer: 'Travelers receive 90% of the offered parcel price. A nominal 10% platform fee is deducted to cover insurance and payment gateway charges.' },
          { question: 'What is the cancellation policy?', answer: 'Free cancellation is allowed anytime before parcel pickup. If a traveler cancels after pickup, full refunds are issued and penalties apply.' },
          { question: 'How do I withdraw funds to my bank account?', answer: 'Visit the Withdraw page under Money in your dashboard. You can withdraw instantly via UPI or IMPS Bank Transfer with 2-step email verification.' },
          { question: 'What items are prohibited from being transported?', answer: 'Hazardous chemicals, flammable substances, illegal narcotics, weapons, and counterfeit goods are strictly prohibited.' }
        ];
      }

      renderFaqs(allFaqs);
    } catch (err) {
      console.error(err);
      if (faqList) faqList.innerHTML = '<p style="color:var(--text-muted); text-align:center;">Unable to load FAQs.</p>';
    } finally {
      if (faqLoading) faqLoading.classList.add('hidden');
    }
  }

  function renderFaqs(list) {
    if (!faqList) return;

    if (!list.length) {
      faqList.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">No matching FAQs found.</p>';
      return;
    }

    faqList.innerHTML = list.map(item => `
      <div class="faq-accordion-item">
        <button type="button" class="faq-question-btn">
          <span>${escapeHTML(item.question)}</span>
          <i class="fa-solid fa-chevron-down"></i>
        </button>
        <div class="faq-answer-pane">
          ${escapeHTML(item.answer)}
        </div>
      </div>
    `).join('');

    faqList.querySelectorAll('.faq-question-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const parent = btn.closest('.faq-accordion-item');
        const isOpen = parent.classList.contains('active');
        faqList.querySelectorAll('.faq-accordion-item').forEach(el => el.classList.remove('active'));
        if (!isOpen) parent.classList.add('active');
      });
    });
  }

  if (faqSearchInput) {
    faqSearchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const filtered = allFaqs.filter(f => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q));
      renderFaqs(filtered);
    });
  }

  // ---------------- Tickets ----------------
  async function loadTickets() {
    if (ticketsLoading) ticketsLoading.classList.remove('hidden');
    if (ticketsEmpty) ticketsEmpty.classList.add('hidden');
    if (ticketsTableWrap) ticketsTableWrap.classList.add('hidden');

    try {
      const res = await fetch(`${API_ORIGIN}/api/support/tickets`, { headers: authHeaders() });
      const data = await res.json();

      userTickets = data.tickets || [];
      if (ticketCountBadge) ticketCountBadge.textContent = userTickets.length;

      if (!userTickets.length) {
        if (ticketsEmpty) ticketsEmpty.classList.remove('hidden');
        return;
      }

      if (ticketsTableWrap) ticketsTableWrap.classList.remove('hidden');
      renderTicketsTable(userTickets);
    } catch (err) {
      console.error(err);
      window.showToast('Could not load support tickets.', 'error');
    } finally {
      if (ticketsLoading) ticketsLoading.classList.add('hidden');
    }
  }

  function renderTicketsTable(tickets) {
    if (!ticketsTableBody) return;

    ticketsTableBody.innerHTML = tickets.map(t => {
      const dateStr = window.TravelBuddyDate
        ? window.TravelBuddyDate.formatDate(t.createdAt)
        : new Date(t.createdAt).toLocaleDateString('en-IN');

      return `
        <tr>
          <td>
            <span style="font-family:monospace; font-weight:700; font-size:12.5px; display:block;">#${escapeHTML(String(t._id).slice(-6).toUpperCase())}</span>
            <span style="font-size:11.5px; color:var(--text-faint);">${escapeHTML(dateStr)}</span>
          </td>
          <td>
            <strong style="font-size:13.5px; color:var(--text-main);">${escapeHTML(t.subject)}</strong>
          </td>
          <td style="font-size:12.5px;">${escapeHTML(t.category || 'General')}</td>
          <td>${statusBadge(t.status || 'open')}</td>
          <td>
            <button type="button" class="btn-ghost open-thread-btn" data-id="${escapeHTML(t._id)}" style="padding:4px 10px; font-size:12px; height:auto;">
              <i class="fa-solid fa-comments"></i> View Thread
            </button>
          </td>
        </tr>
      `;
    }).join('');

    ticketsTableBody.querySelectorAll('.open-thread-btn').forEach(btn => {
      btn.addEventListener('click', () => openTicketThread(btn.dataset.id));
    });
  }

  // ---------------- Create Ticket ----------------
  [openCreateTicketBtn, emptyOpenTicketBtn].forEach(b => {
    b?.addEventListener('click', () => {
      createTicketForm.reset();
      createTicketModal.classList.remove('hidden');
      ticketSubject.focus();
    });
  });

  createTicketClose?.addEventListener('click', () => createTicketModal.classList.add('hidden'));

  if (createTicketForm) {
    createTicketForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const subject = ticketSubject.value.trim();
      const category = ticketCategory.value;
      const parcelId = ticketParcelId.value.trim() || undefined;
      const description = ticketDescription.value.trim();

      if (!subject || !description) {
        window.showToast('Please provide a subject and description.', 'warning');
        return;
      }

      setButtonLoading(submitTicketBtn, true, 'Creating Ticket...');

      try {
        const res = await fetch(`${API_ORIGIN}/api/support/tickets`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ subject, category, parcelId, description })
        });
        const data = await res.json();

        if (!res.ok) {
          window.showToast(data.error || 'Failed to create ticket.', 'error');
          return;
        }

        window.showToast('Support ticket created successfully!', 'success');
        createTicketModal.classList.add('hidden');
        switchTab('tickets');
      } catch (err) {
        console.error(err);
        window.showToast('Network error creating ticket.', 'error');
      } finally {
        setButtonLoading(submitTicketBtn, false);
      }
    });
  }

  // ---------------- Ticket Thread ----------------
  async function openTicketThread(ticketId) {
    currentActiveTicket = userTickets.find(t => String(t._id) === String(ticketId));
    if (!currentActiveTicket) return;

    threadSubject.textContent = currentActiveTicket.subject;
    threadStatusBadge.innerHTML = statusBadge(currentActiveTicket.status || 'open');
    ticketMessagesContainer.innerHTML = '<p style="text-align:center; color:var(--text-faint); margin:auto;">Loading messages...</p>';
    ticketThreadModal.classList.remove('hidden');

    try {
      const res = await fetch(`${API_ORIGIN}/api/support/tickets/${encodeURIComponent(ticketId)}/messages`, {
        headers: authHeaders()
      });
      const data = await res.json();
      const messages = data.messages || [];

      // Include initial description as first message
      const threadList = [
        { senderType: 'user', content: currentActiveTicket.description, createdAt: currentActiveTicket.createdAt },
        ...messages
      ];

      renderThreadMessages(threadList);
    } catch (err) {
      console.error(err);
      ticketMessagesContainer.innerHTML = '<p style="color:var(--error); text-align:center;">Could not load messages.</p>';
    }
  }

  function renderThreadMessages(messages) {
    if (!ticketMessagesContainer) return;

    ticketMessagesContainer.innerHTML = messages.map(m => {
      const isUser = m.senderType === 'user';
      return `
        <div class="ticket-msg-bubble ${isUser ? 'is-user' : 'is-support'}">
          <span style="font-size:10.5px; opacity:0.8; display:block; margin-bottom:2px; font-weight:700;">
            ${isUser ? 'You' : 'TravelBuddy Support Team'}
          </span>
          ${escapeHTML(m.content)}
        </div>
      `;
    }).join('');

    ticketMessagesContainer.scrollTop = ticketMessagesContainer.scrollHeight;
  }

  ticketThreadClose?.addEventListener('click', () => ticketThreadModal.classList.add('hidden'));

  if (replyTicketForm) {
    replyTicketForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentActiveTicket) return;

      const content = replyTicketInput.value.trim();
      if (!content) return;

      try {
        const res = await fetch(`${API_ORIGIN}/api/support/tickets/${encodeURIComponent(currentActiveTicket._id)}/messages`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ content })
        });
        const data = await res.json();

        if (res.ok) {
          replyTicketInput.value = '';
          openTicketThread(currentActiveTicket._id);
        } else {
          window.showToast(data.error || 'Failed to send reply.', 'error');
        }
      } catch (err) {
        console.error(err);
        window.showToast('Network error sending message.', 'error');
      }
    });
  }

  loadFaqs();
  loadTickets();
})();
