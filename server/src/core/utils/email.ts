import { Resend } from 'resend';
import { env } from '../config/env.ts';
import { createLogger } from '../lib/logger.ts';

const log = createLogger('email-utility');

// Initialize the Resend client with your API key
const resend = new Resend(env.RESEND_API_KEY);

/**
 * Verifies the Resend configuration.
 * Since Resend is a REST API and not an SMTP connection, we verify
 * that the API key is present and valid by making a lightweight API call.
 */
export const verifyEmailConnection = async (): Promise<void> => {
  try {
    if (!env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is missing from environment variables.');
    }

    // Optional: We ping the Resend API to verify the key actually works
    const { error } = await resend.domains.list();
    if (error) {
      throw new Error(`Resend API Error: ${error.message}`);
    }

    log.info(
      'Resend client initialized and API key verified. Ready to send emails.'
    );
  } catch (error) {
    log.error(
      { error },
      'Failed to initialize Resend client. Check RESEND_API_KEY in your .env file.'
    );
    throw error;
  }
};

/**
 * Standardized email sending function.
 * This replaces your old `transporter.sendMail` calls inside your workers.
 */
export const sendEmail = async ({
  to,
  subject,
  html,
  text,
}: {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
}) => {
  const { data, error } = await resend.emails.send({
    // Important: This domain MUST be verified in your Resend dashboard
    from: env.EMAIL_FROM_ADDRESS,
    to,
    subject,
    html: html || '',
    text: text || '',
  });

  if (error) {
    log.error({ error, to, subject }, 'Failed to send email via Resend');
    throw new Error(error.message);
  }

  log.info({ id: data?.id, to, subject }, 'Email sent successfully via Resend');
  return data;
};

export default resend;
