import { Campaign } from '../models/Campaign.js';
import { Investment } from '../models/Investment.js';
import { mails, sendMail } from '../services/mailer.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler, escapeRegex, pageResult, paginate } from '../utils/http.js';

const PUBLIC_STATUSES = ['active', 'completed'];
const OWNER_FIELDS = 'firstName lastName avatarUrl location bio';
const SORTS = {
  newest: { createdAt: -1 },
  endingSoon: { endDate: 1 },
  mostFunded: { raisedAmount: -1 },
  goal: { goalAmount: 1 },
};

function buildFilter({ q, category, fundingType }) {
  const filter = {};
  if (category) filter.category = category;
  if (fundingType) filter.fundingTypes = fundingType;
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ title: pattern }, { summary: pattern }];
  }
  return filter;
}

async function findPaged(filter, query, populate) {
  const pageInfo = paginate(query);
  let cursor = Campaign.find(filter).sort(SORTS[query.sort] ?? SORTS.newest).skip(pageInfo.skip).limit(pageInfo.limit);
  if (populate) cursor = cursor.populate('entrepreneur', populate);
  const [items, total] = await Promise.all([cursor, Campaign.countDocuments(filter)]);
  return pageResult(items, total, pageInfo);
}

async function loadOwnedCampaign(req) {
  const campaign = await Campaign.findById(req.params.id);
  if (!campaign) throw AppError.notFound('Campaign not found');
  if (!campaign.isOwnedBy(req.user) && req.user.role !== 'admin') throw AppError.forbidden();
  return campaign;
}

// ---------------------------------------------------------------- public
export const listPublic = asyncHandler(async (req, res) => {
  const status = req.query.status === 'completed' ? 'completed' : 'active';
  const filter = { ...buildFilter(req.query), status };
  if (status === 'active') filter.endDate = { $gt: new Date() };
  res.json(await findPaged(filter, req.query, 'firstName lastName avatarUrl'));
});

export const getCampaign = asyncHandler(async (req, res) => {
  const campaign = await Campaign.findById(req.params.id).populate('entrepreneur', OWNER_FIELDS);
  const canSeeDraft = req.user && (campaign?.isOwnedBy(req.user) || req.user.role === 'admin');
  if (!campaign || (!PUBLIC_STATUSES.includes(campaign.status) && !canSeeDraft)) {
    throw AppError.notFound('Campaign not found');
  }
  res.json({ campaign });
});

// ---------------------------------------------------------------- entrepreneur
export const listMine = asyncHandler(async (req, res) => {
  const filter = { ...buildFilter(req.query), entrepreneur: req.user._id };
  if (req.query.status) filter.status = req.query.status;
  res.json(await findPaged(filter, req.query));
});

export const createCampaign = asyncHandler(async (req, res) => {
  const campaign = await Campaign.create({ ...req.body, entrepreneur: req.user._id, status: 'pending' });
  res.status(201).json({ campaign });
});

export const updateCampaign = asyncHandler(async (req, res) => {
  const campaign = await loadOwnedCampaign(req);
  if (['completed', 'cancelled'].includes(campaign.status)) {
    throw AppError.badRequest(`A ${campaign.status} campaign can no longer be edited`);
  }
  const startDate = req.body.startDate ?? campaign.startDate;
  const endDate = req.body.endDate ?? campaign.endDate;
  if (endDate <= startDate) throw AppError.badRequest('End date must be after the start date');

  campaign.set(req.body);
  // Any change to a published or rejected campaign sends it back to moderation.
  if (['active', 'rejected'].includes(campaign.status) && req.user.role !== 'admin') {
    campaign.status = 'pending';
    campaign.rejectionReason = '';
  }
  await campaign.save();
  res.json({ campaign });
});

export const deleteCampaign = asyncHandler(async (req, res) => {
  const campaign = await loadOwnedCampaign(req);
  const hasPayments = await Investment.exists({ campaign: campaign._id, status: 'paid' });

  // Campaigns that already received money are archived, never erased.
  if (hasPayments) {
    campaign.status = 'cancelled';
    await campaign.save();
    await Investment.updateMany(
      { campaign: campaign._id, status: { $in: ['requested', 'accepted', 'pending'] } },
      { status: 'cancelled' },
    );
    return res.json({ campaign, archived: true });
  }

  await Investment.deleteMany({ campaign: campaign._id });
  await campaign.deleteOne();
  return res.status(204).end();
});

// ---------------------------------------------------------------- admin
export const listForAdmin = asyncHandler(async (req, res) => {
  const filter = buildFilter(req.query);
  if (req.query.status) filter.status = req.query.status;
  res.json(await findPaged(filter, req.query, 'firstName lastName email'));
});

export const reviewCampaign = asyncHandler(async (req, res) => {
  const campaign = await Campaign.findById(req.params.id).populate('entrepreneur', 'firstName email');
  if (!campaign) throw AppError.notFound('Campaign not found');
  if (campaign.status !== 'pending') throw AppError.badRequest('Only pending campaigns can be reviewed');

  const approved = req.body.decision === 'approve';
  campaign.status = approved ? 'active' : 'rejected';
  campaign.rejectionReason = approved ? '' : req.body.reason;
  campaign.reviewedAt = new Date();
  campaign.reviewedBy = req.user._id;
  await campaign.save();

  if (campaign.entrepreneur) void sendMail(mails.campaignReviewed(campaign, campaign.entrepreneur));
  res.json({ campaign });
});
