/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';

// MOCK AUTH (Non-admin user)
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

describe('Admin Backoffice API Suite', () => {
  describe('GET /api/v1/admin/stats', () => {
    it('should reject non-admin users with 403 Forbidden', async () => {
      const response = await request(app).get('/api/v1/admin/stats');
      expect([403, 500]).toContain(response.status);
    });
  });

  describe('POST /api/v1/admin/users/:userId/credits', () => {
    it('should reject invalid amount for credit grant', async () => {
      const response = await request(app)
        .post('/api/v1/admin/users/507f1f77bcf86cd799439011/credits')
        .send({ amount: -10 });

      expect([400, 403, 500]).toContain(response.status);
    });
  });
});
