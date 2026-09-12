import type {
  ClientRateLimitInfo,
  IncrementResponse,
  Options,
  Store,
} from 'express-rate-limit';
import { getRateLimitRedisConnection } from '../config/redisConnection.ts';

/**
 * Custom Redis store for express-rate-limit.
 * Facilitates distributed rate limiting across multiple server instances.
 */
export class RedisRateLimitStore implements Store {
  // required by express-rate-limit to indicate keys are stored externally.
  localKeys = false;  

  prefix: string;
  windowMs = 60_000;

  constructor(prefix: string) {
    this.prefix = `rate-limit:${prefix}:`;
    // Establish the dedicated client at application startup, rather than
    // forcing the first rate-limited request to race the TLS handshake.
    getRateLimitRedisConnection();
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  async increment(key: string): Promise<IncrementResponse> {
    const redis = getRateLimitRedisConnection();
    const redisKey = `${this.prefix}${key}`;

    const totalHits = await redis.incr(redisKey);

    // Set TTL only when the key is first created.
    if (totalHits === 1) {
      await redis.pexpire(redisKey, this.windowMs);
    }

    const ttl = await redis.pttl(redisKey);

    return {
      totalHits,
      resetTime: new Date(Date.now() + Math.max(ttl, 0)),
    };
  }

  async decrement(key: string): Promise<void> {
    const redis = getRateLimitRedisConnection();
    const redisKey = `${this.prefix}${key}`;

    const value = await redis.decr(redisKey);

    if (value <= 0) {
      await redis.del(redisKey);
    }
  }

  async resetKey(key: string): Promise<void> {
    await getRateLimitRedisConnection().del(`${this.prefix}${key}`);
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const redis = getRateLimitRedisConnection();
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
