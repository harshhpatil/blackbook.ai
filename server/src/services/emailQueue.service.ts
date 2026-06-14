import { ConnectionOptions, Queue, Worker } from 'bullmq';
import { redisConnection } from '../config/redisConnection.ts';

// initializind the queue
export const emailQueue = new Queue('emailQueue', {
  connection: redisConnection as ConnectionOptions,
});

// function to add a job to the queue for sending verification email
export async function queueVerificationEmail(
  email: string,
  verificationLink: string
): Promise<void> {
  await emailQueue.add(
    'sendVerificationEmail',
    {
      email,
      link: verificationLink,
    }, // job payload
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
      removeOnFail: false,
    } // job options
  );

  console.log(`Verification email job added to the queue for ${email}`);
}

// function to add a job to the queue for sending welcome email
export async function queueWelcomeEmail(email: string): Promise<void> {
  await emailQueue.add(
    'sendWelcomeEmail',
    {
      email,
    }, // job payload
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
      removeOnFail: false,
    } // job options
  );

  console.log(`Welcome email job added to the queue for ${email}`);
}

// function to add a job to the queue for sending password reset email
export async function queuePasswordResetEmail(
  email: string,
  resetLink: string
): Promise<void> {
  await emailQueue.add(
    'sendPasswordResetEmail',
    {
      email,
      link: resetLink,
    }, // job payload
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
      removeOnFail: false,
    } // job options
  );

  console.log(`Password reset email job added to the queue for ${email}`);
}
