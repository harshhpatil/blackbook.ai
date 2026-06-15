import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

// importing the global error handler middleware to handle unhandled errors in the application
import errorHandler from './middlewares/errorHandeler.middleware.ts';

// importing the routes fron the routes directory
import authRoutes from './routes/auth.routes.ts';

const app: Application = express();

// middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// defining the routes for the application
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    message: 'blackbook express app is configured.',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/v1/auth', authRoutes);

// global error handler middleware to handle unhandled errors in the application
app.use(errorHandler);

export default app;
