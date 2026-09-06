const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '../travel-buddy-backend/services/auditLogger.js');

const code = `// services/auditLogger.js
// Centralized enterprise audit logger recording all significant system and admin actions.

const AuditLog = require('../models/AuditLog');

async function logAudit({
  action,
  performedBy = null,
  performedByName = '',
  adminId = null,
  adminName = '',
  targetType = 'system',
  targetId = null,
  targetLabel = '',
  previousValue = null,
  newValue = null,
  meta = null,
  req = null
}) {
  try {
    let pBy = performedBy || adminId || null;
    let pName = performedByName || adminName || '';

    let ipAddress = '';
    let userAgent = '';

    if (req) {
      ipAddress = req.ip || (req.headers && req.headers['x-forwarded-for']) || (req.socket && req.socket.remoteAddress) || '';
      userAgent = (req.headers && req.headers['user-agent']) || '';
      if (!pBy) {
        pBy = req.adminId || req.userId || null;
      }
      if (!pName) {
        pName = req.adminEmail || req.userEmail || (req.user ? \`\${req.user.firstName || ''} \${req.user.lastName || ''}\`.trim() : '');
      }
    }

    const log = await AuditLog.create({
      action,
      performedBy: pBy,
      performedByName: pName || 'System',
      targetType,
      targetId,
      targetLabel,
      previousValue,
      newValue,
      meta,
      ipAddress,
      userAgent
    });

    return log;
  } catch (err) {
    console.error('[AUDIT LOG ERROR]', err.message);
    return null;
  }
}

module.exports = { logAudit };
`;

fs.writeFileSync(targetFile, code, 'utf8');
console.log('Successfully updated services/auditLogger.js with alias support.');
