(function () {
  'use strict';

  const { API_ORIGIN, authHeaders, escapeHTML, setButtonLoading, statusBadge } = window.TravelBuddy;

  // Elements
  const reportsLoading = document.getElementById('reportsLoading');
  const reportsEmpty = document.getElementById('reportsEmpty');
  const reportsTableWrap = document.getElementById('reportsTableWrap');
  const reportsTableBody = document.getElementById('reportsTableBody');

  const openSubmitReportBtn = document.getElementById('openSubmitReportBtn');
  const submitReportModal = document.getElementById('submitReportModal');
  const submitReportClose = document.getElementById('submitReportClose');
  const submitReportForm = document.getElementById('submitReportForm');
  const reportTargetType = document.getElementById('reportTargetType');
  const reportParcelIdWrap = document.getElementById('reportParcelIdWrap');
  const reportParcelId = document.getElementById('reportParcelId');
  const reportReasonSelect = document.getElementById('reportReasonSelect');
  const reportDetails = document.getElementById('reportDetails');
  const sendReportBtn = document.getElementById('sendReportBtn');

  // Feedback Modal
  const viewFeedbackModal = document.getElementById('viewFeedbackModal');
  const viewFeedbackClose = document.getElementById('viewFeedbackClose');
  const feedbackReason = document.getElementById('feedbackReason');
  const feedbackDesc = document.getElementById('feedbackDesc');
  const feedbackAdminNotes = document.getElementById('feedbackAdminNotes');

  let allReports = [];

  async function loadMyReports() {
    if (reportsLoading) reportsLoading.classList.remove('hidden');
    if (reportsEmpty) reportsEmpty.classList.add('hidden');
    if (reportsTableWrap) reportsTableWrap.classList.add('hidden');

    try {
      const res = await fetch(`${API_ORIGIN}/api/support/my-reports`, { headers: authHeaders() });
      const data = await res.json();

      if (!res.ok) {
        window.showToast(data.error || 'Failed to load reports.', 'error');
        return;
      }

      allReports = data.reports || [];
      if (!allReports.length) {
        if (reportsEmpty) reportsEmpty.classList.remove('hidden');
        return;
      }

      if (reportsTableWrap) reportsTableWrap.classList.remove('hidden');
      renderReportsTable(allReports);
    } catch (err) {
      console.error(err);
      window.showToast('Could not connect to server.', 'error');
    } finally {
      if (reportsLoading) reportsLoading.classList.add('hidden');
    }
  }

  function renderReportsTable(reports) {
    if (!reportsTableBody) return;

    reportsTableBody.innerHTML = reports.map(r => {
      const dateStr = window.TravelBuddyDate
        ? window.TravelBuddyDate.formatDateTime(r.createdAt)
        : new Date(r.createdAt).toLocaleString('en-IN');

      const targetText = r.targetType === 'parcel'
        ? `Parcel ${escapeHTML(r.targetParcelId?.orderId || r.targetParcelId || '')}`
        : (r.targetType === 'user' ? 'User Conduct' : 'General');

      return `
        <tr>
          <td style="font-size:12.5px; color:var(--text-muted);">${escapeHTML(dateStr)}</td>
          <td style="font-weight:700; font-size:13px; color:var(--text-main);">${targetText}</td>
          <td style="font-size:13px;">${escapeHTML(r.reason || 'General Report')}</td>
          <td style="font-size:12.5px; color:var(--text-muted); max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            ${escapeHTML(r.description || '')}
          </td>
          <td>${statusBadge(r.status || 'open')}</td>
          <td>
            <button type="button" class="btn-ghost view-feedback-btn" data-id="${escapeHTML(r._id)}" style="padding:4px 8px; font-size:12px; height:auto; color:var(--primary);">
              View Feedback
            </button>
          </td>
        </tr>
      `;
    }).join('');

    reportsTableBody.querySelectorAll('.view-feedback-btn').forEach(btn => {
      btn.addEventListener('click', () => openFeedbackModal(btn.dataset.id));
    });
  }

  function openFeedbackModal(reportId) {
    const r = allReports.find(x => String(x._id) === String(reportId));
    if (!r) return;

    feedbackReason.textContent = r.reason || 'Safety Report';
    feedbackDesc.textContent = r.description || 'No description provided.';

    if (r.adminNotes) {
      feedbackAdminNotes.textContent = r.adminNotes;
      feedbackAdminNotes.style.fontStyle = 'normal';
      feedbackAdminNotes.style.color = 'var(--text-main)';
    } else {
      feedbackAdminNotes.textContent = 'This report is still being investigated. Our team will provide feedback once resolved.';
      feedbackAdminNotes.style.fontStyle = 'italic';
      feedbackAdminNotes.style.color = 'var(--text-muted)';
    }

    viewFeedbackModal.classList.remove('hidden');
  }

  // Modal Handlers
  if (openSubmitReportBtn) {
    openSubmitReportBtn.addEventListener('click', () => {
      submitReportForm.reset();
      submitReportModal.classList.remove('hidden');
      reportDetails.focus();
    });
  }

  if (submitReportClose) {
    submitReportClose.addEventListener('click', () => submitReportModal.classList.add('hidden'));
  }

  if (viewFeedbackClose) {
    viewFeedbackClose.addEventListener('click', () => viewFeedbackModal.classList.add('hidden'));
  }

  if (reportTargetType) {
    reportTargetType.addEventListener('change', (e) => {
      if (e.target.value === 'parcel') {
        reportParcelIdWrap?.classList.remove('hidden');
      } else {
        reportParcelIdWrap?.classList.add('hidden');
      }
    });
  }

  if (submitReportForm) {
    submitReportForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const targetType = reportTargetType.value;
      const targetParcelId = reportParcelId?.value.trim() || undefined;
      const reason = reportReasonSelect.value;
      const description = reportDetails.value.trim();

      if (!reason || !description) {
        window.showToast('Please provide a reason and detailed description.', 'warning');
        return;
      }

      setButtonLoading(sendReportBtn, true, 'Submitting Report...');

      try {
        const res = await fetch(`${API_ORIGIN}/api/support/reports`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ targetType, targetParcelId, reason, description })
        });
        const data = await res.json();

        if (!res.ok) {
          window.showToast(data.error || 'Failed to submit report.', 'error');
          return;
        }

        window.showToast('Your report has been received and prioritized for review.', 'success');
        submitReportModal.classList.add('hidden');
        loadMyReports();
      } catch (err) {
        console.error(err);
        window.showToast('Network error submitting report.', 'error');
      } finally {
        setButtonLoading(sendReportBtn, false);
      }
    });
  }

  // Check URL params for pre-filling parcel report
  const params = new URLSearchParams(window.location.search);
  const pId = params.get('parcelId');
  if (pId) {
    submitReportModal?.classList.remove('hidden');
    if (reportTargetType) reportTargetType.value = 'parcel';
    if (reportParcelId) reportParcelId.value = pId;
    reportParcelIdWrap?.classList.remove('hidden');
  }

  loadMyReports();
})();
