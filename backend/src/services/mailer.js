import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const smtpConfigured = Boolean(env.smtp.host);

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    })
  : nodemailer.createTransport({ jsonTransport: true });

const escapeHtml = (value = '') =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const money = (amount, currency = 'usd') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(amount);

function layout(title, body, cta) {
  const button = cta
    ? `<p style="margin:28px 0"><a href="${cta.href}" style="background:#15803d;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(cta.label)}</a></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#f5f5f4;font-family:Segoe UI,Arial,sans-serif;color:#1c1917">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;padding:32px">
    <p style="font-size:20px;font-weight:700;color:#15803d;margin:0 0 24px">Dinarius</p>
    <h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(title)}</h1>
    ${body}${button}
    <p style="font-size:12px;color:#78716c;margin-top:32px">You received this email because you have an account on Dinarius.</p>
  </div></body></html>`;
}

/** Sends an email without ever throwing: notifications must not break the request flow. */
export async function sendMail({ to, subject, html }) {
  try {
    await transporter.sendMail({ from: env.smtp.from, to, subject, html });
    if (!smtpConfigured && !env.isTest) console.info(`[mail:dev] to=${to} subject="${subject}"`);
  } catch (err) {
    console.error(`[mail] could not send "${subject}" to ${to}: ${err.message}`);
  }
}

export const mails = {
  welcome: (user) => ({
    to: user.email,
    subject: 'Welcome to Dinarius',
    html: layout(
      `Welcome, ${user.firstName}!`,
      `<p>Your ${escapeHtml(user.role)} account is ready.</p>`,
      { label: 'Go to my dashboard', href: `${env.clientUrl}/dashboard` },
    ),
  }),

  passwordReset: (user, link) => ({
    to: user.email,
    subject: 'Reset your Dinarius password',
    html: layout(
      'Reset your password',
      '<p>Someone asked to reset the password of your account. This link expires in 30 minutes. If it was not you, ignore this email.</p>',
      { label: 'Choose a new password', href: link },
    ),
  }),

  campaignReviewed: (campaign, owner) => {
    const approved = campaign.status === 'active';
    return {
      to: owner.email,
      subject: approved ? 'Your campaign is live' : 'Your campaign needs changes',
      html: layout(
        approved ? `"${campaign.title}" is now live` : `"${campaign.title}" was not approved`,
        approved
          ? '<p>Investors can now discover and fund your campaign.</p>'
          : `<p>Reason given by our team:</p><blockquote style="border-left:3px solid #d6d3d1;margin:0;padding-left:12px">${escapeHtml(campaign.rejectionReason)}</blockquote><p>You can edit the campaign and submit it again.</p>`,
        { label: 'View my campaigns', href: `${env.clientUrl}/dashboard/campaigns` },
      ),
    };
  },

  engagementRequest: (campaign, owner, investor, investment) => ({
    to: owner.email,
    subject: `New ${investment.type} offer for "${campaign.title}"`,
    html: layout(
      'You received an investment offer',
      `<p><strong>${escapeHtml(investor.fullName)}</strong> (${escapeHtml(investor.email)}) offers
       <strong>${money(investment.amount, investment.currency)}</strong> as a <strong>${escapeHtml(investment.type)}</strong>
       investment in "${escapeHtml(campaign.title)}".</p>
       ${investment.message ? `<p>Message:</p><blockquote style="border-left:3px solid #d6d3d1;margin:0;padding-left:12px">${escapeHtml(investment.message)}</blockquote>` : ''}`,
      { label: 'Review the offer', href: `${env.clientUrl}/dashboard/requests` },
    ),
  }),

  engagementAnswered: (campaign, investor, investment) => {
    const accepted = investment.status === 'accepted';
    return {
      to: investor.email,
      subject: `Your offer for "${campaign.title}" was ${accepted ? 'accepted' : 'declined'}`,
      html: layout(
        accepted ? 'Your offer was accepted' : 'Your offer was declined',
        `<p>Your ${escapeHtml(investment.type)} offer of ${money(investment.amount, investment.currency)} for
         "${escapeHtml(campaign.title)}" was ${accepted ? 'accepted. You can now complete the payment.' : 'declined.'}</p>
         ${investment.responseNote ? `<p>Note from the entrepreneur: ${escapeHtml(investment.responseNote)}</p>` : ''}`,
        { label: 'Open my investments', href: `${env.clientUrl}/dashboard/investments` },
      ),
    };
  },

  contributionReceived: (campaign, owner, investment) => ({
    to: owner.email,
    subject: `New contribution to "${campaign.title}"`,
    html: layout(
      'You received a contribution',
      `<p>${money(investment.amount, investment.currency)} (${escapeHtml(investment.type)}) was added to
       "${escapeHtml(campaign.title)}". Total raised: ${money(campaign.raisedAmount, campaign.currency)} of
       ${money(campaign.goalAmount, campaign.currency)}.</p>`,
      { label: 'Open my dashboard', href: `${env.clientUrl}/dashboard` },
    ),
  }),
};
