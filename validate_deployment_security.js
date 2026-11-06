// Frontend/validate_deployment_security.js
// Pre-deployment Security Validation Script for CarryParcel

const fs = require('fs');
const path = require('path');

console.log('=== STARTING CARRYPARCEL DEPLOYMENT SECURITY VALIDATION ===\n');

const deploymentDir = __dirname;
let violationCount = 0;

// Critical blacklisted files and directories that must NEVER be present in the public deployment payload
const blacklistedPatterns = [
  { pattern: /\.git($|[\/\\])/i, description: 'Git Repository Metadata (.git)' },
  { pattern: /\.env($|\.|\/|\\)/i, description: 'Environment Secret File (.env)' },
  { pattern: /(serviceAccountKey|credentials|firebase-adminsdk.*)\.json$/i, description: 'Service Account / Credentials Key' },
  { pattern: /\.(pem|key|jks|keystore)$/i, description: 'Private Key or Signing Certificate' },
  { pattern: /node_modules($|[\/\\])/i, description: 'Node Modules Directory' },
];

function scanDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(deploymentDir, fullPath);

    // Skip validation script itself
    if (entry.name === 'validate_deployment_security.js') continue;

    for (const item of blacklistedPatterns) {
      if (item.pattern.test(relativePath) || item.pattern.test(entry.name)) {
        console.error(`[CRITICAL SECURITY VIOLATION] Found ${item.description}: ${relativePath}`);
        violationCount++;
        break;
      }
    }

    if (entry.isDirectory() && entry.name !== '.git' && entry.name !== 'node_modules') {
      scanDirectory(fullPath);
    }
  }
}

try {
  scanDirectory(deploymentDir);

  if (violationCount > 0) {
    console.error(`\n=== DEPLOYMENT VALIDATION FAILED: ${violationCount} SECURITY VIOLATION(S) DETECTED ===`);
    console.error('ABORTING DEPLOYMENT: Remove or exclude sensitive files before deploying to production.\n');
    process.exit(1);
  } else {
    console.log('=== DEPLOYMENT VALIDATION PASSED: ZERO SENSITIVE FILES FOUND IN FRONTEND ===\n');
  }
} catch (err) {
  console.error('Fatal validation error:', err);
  process.exit(1);
}
