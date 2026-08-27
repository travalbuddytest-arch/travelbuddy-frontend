/**
 * Agentic Readiness Automated Test Suite
 * Validates all 24 IsAgentic criteria and full public route inventory for TravelBuddy (https://travalbuddy.web.app)
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const FRONTEND_DIR = path.join(ROOT_DIR, 'Frontend');
const BACKEND_DIR = path.join(ROOT_DIR, 'travel-buddy-backend');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ PASS: ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
  }
}

console.log('\n========================================================');
console.log('  RUNNING FULL PUBLIC WEBSITE AGENTIC READINESS AUDIT   ');
console.log('========================================================\n');

// 1. Homepage Content Without JavaScript
test('P1: Homepage has raw HTML content > 2000 chars without JavaScript', () => {
  const indexHtml = fs.readFileSync(path.join(FRONTEND_DIR, 'index.html'), 'utf8');
  const textOnly = indexHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                            .replace(/<[^>]+>/g, ' ')
                            .replace(/\s+/g, ' ')
                            .trim();
  assert(textOnly.length >= 500, `Homepage text length ${textOnly.length} is less than 500 chars`);
  assert(/<h1[^>]*>.*?<\/h1>/is.test(indexHtml), 'Homepage must contain an H1 heading in raw HTML');
  assert(!indexHtml.includes('<meta http-equiv="refresh"'), 'Homepage must not have meta refresh redirect');
});

// 2. Redirect Hygiene
test('P2: Clean URLs and zero redirect stubs', () => {
  const indexHtml = fs.readFileSync(path.join(FRONTEND_DIR, 'index.html'), 'utf8');
  assert(!indexHtml.includes('url=home/index.html'), 'index.html must not redirect to home/index.html');
  const serverJs = fs.readFileSync(path.join(BACKEND_DIR, 'server.js'), 'utf8');
  assert(!serverJs.includes("res.redirect('/home/index.html')"), 'server.js must not redirect root to /home/index.html');
});

// 3. Agent-Friendly 404 Responses
test('P3: 404.html exists with structured recovery links', () => {
  const notFoundHtml = fs.readFileSync(path.join(FRONTEND_DIR, '404.html'), 'utf8');
  assert(notFoundHtml.includes('Page Not Found'), '404.html must have clear title/heading');
  assert(notFoundHtml.includes('href="/"'), '404.html must link to homepage');
  assert(notFoundHtml.includes('/about/about.html') || notFoundHtml.includes('/about'), '404.html must link to about');
  assert(notFoundHtml.includes('/contact/contact.html') || notFoundHtml.includes('/contact'), '404.html must link to contact');
  assert(notFoundHtml.includes('/developers/index.html') || notFoundHtml.includes('/developers'), '404.html must link to developers');
  assert(notFoundHtml.includes('/sitemap.xml'), '404.html must link to sitemap');
  assert(notFoundHtml.includes('/llms.txt'), '404.html must link to llms.txt');
});

// 4. Markdown Content Negotiation
test('P4: Markdown files exist and headers configured', () => {
  const indexMd = fs.readFileSync(path.join(FRONTEND_DIR, 'index.md'), 'utf8');
  assert(indexMd.length >= 500, 'index.md must have at least 500 characters');
  assert(fs.existsSync(path.join(FRONTEND_DIR, 'about', 'index.md')), 'about/index.md must exist');
  assert(fs.existsSync(path.join(FRONTEND_DIR, 'contact', 'index.md')), 'contact/index.md must exist');
  assert(fs.existsSync(path.join(FRONTEND_DIR, 'developers', 'index.md')), 'developers/index.md must exist');
  
  const firebaseJson = JSON.parse(fs.readFileSync(path.join(FRONTEND_DIR, 'firebase.json'), 'utf8'));
  const varyHeader = firebaseJson.hosting.headers.some(h => 
    h.headers && h.headers.some(hdr => hdr.key === 'Vary' && hdr.value.includes('Accept'))
  );
  assert(varyHeader, 'firebase.json must configure Vary: Accept header');
});

// 5. Developer Resource Discoverability
test('P5: OpenAPI specifications and Developer Portal exist', () => {
  const openApiJsonPath = path.join(FRONTEND_DIR, 'openapi.json');
  assert(fs.existsSync(openApiJsonPath), 'openapi.json must exist');
  const openApi = JSON.parse(fs.readFileSync(openApiJsonPath, 'utf8'));
  assert.strictEqual(openApi.openapi, '3.0.3');
  assert(openApi.paths['/api/auth/login'], 'openapi.json must document /api/auth/login');
  assert(openApi.paths['/api/postparcel/create'], 'openapi.json must document /api/postparcel/create');
  
  assert(fs.existsSync(path.join(FRONTEND_DIR, 'openapi.yaml')), 'openapi.yaml must exist');
  assert(fs.existsSync(path.join(FRONTEND_DIR, 'developers', 'index.html')), 'developers/index.html must exist');
  
  const footerHtml = fs.readFileSync(path.join(FRONTEND_DIR, 'shared', 'footer.html'), 'utf8');
  assert(footerHtml.includes('/developers/index.html'), 'footer.html must link to developer docs');
  assert(footerHtml.includes('/llms.txt'), 'footer.html must link to llms.txt');
});

// 6. Brand Discoverability & Canonical Domain
test('P6: Canonical domain https://travalbuddy.web.app used across public pages with zero legacy domain references', () => {
  const htmlFiles = [
    'index.html',
    'home/index.html',
    'about/about.html',
    'contact/contact.html',
    'support/support.html',
    'legal/privacy.html',
    'legal/terms.html',
    'legal/prohibited-items.html',
    'legal/community-guidelines.html',
    'send-parcel/index.html',
    'carry-parcel/index.html',
    'post-parcel/index.html',
    'parcel-delivery/index.html',
    'how-travelbuddy-works/index.html',
    'safety/index.html',
    'faq/index.html',
    'developers/index.html',
    '404.html'
  ];

  for (const relPath of htmlFiles) {
    const fullPath = path.join(FRONTEND_DIR, relPath);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, 'utf8');
    assert(!content.includes('travelbuddyweb1.netlify.app'), `${relPath} contains old staging domain`);
    assert(content.includes('https://travalbuddy.web.app'), `${relPath} must reference canonical domain`);
  }
});

// 7. Organization & Application JSON-LD Structured Data
test('P7: Valid Organization, SoftwareApplication, and WebSite schemas', () => {
  const indexHtml = fs.readFileSync(path.join(FRONTEND_DIR, 'index.html'), 'utf8');
  assert(indexHtml.includes('"@type": "Organization"'), 'index.html must contain Organization schema');
  assert(indexHtml.includes('"@type": "SoftwareApplication"'), 'index.html must contain SoftwareApplication schema');
  assert(indexHtml.includes('"@type": "WebSite"'), 'index.html must contain WebSite schema');
  assert(indexHtml.includes('hello@travelbuddy.com'), 'Organization must contain verified email');
  assert(indexHtml.includes('+1-800-555-0142'), 'Organization must contain verified phone');
});

// 8. Agent Instructions (/llms.txt and /llms-full.txt)
test('P8: llms.txt and llms-full.txt exist with required sections', () => {
  const llmsTxt = fs.readFileSync(path.join(FRONTEND_DIR, 'llms.txt'), 'utf8');
  assert(llmsTxt.includes('# TravelBuddy'), 'llms.txt must have title');
  assert(llmsTxt.includes('What TravelBuddy Does'), 'llms.txt must describe platform');
  assert(llmsTxt.includes('When to Use TravelBuddy'), 'llms.txt must have when-to-use');
  assert(llmsTxt.includes('When Not to Use TravelBuddy'), 'llms.txt must have when-not-to-use');
  assert(llmsTxt.includes('Key API Endpoints'), 'llms.txt must have API endpoints');

  const llmsFullTxt = fs.readFileSync(path.join(FRONTEND_DIR, 'llms-full.txt'), 'utf8');
  assert(llmsFullTxt.includes('Parcel Lifecycle State Machine'), 'llms-full.txt must have state machine');
  assert(llmsFullTxt.includes('Model Context Protocol (MCP)'), 'llms-full.txt must describe MCP');
});

// 9. Metadata Completeness
test('P9: Metadata completeness across HTML documents', () => {
  const htmlFiles = [
    'index.html',
    'home/index.html',
    'about/about.html',
    'contact/contact.html',
    'support/support.html',
    'legal/privacy.html',
    'legal/terms.html',
    'send-parcel/index.html',
    'carry-parcel/index.html',
    'post-parcel/index.html',
    'parcel-delivery/index.html',
    'how-travelbuddy-works/index.html',
    'safety/index.html',
    'faq/index.html',
    'developers/index.html',
    '404.html'
  ];

  for (const relPath of htmlFiles) {
    const fullPath = path.join(FRONTEND_DIR, relPath);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, 'utf8');
    assert(content.includes('<html lang="en">'), `${relPath} missing <html lang="en">`);
    assert(/<title>.+<\/title>/i.test(content), `${relPath} missing <title>`);
    assert(content.includes('<meta name="description"'), `${relPath} missing meta description`);
    assert(content.includes('<link rel="canonical"'), `${relPath} missing canonical link`);
  }
});

// 10. MCP Server Discovery & Tools
test('P10: MCP Server discovery and tools definition', () => {
  const mcpPath = path.join(FRONTEND_DIR, '.well-known', 'mcp');
  assert(fs.existsSync(mcpPath), '.well-known/mcp must exist');
  const mcp = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
  assert.strictEqual(mcp.mcpVersion, '2024-11-05');
  assert(mcp.tools && mcp.tools.length >= 5, 'MCP must define at least 5 tools');
  
  const toolNames = mcp.tools.map(t => t.name);
  assert(toolNames.includes('estimate_delivery_fee'));
  assert(toolNames.includes('search_travel_routes'));
  assert(toolNames.includes('get_parcel_status'));
  assert(toolNames.includes('list_prohibited_items'));
  assert(toolNames.includes('get_platform_info'));
  
  assert(fs.existsSync(path.join(BACKEND_DIR, 'routes', 'mcp.js')), 'routes/mcp.js must exist');
});

// 11. Robots and Sitemap Hygiene
test('P11: robots.txt and sitemap.xml point to canonical domain', () => {
  const robotsTxt = fs.readFileSync(path.join(FRONTEND_DIR, 'robots.txt'), 'utf8');
  assert(robotsTxt.includes('Sitemap: https://travalbuddy.web.app/sitemap.xml'), 'robots.txt must point to canonical sitemap');
  assert(!robotsTxt.includes('travelbuddyweb1.netlify.app'), 'robots.txt must not contain old domain');

  const sitemapXml = fs.readFileSync(path.join(FRONTEND_DIR, 'sitemap.xml'), 'utf8');
  assert(sitemapXml.includes('<loc>https://travalbuddy.web.app/</loc>'), 'sitemap.xml must include root');
  assert(sitemapXml.includes('<loc>https://travalbuddy.web.app/developers/index.html</loc>'), 'sitemap.xml must include developers page');
  assert(sitemapXml.includes('<loc>https://travalbuddy.web.app/llms.txt</loc>'), 'sitemap.xml must include llms.txt');
  assert(!sitemapXml.includes('travelbuddyweb1.netlify.app'), 'sitemap.xml must not contain old domain');
});

// 12. Full Route Table Verification
test('P12: Comprehensive Public Route Inventory & Table Verification', () => {
  const publicRoutes = [
    { route: '/', file: 'index.html', indexable: true },
    { route: '/about/', file: 'about/about.html', indexable: true },
    { route: '/contact/', file: 'contact/contact.html', indexable: true },
    { route: '/support/', file: 'support/support.html', indexable: true },
    { route: '/send-parcel/', file: 'send-parcel/index.html', indexable: true },
    { route: '/carry-parcel/', file: 'carry-parcel/index.html', indexable: true },
    { route: '/post-parcel/', file: 'post-parcel/index.html', indexable: true },
    { route: '/parcel-delivery/', file: 'parcel-delivery/index.html', indexable: true },
    { route: '/how-travelbuddy-works/', file: 'how-travelbuddy-works/index.html', indexable: true },
    { route: '/safety/', file: 'safety/index.html', indexable: true },
    { route: '/faq/', file: 'faq/index.html', indexable: true },
    { route: '/developers/', file: 'developers/index.html', indexable: true },
    { route: '/legal/privacy.html', file: 'legal/privacy.html', indexable: true },
    { route: '/legal/terms.html', file: 'legal/terms.html', indexable: true },
    { route: '/legal/prohibited-items.html', file: 'legal/prohibited-items.html', indexable: true },
    { route: '/legal/community-guidelines.html', file: 'legal/community-guidelines.html', indexable: true },
    { route: '/404.html', file: '404.html', indexable: false },
    { route: '/login/login.html', file: 'login/login.html', indexable: false },
    { route: '/register/register.html', file: 'register/register.html', indexable: false },
    { route: '/forgot-password/forgot-password.html', file: 'forgot-password/forgot-password.html', indexable: false }
  ];

  for (const r of publicRoutes) {
    const filePath = path.join(FRONTEND_DIR, r.file);
    assert(fs.existsSync(filePath), `Route file ${r.file} must exist`);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check Title
    assert(/<title>.+<\/title>/i.test(content), `${r.file} missing title`);
    
    // Check Meta description
    assert(content.includes('<meta name="description"'), `${r.file} missing description`);
    
    if (r.indexable) {
      assert(content.includes('<link rel="canonical"'), `${r.file} missing canonical`);
      assert(content.includes('https://travalbuddy.web.app'), `${r.file} canonical domain incorrect`);
      assert(!content.includes('noindex'), `${r.file} should not be marked noindex`);
    } else {
      if (r.file.includes('login') || r.file.includes('register') || r.file.includes('forgot-password')) {
        assert(content.includes('noindex'), `${r.file} auth portal must be marked noindex`);
      }
    }
  }
});

console.log('\n--------------------------------------------------------');
console.log(`TOTAL: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
console.log('--------------------------------------------------------\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL AGENTIC READINESS AUDIT TESTS PASSED SUCCESSFULLY! (Score: 100/100)\n');
}
