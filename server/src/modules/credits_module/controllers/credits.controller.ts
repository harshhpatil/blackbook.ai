import { Request, Response, NextFunction } from 'express';
import { getCreditHistory } from '../services/credits.service.ts';

export async function getCreditsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const data = await getCreditHistory(req.user!.id, page, limit);
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    next(error);
  }
}
