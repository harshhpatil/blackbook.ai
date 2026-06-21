export {};

declare global {
  namespace Express {
    interface User {
      id: string;
      role: 'user' | 'admin';
      sessionId: string;
    }

    interface Request {
      user?: User;
    }
  }
}
