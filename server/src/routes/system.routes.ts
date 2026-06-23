import { Router, Request, Response } from 'express';
import { isDbReady } from '../config/dbConnection.ts';
import { checkRedisConnection } from '../config/redisConnection.ts';

const router = Router();

// defining the system routes
// health check route to verify that the server is up and running
router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    message: 'blackbook express app is configured & running successfully',
    timestamp: new Date().toISOString(),
  });
});

// ready check route to verify that the server and its dependencies are ready to handle requests
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
