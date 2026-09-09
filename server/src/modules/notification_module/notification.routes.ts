import { Router } from 'express';
import { authenticate } from '../authentication_module/middlewares/auth.middleware.ts';
import { csrfProtection } from '../../core/middlewares/csrf.middleware.ts';
import {
  getNotificationsController,
  markAsReadController,
  markAllAsReadController,
  streamNotificationsController,
} from './controllers/notification.controller.ts';

const router = Router();

router.use(authenticate);

router.get('/', getNotificationsController);
router.get('/stream', streamNotificationsController);
router.patch('/:notificationId/read', csrfProtection, markAsReadController);
router.post('/mark-all-read', csrfProtection, markAllAsReadController);

export default router;
