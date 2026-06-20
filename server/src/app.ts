import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.ts';
import { checkRedisConnection } from './config/redisConnection.ts';
import { isDbReady } from './config/dbConnection.ts';

// importing the global error handler middleware to handle unhandled errors in the application
import errorHandler from './middlewares/errorHandeler.middleware.ts';

// importing the routes fron the routes directory
import authRoutes from './routes/auth.routes.ts';

const app: Application = express();
const allowedOrigins = env.corsOrigins;

if (env.trustProxy) {
  app.set('trust proxy', env.trustProxy);
}

const isAllowedOrigin = (origin?: string): boolean => {
  if (!origin) return true;
  return allowedOrigins.includes(origin);
};

const verifyRequestOrigin = (
  req: Request,
  res: Response,
  next: express.NextFunction
): void | Response => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const origin = req.get('origin');
  if (origin && !isAllowedOrigin(origin)) {
    return res.status(403).json({ message: 'forbidden origin' });
  }

  return next();
};

// middleware
app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        return callback(null, origin ?? false);
      }

      return callback(new Error('Origin is not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(verifyRequestOrigin);

// defining the routes for the application
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    message: 'blackbook express app is configured.',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/ready', async (_req: Request, res: Response) => {
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

app.use('/api/v1/auth', authRoutes);

// global error handler middleware to handle unhandled errors in the application
app.use(errorHandler);

export default app;
