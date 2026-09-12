import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet'; // Added for secure HTTP headers

// importing the configs and middlewares
import { env } from './core/config/env.ts';
import errorHandler from './core/middlewares/errorHandeler.middleware.ts';
import { requestLogger } from './core/middlewares/logger.middleware.ts'; // Fixed path
import { globalApiLimiter } from './core/middlewares/rateLimiter.middleware.ts'; // Added rate limiter
import {
  verifyRequestOrigin,
  isAllowedOrigin,
} from './core/middlewares/security.middleware.ts';

// importing the core routes (Fixed paths to match your `modules` tree)
import systemRoutes from './modules/system_module/system.routes.ts';
import authRoutes from './modules/authentication_module/auth.routes.ts';
import paymentRoutes from './modules/payment_module/payment.routes.ts';
import templateRoutes from './modules/template_engine_module/template.routes.ts';
import assetRoutes from './modules/assets_module/asset.routes.ts';
import projectRoutes from './modules/project_module/project.routes.ts';
import userRoutes from './modules/user_profile_module/user.routes.ts';
import notificationRoutes from './modules/notification_module/notification.routes.ts';
import creditsRoutes from './modules/credits_module/credits.routes.ts';
import adminRoutes from './modules/admin_module/admin.routes.ts';

const app: Application = express();
const developmentLocalhostOrigin = /^http:\/\/localhost:[0-9]+$/;

app.use(requestLogger); // global request logging middleware

// server settings
if (env.TRUST_PROXY) {
  app.set('trust proxy', env.TRUST_PROXY);
}

// global security and parsing middlewares
app.use(helmet()); // Protects against common web vulnerabilities
app.use(globalApiLimiter); // Prevents brute-force/DDoS on the API layer

app.use(
  cors({
    origin(origin, callback) {
      const isDevelopmentLocalhost =
        env.NODE_ENV === 'development' &&
        !!origin &&
        developmentLocalhostOrigin.test(origin);

      if (
        env.NODE_ENV === 'test' ||
        !origin ||
        isAllowedOrigin(origin) ||
        isDevelopmentLocalhost
      ) {
        return callback(null, true);
      }
      return callback(new Error('Origin is not allowed by CORS'));
    },
    credentials: true,
  })
);

// parsing middlewares
// store raw body for webhook verification
app.use(
  express.json({
    verify: (req, _res, buf) => {
      const expressReq = req as Request;

      if (expressReq.originalUrl.split('?')[0] === '/api/v1/payment/webhook') {
        expressReq.rawBody = buf;
      }
    },
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(verifyRequestOrigin);

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// application routes
app.use('/api', systemRoutes);
app.use('/api/v1/template-engine', templateRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/payment', paymentRoutes);
app.use('/api/v1/assets', assetRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/credits', creditsRoutes);
app.use('/api/v1/admin', adminRoutes);

// global error handler middleware
app.use(errorHandler);

export default app; // exporting the app for server startup and testing
