/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';

// 1. MOCK CSRF
vi.mock('../core/middlewares/csrf.middleware.ts', () => ({
  csrfProtection: (_req: any, _res: any, next: any) => next(),
  issueCsrfToken: (_req: any, res: any) => res.json({ csrfToken: 'fake-csrf-token' }),
}));

// 2. MOCK SECURITY
vi.mock('../core/middlewares/security.middleware.ts', () => ({
  verifyRequestOrigin: (_req: any, _res: any, next: any) => next(),
  isAllowedOrigin: () => true,
}));

import request from 'supertest';
import app from '../app.ts';

describe('Authentication API Suite', () => {
  describe('GET /api/v1/auth/csrf-token', () => {
    it('should issue a CSRF token', async () => {
      const response = await request(app).get('/api/v1/auth/csrf-token');
      expect(response.status).toBe(200);
      expect(response.body.csrfToken).toBe('fake-csrf-token');
    });
  });

  describe('POST /api/v1/auth/register', () => {
    it('should return 400 when email or password is missing', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'invalid-email', password: 'Password123!' });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should return 400 when missing login fields', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    it('should validate missing email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/send-otp', () => {
    it('should return 400 for invalid mobile number format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/send-otp')
        .send({ mobileNumber: '12345' });

      expect(response.status).toBe(400);
    });
  });
});
