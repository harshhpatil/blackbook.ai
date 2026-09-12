import { sendEmail } from '../../../core/utils/email.ts';
import compileTemplate from '../../../core/templates/email_exporter.ts';
import { createLogger } from '../../../core/lib/logger.ts';

const log = createLogger('auth-email-service');

/**
 * Helper to always inject the current year into templates
 */
const getCurrentYear = () => new Date().getFullYear().toString();

export const sendWelcomeEmail = async (
  email: string,
  name: string
): Promise<void> => {
  try {
    const html = await compileTemplate('welcome-email.mjml', {
      name,
    });

    await sendEmail({
      to: email,
      subject: 'Welcome Abroad - Team Getblackbook',
      html,
    });

    log.info({ email }, 'Welcome email processed and sent successfully');
  } catch (error) {
    log.error({ err: error, email }, 'Failed to process welcome email');
    throw new Error('Welcome email could not be processed', { cause: error });
  }
};

export const sendVerificationEmail = async (
  email: string,
  name: string,
  verificationUrl: string,
  expiryHours: string = '24'
): Promise<void> => {
  try {
    const html = await compileTemplate('verify-email.mjml', {
      name,
      expiry_hours: expiryHours,
      verification_url: verificationUrl,
      year: getCurrentYear(),
    });

    await sendEmail({
      to: email,
      subject: 'Verify your email — Team Getblackbook',
      html,
    });

    log.info({ email }, 'Verification email processed and sent successfully');
  } catch (error) {
    log.error({ err: error, email }, 'Failed to process verification email');
    throw new Error('Verification email could not be processed', {
      cause: error,
    });
  }
};

export const sendPasswordResetEmail = async (
  email: string,
  name: string,
  resetUrl: string,
  expiryMinutes: string = '15'
): Promise<void> => {
  try {
    const html = await compileTemplate('forgot-password.mjml', {
      name,
      expiry_minutes: expiryMinutes,
      reset_url: resetUrl,
      year: getCurrentYear(),
    });

    await sendEmail({
      to: email,
      subject: 'Reset your password — Blackbook',
      html,
    });

    log.info({ email }, 'Password reset email processed and sent successfully');
  } catch (error) {
    log.error({ err: error, email }, 'Failed to process password reset email');
    throw new Error('Password reset email could not be processed', {
      cause: error,
    });
  }
};

export const sendPasswordChangedEmail = async (
  email: string,
  name: string,
  changedAt: string,
  location: string,
  device: string,
  secureAccountUrl: string = 'https://getblackbook.in/help/security'
): Promise<void> => {
  try {
    const html = await compileTemplate('password-changed.mjml', {
      name,
      changed_at: changedAt,
      secure_account_url: secureAccountUrl,
      location,
      device,
      year: getCurrentYear(),
    });

    await sendEmail({
      to: email,
      subject: 'Security Notice: Your password was changed',
      html,
    });

    log.info(
      { email },
      'Password changed security email processed and sent successfully'
    );
  } catch (error) {
    log.error(
      { err: error, email },
      'Failed to process password changed email'
    );
    throw new Error('Password changed email could not be processed', {
      cause: error,
    });
  }
};
