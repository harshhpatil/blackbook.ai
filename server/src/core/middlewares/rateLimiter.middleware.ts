import rateLimit, { Options, ipKeyGenerator } from 'express-rate-limit';
import { RedisRateLimitStore } from '../stores/redisRateLimitStore.ts';

/**
 * Normalizes email addresses from request bodies to ensure consistent rate limit keys.
 */
const normalizeEmail = (value: unknown): string | undefined => {
  return typeof value === 'string' ? value.trim().toLowerCase() : undefined;
};

/**
 * Core factory to generate Express rate limiters backed by Redis.
 * Feature modules should import this utility to define their own domain-specific limiters.
 *
 * @param name - Unique prefix for the Redis keys (e.g., 'login', 'generate-pdf').
 * @param options - express-rate-limit configuration (windowMs, max, message, etc.).
 */
export const createLimiter = (
  name: string,
  options: Partial<Options>
): ReturnType<typeof rateLimit> => {
  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,

    // Fail-open policy: If Redis crashes, requests pass through instead of taking down the API
    passOnStoreError: true,
    store: new RedisRateLimitStore(name),

    // Silences the IPv6 runtime string warning check
    validate: { xForwardedForHeader: false, ip: false },

    // Default key generator: Combines IP and Email (if present) to prevent distributed attacks.
    // Can be overridden in specific routes (e.g., for authenticated user IDs).
    keyGenerator: (req) => {
      // NOTE: req.ip relies on `app.set('trust proxy', 1)` being configured in Express
      const safeIp = req.ip ? ipKeyGenerator(req.ip) : 'unknown-ip';
      const email = normalizeEmail(req.body?.email);

      return email ? `${safeIp}:${email}` : safeIp;
    },
    ...options,
  });
};

/**
 * Global default API rate limiter.
 * Apply this to standard routes to prevent general API abuse.
 */
export const globalApiLimiter = createLimiter('global-api', {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: 'Too many requests, please try again later.',
});
