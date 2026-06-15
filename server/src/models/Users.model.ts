import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

// defining the user schema's interface
export interface IUser extends Document {
  email: string;
  password: string;
  role: 'user' | 'admin';
  tokenVersion: number;
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationTokenExpiry?: Date;
  passwordResetToken?: string;
  passwordResetTokenExpiry?: Date;
  createdAt: Date;
  updatedAt: Date;

  // defining the instance methods here so typescripts knows they exist
  comparePassword(password: string): Promise<boolean>;
}

// defining the user schema
const UserSchema: Schema<IUser> = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    isEmailVerified: {
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

// pre-save hook to hash the password before saving the user document
UserSchema.pre<IUser>('save', async function (next: any) {
  // hashing the password if it is modified or new
  if (!this.isModified('password') || !this.password) {
    return;
  }

  this.password = await bcrypt.hash(this.password, 13);
});

// instance method to compare the password with the hashed password
UserSchema.methods.comparePassword = async function (
  password: string
): Promise<boolean> {
  return await bcrypt.compare(password, this.password);
};

// exporting the user model
export const User = mongoose.model<IUser>('User', UserSchema);
