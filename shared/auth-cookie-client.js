(()=>{
'use strict';
const nativeFetch=window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input?.url || '';
  const isCarryParcelApi = url.startsWith(`${APP_CONFIG.API_BASE_URL}/`);

  const isProtectedPage = () => {
    const guardedPage = document.currentScript?.getAttribute?.('data-guard');
    const path = window.location.pathname || '';
    return Boolean(guardedPage) || path.includes('/user-dashboard/') || path.includes('/admin_dashboard/');
  };

  const response = await nativeFetch(input, isCarryParcelApi ? { ...init, credentials: 'include' } : init);

  if (isCarryParcelApi) {
    if (response.status === 401) {
      // 401 Unauthorized: Session is invalid/expired. Logout.
      // HARDENING: Only redirect if we are not already on the login page
      // AND if this wasn't a background refresh that we can handle more gracefully.
      if (isProtectedPage() && !window.location.pathname.includes('login.html')) {
        console.warn('[Auth] Received 401. Logging out and redirecting.');
        window.CarryParcelAuth.logout();

        const returnTo = window.location.pathname + window.location.search + window.location.hash;
        window.location.href = `/login/login.html?reason=session_expired\u0026redirect=${encodeURIComponent(returnTo)}`;
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
window.CarryParcelAuth={
  async logout(){
    try{
      const fcmToken=localStorage.getItem('carryParcelFcmToken');
      if(fcmToken){
        await nativeFetch(`${APP_CONFIG.API_BASE_URL}/api/notifications/device-token`, {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token: fcmToken }),
        });
      }
    }catch{}
    try{await nativeFetch(`${APP_CONFIG.API_BASE_URL}/api/auth/logout`,{method:'POST',credentials:'include'});}catch{}
    localStorage.removeItem('carryParcelToken');
    localStorage.removeItem('carryParcelUser');
    localStorage.removeItem('carryParcelFcmToken');
    localStorage.removeItem('carryParcelAdminToken');
    localStorage.removeItem('admin_token');
    localStorage.removeItem('carryParcelLoggedIn');
    localStorage.removeItem('carryParcelAdminLoggedIn');
    if (window.CarryParcel && window.CarryParcel.clearClientCache) {
      window.CarryParcel.clearClientCache();
    }
  }
  ,
  // Admin helpers: admin sessions are stored separately to avoid colliding with user sessions
  isAdmin(){
    return Boolean(localStorage.getItem('carryParcelAdminLoggedIn'));
  },
  getAdmin(){
    try{return JSON.parse(localStorage.getItem('carryParcelAdmin')||'{}');}catch(e){return {};}
  },
  async logoutAdmin(){
    try{
      const fcmToken=localStorage.getItem('carryParcelFcmToken');
      if(fcmToken){
        await nativeFetch(`${APP_CONFIG.API_BASE_URL}/api/notifications/device-token`,{method:'DELETE',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:fcmToken})});
      }
    }catch(e){}
    try{await nativeFetch(`${APP_CONFIG.API_BASE_URL}/api/admin/logout`,{method:'POST',credentials:'include'});}catch(e){}
    localStorage.removeItem('carryParcelAdminToken');
    localStorage.removeItem('carryParcelAdmin');
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('carryParcelFcmToken');
    localStorage.removeItem('carryParcelLoggedIn');
    localStorage.removeItem('carryParcelAdminLoggedIn');
  }
};
})();
