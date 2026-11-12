import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/http.js';
import { verifyToken } from '../utils/tokens.js';

async function userFromRequest(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;

  let payload;
  try {
    payload = verifyToken(header.slice(7));
  } catch {
    throw AppError.unauthorized('Your session has expired, please log in again');
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw AppError.unauthorized('Account not found or disabled');
  if (user.passwordChangedAt && payload.iat * 1000 < user.passwordChangedAt.getTime()) {
    throw AppError.unauthorized('Your password changed, please log in again');
  }
  return user;
}

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const user = await userFromRequest(req);
  if (!user) throw AppError.unauthorized();
  req.user = user;
  next();
});

/** Attaches the user when a valid token is present, without rejecting anonymous requests. */
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  try {
    req.user = await userFromRequest(req);
  } catch {
    req.user = null;
  }
  next();
});

export const requireRole =
  (...roles) =>
  (req, _res, next) =>
    roles.includes(req.user?.role) ? next() : next(AppError.forbidden());
