import Stripe from 'stripe';
import { env } from '../config/env.js';
import { Campaign } from '../models/Campaign.js';
import { Investment } from '../models/Investment.js';
import { mails, sendMail } from './mailer.js';

export const stripe = env.stripe.secretKey ? new Stripe(env.stripe.secretKey) : null;
export const paymentsMode = stripe ? 'stripe' : 'demo';

const LABELS = { donation: 'Donation', reward: 'Reward pledge', equity: 'Equity investment', loan: 'Loan' };

/**
 * Marks an investment as paid and credits the campaign.
 * Idempotent: the conditional update guarantees a payment is only counted once,
 * even if the webhook and the success page confirm it concurrently.
 */
export async function markInvestmentPaid(investmentId) {
  const investment = await Investment.findOneAndUpdate(
    { _id: investmentId, status: 'pending' },
    { status: 'paid', paidAt: new Date() },
    { new: true },
  );
  if (!investment) return null;

  const campaign = await Campaign.findByIdAndUpdate(
    investment.campaign,
    { $inc: { raisedAmount: investment.amount, contributionsCount: 1 } },
    { new: true },
  ).populate('entrepreneur', 'firstName email');

  if (campaign?.entrepreneur) void sendMail(mails.contributionReceived(campaign, campaign.entrepreneur, investment));
  return investment;
}

/**
 * Starts the payment of a pending investment.
 * Returns the URL the investor must be sent to (Stripe Checkout, or the success page in demo mode).
 */
export async function startCheckout(investment, campaign) {
  if (!stripe) {
    await markInvestmentPaid(investment.id);
    return { url: `${env.clientUrl}/payment/success?investment=${investment.id}`, mode: 'demo' };
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    client_reference_id: investment.id,
    metadata: { investmentId: investment.id },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: investment.currency,
          unit_amount: Math.round(investment.amount * 100),
          product_data: { name: `${LABELS[investment.type]} - ${campaign.title}` },
        },
      },
    ],
    success_url: `${env.clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.clientUrl}/campaigns/${campaign.id}?payment=cancelled`,
  });

  investment.stripeSessionId = session.id;
  await investment.save();
  return { url: session.url, mode: 'stripe' };
}

/** Confirms a Checkout session from the success page (useful locally, where webhooks may not reach the API). */
export async function confirmCheckoutSession(sessionId) {
  if (!stripe) return null;
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const investmentId = session.metadata?.investmentId;
  if (!investmentId) return null;
  if (session.payment_status === 'paid') await markInvestmentPaid(investmentId);
  return investmentId;
}

export function constructWebhookEvent(rawBody, signature) {
  return stripe.webhooks.constructEvent(rawBody, signature, env.stripe.webhookSecret);
}
