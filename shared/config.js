(function () {
  'use strict';
  const isLocal = window.location.hostname === 'localhost' || 
                  window.location.hostname === '127.0.0.1' || 
                  window.location.protocol === 'file:';
  const localUrl = 'http://localhost:4000';
  window.APP_CONFIG = {
    API_BASE_URL: isLocal ? localUrl : 'https://travelbuddy-backend-19l6.onrender.com',
    SOCKET_URL: isLocal ? localUrl : 'https://travelbuddy-backend-19l6.onrender.com',
    ENV: isLocal ? 'development' : 'production',
  };
})();
