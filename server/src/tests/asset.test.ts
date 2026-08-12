/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// 1. MOCK AUTH
vi.mock('../modules/authentication_module/middlewares/auth.middleware.ts', () => ({
  authenticate: (req: any, res: any, next: any) => {
    // We use the exact same fake user ID so it's predictable
    req.user = { id: '507f1f77bcf86cd799439011', email: 'test@blackbook.ai' };
    next();
  },
}));

// 2. MOCK CSRF
vi.mock('../core/middlewares/csrf.middleware.ts', () => ({
  csrfProtection: (req: any, res: any, next: any) => next(),
  issueCsrfToken: (req: any, res: any) => res.json({ csrfToken: 'fake-token' }),
}));

// 3. MOCK SECURITY
vi.mock('../core/middlewares/security.middleware.ts', () => ({
  verifyRequestOrigin: (req: any, res: any, next: any) => next(),
  isAllowedOrigin: () => true,
}));

import request from 'supertest';
import app from '../app.ts';
import { dbConnection, closeDbConnection } from '../core/config/dbConnection.ts';

// TODO: Import your Asset model here so you can seed a fake asset for the 200 OK test
// import { Asset } from '../modules/assets_module/models/Asset.model.ts';

describe('Asset API', () => {
  beforeAll(async () => {
    await dbConnection();
  });

  afterAll(async () => {
    await closeDbConnection();
  });

  describe('GET /api/v1/assets/:assetId/download', () => {
    
    it('should return 404 if the asset does not exist', async () => {
      const fakeMongoId = '507f1f77bcf86cd799439099'; // Valid format, but doesn't exist in DB
      
      const response = await request(app)
        .get(`/api/v1/assets/${fakeMongoId}/download`)
        .set('Origin', 'http://localhost:5173');

      expect(response.status).toBe(404);
    });

    it('should return 400 for an invalid asset ID format', async () => {
      // Sending a non-MongoDB ID string to see if your validation catches it
      const response = await request(app)
        .get(`/api/v1/assets/invalid-id-format/download`)
        .set('Origin', 'http://localhost:5173');

      // Assuming your validation (e.g., Zod or Mongoose) catches bad ObjectIds
      expect(response.status).toBe(400); 
    });

    // ==========================================
    // THE HAPPY PATH (Needs a seeded asset)
    // ==========================================
    /*
    it('should download the asset successfully', async () => {
      // 1. Create a fake asset in the database assigned to our mocked user
      const fakeAsset = await Asset.create({
        userId: '507f1f77bcf86cd799439011',
        filename: 'test-document.pdf',
        fileUrl: 'https://fake-s3-bucket.amazonaws.com/test-document.pdf',
        // ... add any other fields your Asset schema requires
      });

      // 2. Request the download endpoint using the ID of the asset we just created
      const response = await request(app)
        .get(`/api/v1/assets/${fakeAsset._id}/download`)
        .set('Origin', 'http://localhost:5173');

      // 3. Assert success
      expect(response.status).toBe(200);
      
      // Optional: Check if the server sets the correct file download headers
      // expect(response.header['content-disposition']).toContain('attachment');
    });
    */
  });
});