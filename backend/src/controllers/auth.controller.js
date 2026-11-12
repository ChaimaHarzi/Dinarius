import { env } from '../config/env.js';
import { googleEnabled, passport } from '../config/passport.js';
import { User } from '../models/User.js';
import { mails, sendMail } from '../services/mailer.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/http.js';
import { createOneTimeToken, hashToken, signToken } from '../utils/tokens.js';

const RESET_TTL_MS = 30 * 60 * 1000;

const sendSession = (res, user, status = 200) => res.status(status).json({ token: signToken(user), user });

export const register = asyncHandler(async (req, res) => {
  if (await User.exists({ email: req.body.email })) {
    throw AppError.conflict('An account with this email already exists');
  }
  const user = await User.create(req.body);
  void sendMail(mails.welcome(user));
  sendSession(res, user, 201);
});

export const login = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+password');
  // Same message for unknown email and wrong password, so accounts cannot be enumerated.
  if (!user || !(await user.comparePassword(req.body.password))) {
    throw AppError.unauthorized('Invalid email or password');
  }
  if (!user.isActive) throw AppError.forbidden('This account has been disabled');
  sendSession(res, user);
});

export const me = (req, res) => res.json({ user: req.user });

export const providers = (_req, res) => res.json({ google: googleEnabled });

export const forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email, isActive: true });
  if (user) {
    const { raw, hash } = createOneTimeToken();
    user.resetPasswordToken = hash;
    user.resetPasswordExpires = new Date(Date.now() + RESET_TTL_MS);
    await user.save({ validateBeforeSave: false });
    void sendMail(mails.passwordReset(user, `${env.clientUrl}/reset-password?token=${raw}`));
  }
  res.json({ message: 'If an account exists for this email, a reset link has been sent.' });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    resetPasswordToken: hashToken(req.body.token),
    resetPasswordExpires: { $gt: new Date() },
  }).select('+resetPasswordToken +resetPasswordExpires');
  if (!user) throw AppError.badRequest('This reset link is invalid or has expired');

  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();
  sendSession(res, user);
});

export function googleStart(req, res, next) {
  if (!googleEnabled) return next(AppError.notFound('Google sign-in is not configured'));
  const role = req.query.role === 'entrepreneur' ? 'entrepreneur' : 'investor';
  return passport.authenticate('google', { scope: ['profile', 'email'], session: false, state: role })(req, res, next);
}

export function googleCallback(req, res, next) {
  if (!googleEnabled) return next(AppError.notFound('Google sign-in is not configured'));
  return passport.authenticate('google', { session: false }, (err, user) => {
    if (err || !user) return res.redirect(`${env.clientUrl}/login?error=google`);
    // The token travels in the URL fragment, which is never sent to servers or logged.
    return res.redirect(`${env.clientUrl}/auth/callback#token=${signToken(user)}`);
  })(req, res, next);
}
