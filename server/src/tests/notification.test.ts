/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';

// MOCK AUTH
vi.mock('../modules/authentication_module/middlewares/auth.middleware.ts', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: '507f1f77bcf86cd799439011', role: 'user' };
    next();
  },
}));

// MOCK CSRF
vi.mock('../core/middlewares/csrf.middleware.ts', () => ({
  csrfProtection: (_req: any, _res: any, next: any) => next(),
}));

// MOCK SECURITY
vi.mock('../core/middlewares/security.middleware.ts', () => ({
  verifyRequestOrigin: (_req: any, _res: any, next: any) => next(),
  isAllowedOrigin: () => true,
}));

import request from 'supertest';
import app from '../app.ts';

describe('Notification API Suite', () => {
  describe('PATCH /api/v1/notifications/:id/read', () => {
    it('should return 404 for invalid notification ID', async () => {
      const response = await request(app).patch('/api/v1/notifications/invalid-id/read');
      expect(response.status).toBe(404);
    });
  });
});
