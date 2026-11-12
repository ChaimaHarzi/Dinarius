import { z } from 'zod';
import { CAMPAIGN_STATUSES, CATEGORIES, FUNDING_TYPES } from '../models/Campaign.js';
import { INVESTMENT_STATUSES } from '../models/Investment.js';
import { ROLES } from '../models/User.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const email = z.string().trim().toLowerCase().email('Enter a valid email address');
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');
const name = (label) => z.string().trim().min(2, `${label} is too short`).max(50, `${label} is too long`);
const money = z.coerce.number().positive('Amount must be positive').max(10_000_000, 'Amount is too large');
const page = z.coerce.number().int().min(1).default(1);
const limit = z.coerce.number().int().min(1).max(100).default(10);

export const idParam = z.object({ id: objectId });

// ---------------------------------------------------------------- auth
export const registerSchema = z
  .object({
    firstName: name('First name'),
    lastName: name('Last name'),
    email,
    password,
    role: z.enum(['entrepreneur', 'investor']),
  })
  .strict();

export const loginSchema = z.object({ email, password: z.string().min(1, 'Password is required') }).strict();

export const forgotPasswordSchema = z.object({ email }).strict();

export const resetPasswordSchema = z
  .object({ token: z.string().length(64, 'Invalid or expired link'), password })
  .strict();

// ---------------------------------------------------------------- users
export const updateMeSchema = z
  .object({
    firstName: name('First name'),
    lastName: name('Last name'),
    email,
    phone: z
      .string()
      .trim()
      .regex(/^(\+?[\d\s-]{6,20})?$/, 'Enter a valid phone number'),
    birthDate: z.coerce.date().max(new Date(), 'Birth date must be in the past').nullable(),
    location: z.string().trim().max(100),
    bio: z.string().trim().max(500),
    avatarUrl: z.string().trim().max(500),
  })
  .partial()
  .strict();

export const changePasswordSchema = z
  .object({ currentPassword: z.string().optional(), newPassword: password })
  .strict();

export const userListQuery = z.object({
  page,
  limit,
  q: z.string().trim().max(100).optional(),
  role: z.enum(ROLES).optional(),
});

export const adminCreateUserSchema = z
  .object({
    firstName: name('First name'),
    lastName: name('Last name'),
    email,
    password,
    role: z.enum(ROLES),
  })
  .strict();

export const adminUpdateUserSchema = z
  .object({ role: z.enum(ROLES), isActive: z.boolean() })
  .partial()
  .strict();

// ---------------------------------------------------------------- campaigns
const campaignFields = z.object({
  title: z.string().trim().min(5, 'Title is too short').max(120, 'Title is too long'),
  summary: z.string().trim().min(10, 'Summary is too short').max(200, 'Summary is too long'),
  description: z.string().trim().min(50, 'Description must be at least 50 characters').max(10000),
  category: z.enum(CATEGORIES),
  fundingTypes: z
    .array(z.enum(FUNDING_TYPES))
    .min(1, 'Choose at least one funding type')
    .transform((types) => [...new Set(types)]),
  goalAmount: money,
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  country: z.string().trim().min(2, 'Country is required').max(60),
  postalCode: z.string().trim().max(12).optional(),
  coverImage: z.string().trim().max(500).optional(),
  images: z.array(z.string().trim().max(500)).max(6).optional(),
  equityPercentage: z.coerce.number().min(0.1).max(100).optional(),
  loanInterestRate: z.coerce.number().min(0).max(50).optional(),
  rewardDescription: z.string().trim().max(500).optional(),
});

const datesInOrder = (data) => !data.startDate || !data.endDate || data.endDate > data.startDate;
const datesMessage = { message: 'End date must be after the start date', path: ['endDate'] };

export const createCampaignSchema = campaignFields
  .strict()
  .refine(datesInOrder, datesMessage)
  .refine((data) => data.endDate > new Date(), { message: 'End date must be in the future', path: ['endDate'] });

export const updateCampaignSchema = campaignFields.partial().strict().refine(datesInOrder, datesMessage);

export const campaignListQuery = z.object({
  page,
  limit: limit.default(9),
  q: z.string().trim().max(100).optional(),
  category: z.enum(CATEGORIES).optional(),
  fundingType: z.enum(FUNDING_TYPES).optional(),
  status: z.enum(CAMPAIGN_STATUSES).optional(),
  sort: z.enum(['newest', 'endingSoon', 'mostFunded', 'goal']).default('newest'),
});

export const reviewCampaignSchema = z
  .object({
    decision: z.enum(['approve', 'reject']),
    reason: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine((data) => data.decision === 'approve' || (data.reason?.length ?? 0) >= 5, {
    message: 'Explain why the campaign is rejected (at least 5 characters)',
    path: ['reason'],
  });

// ---------------------------------------------------------------- investments
export const checkoutSchema = z
  .object({ campaignId: objectId, amount: money, type: z.enum(['donation', 'reward']) })
  .strict();

export const engageSchema = z
  .object({
    campaignId: objectId,
    amount: money,
    type: z.enum(['equity', 'loan']),
    message: z.string().trim().max(1000).optional(),
  })
  .strict();

export const respondSchema = z
  .object({ decision: z.enum(['accept', 'decline']), note: z.string().trim().max(500).optional() })
  .strict();

export const confirmPaymentSchema = z.object({ sessionId: z.string().min(10).max(255) }).strict();

export const investmentListQuery = z.object({
  page,
  limit,
  status: z.enum(INVESTMENT_STATUSES).optional(),
  type: z.enum(FUNDING_TYPES).optional(),
});
