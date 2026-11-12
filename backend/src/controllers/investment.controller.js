import { env } from '../config/env.js';
import { Campaign } from '../models/Campaign.js';
import { Investment } from '../models/Investment.js';
import { mails, sendMail } from '../services/mailer.js';
import {
  confirmCheckoutSession,
  constructWebhookEvent,
  markInvestmentPaid,
  paymentsMode,
  startCheckout,
  stripe,
} from '../services/payments.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler, pageResult, paginate } from '../utils/http.js';

const CAMPAIGN_FIELDS = 'title coverImage status goalAmount raisedAmount endDate startDate category currency';

async function loadOpenCampaign(id, type) {
  const campaign = await Campaign.findById(id);
  if (!campaign) throw AppError.notFound('Campaign not found');
  if (!campaign.acceptsContributions()) throw AppError.badRequest('This campaign is not open for funding');
  if (!campaign.fundingTypes.includes(type)) {
    throw AppError.badRequest(`This campaign does not accept ${type} funding`);
  }
  return campaign;
}

async function listInvestments(filter, query, res) {
  if (query.status) filter.status = query.status;
  if (query.type) filter.type = query.type;
  const pageInfo = paginate(query);
  const [items, total] = await Promise.all([
    Investment.find(filter)
      .sort({ createdAt: -1 })
      .skip(pageInfo.skip)
      .limit(pageInfo.limit)
      .populate('campaign', CAMPAIGN_FIELDS)
      .populate('investor', 'firstName lastName email avatarUrl')
      .populate('entrepreneur', 'firstName lastName email'),
    Investment.countDocuments(filter),
  ]);
  res.json(pageResult(items, total, pageInfo));
}

// ---------------------------------------------------------------- investor
export const paymentConfig = (_req, res) => res.json({ mode: paymentsMode });

/** Donation or reward: pays immediately. */
export const checkout = asyncHandler(async (req, res) => {
  const { campaignId, amount, type } = req.body;
  const campaign = await loadOpenCampaign(campaignId, type);
  const investment = await Investment.create({
    investor: req.user._id,
    campaign: campaign._id,
    entrepreneur: campaign.entrepreneur,
    type,
    amount,
    currency: campaign.currency,
    status: 'pending',
  });
  res.status(201).json({ investmentId: investment.id, ...(await startCheckout(investment, campaign)) });
});

/** Equity or loan: sends an offer the entrepreneur must accept before any payment. */
export const engage = asyncHandler(async (req, res) => {
  const { campaignId, amount, type, message } = req.body;
  const campaign = await loadOpenCampaign(campaignId, type);
  const alreadyOpen = await Investment.exists({
    investor: req.user._id,
    campaign: campaign._id,
    status: { $in: ['requested', 'accepted'] },
  });
  if (alreadyOpen) throw AppError.conflict('You already have an open offer for this campaign');

  const investment = await Investment.create({
    investor: req.user._id,
    campaign: campaign._id,
    entrepreneur: campaign.entrepreneur,
    type,
    amount,
    currency: campaign.currency,
    message,
    status: 'requested',
  });

  await campaign.populate('entrepreneur', 'firstName email');
  void sendMail(mails.engagementRequest(campaign, campaign.entrepreneur, req.user, investment));
  res.status(201).json({ investment });
});

/** Pays an equity/loan offer once the entrepreneur accepted it. */
export const payAcceptedOffer = asyncHandler(async (req, res) => {
  const investment = await Investment.findOne({ _id: req.params.id, investor: req.user._id });
  if (!investment) throw AppError.notFound('Investment not found');
  if (!['accepted', 'pending'].includes(investment.status)) {
    throw AppError.badRequest('Only accepted offers can be paid');
  }
  const campaign = await loadOpenCampaign(investment.campaign, investment.type);
  investment.status = 'pending';
  await investment.save();
  res.json({ investmentId: investment.id, ...(await startCheckout(investment, campaign)) });
});

export const cancelInvestment = asyncHandler(async (req, res) => {
  const investment = await Investment.findOneAndUpdate(
    { _id: req.params.id, investor: req.user._id, status: { $in: ['requested', 'accepted', 'pending'] } },
    { status: 'cancelled' },
    { new: true },
  );
  if (!investment) throw AppError.badRequest('This investment cannot be cancelled');
  res.json({ investment });
});

export const confirmPayment = asyncHandler(async (req, res) => {
  const investmentId = await confirmCheckoutSession(req.body.sessionId);
  if (!investmentId) throw AppError.badRequest('Unknown payment session');
  const investment = await Investment.findOne({ _id: investmentId, investor: req.user._id }).populate(
    'campaign',
    CAMPAIGN_FIELDS,
  );
  if (!investment) throw AppError.notFound('Investment not found');
  res.json({ investment });
});

export const listMine = asyncHandler(async (req, res) => listInvestments({ investor: req.user._id }, req.query, res));

// ---------------------------------------------------------------- entrepreneur
export const listReceived = asyncHandler(async (req, res) =>
  listInvestments({ entrepreneur: req.user._id }, req.query, res),
);

export const respondToOffer = asyncHandler(async (req, res) => {
  const investment = await Investment.findOne({ _id: req.params.id, entrepreneur: req.user._id })
    .populate('campaign', 'title')
    .populate('investor', 'firstName email');
  if (!investment) throw AppError.notFound('Offer not found');
  if (investment.status !== 'requested') throw AppError.badRequest('This offer was already answered');

  investment.status = req.body.decision === 'accept' ? 'accepted' : 'declined';
  investment.responseNote = req.body.note ?? '';
  investment.respondedAt = new Date();
  await investment.save();

  if (investment.investor && investment.campaign) {
    void sendMail(mails.engagementAnswered(investment.campaign, investment.investor, investment));
  }
  res.json({ investment });
});

// ---------------------------------------------------------------- shared / admin
export const getInvestment = asyncHandler(async (req, res) => {
  const investment = await Investment.findById(req.params.id)
    .populate('campaign', CAMPAIGN_FIELDS)
    .populate('investor', 'firstName lastName email')
    .populate('entrepreneur', 'firstName lastName email');
  if (!investment || !investment.involves(req.user)) throw AppError.notFound('Investment not found');
  res.json({ investment });
});

export const listAll = asyncHandler(async (req, res) => listInvestments({}, req.query, res));

// ---------------------------------------------------------------- Stripe webhook
export const stripeWebhook = asyncHandler(async (req, res) => {
  if (!stripe || !env.stripe.webhookSecret) throw AppError.notFound('Webhooks are not configured');
  let event;
  try {
    event = constructWebhookEvent(req.body, req.headers['stripe-signature']);
  } catch (err) {
    throw AppError.badRequest(`Invalid webhook signature: ${err.message}`);
  }

  const session = event.data.object;
  const investmentId = session.metadata?.investmentId;
  if (investmentId) {
    if (event.type === 'checkout.session.completed' && session.payment_status === 'paid') {
      await markInvestmentPaid(investmentId);
    } else if (event.type === 'checkout.session.expired') {
      await Investment.updateOne({ _id: investmentId, status: 'pending' }, { status: 'failed' });
    }
  }
  res.json({ received: true });
});
