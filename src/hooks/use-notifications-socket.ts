'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/components/providers/session-provider';

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

export function useNotificationsSocket() {
  const { user, isAuthenticated } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastNotification, setLastNotification] = useState<NotificationEvent | null>(null);
  const [lastRefreshEvent, setLastRefreshEvent] = useState<DataRefreshEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    // Connect to Socket.IO relay
    // Using Caddy gateway pattern: path / with XTransformPort query param
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
      // Authenticate with user info
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
    });

    socketInstance.on('data-refresh', (event: DataRefreshEvent) => {
      setLastRefreshEvent(event);
    });

    return () => {
      socketInstance.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, user?.id, user?.role]);

  // Fetch initial unread count
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchUnreadCount = async () => {
      try {
        const res = await fetch('/api/notifications/count');
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.unreadCount ?? 0);
        }
      } catch {
        // Silently fail
      }
    };

    fetchUnreadCount();
  }, [isAuthenticated]);

  const decrementUnread = useCallback((count: number = 1) => {
    setUnreadCount((prev) => Math.max(0, prev - count));
  }, []);

  const resetUnread = useCallback(() => {
    setUnreadCount(0);
  }, []);

  return {
    unreadCount,
    lastNotification,
    lastRefreshEvent,
    isConnected,
    decrementUnread,
    resetUnread,
  };
}
