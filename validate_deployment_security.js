// Frontend/validate_deployment_security.js
// Pre-deployment Security Validation Script for CarryParcel

const fs = require('fs');
const path = require('path');

console.log('=== STARTING CARRYPARCEL DEPLOYMENT SECURITY VALIDATION ===\n');

const frontendDir = __dirname;
let violationCount = 0;

// 1. Verify firebase.json ignore configuration
const firebaseJsonPath = path.join(frontendDir, 'firebase.json');
if (fs.existsSync(firebaseJsonPath)) {
  try {
    const firebaseConfig = JSON.parse(fs.readFileSync(firebaseJsonPath, 'utf-8'));
    const ignoreList = firebaseConfig.hosting?.ignore || [];

    const requiredIgnores = ['.git', '.git/**', '**/.git/**', '.env*', '**/.env*'];
    const missingIgnores = requiredIgnores.filter(item => !ignoreList.includes(item));

    if (missingIgnores.length > 0) {
      console.error(`[SECURITY ERROR] firebase.json is missing required ignore patterns: ${missingIgnores.join(', ')}`);
      violationCount++;
    } else {
      console.log('[PASS] firebase.json contains all required .git and .env ignore rules.');
    }
  } catch (err) {
    console.error('[ERROR] Failed to parse firebase.json:', err.message);
    violationCount++;
  }
}

// 2. Scan public directory structure for un-ignored sensitive files
const blacklistedPatterns = [
  { pattern: /\.env($|\.|\/|\\)/i, description: 'Environment Secret File (.env)' },
  { pattern: /(serviceAccountKey|credentials|firebase-adminsdk.*)\.json$/i, description: 'Service Account / Credentials Key' },
  { pattern: /\.(pem|key|jks|keystore)$/i, description: 'Private Key or Signing Certificate' },
];

function scanPublicFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(frontendDir, fullPath);

    if (entry.name === 'validate_deployment_security.js' || entry.name === '.git' || entry.name === 'node_modules') continue;

    for (const item of blacklistedPatterns) {
      if (item.pattern.test(relativePath) || item.pattern.test(entry.name)) {
        console.error(`[CRITICAL SECURITY VIOLATION] Found ${item.description}: ${relativePath}`);
        violationCount++;
        break;
      }
    }

    if (entry.isDirectory() && entry.name !== '.git' && entry.name !== 'node_modules') {
      scanPublicFiles(fullPath);
    }
  }
}

try {
  scanPublicFiles(frontendDir);

  if (violationCount > 0) {
    console.error(`\n=== DEPLOYMENT VALIDATION FAILED: ${violationCount} VIOLATION(S) DETECTED ===`);
    process.exit(1);
  } else {
    console.log('\n=== DEPLOYMENT VALIDATION PASSED: ALL SECURITY CHECKS SUCCESSFUL ===\n');
  }
} catch (err) {
  console.error('Fatal validation error:', err);
  process.exit(1);
}
