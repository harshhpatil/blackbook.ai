import { Router } from 'express';
import { authenticate } from '../authentication_module/middlewares/auth.middleware.ts';
import { downloadAsset } from './controllers/asset.controller.ts';

const router = Router();

/**
 * System-wide middleware for the asset module.
 * Every route below this line strictly requires a valid, authenticated JWT session.
 */
router.use(authenticate);

/**
 * @route GET /:assetId/download
 * @description Downloads a specific file asset (PDF, DOCX, etc.).
 * @access Protected (Owner only)
 */
router.get('/:assetId/download', downloadAsset);

export default router;