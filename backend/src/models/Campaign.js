import mongoose from 'mongoose';

export const CATEGORIES = [
  'social',
  'business',
  'artistic',
  'technology',
  'medical',
  'educational',
  'environmental',
  'other',
];

/** donation & reward are paid directly; equity & loan need the entrepreneur's approval first. */
export const FUNDING_TYPES = ['donation', 'reward', 'equity', 'loan'];

export const CAMPAIGN_STATUSES = ['pending', 'active', 'rejected', 'completed', 'cancelled'];

const campaignSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    summary: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 10000 },
    category: { type: String, enum: CATEGORIES, required: true },
    fundingTypes: {
      type: [{ type: String, enum: FUNDING_TYPES }],
      validate: [(v) => v.length > 0, 'Choose at least one funding type'],
    },
    goalAmount: { type: Number, required: true, min: 1 },
    raisedAmount: { type: Number, default: 0, min: 0 },
    contributionsCount: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'usd' },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    country: { type: String, required: true, trim: true },
    postalCode: { type: String, trim: true, default: '' },
    coverImage: { type: String, trim: true, default: '' },
    images: { type: [String], default: [] },
    equityPercentage: { type: Number, min: 0, max: 100 },
    loanInterestRate: { type: Number, min: 0, max: 50 },
    rewardDescription: { type: String, trim: true, maxlength: 500 },
    status: { type: String, enum: CAMPAIGN_STATUSES, default: 'pending', index: true },
    rejectionReason: { type: String, trim: true, default: '' },
    reviewedAt: { type: Date },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    entrepreneur: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform(_doc, ret) {
        delete ret._id;
        return ret;
      },
    },
  },
);

campaignSchema.index({ status: 1, category: 1, endDate: 1 });

campaignSchema.virtual('progress').get(function progress() {
  if (!this.goalAmount) return 0;
  return Math.round((this.raisedAmount / this.goalAmount) * 100);
});

campaignSchema.virtual('daysLeft').get(function daysLeft() {
  if (!this.endDate) return 0;
  return Math.max(0, Math.ceil((this.endDate.getTime() - Date.now()) / 86_400_000));
});

campaignSchema.methods.isOwnedBy = function isOwnedBy(user) {
  const ownerId = this.entrepreneur?._id ?? this.entrepreneur;
  return Boolean(user) && ownerId?.toString() === user.id;
};

campaignSchema.methods.acceptsContributions = function acceptsContributions() {
  return this.status === 'active' && this.endDate > new Date() && this.startDate <= new Date();
};

export const Campaign = mongoose.model('Campaign', campaignSchema);
