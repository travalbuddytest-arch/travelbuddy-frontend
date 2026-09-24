(function () {
  'use strict';

  const canonicalOrigin = 'https://carryparcel.in';
  const host = window.location.hostname || '';
  const isLocal = host === 'localhost' || host === '127.0.0.1' || window.location.protocol === 'file:';

  if (!isLocal && host === 'www.carryparcel.in') {
    const target = canonicalOrigin + (window.location.pathname || '/') + window.location.search + window.location.hash;
    if (window.location.href !== target) {
      window.location.replace(target);
    }
  }

  // Centralized CarryParcel Global Object
  window.CarryParcel = window.CarryParcel || {};
  // Keep older dashboard modules working while they migrate to CarryParcel.
  window.TravelBuddy = window.CarryParcel;

  const localUrl = 'http://localhost:4000';
  const productionUrl = 'https://api.carryparcel.in';
  const apiBaseUrl = isLocal ? localUrl : productionUrl;

  window.APP_CONFIG = {
    API_BASE_URL: apiBaseUrl,
    SOCKET_URL: apiBaseUrl,
    ENV: isLocal ? 'development' : 'production',
    CANONICAL_ORIGIN: canonicalOrigin,
    WWW_REDIRECT_TARGET: canonicalOrigin,
  };

  window.API_BASE_URL = apiBaseUrl;
})();
