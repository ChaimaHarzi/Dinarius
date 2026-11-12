import mongoose from 'mongoose';
import { FUNDING_TYPES } from './Campaign.js';

/**
 * Lifecycle:
 *   donation / reward : pending -> paid | failed
 *   equity / loan     : requested -> accepted | declined -> (accepted) pending -> paid
 *   any open state    : -> cancelled
 */
export const INVESTMENT_STATUSES = [
  'requested',
  'accepted',
  'declined',
  'pending',
  'paid',
  'failed',
  'cancelled',
];

const investmentSchema = new mongoose.Schema(
  {
    investor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
    entrepreneur: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: FUNDING_TYPES, required: true },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, default: 'usd' },
    status: { type: String, enum: INVESTMENT_STATUSES, required: true, index: true },
    message: { type: String, trim: true, maxlength: 1000, default: '' },
    responseNote: { type: String, trim: true, maxlength: 500, default: '' },
    respondedAt: { type: Date },
    stripeSessionId: { type: String, index: true, sparse: true },
    paidAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform(_doc, ret) {
        delete ret._id;
        delete ret.stripeSessionId;
        return ret;
      },
    },
  },
);

investmentSchema.index({ status: 1, paidAt: -1 });

investmentSchema.methods.involves = function involves(user) {
  const idOf = (ref) => (ref?._id ?? ref)?.toString();
  return [idOf(this.investor), idOf(this.entrepreneur)].includes(user.id) || user.role === 'admin';
};

export const Investment = mongoose.model('Investment', investmentSchema);
