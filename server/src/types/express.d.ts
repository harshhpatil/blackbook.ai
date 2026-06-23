// types/express.d.ts
import * as express from 'express';

declare global {
  namespace Express {
    interface Request {
      user: {
        id: string;
      };
      rawBody?: Buffer;
    }
  }
}

export {}; // Forces TS to treat this file as a module
