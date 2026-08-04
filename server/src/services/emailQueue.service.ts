import crypto from 'node:crypto';
import { ConnectionOptions, JobsOptions, Queue } from 'bullmq';
import mongoose from 'mongoose';
import { getBullRedisConnection } from '../config/redisConnection.ts';
import {
  EmailOutbox,
  EmailOutboxEventName,
  IEmailOutbox,
} from '../models/EmailOutbox.model.ts';
import { createLogger } from '../lib/logger.ts';

const log = createLogger('email-queue');

// initializind the queue
let emailQueue: Queue | undefined;

export const getEmailQueue = (): Queue => {
  if (emailQueue) return emailQueue;

  emailQueue = new Queue('emailQueue', {
    connection: getBullRedisConnection() as ConnectionOptions,
  });
  log.info('email queue initialized');

  return emailQueue;
};

export const closeEmailQueue = async (): Promise<void> => {
  if (!emailQueue) return;
  await emailQueue.close();
  emailQueue = undefined;
  log.info('email queue closed');
};

const defaultEmailJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: true,
  removeOnFail: { age: 7 * 24 * 60 * 60, count: 1000 },
};

const emailJobId = (name: string, payload: Record<string, string>): string => {
  const digest = crypto
    .createHash('sha256')
    .update(JSON.stringify({ name, payload }))
    .digest('hex');

  return `${name}-${digest}`;
};

export async function createEmailOutboxEvent(
  eventName: EmailOutboxEventName,
  payload: Record<string, string>,
  session?: mongoose.ClientSession
): Promise<IEmailOutbox> {
  const [event] = await EmailOutbox.create(
    [{ eventName, payload, status: 'pending' }],
    { session }
  );

  return event;
}

export async function publishEmailOutboxEvent(
  event: IEmailOutbox
): Promise<void> {
  try {
    await addEmailJob(event.eventName, event.payload);
    event.status = 'published';
    event.publishedAt = new Date();
    event.lastError = undefined;
    await event.save();
  } catch (err) {
    event.status = 'failed';
    event.attempts += 1;
    event.lastError = err instanceof Error ? err.message : 'unknown error';
    await event.save();

    log.error(
      {
        err,
        eventId: event._id.toString(),
        eventName: event.eventName,
      },
      'email outbox publish failed'
    );
  }
}

export async function publishPendingEmailOutbox(limit = 100): Promise<void> {
  const events = await EmailOutbox.find({
    status: { $in: ['pending', 'failed'] },
  })
    .sort({ createdAt: 1 })
    .limit(limit);

  for (const event of events) {
    await publishEmailOutboxEvent(event);
  }
}

async function addEmailJob(
  name: EmailOutboxEventName,
  payload: Record<string, string>
): Promise<void> {
  await getEmailQueue().add(name, payload, {
    ...defaultEmailJobOptions,
    jobId: emailJobId(name, payload),
  });
}

// function to add a job to the queue for sending verification email
export async function queueVerificationEmail(
  email: string,
  verificationLink: string
): Promise<void> {
  await addEmailJob('send-verification-email', {
    email,
    link: verificationLink,
  });

  log.info({ email, jobName: 'send-verification-email' }, 'email job queued');
}

// function to add a job to the queue for sending welcome email
export async function queueWelcomeEmail(email: string): Promise<void> {
  await addEmailJob('send-welcome-email', { email });

  log.info({ email, jobName: 'send-welcome-email' }, 'email job queued');
}

// function to add a job to the queue for sending password reset email
export async function queuePasswordResetEmail(
  email: string,
  resetLink: string
): Promise<void> {
  await addEmailJob('send-password-reset-email', {
    email,
    link: resetLink,
  });

  log.info({ email, jobName: 'send-password-reset-email' }, 'email job queued');
}
