(function () {
  'use strict';

  const { API_ORIGIN, authHeaders, escapeHTML, setButtonLoading } = window.TravelBuddy;

  // Feedback Elements
  const feedbackForm = document.getElementById('feedbackForm');
  const feedbackRatingSelect = document.getElementById('feedbackRatingSelect');
  const feedbackCommentInput = document.getElementById('feedbackCommentInput');
  const submitFeedbackBtn = document.getElementById('submitFeedbackBtn');

  // Privacy Elements
  const manageCookiesBtn = document.getElementById('manageCookiesBtn');

  // Feedback Form
  if (feedbackForm) {
    feedbackForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const rating = Number(feedbackRatingSelect.value);
      const comment = feedbackCommentInput.value.trim();

      if (!comment) {
        window.showToast('Please write your feedback comment.', 'warning');
        return;
      }

      window.TravelBuddy.FormLock(feedbackForm, true, { loadingText: 'Submitting...' });

      try {
        const res = await fetch(`${API_ORIGIN}/api/settings/feedback`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ rating, comment })
        });
        const data = await res.json();

        if (!res.ok) {
          window.showToast(data.error || 'Failed to submit feedback.', 'error');
          return;
        }

        window.showToast('Thank you! Your feedback helps us make TravelBuddy better.', 'success');
        feedbackForm.reset();
      } catch (err) {
        console.error(err);
        window.showToast('Could not reach server to submit feedback.', 'error');
      } finally {
        window.TravelBuddy.FormLock(feedbackForm, false);
      }
    });
  }

  // Privacy & Cookies
  if (manageCookiesBtn) {
    manageCookiesBtn.addEventListener('click', () => {
      if (window.TravelBuddyCookies && typeof window.TravelBuddyCookies.open === 'function') {
        window.TravelBuddyCookies.open();
      } else {
        window.showToast('Cookie management is currently unavailable.', 'warning');
      }
    });
  }

})();
