import { Worker, Job, ConnectionOptions } from 'bullmq';
import { getBullRedisConnection } from '../../../core/config/redisConnection.ts';
import {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
} from '../../authentication_module/services/authEmail.service.ts';
import { createLogger } from '../../../core/lib/logger.ts';
import {
  markEmailOutboxFailed,
  markEmailOutboxSent,
} from '../../../core/services/emailQueue.service.ts';

const log = createLogger('email-worker');

export type EmailJobName =
  | 'send-verification-email'
  | 'send-welcome-email'
  | 'send-password-reset-email'
  | 'send-password-changed-email';

export interface EmailJobData {
  email: string;
  name: string;
  link?: string;
  expiryHours?: string;
  expiryMinutes?: string;
  changedAt?: string;
  location?: string;
  device?: string;
  secureAccountUrl?: string;
  outboxEventId?: string;
  outboxAttempt?: string;
}

/**
 * Validates that a required string exists in the job data.
 * Throws a clear error if missing, forcing BullMQ to retry or fail the job safely.
 */
const assertString = (
  value: unknown,
  field: string,
  jobName: EmailJobName
): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid or missing '${field}' for job '${jobName}'`);
  }
  return value.trim();
};

/**
 * The BullMQ Worker that processes emails in the background.
 * Concurrency is set to 5 to prevent rate-limiting from your email provider.
 */
export const emailWorker = new Worker<EmailJobData, void, EmailJobName>(
  'emailQueue', // Must match the Queue name used in your emailQueue.service.ts
  async (job: Job<EmailJobData, void, EmailJobName>) => {
    const { name, data } = job;

    switch (name) {
      case 'send-verification-email':
        log.info(
          { jobId: job.id, jobName: name },
          'Processing verification email'
        );
        await sendVerificationEmail(
          assertString(data.email, 'email', name),
          assertString(data.name, 'name', name),
          assertString(data.link, 'link', name),
          data.expiryHours
        );
        break;

      case 'send-welcome-email':
        log.info({ jobId: job.id, jobName: name }, 'Processing welcome email');
        await sendWelcomeEmail(
          assertString(data.email, 'email', name),
          assertString(data.name, 'name', name)
        );
        break;

      case 'send-password-reset-email':
        log.info(
          { jobId: job.id, jobName: name },
          'Processing password reset email'
        );
        await sendPasswordResetEmail(
          assertString(data.email, 'email', name),
          assertString(data.name, 'name', name),
          assertString(data.link, 'link', name),
          data.expiryMinutes
        );
        break;

      case 'send-password-changed-email':
        await sendPasswordChangedEmail(
          assertString(data.email, 'email', name),
          assertString(data.name, 'name', name),
          assertString(data.changedAt, 'changedAt', name),
          assertString(data.location, 'location', name),
          assertString(data.device, 'device', name),
          data.secureAccountUrl
        );
        break;

      default:
        // This acts as a compile-time and runtime safeguard
        throw new Error(`Unknown email job name: ${name}`);
    }

    await markEmailOutboxSent(data.outboxEventId, data.outboxAttempt);
  },
  {
    // ioredis instances can be passed directly to BullMQ
    connection: getBullRedisConnection() as unknown as ConnectionOptions,
    concurrency: 5,
    // Automatically removes successfully completed jobs so Redis doesn't run out of memory
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  }
);

// --- Worker Event Listeners for robust logging ---

emailWorker.on('completed', (job) => {
  log.info(
    { jobId: job.id, jobName: job.name, attemptsMade: job.attemptsMade },
    'Email job completed successfully'
  );
});

emailWorker.on('failed', (job, err) => {
  log.error(
    {
      err,
      jobId: job?.id,
      jobName: job?.name,
      attemptsMade: job?.attemptsMade,
    },
    'Email job failed'
  );

  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    void markEmailOutboxFailed(
      job.data.outboxEventId,
      job.data.outboxAttempt,
      err
    ).catch((error) =>
      log.error(
        { error, jobId: job.id },
        'Failed to update email outbox status'
      )
    );
  }
});

// Graceful shutdown listener
process.on('SIGINT', async () => {
  await emailWorker.close();
  log.info('Email worker shut down gracefully');
});
