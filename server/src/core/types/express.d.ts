// types/express.d.ts
import { Logger } from 'pino';

declare global {
  namespace Express {
    interface Request {
      id: string;
      log: Logger;
      user: {
        id: string;
        role: string;
        sessionId: string;
      };
      rawBody?: Buffer;
    }
  }
}

export {}; // Forces TS to treat this file as a module
