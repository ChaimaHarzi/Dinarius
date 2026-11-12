/**
 * Fills the database with demo data. Destroys existing users, campaigns and investments.
 * Usage: npm run seed
 */
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { env } from '../config/env.js';
import { Campaign } from '../models/Campaign.js';
import { Investment } from '../models/Investment.js';
import { User } from '../models/User.js';

const PASSWORD = 'Password123';
const DAY = 86_400_000;
const daysFromNow = (days) => new Date(Date.now() + days * DAY);
// Illustrations shipped with the frontend (frontend/public/demo).
const img = (name) => `/demo/${name}.svg`;

if (env.isProd && !process.argv.includes('--force')) {
  console.error('Refusing to wipe a production database. Re-run with --force for a demo deployment.');
  process.exit(1);
}

await connectDB();
await Promise.all([User.deleteMany({}), Campaign.deleteMany({}), Investment.deleteMany({})]);

const make = (firstName, lastName, role, extra = {}) =>
  User.create({ firstName, lastName, role, email: `${firstName.toLowerCase()}@dinarius.dev`, password: PASSWORD, ...extra });

const admin = await make('Admin', 'Dinarius', 'admin');
const [salma, karim] = await Promise.all([
  make('Salma', 'Ben Ali', 'entrepreneur', { location: 'Tunis', bio: 'Founder of a solar-powered irrigation startup.' }),
  make('Karim', 'Trabelsi', 'entrepreneur', { location: 'Sfax', bio: 'Edtech builder and former teacher.' }),
]);
const investors = await Promise.all([
  make('Ines', 'Haddad', 'investor', { location: 'Paris' }),
  make('Youssef', 'Mansour', 'investor', { location: 'Montreal' }),
  make('Nour', 'Jaziri', 'investor', { location: 'Sousse' }),
]);

const base = { country: 'Tunisia', startDate: daysFromNow(-200) };
const campaigns = await Campaign.insertMany([
  {
    ...base,
    title: 'SunDrip: solar irrigation for small farms',
    summary: 'Affordable solar pumps that cut water and energy costs for farmers in Kairouan.',
    description:
      'SunDrip designs low-cost solar pumping kits coupled with drip irrigation. Our pilot with 12 farms reduced water use by 40% and diesel costs to zero. The funds will finance 150 kits and the training of local installers.',
    category: 'environmental',
    fundingTypes: ['donation', 'equity'],
    equityPercentage: 8,
    goalAmount: 40000,
    endDate: daysFromNow(45),
    coverImage: img('sundrip'),
    status: 'active',
    entrepreneur: salma._id,
  },
  {
    ...base,
    title: 'Kotobi: a reading app for Tunisian kids',
    summary: 'Interactive stories in Tunisian Arabic, French and English for children aged 4 to 10.',
    description:
      'Kotobi is a mobile reading app with illustrated, narrated stories written by Tunisian authors. Children read in three languages and parents follow their progress. We are raising funds to produce 60 new stories.',
    category: 'educational',
    fundingTypes: ['donation', 'reward', 'loan'],
    rewardDescription: 'Lifetime family subscription and your name in the credits.',
    loanInterestRate: 6,
    goalAmount: 25000,
    endDate: daysFromNow(20),
    coverImage: img('kotobi'),
    status: 'active',
    entrepreneur: karim._id,
  },
  {
    ...base,
    title: 'Medina Makers: a shared workshop for artisans',
    summary: 'A fully equipped workshop where young artisans of the Medina can produce and sell online.',
    description:
      'Medina Makers will renovate an old house in the Medina of Tunis into a shared workshop with a kiln, looms and a photo studio, so artisans can produce together and sell their work online to the diaspora.',
    category: 'artistic',
    fundingTypes: ['donation', 'reward'],
    rewardDescription: 'A handmade ceramic piece shipped anywhere in the world.',
    goalAmount: 15000,
    endDate: daysFromNow(60),
    coverImage: img('medina'),
    status: 'active',
    entrepreneur: salma._id,
  },
  {
    ...base,
    title: 'CareLink: home nursing on demand',
    summary: 'Book a certified nurse at home in under two hours, anywhere in Grand Tunis.',
    description:
      'CareLink connects patients with certified nurses for home visits: injections, wound care and post-surgery follow-up. We are expanding from Tunis to Sousse and Sfax and need to onboard 200 nurses.',
    category: 'medical',
    fundingTypes: ['equity', 'loan'],
    equityPercentage: 12,
    loanInterestRate: 8,
    goalAmount: 80000,
    endDate: daysFromNow(90),
    coverImage: img('carelink'),
    status: 'pending',
    entrepreneur: karim._id,
  },
  {
    ...base,
    title: 'Olive Loop: zero-waste olive pomace',
    summary: 'Turning olive pomace into biofuel pellets for local bakeries.',
    description:
      'Every harvest leaves tons of olive pomace that end up in landfills. Olive Loop compresses it into clean-burning pellets sold to bakeries and hammams. This campaign financed our first press.',
    category: 'business',
    fundingTypes: ['donation', 'equity'],
    equityPercentage: 10,
    goalAmount: 20000,
    startDate: daysFromNow(-300),
    endDate: daysFromNow(-10),
    coverImage: img('oliveloop'),
    status: 'completed',
    entrepreneur: salma._id,
  },
]);

// Paid contributions spread over the last months, so the dashboards have history.
const paidPlan = [
  [0, 0, 'donation', 2500, 160],
  [0, 1, 'equity', 9000, 120],
  [0, 2, 'donation', 1200, 30],
  [1, 0, 'reward', 300, 90],
  [1, 1, 'loan', 5000, 60],
  [1, 2, 'donation', 800, 12],
  [2, 2, 'reward', 450, 40],
  [2, 0, 'donation', 600, 5],
  [4, 1, 'equity', 12000, 200],
  [4, 2, 'donation', 3000, 150],
  [4, 0, 'donation', 5500, 100],
];

const paid = paidPlan.map(([c, i, type, amount, daysAgo]) => ({
  campaign: campaigns[c]._id,
  entrepreneur: campaigns[c].entrepreneur,
  investor: investors[i]._id,
  type,
  amount,
  status: 'paid',
  paidAt: daysFromNow(-daysAgo),
  createdAt: daysFromNow(-daysAgo),
}));

await Investment.insertMany([
  ...paid,
  {
    campaign: campaigns[0]._id,
    entrepreneur: salma._id,
    investor: investors[2]._id,
    type: 'equity',
    amount: 4000,
    status: 'requested',
    message: 'I love the project and would like to join as a small shareholder.',
  },
]);

for (const campaign of campaigns) {
  const contributions = paid.filter((p) => p.campaign.equals(campaign._id));
  campaign.raisedAmount = contributions.reduce((sum, p) => sum + p.amount, 0);
  campaign.contributionsCount = contributions.length;
  await campaign.save();
}

console.info('\nDemo data ready. Every account uses the password:', PASSWORD);
console.table([admin, salma, karim, ...investors].map((u) => ({ role: u.role, email: u.email })));
await mongoose.disconnect();
