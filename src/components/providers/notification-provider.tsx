'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/components/providers/session-provider';
import { useSocket } from '@/hooks/use-socket';
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
  refreshEventId: number; // Monotonically increasing counter — every event gets a unique ID
  isConnected: boolean;
  decrementUnread: (count?: number) => void;
  resetUnread: () => void;
  refreshUnreadCount: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  unreadCount: 0,
  lastNotification: null,
  lastRefreshEvent: null,
  refreshEventId: 0,
  isConnected: false,
  decrementUnread: () => {},
  resetUnread: () => {},
  refreshUnreadCount: async () => {},
});

export function useNotificationContext() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { isConnected, on } = useSocket();
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastNotification, setLastNotification] = useState<NotificationEvent | null>(null);
  const [lastRefreshEvent, setLastRefreshEvent] = useState<DataRefreshEvent | null>(null);
  const [refreshEventId, setRefreshEventId] = useState(0);

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

  // Subscribe to Socket.IO events via the singleton connection
  useEffect(() => {
    if (!isAuthenticated) return;

    const cleanupNotification = on('notification', (_notification: NotificationEvent) => {
      setLastNotification(_notification);

      // Instead of blindly incrementing (causes off-by-one), re-fetch accurate count
      refreshUnreadCount();

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

      toast.info(_notification.message, {
        description: typeLabels[_notification.type] || _notification.type,
        duration: 5000,
      });
    });

    const cleanupRefresh = on('data-refresh', (event: DataRefreshEvent) => {
      setLastRefreshEvent(event);
      // Increment the event counter so consumers know this is a NEW event
      setRefreshEventId((prev) => prev + 1);
    });

    return () => {
      cleanupNotification();
      cleanupRefresh();
    };
  }, [on, isAuthenticated, refreshUnreadCount]);

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
        refreshEventId,
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
