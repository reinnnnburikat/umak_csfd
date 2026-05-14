'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/components/providers/session-provider';
import { toast } from 'sonner';

export interface NotificationEvent {
  id: string;
  type: string;
  message: string;
  referenceId: string | null;
  referenceType: string | null;
  createdAt: string;
}

export interface DataRefreshEvent {
  module: string;
  action: string;
  recordId?: string;
}

interface NotificationContextType {
  unreadCount: number;
  lastNotification: NotificationEvent | null;
  lastRefreshEvent: DataRefreshEvent | null;
  isConnected: boolean;
  decrementUnread: (count?: number) => void;
  resetUnread: () => void;
  refreshUnreadCount: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  unreadCount: 0,
  lastNotification: null,
  lastRefreshEvent: null,
  isConnected: false,
  decrementUnread: () => {},
  resetUnread: () => {},
  refreshUnreadCount: async () => {},
});

export function useNotificationContext() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastNotification, setLastNotification] = useState<NotificationEvent | null>(null);
  const [lastRefreshEvent, setLastRefreshEvent] = useState<DataRefreshEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/count');
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch {
      // Silently fail
    }
  }, []);

  // Fetch initial unread count
  useEffect(() => {
    if (!isAuthenticated) return;
    const timer = setTimeout(() => refreshUnreadCount(), 0);
    return () => clearTimeout(timer);
  }, [isAuthenticated, refreshUnreadCount]);

  // Socket.IO connection
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const socketInstance = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 10000,
    });

    socketRef.current = socketInstance;

    socketInstance.on('connect', () => {
      setIsConnected(true);
      socketInstance.emit('authenticate', {
        userId: user.id,
        role: user.role,
      });
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    socketInstance.on('notification', (notification: NotificationEvent) => {
      setLastNotification(notification);
      setUnreadCount((prev) => prev + 1);

      // Show toast notification
      const typeLabels: Record<string, string> = {
        status_change: '📋 Status Update',
        request_issued: '✅ Request Issued',
        request_hold: '⏸️ Request On Hold',
        request_rejected: '❌ Request Rejected',
        complaint_update: '📝 Complaint Update',
        announcement: '📢 Announcement',
        info: 'ℹ️ Info',
      };

      toast.info(notification.message, {
        description: typeLabels[notification.type] || notification.type,
        duration: 5000,
      });
    });

    socketInstance.on('data-refresh', (event: DataRefreshEvent) => {
      setLastRefreshEvent(event);
    });

    return () => {
      socketInstance.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, user?.id, user?.role]);

  // Periodic sync of unread count (fallback for multi-tab consistency)
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => {
      refreshUnreadCount();
    }, 30000); // Sync every 30 seconds
    return () => clearInterval(interval);
  }, [isAuthenticated, refreshUnreadCount]);

  const decrementUnread = useCallback((count: number = 1) => {
    setUnreadCount((prev) => Math.max(0, prev - count));
  }, []);

  const resetUnread = useCallback(() => {
    setUnreadCount(0);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        lastNotification,
        lastRefreshEvent,
        isConnected,
        decrementUnread,
        resetUnread,
        refreshUnreadCount,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
