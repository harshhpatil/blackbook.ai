import { Request, Response, NextFunction } from 'express';
import { isValidObjectId } from 'mongoose';
import {
  registerSseClient,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../services/notification.service.ts';

export async function getNotificationsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const data = await getUserNotifications(req.user!.id, page, limit);
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    next(error);
  }
}

export async function markAsReadController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { notificationId } = req.params as { notificationId: string };
    if (!isValidObjectId(notificationId)) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    const notification = await markNotificationAsRead(notificationId, req.user!.id);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    return res.status(200).json({ success: true, notification });
  } catch (error) {
    next(error);
  }
}

export async function markAllAsReadController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    await markAllNotificationsAsRead(req.user!.id);
    return res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
}

export function streamNotificationsController(req: Request, res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send initial ping event
  res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', timestamp: new Date() })}\n\n`);

  const unregister = registerSseClient(req.user!.id, res);

  req.on('close', () => {
    unregister();
  });
}
