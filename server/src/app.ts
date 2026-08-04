import express, { Application, Request } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

// importing the configs and middlewares
import { env } from './config/env.ts';
import errorHandler from './middlewares/errorHandeler.middleware.ts';
import {
  verifyRequestOrigin,
  isAllowedOrigin,
} from './middlewares/security.middleware.ts';

// importing the core routes
import systemRoutes from './routes/system.routes.ts';
import authRoutes from './routes/auth.routes.ts';
import paymentRoutes from './routes/payment.routes.ts';
import templateRoutes from './routes/template.routes.ts';
import assetRoutes from './routes/asset.routes.ts';
import projectRoutes from './routes/project.routes.ts';
import { requestLogger } from './middlewares/logger.middleware.ts';

const app: Application = express();
app.use(requestLogger); // global request logging middleware

// server settings
if (env.TRUST_PROXY) {
  app.set('trust proxy', env.TRUST_PROXY);
}

// global security and parsing middlewares
app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error('origin is not allowed by cors'));
    },
    // The CSRF endpoint sets a cookie which must be accepted by the browser
    // when the client and API are served from different allowed origins.
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

// application routes
app.use('/api', systemRoutes);
app.use('/api', templateRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/payment', paymentRoutes);
app.use('/api/v1/assets', assetRoutes);
app.use('/api/v1/projects', projectRoutes);
// global error handler middleware
app.use(errorHandler);

export default app; // exporting the app for server startup and testing
