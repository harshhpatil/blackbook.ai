import { addEmailJob } from '../../../core/services/emailQueue.service.ts';
import { createLogger } from '../../../core/lib/logger.ts';

const log = createLogger('auth-jobs');

/**
 * @function queueWelcomeEmail
 * @description Queues a welcome email to be sent asynchronously via BullMQ.
 * @param {string} email - The recipient's email address.
 * @returns {Promise<void>} Resolves when the job is successfully added to the queue.
 */
export async function queueWelcomeEmail(
  email: string,
  name: string
): Promise<void> {
  await addEmailJob('send-welcome-email', { email, name });

  log.info({ email }, 'Welcome email job queued');
}

/**
 * @function queueVerificationEmail
 * @description Queues an email verification link to be sent asynchronously.
 * @param {string} email - The recipient's email address.
 * @param {string} verificationLink - The secure verification URL to embed in the email.
 * @returns {Promise<void>} Resolves when the job is successfully added to the queue.
 */
export async function queueVerificationEmail(
  email: string,
  name: string,
  verificationLink: string
): Promise<void> {
  await addEmailJob('send-verification-email', {
    email,
    name,
    link: verificationLink,
  });

  log.info({ email }, 'Verification email job queued');
}

/**
 * @function queuePasswordResetEmail
 * @description Queues a secure password reset link to be sent asynchronously.
 * @param {string} email - The recipient's email address.
 * @param {string} resetLink - The secure reset URL to embed in the email.
 * @returns {Promise<void>} Resolves when the job is successfully added to the queue.
 */
export async function queuePasswordResetEmail(
  email: string,
  name: string,
  resetLink: string
): Promise<void> {
  await addEmailJob('send-password-reset-email', {
    email,
    name,
    link: resetLink,
  });

  log.info({ email }, 'Password reset email job queued');
}
