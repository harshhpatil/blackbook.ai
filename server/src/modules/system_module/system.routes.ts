import { Router, Request, Response } from 'express';
import { isDbReady } from '../../core/config/dbConnection.ts';
import { checkRedisConnection } from '../../core/config/redisConnection.ts';

const router = Router();

/**
 * @route GET /health
 * @description Liveness Probe: Verifies that the Express application process is running.
 * Used by load balancers and container orchestrators (Docker/K8s).
 */
router.get('/health', (_req: Request, res: Response) => {
  return res.status(200).json({
    status: 'success',
    message: 'blackbook express app is configured & running successfully',
    timestamp: new Date().toISOString(),
  });
});

/**
 * @route GET /ready
 * @description Readiness Probe: Verifies that the server and all critical external dependencies
 * (MongoDB, Redis) are fully connected and ready to accept traffic.
 */
router.get('/ready', async (_req: Request, res: Response) => {
  const mongoReady = isDbReady();
  const redisReady = await checkRedisConnection();

  const ready = mongoReady && redisReady;

  return res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    dependencies: {
      mongo: mongoReady ? 'ready' : 'not_ready',
      redis: redisReady ? 'ready' : 'not_ready',
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
