import { Response } from 'express';
import {
  Notification,
  INotification,
  NotificationType,
} from '../models/Notification.model.ts';
import { createLogger } from '../../../core/lib/logger.ts';

const log = createLogger('notification-service');

// Store active Server-Sent Events connections by userId
const sseClients = new Map<string, Set<Response>>();

export function registerSseClient(userId: string, res: Response): () => void {
  if (!sseClients.has(userId)) {
    sseClients.set(userId, new Set());
  }

  const clientSet = sseClients.get(userId)!;
  clientSet.add(res);

  log.info({ userId, totalConnections: clientSet.size }, 'Registered SSE client connection');

  // Cleanup function on connection close
  return () => {
    clientSet.delete(res);
    if (clientSet.size === 0) {
      sseClients.delete(userId);
    }
    log.info({ userId }, 'Cleaned up SSE client connection');
  };
}

export async function createAndSendNotification({
  userId,
  title,
  message,
  type = 'info',
  link,
}: {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  link?: string;
}): Promise<INotification> {
  const notification = await Notification.create({
    user: userId,
    title,
    message,
    type,
    link,
  });

  // Broadcast to active real-time SSE stream if client is online
  const clientSet = sseClients.get(userId.toString());
  if (clientSet && clientSet.size > 0) {
    const payload = JSON.stringify(notification.toObject());
    clientSet.forEach((res) => {
      try {
        res.write(`event: notification\ndata: ${payload}\n\n`);
      } catch {
        // Socket stream may have closed
      }
    });
    log.info({ userId, title }, 'Real-time notification pushed via SSE stream');
  }

  return notification;
}

export async function getUserNotifications(
  userId: string,
  page = 1,
  limit = 20
) {
  const skip = (page - 1) * limit;
  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Notification.countDocuments({ user: userId }),
    Notification.countDocuments({ user: userId, isRead: false }),
  ]);

  return {
    notifications,
    unreadCount,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function markNotificationAsRead(
  notificationId: string,
  userId: string
): Promise<INotification | null> {
  return Notification.findOneAndUpdate(
    { _id: notificationId, user: userId },
    { $set: { isRead: true } },
    { new: true }
  );
}

export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  await Notification.updateMany({ user: userId, isRead: false }, { $set: { isRead: true } });
}
