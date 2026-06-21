import type {
  ClientRateLimitInfo,
  IncrementResponse,
  Options,
  Store,
} from 'express-rate-limit';
import { getRedisConnection } from '../config/redisConnection.ts';

export class RedisRateLimitStore implements Store {
  localKeys = false;
  prefix: string;
  windowMs = 60_000;

  constructor(prefix: string) {
    this.prefix = `rate-limit:${prefix}:`;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  async increment(key: string): Promise<IncrementResponse> {
    const redis = getRedisConnection();
    const redisKey = `${this.prefix}${key}`;
    const totalHits = await redis.incr(redisKey);

    if (totalHits === 1) {
      await redis.pexpire(redisKey, this.windowMs);
    }

    const ttl = await redis.pttl(redisKey);
    const resetTime = new Date(Date.now() + Math.max(ttl, 0));

    return { totalHits, resetTime };
  }

  async decrement(key: string): Promise<void> {
    const redis = getRedisConnection();
    const redisKey = `${this.prefix}${key}`;
    const value = await redis.decr(redisKey);

    if (value <= 0) {
      await redis.del(redisKey);
    }
  }

  async resetKey(key: string): Promise<void> {
    await getRedisConnection().del(`${this.prefix}${key}`);
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const redis = getRedisConnection();
    const redisKey = `${this.prefix}${key}`;
    const [value, ttl] = await Promise.all([
      redis.get(redisKey),
      redis.pttl(redisKey),
    ]);

    if (!value) return undefined;

    return {
      totalHits: Number(value),
      resetTime: new Date(Date.now() + Math.max(ttl, 0)),
    };
  }
}
