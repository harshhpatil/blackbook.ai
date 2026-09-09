import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../authentication_module/middlewares/auth.middleware.ts';
import { csrfProtection } from '../../core/middlewares/csrf.middleware.ts';
import validate from '../../core/middlewares/validate.middleware.ts';
import { updateProfileSchema } from './schemas/profile.validation.ts';
import {
  getProfileController,
  updateProfileController,
  uploadAvatarController,
  exportDataController,
  deleteAccountController,
} from './controllers/profile.controller.ts';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max avatar size
});

const router = Router();

router.use(authenticate);

router.get('/me', getProfileController);
router.patch('/me', csrfProtection, validate(updateProfileSchema), updateProfileController);
router.post('/me/avatar', csrfProtection, upload.single('avatar'), uploadAvatarController);
router.get('/me/export-data', exportDataController);
router.delete('/me', csrfProtection, deleteAccountController);

export default router;
