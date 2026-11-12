import { Campaign } from '../models/Campaign.js';

const percent = (part, total) => Math.round((part / total) * 100);

/**
 * Rule-based portfolio advice for an investor.
 * @param {Array} investments paid investments, with `campaign` populated
 */
export async function buildAdvice(investments) {
  const tips = [];
  const total = investments.reduce((sum, inv) => sum + inv.amount, 0);

  if (investments.length === 0) {
    tips.push({
      level: 'info',
      message: 'You have not backed any campaign yet. A small donation is a good way to discover how the platform works.',
    });
  } else {
    const byCampaign = new Map();
    for (const inv of investments) {
      if (!inv.campaign) continue;
      const key = inv.campaign.id;
      const entry = byCampaign.get(key) ?? { title: inv.campaign.title, amount: 0 };
      entry.amount += inv.amount;
      byCampaign.set(key, entry);
    }
    const [largest] = [...byCampaign.values()].sort((a, b) => b.amount - a.amount);
    if (byCampaign.size > 0 && byCampaign.size < 3 && largest) {
      tips.push({
        level: 'warning',
        message: `${percent(largest.amount, total)}% of your portfolio is in "${largest.title}". Spreading your money over more projects lowers your risk.`,
      });
    }

    const types = new Set(investments.map((inv) => inv.type));
    if (types.size === 1) {
      tips.push({
        level: 'info',
        message: `All your contributions are ${[...types][0]}-based. Other funding models (reward, equity, loan) offer different returns.`,
      });
    }

    const risky = investments.filter((inv) => inv.type === 'equity' || inv.type === 'loan');
    const riskyShare = percent(risky.reduce((sum, inv) => sum + inv.amount, 0), total);
    if (riskyShare >= 70) {
      tips.push({
        level: 'warning',
        message: `${riskyShare}% of your capital is in equity or loan deals. These can pay more but can also be lost if the startup fails.`,
      });
    }
  }

  // Suggest open campaigns in the investor's favourite category.
  const categoryCount = {};
  for (const inv of investments) {
    if (inv.campaign?.category) categoryCount[inv.campaign.category] = (categoryCount[inv.campaign.category] ?? 0) + 1;
  }
  const favourite = Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0]?.[0];
  const backedIds = investments.map((inv) => inv.campaign?._id).filter(Boolean);

  const suggestions = await Campaign.find({
    status: 'active',
    endDate: { $gt: new Date() },
    _id: { $nin: backedIds },
    ...(favourite && { category: favourite }),
  })
    .sort({ endDate: 1 })
    .limit(3);

  for (const campaign of suggestions) {
    tips.push({
      level: 'tip',
      message: `"${campaign.title}" is ${campaign.progress}% funded and closes in ${campaign.daysLeft} day(s).`,
      campaignId: campaign.id,
    });
  }

  if (tips.length === 0) {
    tips.push({
      level: 'info',
      message: 'Your portfolio is well balanced across projects and funding models. Keep an eye on new campaigns.',
    });
  }

  return tips;
}
