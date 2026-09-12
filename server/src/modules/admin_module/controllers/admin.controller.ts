import { Request, Response, NextFunction } from 'express';
import { isValidObjectId } from 'mongoose';
import {
  getSystemStats,
  getUsersList,
  grantUserCreditsAdmin,
} from '../services/admin.service.ts';
import { recordAudit } from '../../authentication_module/utils/auth.helpers.ts';

export async function getAdminStatsController(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const stats = await getSystemStats();
    return res.status(200).json({ success: true, stats });
  } catch (error) {
    next(error);
  }
}

export async function getAdminUsersController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = (req.query.search as string) || undefined;

    const data = await getUsersList(page, limit, search);
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    next(error);
  }
}

export async function grantCreditsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { userId } = req.params as { userId: string };
    const { amount } = req.body;

    if (!isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid target user ID' });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be a positive number' });
    }

    const result = await grantUserCreditsAdmin(userId, amount, req.user!.id);

    await recordAudit({
      user: req.user!.id,
      event: 'admin_granted_credits',
      req,
      meta: { targetUserId: userId, amount },
    });

    return res.status(200).json({ success: true, result });
  } catch (error) {
    next(error);
  }
}
