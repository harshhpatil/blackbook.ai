import { Router } from 'express';
import { authenticate } from '../authentication_module/middlewares/auth.middleware.ts';
import { requireAdmin } from './middlewares/admin.middleware.ts';
import { csrfProtection } from '../../core/middlewares/csrf.middleware.ts';
import {
  getAdminStatsController,
  getAdminUsersController,
  grantCreditsController,
} from './controllers/admin.controller.ts';

const router = Router();

router.use(authenticate);
router.use(requireAdmin);

router.get('/stats', getAdminStatsController);
router.get('/users', getAdminUsersController);
router.post('/users/:userId/credits', csrfProtection, grantCreditsController);

export default router;
