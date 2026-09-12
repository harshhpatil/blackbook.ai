import crypto from 'node:crypto';
import { ConnectionOptions, JobsOptions, Queue } from 'bullmq';
import mongoose from 'mongoose';
import { getBullRedisConnection } from '../config/redisConnection.ts';
import {
  EmailOutbox,
  EmailOutboxEventName,
  IEmailOutbox,
} from '../../modules/system_module/models/EmailOutbox.model.ts';
import { createLogger } from '../lib/logger.ts';

const log = createLogger('email-queue');

let emailQueue: Queue | undefined;

/**
 * Initializes and retrieves the singleton BullMQ Email Queue.
 */
export const getEmailQueue = (): Queue => {
  if (emailQueue) return emailQueue;

  emailQueue = new Queue('emailQueue', {
    connection: getBullRedisConnection() as ConnectionOptions,
  });

  log.info('Email queue initialized');
  return emailQueue;
};

/**
 * Gracefully closes the email queue connection during app teardown.
 */
export const closeEmailQueue = async (): Promise<void> => {
  if (!emailQueue) return;
  await emailQueue.close();
  emailQueue = undefined;
  log.info('Email queue closed');
};

const defaultEmailJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: true,
  removeOnFail: { age: 7 * 24 * 60 * 60, count: 1000 }, // Keep failed jobs for 7 days
};

/**
 * Generates a deterministic Job ID based on the event name and payload.
 * This ensures idempotency: if the outbox publisher retries a job,
 * BullMQ won't create a duplicate.
 */
const generateJobId = (
  name: string,
  payload: Record<string, string>
): string => {
  const digest = crypto
    .createHash('sha256')
    .update(JSON.stringify({ name, payload }))
    .digest('hex');

  return `${name}-${digest}`;
};

/**
 * Stores an email event in the MongoDB Outbox.
 * @note This should ideally be called within a Mongoose session/transaction
 * to guarantee atomicity alongside your primary business logic.
 */
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

/**
 * Directly adds a generic job to the BullMQ email queue.
 * Exported so feature modules can queue their specific emails.
 */
export async function addEmailJob(
  name: EmailOutboxEventName,
  payload: Record<string, string>
): Promise<void> {
  await getEmailQueue().add(name, payload, {
    ...defaultEmailJobOptions,
    jobId: generateJobId(name, payload),
  });
}

/**
 * Publishes a single outbox event to BullMQ and updates its DB status.
 */
export async function publishEmailOutboxEvent(
  event: IEmailOutbox
): Promise<void> {
  try {
    const attempt = event.attempts + 1;
    event.status = 'queued';
    event.attempts = attempt;
    event.publishedAt = new Date();
    event.lastError = undefined;
    await event.save();

    await addEmailJob(event.eventName, {
      ...event.payload,
      outboxEventId: event._id.toString(),
      outboxAttempt: attempt.toString(),
    });
  } catch (err) {
    event.status = 'failed';
    event.attempts += 1;
    event.lastError = err instanceof Error ? err.message : 'Unknown error';
    await event.save();

    log.error(
      { err, eventId: event._id.toString(), eventName: event.eventName },
      'Email outbox publish failed'
    );
  }
}

/** Marks an outbox event as delivered only when its latest queued attempt succeeds. */
export async function markEmailOutboxSent(
  outboxEventId: string | undefined,
  outboxAttempt: string | undefined
): Promise<void> {
  if (!outboxEventId || !outboxAttempt) return;

  await EmailOutbox.updateOne(
    { _id: outboxEventId, attempts: Number(outboxAttempt) },
    {
      $set: { status: 'sent', deliveredAt: new Date(), lastError: undefined },
    }
  );
}

/** Marks a terminal BullMQ failure so the periodic outbox sweep can requeue it. */
export async function markEmailOutboxFailed(
  outboxEventId: string | undefined,
  outboxAttempt: string | undefined,
  error: Error
): Promise<void> {
  if (!outboxEventId || !outboxAttempt) return;

  await EmailOutbox.updateOne(
    { _id: outboxEventId, attempts: Number(outboxAttempt) },
    { $set: { status: 'failed', lastError: error.message } }
  );
}

/**
 * Sweeps the MongoDB outbox for events that need publishing or whose queue handoff
 * was interrupted before delivery could be recorded.
 * Intended to be run periodically (e.g., via a Cron job) to ensure eventual consistency.
 */
export async function publishPendingEmailOutbox(limit = 100): Promise<void> {
  const staleQueueCutoff = new Date(Date.now() - 5 * 60 * 1000);
  const events = await EmailOutbox.find({
    $or: [
      { status: { $in: ['pending', 'failed'] } },
      { status: 'queued', publishedAt: { $lt: staleQueueCutoff } },
    ],
  })
    .sort({ createdAt: 1 })
    .limit(limit);

  for (const event of events) {
    await publishEmailOutboxEvent(event);
  }
}
