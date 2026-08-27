/**
 * TravelBuddy Central Date & Time Utilities
 * Standardizes display formatting and timezone handling across the web platform.
 */

(function () {
  'use strict';

  /**
   * Formats an ISO 8601 timestamp into a human-friendly string.
   * Format: 27 Aug 2026, 10:30 AM
   * @param {string|Date} value - The date to format.
   * @returns {string} - Formatted string or fallback.
   */
  function formatDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    }).format(date);
  }

  /**
   * Formats an ISO string to a date-only string.
   * Format: 27 Aug 2026
   * @param {string|Date} value
   */
  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(date);
  }

  /**
   * Formats an ISO string to a time-only string.
   * Format: 10:30 AM
   */
  function formatTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return new Intl.DateTimeFormat("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    }).format(date);
  }

  /**
   * Returns a relative time string (e.g., "2 hours ago").
   * Fallback to formatDate if older than 1 week.
   */
  function formatRelative(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return "Just now";
    if (diffMin < 60) return `${diffMin} min${diffMin > 1 ? "s" : ""} ago`;
    if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? "s" : ""} ago`;
    if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? "s" : ""} ago`;

    return formatDate(value);
  }

  // Export to global namespace
  window.TravelBuddyDate = {
    formatDateTime,
    formatDate,
    formatTime,
    formatRelative
  };
})();
