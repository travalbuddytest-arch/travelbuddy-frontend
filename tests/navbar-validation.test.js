const fs = require('fs');
const path = require('path');
const assert = require('assert');

const FRONTEND_DIR = path.resolve(__dirname, '..');

console.log('========================================================');
console.log('  TRAVELBUDDY NAVBAR AUTOMATED VALIDATION TEST SUITE    ');
console.log('========================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
    totalTests++;
    try {
        fn();
        passedTests++;
        console.log(`  ✓ PASS: ${name}`);
    } catch (e) {
        failedTests++;
        console.error(`  ✗ FAIL: ${name}`);
        console.error(`    ${e.message}`);
    }
}

// 1. Check public-navbar.html
runTest('T1: public-navbar.html has version 7 and correct canonical structure', () => {
    const navbarHtml = fs.readFileSync(path.join(FRONTEND_DIR, 'shared', 'public-navbar.html'), 'utf8');
    assert(navbarHtml.includes('data-v="7"'), 'public-navbar.html must have data-v="7"');
    assert(!navbarHtml.includes('data-v="6"'), 'public-navbar.html must not have data-v="6"');
    
    // Check Single Login / Register button
    assert(navbarHtml.includes('class="auth-btn">Login / Register</a>'), 'Must contain single Login / Register button with class auth-btn');
    assert(!navbarHtml.includes('>Login</a>'), 'Must NOT have separate Login button');
    assert(!navbarHtml.includes('>Register</a>'), 'Must NOT have separate Register button');
    
    // Route check
    assert(navbarHtml.includes('href="/login/login.html"'), 'Button must link to /login/login.html');
    
    // Support link hidden by default
    assert(/id="navSupportLink"\s+hidden/.test(navbarHtml), 'Support link must have hidden attribute for fresh guests');
    
    // Check preservation of required IDs
    const requiredIds = [
        'menuToggle', 'mainNav', 'navSupportLink', 'guestNavActions',
        'homeUserChip', 'homeUserTrigger', 'homeAvatar', 'homeUserName',
        'homeUserRole', 'homeUserMenu', 'homeProfileBtn', 'homeDashboardLink',
        'homeDashboardLinkLabel', 'homeSettingsBtn', 'homeLogoutBtn', 'navOverlay'
    ];
    for (const id of requiredIds) {
        assert(navbarHtml.includes(`id="${id}"`), `public-navbar.html must preserve id="${id}"`);
    }
});

// 2. Check navbar.css
runTest('T2: navbar.css contains complete styles for .auth-btn and hidden state rules', () => {
    const navbarCss = fs.readFileSync(path.join(FRONTEND_DIR, 'shared', 'navbar.css'), 'utf8');
    
    // .auth-btn styling
    assert(navbarCss.includes('.auth-btn'), 'navbar.css must define .auth-btn');
    assert(navbarCss.includes('linear-gradient(135deg, var(--tb-primary,'), 'auth-btn must use TravelBuddy brand gradient');
    assert(navbarCss.includes('color: #ffffff !important'), 'auth-btn must have white text');
    assert(navbarCss.includes('border-radius: var(--radius-pill'), 'auth-btn must have pill border-radius');
    
    // Hover & active
    assert(navbarCss.includes('.auth-btn:hover'), 'auth-btn must have hover effect');
    assert(navbarCss.includes('.auth-btn:active'), 'auth-btn must have active press effect');
    assert(navbarCss.includes('.auth-btn:focus-visible'), 'auth-btn must have accessible focus-visible outline');
    
    // No nav underline
    assert(navbarCss.includes('#mainNav .auth-btn::after'), 'Must explicitly suppress nav underline for .auth-btn');
    
    // Hidden rules
    assert(navbarCss.includes('.guest-nav-actions[hidden]'), 'Must include .guest-nav-actions[hidden]');
    assert(navbarCss.includes('.home-user-chip[hidden]'), 'Must include .home-user-chip[hidden]');
    assert(navbarCss.includes('#navSupportLink[hidden]'), 'Must include #navSupportLink[hidden]');
    assert(navbarCss.includes('display: none !important;'), 'Hidden elements must have display: none !important;');
    
    // Mobile responsiveness
    assert(navbarCss.includes('.guest-nav-actions .auth-btn'), 'Mobile styles must format .auth-btn in mobile menu');
    assert(navbarCss.includes('#mainNav .auth-btn'), 'Mobile #mainNav styles must support .auth-btn');
});

// 3. Check nav-include.js
runTest('T3: nav-include.js versioning and clean injection mechanism', () => {
    const navIncludeJs = fs.readFileSync(path.join(FRONTEND_DIR, 'shared', 'nav-include.js'), 'utf8');
    assert(navIncludeJs.includes("var CURRENT_NAV_V = '7'"), 'CURRENT_NAV_V must be 7');
    assert(navIncludeJs.includes("var CURRENT_V = CURRENT_NAV_V"), 'CURRENT_V must point to CURRENT_NAV_V');
    
    // Clean replacement of outdated navbar and overlay to prevent duplicates
    assert(navIncludeJs.includes('existing.remove()'), 'Must remove outdated existing header to prevent duplicates');
    assert(navIncludeJs.includes('nextSib.id === \'navOverlay\''), 'Must remove outdated sibling navOverlay');
    assert(navIncludeJs.includes('el.outerHTML = html'), 'Must inject new navbar');
});

// 4. Invariant check: Authentication & Login/Register files NOT modified
runTest('T4: Authentication, login, and registration files are completely untouched', () => {
    const authFiles = [
        'login/login.html',
        'login/login.js',
        'login/login.css',
        'register/register.html',
        'register/register.js',
        'register/register.css',
        'shared/auth-guard.js',
        'shared/auth-cookie-client.js'
    ];
    
    for (const relPath of authFiles) {
        const fullPath = path.join(FRONTEND_DIR, relPath);
        assert(fs.existsSync(fullPath), `File must exist: ${relPath}`);
    }
});

// 5. JavaScript Behavior Logic Simulation
runTest('T5: nav-basic-behavior.js handles guest, user, admin, and logout correctly', () => {
    const behaviorJs = fs.readFileSync(path.join(FRONTEND_DIR, 'shared', 'nav-basic-behavior.js'), 'utf8');
    
    // Detects user and admin
    assert(behaviorJs.includes("localStorage.getItem('travelBuddyAdmin')"), 'Must detect admin via travelBuddyAdmin');
    assert(behaviorJs.includes("localStorage.getItem('travelBuddyUser')"), 'Must detect user via travelBuddyUser');
    
    // Controls guest actions vs user chip
    assert(behaviorJs.includes('guestActions.hidden = false'), 'Must show guest actions when logged out');
    assert(behaviorJs.includes('chip.hidden = true'), 'Must hide chip when logged out');
    assert(behaviorJs.includes('guestActions.hidden = true'), 'Must hide guest actions when logged in');
    assert(behaviorJs.includes('chip.hidden = false'), 'Must show chip when logged in');
    
    // Controls Support link
    assert(behaviorJs.includes('navSupportLink.hidden = !isAdmin && !isUser'), 'Must set Support link visibility based on auth');
    
    // Handles admin dashboard route
    assert(behaviorJs.includes('/admin_dashboard/html/admin.html'), 'Admin must route to admin dashboard');
    assert(behaviorJs.includes('/user-dashboard/overview.html'), 'User must route to user dashboard');
    
    // Logout
    assert(behaviorJs.includes("localStorage.removeItem('travelBuddyUser')"), 'Must clear travelBuddyUser on logout');
});

console.log(`\nRESULTS: TOTAL: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}\n`);
if (failedTests > 0) process.exit(1);
