import { Router } from 'express';
import { authenticate } from '../authentication_module/middlewares/auth.middleware.ts';
import { getCreditsController } from './controllers/credits.controller.ts';

const router = Router();

router.use(authenticate);

router.get('/balance', getCreditsController);

export default router;
