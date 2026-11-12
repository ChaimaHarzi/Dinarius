import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

export const ROLES = ['admin', 'entrepreneur', 'investor'];

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 50 },
    lastName: { type: String, required: true, trim: true, maxlength: 50 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, select: false },
    role: { type: String, enum: ROLES, default: 'investor' },
    phone: { type: String, trim: true, default: '' },
    birthDate: { type: Date },
    location: { type: String, trim: true, maxlength: 100, default: '' },
    bio: { type: String, trim: true, maxlength: 500, default: '' },
    avatarUrl: { type: String, trim: true, default: '' },
    googleId: { type: String, unique: true, sparse: true },
    isActive: { type: Boolean, default: true },
    passwordChangedAt: { type: Date },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform(_doc, ret) {
        delete ret._id;
        delete ret.password;
        delete ret.googleId;
        delete ret.passwordChangedAt;
        delete ret.resetPasswordToken;
        delete ret.resetPasswordExpires;
        return ret;
      },
    },
  },
);

userSchema.virtual('fullName').get(function fullName() {
  return `${this.firstName} ${this.lastName}`.trim();
});

userSchema.pre('validate', function requirePasswordOrGoogle() {
  if (this.isNew && !this.password && !this.googleId) {
    this.invalidate('password', 'Password is required');
  }
});

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password') || !this.password) return;
  this.password = await bcrypt.hash(this.password, 12);
  // Tokens issued before this moment become invalid.
  if (!this.isNew) this.passwordChangedAt = new Date(Date.now() - 1000);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return this.password ? bcrypt.compare(candidate, this.password) : Promise.resolve(false);
};

export const User = mongoose.model('User', userSchema);
