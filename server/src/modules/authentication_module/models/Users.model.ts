import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

/**
 * @interface IUser
 * @extends {Document}
 * @description Represents the User document structure in MongoDB.
 */
export interface IUser extends Document {
  /** The unique email address of the user */
  email: string;
  /** The mobile number of the user */
  mobileNumber: string;
  /** Optional display name used in transactional emails */
  name?: string;
  /** The bcrypt-hashed password (excluded from queries by default for security) */
  passwordHash?: string;
  /** The auth provider, it can be google or local*/
  authProvider: 'local' | 'google';
  /** The google id if the user authenticates using the google*/
  googleId?: string;
  /** The authorization role of the user */
  role: 'user' | 'admin';
  /** The active subscription tier of the user */
  subscriptionPlan: 'none' | 'normal' | 'pro' | 'premium';
  /** Incremented on major security events to invalidate all existing JWTs */
  tokenVersion: number;
  /** Indicates if the user has verified their email address */
  isEmailVerified: boolean;
  /** Indicates if the user has verifies their mobile number */
  isMobileVerified: boolean;
  /** Token used for email verification processes */
  emailVerificationToken?: string;
  /** Expiration date for the email verification token */
  emailVerificationTokenExpiry?: Date;
  /** Token used for resetting a forgotten password */
  passwordResetToken?: string;
  /** Expiration date for the password reset token */
  passwordResetTokenExpiry?: Date;
  /** Timestamp of document creation */
  createdAt: Date;
  /** Timestamp of last document update */
  updatedAt: Date;

  /**
   * @method comparePassword
   * @description Compares a plaintext password against the stored bcrypt hash.
   * @param {string} password - The plaintext password to verify.
   * @returns {Promise<boolean>} True if the password matches, false otherwise.
   */
  comparePassword(password: string): Promise<boolean>;
}

/**
 * @constant UserSchema
 * @description Mongoose schema definition for the User model.
 */
const UserSchema: Schema<IUser> = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    mobileNumber: {
      type: String,
      required: true,
      unique: true,
      sparse: true,
    },
    name: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    subscriptionPlan: {
      type: String,
      enum: ['none', 'normal', 'pro', 'premium'],
      default: 'none',
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isMobileVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: String,
    emailVerificationTokenExpiry: Date,
    passwordResetToken: String,
    passwordResetTokenExpiry: Date,
  },
  { timestamps: true }
);

// Indexes for fast token lookups during verification/reset flows
UserSchema.index({
  emailVerificationToken: 1,
  emailVerificationTokenExpiry: 1,
});
UserSchema.index({ passwordResetToken: 1, passwordResetTokenExpiry: 1 });

/**
 * @function pre('save')
 * @description Middleware that automatically hashes the user's password before saving to the database.
 * Skips hashing if the password field hasn't been modified.
 */
UserSchema.pre<IUser>('save', async function () {
  if (!this.isModified('passwordHash') || !this.passwordHash) {
    return;
  }

  // Cost factor 13 balances strong security against brute-force with acceptable login latency
  this.passwordHash = await bcrypt.hash(this.passwordHash, 13);
});

/**
 * @function comparePassword
 * @description Instance method to securely verify credentials during login.
 */
UserSchema.methods.comparePassword = async function (
  password: string
): Promise<boolean> {
  if (!this.passwordHash) {
    return false;
  }

  return await bcrypt.compare(password, this.passwordHash);
};

/**
 * @exports User
 * @description The compiled Mongoose model for User operations.
 */
export const User = mongoose.model<IUser>('User', UserSchema);
