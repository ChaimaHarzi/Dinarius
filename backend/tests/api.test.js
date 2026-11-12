import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import mongoose from 'mongoose';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.TEST_MONGO_URI ?? 'mongodb://127.0.0.1:27017/dinarius_test';
process.env.STRIPE_SECRET_KEY = ''; // force demo payments

// Imported dynamically so the environment above is applied first.
const { app } = await import('../src/app.js');
const { connectDB } = await import('../src/config/db.js');
const { User } = await import('../src/models/User.js');
const { closeEndedCampaigns } = await import('../src/jobs/campaignLifecycle.js');
const { Campaign } = await import('../src/models/Campaign.js');

const api = request(app);
const bearer = (token) => ({ Authorization: `Bearer ${token}` });
const tokens = {};
let campaignId;

const campaignPayload = () => ({
  title: 'Solar kiosks for rural schools',
  summary: 'Solar-powered charging kiosks for schools without electricity.',
  description:
    'We install solar kiosks in rural schools so students can charge tablets and lamps. This campaign funds the first ten kiosks in Siliana.',
  category: 'environmental',
  fundingTypes: ['donation', 'equity'],
  goalAmount: 1000,
  startDate: new Date(Date.now() - 86_400_000).toISOString(),
  endDate: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  country: 'Tunisia',
});

before(async () => {
  await connectDB();
  await mongoose.connection.dropDatabase();
  await User.create({ firstName: 'Root', lastName: 'Admin', email: 'admin@test.dev', password: 'Password123', role: 'admin' });
  tokens.admin = (await api.post('/api/auth/login').send({ email: 'admin@test.dev', password: 'Password123' })).body.token;
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe('auth', () => {
  test('registers an entrepreneur and an investor', async () => {
    for (const role of ['entrepreneur', 'investor']) {
      const res = await api
        .post('/api/auth/register')
        .send({ firstName: 'Test', lastName: role, email: `${role}@test.dev`, password: 'Password123', role });
      assert.equal(res.status, 201);
      assert.equal(res.body.user.role, role);
      assert.equal(res.body.user.password, undefined);
      tokens[role] = res.body.token;
    }
  });

  test('refuses to self-register as admin', async () => {
    const res = await api
      .post('/api/auth/register')
      .send({ firstName: 'Evil', lastName: 'User', email: 'evil@test.dev', password: 'Password123', role: 'admin' });
    assert.equal(res.status, 400);
  });

  test('rejects a wrong password with a generic message', async () => {
    const res = await api.post('/api/auth/login').send({ email: 'investor@test.dev', password: 'nope12345' });
    assert.equal(res.status, 401);
    assert.equal(res.body.message, 'Invalid email or password');
  });

  test('rejects duplicate emails', async () => {
    const res = await api
      .post('/api/auth/register')
      .send({ firstName: 'Test', lastName: 'Dup', email: 'investor@test.dev', password: 'Password123', role: 'investor' });
    assert.equal(res.status, 409);
  });

  test('invalidates old tokens after a password change', async () => {
    const res = await api
      .patch('/api/users/me/password')
      .set(bearer(tokens.investor))
      .send({ currentPassword: 'Password123', newPassword: 'Password456' });
    assert.equal(res.status, 200);
    const old = await api.get('/api/auth/me').set(bearer(tokens.investor));
    assert.equal(old.status, 401);
    tokens.investor = res.body.token;
  });
});

describe('campaign moderation', () => {
  test('an entrepreneur creates a campaign that starts as pending', async () => {
    const res = await api.post('/api/campaigns').set(bearer(tokens.entrepreneur)).send(campaignPayload());
    assert.equal(res.status, 201);
    assert.equal(res.body.campaign.status, 'pending');
    campaignId = res.body.campaign.id;
  });

  test('investors cannot create campaigns', async () => {
    const res = await api.post('/api/campaigns').set(bearer(tokens.investor)).send(campaignPayload());
    assert.equal(res.status, 403);
  });

  test('pending campaigns are hidden from the public', async () => {
    const list = await api.get('/api/campaigns');
    assert.equal(list.body.total, 0);
    const detail = await api.get(`/api/campaigns/${campaignId}`);
    assert.equal(detail.status, 404);
  });

  test('a rejection requires a reason', async () => {
    const res = await api
      .patch(`/api/campaigns/${campaignId}/review`)
      .set(bearer(tokens.admin))
      .send({ decision: 'reject' });
    assert.equal(res.status, 400);
  });

  test('the admin approves the campaign and it becomes public', async () => {
    const res = await api
      .patch(`/api/campaigns/${campaignId}/review`)
      .set(bearer(tokens.admin))
      .send({ decision: 'approve' });
    assert.equal(res.status, 200);
    assert.equal(res.body.campaign.status, 'active');
    const list = await api.get('/api/campaigns?category=environmental');
    assert.equal(list.body.total, 1);
  });
});

describe('investments', () => {
  test('a donation is paid in demo mode and credited to the campaign', async () => {
    const res = await api
      .post('/api/investments/checkout')
      .set(bearer(tokens.investor))
      .send({ campaignId, amount: 250, type: 'donation' });
    assert.equal(res.status, 201);
    assert.equal(res.body.mode, 'demo');
    const { body } = await api.get(`/api/campaigns/${campaignId}`);
    assert.equal(body.campaign.raisedAmount, 250);
    assert.equal(body.campaign.progress, 25);
  });

  test('funding types not offered by the campaign are refused', async () => {
    const res = await api
      .post('/api/investments/engage')
      .set(bearer(tokens.investor))
      .send({ campaignId, amount: 100, type: 'loan' });
    assert.equal(res.status, 400);
  });

  test('an equity offer must be accepted before it can be paid', async () => {
    const offer = await api
      .post('/api/investments/engage')
      .set(bearer(tokens.investor))
      .send({ campaignId, amount: 500, type: 'equity', message: 'Count me in' });
    assert.equal(offer.status, 201);
    const offerId = offer.body.investment.id;

    const early = await api.post(`/api/investments/${offerId}/pay`).set(bearer(tokens.investor));
    assert.equal(early.status, 400);

    const accepted = await api
      .patch(`/api/investments/${offerId}/respond`)
      .set(bearer(tokens.entrepreneur))
      .send({ decision: 'accept' });
    assert.equal(accepted.body.investment.status, 'accepted');

    const paid = await api.post(`/api/investments/${offerId}/pay`).set(bearer(tokens.investor));
    assert.equal(paid.status, 200);
    const { body } = await api.get(`/api/campaigns/${campaignId}`);
    assert.equal(body.campaign.raisedAmount, 750);
  });

  test('dashboards aggregate the payments', async () => {
    const admin = await api.get('/api/stats/admin').set(bearer(tokens.admin));
    assert.equal(admin.body.totals.raised, 750);
    assert.equal(admin.body.topInvestors[0].total, 750);

    const owner = await api.get('/api/stats/entrepreneur').set(bearer(tokens.entrepreneur));
    assert.equal(owner.body.totals.contributors, 1);
    assert.equal(owner.body.monthly.at(-1).total, 750);

    const investor = await api.get('/api/stats/investor').set(bearer(tokens.investor));
    assert.equal(investor.body.totals.projects, 1);
    assert.ok(investor.body.advice.length > 0);
  });

  test('a campaign with payments is archived instead of deleted', async () => {
    const res = await api.delete(`/api/campaigns/${campaignId}`).set(bearer(tokens.entrepreneur));
    assert.equal(res.status, 200);
    assert.equal(res.body.archived, true);
  });
});

describe('scheduled jobs', () => {
  test('ended campaigns are closed', async () => {
    const campaign = await Campaign.create({
      ...campaignPayload(),
      status: 'active',
      startDate: new Date(Date.now() - 10 * 86_400_000),
      endDate: new Date(Date.now() - 1000),
      entrepreneur: new mongoose.Types.ObjectId(),
    });
    assert.equal(await closeEndedCampaigns(), 1);
    assert.equal((await Campaign.findById(campaign._id)).status, 'completed');
  });
});
