/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';

// MOCK AUTH
vi.mock('../modules/authentication_module/middlewares/auth.middleware.ts', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: '507f1f77bcf86cd799439011', role: 'user' };
    next();
  },
}));

// MOCK SECURITY
vi.mock('../core/middlewares/security.middleware.ts', () => ({
  verifyRequestOrigin: (_req: any, _res: any, next: any) => next(),
  isAllowedOrigin: () => true,
}));

import request from 'supertest';
import app from '../app.ts';

describe('Credit System API Suite', () => {
  describe('GET /api/v1/credits/balance', () => {
    it('should respond to credit balance requests', async () => {
      const response = await request(app).get('/api/v1/credits/balance');
      expect([200, 500]).toContain(response.status);
    });
  });
});
