const fs = require('fs');
const path = require('path');

const walletPath = path.resolve(__dirname, '../travel-buddy-backend/services/wallet.js');
let content = fs.readFileSync(walletPath, 'utf8');

const helpers = `
async function getPlatformRevenue(filter = {}) {
  const match = {
    type: 'platform_commission',
    status: { $in: ['completed', 'released'] }
  };
  if (filter.startDate || filter.endDate) {
    match.createdAt = {};
    if (filter.startDate) match.createdAt.$gte = new Date(filter.startDate);
    if (filter.endDate) match.createdAt.$lte = new Date(filter.endDate);
  }
  const result = await WalletTransaction.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  return (result[0] && result[0].total) || 0;
}

async function getPlatformRevenueByDay(days = 7) {
  const since = new Date(Date.now() - days * 86400000);
  const result = await WalletTransaction.aggregate([
    {
      $match: {
        type: 'platform_commission',
        status: { $in: ['completed', 'released'] },
        createdAt: { $gte: since }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        amount: { $sum: '$amount' }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  return result;
}
`;

if (!content.includes('getPlatformRevenue(')) {
  content = content.replace('module.exports = {', helpers + '\nmodule.exports = {\n    getPlatformRevenue,\n    getPlatformRevenueByDay,');
  fs.writeFileSync(walletPath, content, 'utf8');
  console.log('Successfully added getPlatformRevenue to wallet.js');
} else {
  console.log('getPlatformRevenue already present in wallet.js');
}
