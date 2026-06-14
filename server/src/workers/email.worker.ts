import { Worker, Job, ConnectionOptions } from 'bullmq';
import { redisConnection } from '../config/redisConnection.ts';
import {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
} from '../services/email.service.ts';

// Initialize the Worker
export const emailWorker = new Worker(
  'email-queue', // Must match the Queue name exactly
  async (job: Job) => {
    const { name, data } = job;

    switch (name) {
      case 'send-verification':
        console.log(` Processing verification email for ${data.email}...`);
        await sendVerificationEmail(data.email, data.link);
        break;

      case 'send-welcome':
        console.log(` Processing welcome email for ${data.email}...`);
        await sendWelcomeEmail(data.email);
        break;

      case 'send-password-reset':
        console.log(` Processing password reset email for ${data.email}...`);
        await sendPasswordResetEmail(data.email, data.link);
        break;

      default:
        console.warn(` Unknown job name: ${name}`);
    }
  },
  {
    connection: redisConnection as ConnectionOptions,
    concurrency: 5, // Process up to 5 emails simultaneously
  }
);

emailWorker.on('completed', (job) => {
  console.log(`worker job ${job.id} (${job.name}) completed successfully.`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`worker job ${job?.id} (${job?.name}) failed:`, err.message);
});
