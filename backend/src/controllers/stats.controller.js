import { CAMPAIGN_STATUSES, CATEGORIES, Campaign, FUNDING_TYPES } from '../models/Campaign.js';
import { Investment } from '../models/Investment.js';
import { ROLES, User } from '../models/User.js';
import { buildAdvice } from '../services/advice.js';
import { asyncHandler } from '../utils/http.js';

const MONTHS = 12;

/** Last N calendar months (UTC), oldest first. */
function lastMonths(count = MONTHS) {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (count - 1 - i), 1));
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      label: date.toLocaleString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
      start: date,
    };
  });
}

async function monthlyFunds(match = {}) {
  const months = lastMonths();
  const rows = await Investment.aggregate([
    { $match: { ...match, status: 'paid', paidAt: { $gte: months[0].start } } },
    {
      $group: {
        _id: { y: { $year: '$paidAt' }, m: { $month: '$paidAt' } },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
  ]);
  return months.map(({ year, month, label }) => {
    const row = rows.find((r) => r._id.y === year && r._id.m === month);
    return { label, total: row?.total ?? 0, count: row?.count ?? 0 };
  });
}

/** Counts documents per value of `field`, returning every known key (zeros included). */
async function countBy(Model, field, keys, match = {}) {
  const rows = await Model.aggregate([{ $match: match }, { $group: { _id: `$${field}`, count: { $sum: 1 } } }]);
  return keys.map((key) => ({ key, count: rows.find((r) => r._id === key)?.count ?? 0 }));
}

const tally = (items, keys, pick) =>
  keys.map((key) => ({ key, count: items.filter((item) => pick(item) === key).length }));

const sum = (items, pick) => items.reduce((total, item) => total + pick(item), 0);

// ---------------------------------------------------------------- admin
export const adminStats = asyncHandler(async (_req, res) => {
  const [users, campaigns, pendingCampaigns, paid, usersByRole, campaignsByStatus, campaignsByCategory, monthly, topInvestors] =
    await Promise.all([
      User.countDocuments(),
      Campaign.countDocuments(),
      Campaign.countDocuments({ status: 'pending' }),
      Investment.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
      countBy(User, 'role', ROLES),
      countBy(Campaign, 'status', CAMPAIGN_STATUSES),
      countBy(Campaign, 'category', CATEGORIES),
      monthlyFunds(),
      Investment.aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: '$investor', total: { $sum: '$amount' }, campaigns: { $addToSet: '$campaign' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            investorId: '$_id',
            name: { $ifNull: [{ $concat: ['$user.firstName', ' ', '$user.lastName'] }, 'Deleted user'] },
            avatarUrl: '$user.avatarUrl',
            total: 1,
            projects: { $size: '$campaigns' },
            contributions: '$count',
          },
        },
      ]),
    ]);

  res.json({
    totals: {
      raised: paid[0]?.total ?? 0,
      contributions: paid[0]?.count ?? 0,
      users,
      campaigns,
      pendingCampaigns,
    },
    usersByRole,
    campaignsByStatus,
    campaignsByCategory,
    monthly,
    topInvestors,
  });
});

// ---------------------------------------------------------------- entrepreneur
export const entrepreneurStats = asyncHandler(async (req, res) => {
  const owner = req.user._id;
  const [campaigns, contributors, pendingOffers, monthly, recent] = await Promise.all([
    Campaign.find({ entrepreneur: owner }).select('title goalAmount raisedAmount status category endDate contributionsCount'),
    Investment.distinct('investor', { entrepreneur: owner, status: 'paid' }),
    Investment.countDocuments({ entrepreneur: owner, status: 'requested' }),
    monthlyFunds({ entrepreneur: owner }),
    Investment.find({ entrepreneur: owner, status: 'paid' })
      .sort({ paidAt: -1 })
      .limit(6)
      .populate('investor', 'firstName lastName avatarUrl')
      .populate('campaign', 'title'),
  ]);

  res.json({
    totals: {
      campaigns: campaigns.length,
      active: campaigns.filter((c) => c.status === 'active').length,
      raised: sum(campaigns, (c) => c.raisedAmount),
      contributors: contributors.length,
      pendingOffers,
    },
    monthly,
    campaignsByStatus: tally(campaigns, CAMPAIGN_STATUSES, (c) => c.status),
    campaignsByCategory: tally(campaigns, CATEGORIES, (c) => c.category).filter((row) => row.count > 0),
    campaigns: campaigns
      .map((c) => ({ id: c.id, title: c.title, raised: c.raisedAmount, goal: c.goalAmount, progress: c.progress, status: c.status }))
      .sort((a, b) => b.raised - a.raised)
      .slice(0, 8),
    recentContributions: recent,
  });
});

// ---------------------------------------------------------------- investor
export const investorStats = asyncHandler(async (req, res) => {
  const investor = req.user._id;
  const [paid, openOffers, monthly] = await Promise.all([
    Investment.find({ investor, status: 'paid' })
      .sort({ paidAt: -1 })
      .populate('campaign', 'title category status goalAmount raisedAmount endDate'),
    Investment.countDocuments({ investor, status: { $in: ['requested', 'accepted'] } }),
    monthlyFunds({ investor }),
  ]);

  const invested = sum(paid, (inv) => inv.amount);
  const perCampaign = new Map();
  for (const inv of paid) {
    if (!inv.campaign) continue;
    const row = perCampaign.get(inv.campaign.id) ?? {
      id: inv.campaign.id,
      title: inv.campaign.title,
      category: inv.campaign.category,
      status: inv.campaign.status,
      progress: inv.campaign.progress,
      invested: 0,
    };
    row.invested += inv.amount;
    perCampaign.set(inv.campaign.id, row);
  }

  res.json({
    totals: {
      invested,
      projects: perCampaign.size,
      contributions: paid.length,
      averageTicket: paid.length ? Math.round(invested / paid.length) : 0,
      openOffers,
    },
    monthly,
    byType: FUNDING_TYPES.map((type) => ({
      key: type,
      total: sum(paid.filter((inv) => inv.type === type), (inv) => inv.amount),
    })),
    campaigns: [...perCampaign.values()].sort((a, b) => b.invested - a.invested),
    advice: await buildAdvice(paid),
  });
});
