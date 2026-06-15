import { Redis } from 'ioredis';

if (!process.env.REDIS_URL) {
  console.error('REDIS_URL is not defined in environment variables.');
  process.exit(1);
}
export const redisConnection = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

redisConnection.on('connect', () => {
  console.log('Connected to Redis successfully.');
});

redisConnection.on('error', (err) => {
  console.error('Redis connection error:', err);
});
