import { Worker, Job } from 'bullmq';
import { getBullRedisConnection } from '../config/redisConnection.ts';
import {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
} from '../services/email.service.ts';

type EmailJobName =
  | 'send-verification-email'
  | 'send-welcome-email'
  | 'send-password-reset-email';

interface EmailJobData {
  email?: unknown;
  link?: unknown;
}

const assertString = (
  value: unknown,
  field: string,
  jobName: EmailJobName
): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid ${field} for ${jobName}`);
  }

  return value;
};

// Initialize the Worker
export const emailWorker = new Worker(
  'emailQueue', // Must match the Queue name exactly
  async (job: Job<EmailJobData>) => {
    const { name, data } = job;

    switch (name) {
      case 'send-verification-email':
        console.log('Processing verification email job.');
        await sendVerificationEmail(
          assertString(data.email, 'email', name),
          assertString(data.link, 'link', name)
        );
        break;

      case 'send-welcome-email':
        console.log('Processing welcome email job.');
        await sendWelcomeEmail(assertString(data.email, 'email', name));
        break;

      case 'send-password-reset-email':
        console.log('Processing password reset email job.');
        await sendPasswordResetEmail(
          assertString(data.email, 'email', name),
          assertString(data.link, 'link', name)
        );
        break;

      default:
        throw new Error(`Unknown email job name: ${name}`);
    }
  },
  {
    connection: getBullRedisConnection() as any, // Ensure this matches your Redis connection configuration
    concurrency: 5, // Process up to 5 emails simultaneously
  }
);

emailWorker.on('completed', (job) => {
  console.log(`worker job ${job.id} (${job.name}) completed successfully.`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`worker job ${job?.id} (${job?.name}) failed:`, err.message);
});
