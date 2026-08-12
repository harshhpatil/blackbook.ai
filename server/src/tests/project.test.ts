/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// 1. MOCK AUTH
vi.mock(
  '../modules/authentication_module/middlewares/auth.middleware.ts',
  () => ({
    authenticate: (req: any, res: any, next: any) => {
      req.user = { id: '507f1f77bcf86cd799439011', email: 'test@blackbook.ai' };
      next();
    },
  })
);

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
import {
  dbConnection,
  closeDbConnection,
} from '../core/config/dbConnection.ts';

describe('Project API CRUD Operations', () => {
  // We will store the ID of the project we create to test fetching, updating, and deleting it
  let createdProjectId: string;

  beforeAll(async () => {
    await dbConnection();
  });

  afterAll(async () => {
    await closeDbConnection();
  });

  // ==========================================
  // 1. CREATE (POST)
  // ==========================================
  describe('POST /api/v1/projects', () => {
    it('should create a new project successfully', async () => {
      const payload = {
        title: 'My First Test Project',
        description: 'Testing the modular monolith',
      };

      const response = await request(app)
        .post('/api/v1/projects')
        .set('Origin', 'http://localhost:5173')
        .send(payload);

      expect(response.status).toBe(201);
      expect(response.body.project).toBeDefined();
      expect(response.body.project.title).toBe(payload.title);

      // Save the ID so the next tests can use it!
      createdProjectId = response.body.project._id;
    });

    it('should fail to create a project without a title (400)', async () => {
      const payload = { description: 'Missing a title' };

      const response = await request(app)
        .post('/api/v1/projects')
        .set('Origin', 'http://localhost:5173')
        .send(payload);

      expect(response.status).toBe(400);
    });
  });

  // ==========================================
  // 2. READ (GET)
  // ==========================================
  describe('GET /api/v1/projects', () => {
    it('should fetch all projects for the user', async () => {
      const response = await request(app)
        .get('/api/v1/projects')
        .set('Origin', 'http://localhost:5173');

      expect(response.status).toBe(200);

      // Ensure it returns an array (adjust based on your actual response structure, e.g., response.body.data)
      const projects = response.body.projects || response.body.data;
      expect(Array.isArray(projects)).toBe(true);
      expect(projects.length).toBeGreaterThan(0);
    });

    it('should fetch a single project by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/projects/${createdProjectId}`)
        .set('Origin', 'http://localhost:5173');

      expect(response.status).toBe(200);
      expect(response.body.project._id).toBe(createdProjectId);
    });

    it('should return 404 for a non-existent project', async () => {
      const fakeMongoId = '507f1f77bcf86cd799439099'; // Valid format, but doesn't exist
      const response = await request(app)
        .get(`/api/v1/projects/${fakeMongoId}`)
        .set('Origin', 'http://localhost:5173');

      expect(response.status).toBe(404);
    });
  });

  // ==========================================
  // 3. UPDATE (PATCH / PUT)
  // ==========================================
  describe('PATCH /api/v1/projects/:id', () => {
    it('should update the project title', async () => {
      const updatePayload = { title: 'Updated Title via Test' };

      const response = await request(app)
        // Note: Change `.patch` to `.put` if your routes use router.put()
        .patch(`/api/v1/projects/${createdProjectId}`)
        .set('Origin', 'http://localhost:5173')
        .send(updatePayload);

      expect(response.status).toBe(200);
      expect(response.body.project.title).toBe(updatePayload.title);
    });
  });

  // ==========================================
  // 4. DELETE (DELETE)
  // ==========================================
  describe('DELETE /api/v1/projects/:id', () => {
    it('should delete the project successfully', async () => {
      const response = await request(app)
        .delete(`/api/v1/projects/${createdProjectId}`)
        .set('Origin', 'http://localhost:5173');

      // Standard REST APIs usually return 200 (OK) or 204 (No Content) on delete
      expect([200, 204]).toContain(response.status);
    });

    it('should return 404 when trying to fetch the deleted project', async () => {
      const response = await request(app)
        .get(`/api/v1/projects/${createdProjectId}`)
        .set('Origin', 'http://localhost:5173');

      expect(response.status).toBe(404);
    });
  });
});
