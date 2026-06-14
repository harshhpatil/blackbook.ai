import express, { Application, Request, Response } from 'express';
import cors from 'cors';

const app: Application = express();

// middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    message: 'blackbook express app is configured.',
    timestamp: new Date().toISOString(),
  });
});

export default app;
