/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';

// MOCK AUTH
vi.mock('../modules/authentication_module/middlewares/auth.middleware.ts', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: '507f1f77bcf86cd799439011', role: 'user', email: 'user@blackbook.ai' };
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

describe('User Profile API Suite', () => {
  describe('PATCH /api/v1/users/me', () => {
    it('should validate invalid profile update payloads', async () => {
      const response = await request(app)
        .patch('/api/v1/users/me')
        .send({ bio: 'a'.repeat(600) }); // Exceeds max length

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/v1/users/me/avatar', () => {
    it('should return 400 when no image is uploaded', async () => {
      const response = await request(app).post('/api/v1/users/me/avatar');
      expect(response.status).toBe(400);
    });
  });
});
