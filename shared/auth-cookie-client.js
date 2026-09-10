(()=>{
'use strict';
const nativeFetch=window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input?.url || '';
  const isTravelBuddyApi = url.startsWith(`${APP_CONFIG.API_BASE_URL}/`);

  const response = await nativeFetch(input, isTravelBuddyApi ? { ...init, credentials: 'include' } : init);

  if (isTravelBuddyApi) {
    if (response.status === 401) {
      // 401 Unauthorized: Session is invalid/expired. Logout.
      // HARDENING: Only redirect if we are not already on the login page
      // AND if this wasn't a background refresh that we can handle more gracefully.
      if (!window.location.pathname.includes('login.html')) {
        console.warn('[Auth] Received 401. Logging out and redirecting.');
        window.TravelBuddyAuth.logout();

        const returnTo = window.location.pathname + window.location.search + window.location.hash;
        window.location.href = `../login/login.html?reason=session_expired\u0026redirect=${encodeURIComponent(returnTo)}`;
      }
    } else if (response.status === 403) {
      // 403 Forbidden: Permission denied for this resource. DO NOT logout.
      // The calling code should handle this (e.g. show "Access Denied").
      console.warn('Access denied (403):', url);
    } else if (response.status === 429) {
      if (window.TBToast) {
        window.TBToast.show('Too many requests. Please wait a moment.', 'warning');
      }
    }
  }

  return response;
};
window.TravelBuddyAuth={
  async logout(){
    try{
      const fcmToken=localStorage.getItem('travelBuddyFcmToken');
      if(fcmToken){
        await nativeFetch(`${APP_CONFIG.API_BASE_URL}/api/notifications/device-token`, {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(localStorage.getItem('travelBuddyToken') ? { Authorization: `Bearer ${localStorage.getItem('travelBuddyToken')}` } : {}),
          },
          body: JSON.stringify({ token: fcmToken }),
        });
      }
    }catch{}
    try{await nativeFetch(`${APP_CONFIG.API_BASE_URL}/api/auth/logout`,{method:'POST',credentials:'include'});}catch{}
    localStorage.removeItem('travelBuddyToken');
    localStorage.removeItem('travelBuddyUser');
    localStorage.removeItem('travelBuddyFcmToken');
    if (window.TravelBuddy && window.TravelBuddy.clearClientCache) {
      window.TravelBuddy.clearClientCache();
    }
  }
  ,
  // Admin helpers: admin sessions are stored separately to avoid colliding with user sessions
  isAdmin(){
    return Boolean(localStorage.getItem('travelBuddyAdmin'));
  },
  getAdmin(){
    try{return JSON.parse(localStorage.getItem('travelBuddyAdmin')||'{}');}catch(e){return {};}
  },
  async logoutAdmin(){
    try{
      const fcmToken=localStorage.getItem('travelBuddyFcmToken');
      if(fcmToken){
        await nativeFetch(`${APP_CONFIG.API_BASE_URL}/api/notifications/device-token`,{method:'DELETE',credentials:'include',headers:{'Content-Type':'application/json',...(localStorage.getItem('travelBuddyAdminToken')?{Authorization:`Bearer ${localStorage.getItem('travelBuddyAdminToken')}`}:{})},body:JSON.stringify({token:fcmToken})});
      }
    }catch(e){}
    try{await nativeFetch(`${APP_CONFIG.API_BASE_URL}/api/admin/logout`,{method:'POST',credentials:'include'});}catch(e){}
    localStorage.removeItem('travelBuddyAdminToken');
    localStorage.removeItem('travelBuddyAdmin');
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('travelBuddyFcmToken');
  }
};
})();
