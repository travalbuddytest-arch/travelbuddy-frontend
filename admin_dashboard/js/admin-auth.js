// Verifies admin session on dashboard pages and fills admin info in sidebar
//
// The admin dashboard is served as static files (e.g. by VS Code Live
// Server on port 5501), which is a completely different origin from the
// backend API (port 4000). A relative fetch resolves against the page's
// instead of the real backend - which doesn't exist there and 404s. That
// made ensureAdminProfile() think the session was invalid, clear the
// stored token, and bounce straight back to the login page - even though
// login itself had just succeeded. Pointing at the real backend origin
// (same pattern as Frontend/user-dashboard/js/common.js's API_ORIGIN) fixes
// this.
const API_ORIGIN = APP_CONFIG.API_BASE_URL;

async function apiGet(url) {
  const token = localStorage.getItem('admin_token') || localStorage.getItem('travelBuddyAdminToken');
  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
  const res = await fetch(`${API_ORIGIN}${url}`, { headers, credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, data };
  return data;
}

async function ensureAdminProfile() {
  try {
    const data = await apiGet('/api/admin/profile');
    const admin = data.admin;
    if (!admin) throw new Error('No admin data');
    // Update sidebar user display
    const adminSpan = document.querySelector('.admin > span');
    const nameNode = document.querySelector('.admin b');
    const smallNode = document.querySelector('.admin small');
    if (adminSpan) adminSpan.textContent = (admin.firstName || 'A').slice(0,1) + (admin.lastName?admin.lastName.slice(0,1):'');
    if (nameNode) nameNode.textContent = `${admin.firstName} ${admin.lastName}`;
    if (smallNode) smallNode.textContent = admin.email;
    // expose admin on window for other scripts
    window.ADMIN = admin;
    return admin;
  } catch (err) {
    console.warn('Admin auth failed, redirecting to login', err);
    // clear stored token and redirect
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    // Also clear the newer key names (login.js writes both old and new keys
    // - see travelBuddyAdmin/travelBuddyAdminToken). Missing this left a
    // stale "logged in" admin chip showing on Home/Support/About even after
    // this page decided the session was invalid and kicked back to login.
    localStorage.removeItem('travelBuddyAdminToken');
    localStorage.removeItem('travelBuddyAdmin');
    // There's only one login page for the whole site now: /login/login.html.
    // The unified /api/auth/login endpoint decides whether the email belongs
    // to a user or an admin.
    window.location.href = '../../login/login.html';
  }
}

// run immediately on load
ensureAdminProfile();
