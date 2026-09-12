"use client";

import { useState, useEffect } from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";

interface NotificationItem {
  _id: string;
  title: string;
  message: string;
  isRead?: boolean;
  read?: boolean;
  type?: string;
  createdAt: string;
}

export function NotificationsPopover() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.notifications.getNotifications();
      const items = Array.isArray(res.notifications) ? res.notifications : Array.isArray(res) ? res : [];
      if (items.length >= 0) {
        setNotifications(items);
      } else if (Array.isArray(res)) {
        setNotifications(res);
      }
    } catch {
      // Failed to load notifications
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, []);

  const isRead = (notification: NotificationItem) => notification.isRead ?? notification.read ?? false;
  const unreadCount = notifications.filter((n) => !isRead(n)).length;

  const handleMarkRead = async (id: string) => {
    try {
      await api.notifications.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true, read: true } : n))
      );
    } catch {
      // Failed to mark read
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.notifications.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, read: true })));
    } catch {
      // Failed to mark all read
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-white/70 hover:text-white">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 border-[#222] bg-[#111] text-white p-0 shadow-xl" align="end">
        <div className="flex items-center justify-between border-b border-[#222] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <Badge variant="primary" className="text-[10px] px-1.5 py-0">
                {unreadCount} new
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <CheckCheck className="h-3 w-3" /> Mark all read
            </button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto divide-y divide-[#222]">
          {loading && notifications.length === 0 ? (
            <div className="flex justify-center py-6 text-white/40">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-8 text-center text-xs text-white/40">
              No notifications yet
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item._id}
                onClick={() => !isRead(item) && handleMarkRead(item._id)}
                className={`p-3.5 transition-colors cursor-pointer hover:bg-white/5 ${
                  !isRead(item) ? "bg-blue-500/5" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={`text-xs font-medium ${isRead(item) ? "text-white/70" : "text-white font-semibold"}`}>
                    {item.title || "Notification"}
                  </span>
                  {!isRead(item) && <span className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-1 shrink-0" />}
                </div>
                <p className="text-xs text-white/50 mt-1 leading-relaxed">{item.message}</p>
                <span className="text-[10px] text-white/30 mt-2 block">
                  {new Date(item.createdAt).toLocaleDateString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
