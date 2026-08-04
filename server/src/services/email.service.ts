import transporter from '../utils/email.ts';
import { env } from '../config/env.ts';
import { createLogger } from '../lib/logger.ts';

const log = createLogger('email-service');

// function to send verification email
export const sendVerificationEmail = async (
  email: string,
  verificationLink: string
): Promise<void> => {
  try {
    await transporter.sendMail({
      from: `"Auth-System" <${env.EMAIL_FROM}>`,
      to: email,
      subject: 'Verify Your Email Address',
      html: `
        <h2>Email Verification</h2>
        <p>Thank you for registering.</p>
        <p>Please click the link below to verify your email:</p>
        <a href="${verificationLink}" target="_blank">
          Verify Email
        </a>
        <p>This link will expire soon.</p>
      `,
    });
  } catch (error) {
    log.error({ err: error, email }, 'error sending verification email');
    throw new Error('email could not be sent', { cause: error });
  }
};

// function to send password reset email
export const sendPasswordResetEmail = async (
  email: string,
  passwordResetLink: string
): Promise<void> => {
  try {
    await transporter.sendMail({
      from: `"Auth-System" <${env.EMAIL_FROM}>`,
      to: email,
      subject: 'Password Reset Request',
      html: `
        <h2>Password Reset</h2>
        <p>You requested to reset your password.</p>
        <p>Click the link below to reset it:</p>
        <a href="${passwordResetLink}" target="_blank">
          Reset Password
        </a>
        <p>If you did not request this, ignore this email.</p>
        `,
    });
  } catch (err) {
    log.error({ err, email }, 'error sending password reset email');
    throw new Error('email could not be sent', { cause: err });
  }
};

// function to send welcome email
export const sendWelcomeEmail = async (email: string): Promise<void> => {
  try {
    await transporter.sendMail({
      from: `"Your App Name" <${env.EMAIL_FROM}>`,
      to: email,
      subject: 'Welcome to Our Platform 🎉',
      html: `
        <h2>Welcome!</h2>
        <p>Your account has been successfully created.</p>
        <p>We're excited to have you on board.</p>
        <p>Feel free to explore and let us know if you have any questions. Also verify the email address associated with your account for seamless experience.</p>
      `,
    });
  } catch (error) {
    log.error({ err: error, email }, 'error sending welcome email');
    throw new Error('Email could not be sent', { cause: error });
  }
};
