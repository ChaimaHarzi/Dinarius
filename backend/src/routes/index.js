import crypto from 'node:crypto';
import fs from 'node:fs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { env } from '../config/env.js';
import * as auth from '../controllers/auth.controller.js';
import * as campaigns from '../controllers/campaign.controller.js';
import * as investments from '../controllers/investment.controller.js';
import * as stats from '../controllers/stats.controller.js';
import * as users from '../controllers/user.controller.js';
import { optionalAuth, requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../utils/AppError.js';
import * as s from '../validators/schemas.js';

const router = Router();
const byId = validate({ params: s.idParam });
const admin = [requireAuth, requireRole('admin')];
const entrepreneur = [requireAuth, requireRole('entrepreneur')];
const investor = [requireAuth, requireRole('investor')];

// ---------------------------------------------------------------- auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.isTest,
  message: { message: 'Too many attempts, please try again in a few minutes' },
});

router.post('/auth/register', authLimiter, validate({ body: s.registerSchema }), auth.register);
router.post('/auth/login', authLimiter, validate({ body: s.loginSchema }), auth.login);
router.post('/auth/forgot-password', authLimiter, validate({ body: s.forgotPasswordSchema }), auth.forgotPassword);
router.post('/auth/reset-password', authLimiter, validate({ body: s.resetPasswordSchema }), auth.resetPassword);
router.get('/auth/me', requireAuth, auth.me);
router.get('/auth/providers', auth.providers);
router.get('/auth/google', auth.googleStart);
router.get('/auth/google/callback', auth.googleCallback);

// ---------------------------------------------------------------- users
router.get('/users/me', requireAuth, users.getMe);
router.patch('/users/me', requireAuth, validate({ body: s.updateMeSchema }), users.updateMe);
router.patch('/users/me/password', requireAuth, validate({ body: s.changePasswordSchema }), users.changePassword);
router.delete('/users/me', requireAuth, users.deleteMe);
router.get('/users', admin, validate({ query: s.userListQuery }), users.listUsers);
router.post('/users', admin, validate({ body: s.adminCreateUserSchema }), users.createUser);
router.patch('/users/:id', admin, byId, validate({ body: s.adminUpdateUserSchema }), users.updateUser);
router.delete('/users/:id', admin, byId, users.deleteUser);

// ---------------------------------------------------------------- campaigns
router.get('/campaigns', validate({ query: s.campaignListQuery }), campaigns.listPublic);
router.get('/campaigns/mine', entrepreneur, validate({ query: s.campaignListQuery }), campaigns.listMine);
router.get('/campaigns/admin', admin, validate({ query: s.campaignListQuery }), campaigns.listForAdmin);
router.get('/campaigns/:id', optionalAuth, byId, campaigns.getCampaign);
router.post('/campaigns', entrepreneur, validate({ body: s.createCampaignSchema }), campaigns.createCampaign);
router.patch('/campaigns/:id', requireAuth, byId, validate({ body: s.updateCampaignSchema }), campaigns.updateCampaign);
router.delete('/campaigns/:id', requireAuth, byId, campaigns.deleteCampaign);
router.patch('/campaigns/:id/review', admin, byId, validate({ body: s.reviewCampaignSchema }), campaigns.reviewCampaign);

// ---------------------------------------------------------------- investments
router.get('/payments/config', investments.paymentConfig);
router.post('/investments/checkout', investor, validate({ body: s.checkoutSchema }), investments.checkout);
router.post('/investments/engage', investor, validate({ body: s.engageSchema }), investments.engage);
router.post('/investments/confirm', investor, validate({ body: s.confirmPaymentSchema }), investments.confirmPayment);
router.get('/investments/mine', investor, validate({ query: s.investmentListQuery }), investments.listMine);
router.get('/investments/received', entrepreneur, validate({ query: s.investmentListQuery }), investments.listReceived);
router.get('/investments', admin, validate({ query: s.investmentListQuery }), investments.listAll);
router.get('/investments/:id', requireAuth, byId, investments.getInvestment);
router.post('/investments/:id/pay', investor, byId, investments.payAcceptedOffer);
router.patch('/investments/:id/cancel', investor, byId, investments.cancelInvestment);
router.patch('/investments/:id/respond', entrepreneur, byId, validate({ body: s.respondSchema }), investments.respondToOffer);

// ---------------------------------------------------------------- stats
router.get('/stats/admin', admin, stats.adminStats);
router.get('/stats/entrepreneur', entrepreneur, stats.entrepreneurStats);
router.get('/stats/investor', investor, stats.investorStats);

// ---------------------------------------------------------------- uploads
const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
fs.mkdirSync(env.uploadsDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: env.uploadsDir,
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${IMAGE_TYPES[file.mimetype]}`),
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    IMAGE_TYPES[file.mimetype] ? cb(null, true) : cb(AppError.badRequest('Only JPG, PNG or WEBP images are allowed')),
});

router.post('/uploads', requireAuth, upload.single('image'), (req, res, next) => {
  if (!req.file) return next(AppError.badRequest('No image received'));
  return res.status(201).json({ url: `/uploads/${req.file.filename}` });
});

export default router;
