(function () {
  'use strict';
  // Centralized CarryParcel Global Object
  window.CarryParcel = window.CarryParcel || {};
  // Keep older dashboard modules working while they migrate to CarryParcel.
  window.TravelBuddy = window.CarryParcel;

  const isLocal = window.location.hostname === 'localhost' ||
                  window.location.hostname === '127.0.0.1' || 
                  window.location.protocol === 'file:';
  const localUrl = 'http://localhost:4000';
  const productionUrl = 'https://api.carryparcel.in';
  window.APP_CONFIG = {
    API_BASE_URL: isLocal ? localUrl : productionUrl,
    SOCKET_URL: isLocal ? localUrl : productionUrl,
    ENV: isLocal ? 'development' : 'production',
  };
})();
