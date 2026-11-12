import { Campaign } from '../models/Campaign.js';
import { Investment } from '../models/Investment.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler, escapeRegex, pageResult, paginate } from '../utils/http.js';
import { signToken } from '../utils/tokens.js';

/** Closes everything a user still has open, then removes the account. Paid records are kept for accounting. */
async function deleteUserAccount(user) {
  await Campaign.updateMany(
    { entrepreneur: user._id, status: { $in: ['pending', 'active'] } },
    { status: 'cancelled' },
  );
  await Investment.updateMany(
    { investor: user._id, status: { $in: ['requested', 'accepted', 'pending'] } },
    { status: 'cancelled' },
  );
  await user.deleteOne();
}

// ---------------------------------------------------------------- current user
export const getMe = (req, res) => res.json({ user: req.user });

export const updateMe = asyncHandler(async (req, res) => {
  req.user.set(req.body);
  await req.user.save();
  res.json({ user: req.user });
});

export const changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('+password');
  if (user.password && !(await user.comparePassword(req.body.currentPassword ?? ''))) {
    throw AppError.badRequest('Current password is incorrect');
  }
  user.password = req.body.newPassword;
  await user.save();
  res.json({ token: signToken(user), user });
});

export const deleteMe = asyncHandler(async (req, res) => {
  if (req.user.role === 'admin' && (await User.countDocuments({ role: 'admin' })) === 1) {
    throw AppError.badRequest('You are the last administrator; promote someone else first');
  }
  await deleteUserAccount(req.user);
  res.status(204).end();
});

// ---------------------------------------------------------------- admin
export const listUsers = asyncHandler(async (req, res) => {
  const { q, role } = req.query;
  const filter = {};
  if (role) filter.role = role;
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ firstName: pattern }, { lastName: pattern }, { email: pattern }];
  }
  const pageInfo = paginate(req.query);
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(pageInfo.skip).limit(pageInfo.limit),
    User.countDocuments(filter),
  ]);
  res.json(pageResult(items, total, pageInfo));
});

export const createUser = asyncHandler(async (req, res) => {
  if (await User.exists({ email: req.body.email })) {
    throw AppError.conflict('An account with this email already exists');
  }
  const user = await User.create(req.body);
  res.status(201).json({ user });
});

export const updateUser = asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id) throw AppError.badRequest('Use your profile page to edit your own account');
  const user = await User.findById(req.params.id);
  if (!user) throw AppError.notFound('User not found');
  user.set(req.body);
  await user.save();
  res.json({ user });
});

export const deleteUser = asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id) throw AppError.badRequest('You cannot delete your own account here');
  const user = await User.findById(req.params.id);
  if (!user) throw AppError.notFound('User not found');
  await deleteUserAccount(user);
  res.status(204).end();
});
