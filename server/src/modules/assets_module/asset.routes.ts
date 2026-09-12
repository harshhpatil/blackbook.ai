import { Router } from 'express';
import { authenticate } from '../authentication_module/middlewares/auth.middleware.ts';
import { downloadAsset, getUserAssets, deleteAssetController } from './controllers/asset.controller.ts';
import { csrfProtection } from '../../core/middlewares/csrf.middleware.ts';

const router = Router();

/**
 * System-wide middleware for the asset module.
 * Every route below this line strictly requires a valid, authenticated JWT session.
 */
router.use(authenticate);

router.get('/', getUserAssets);
router.get('/:assetId/download', downloadAsset);
router.delete('/:assetId', csrfProtection, deleteAssetController);

export default router;