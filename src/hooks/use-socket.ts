'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/components/providers/session-provider';

// Singleton socket instance — only ONE socket connection per browser tab
let socketInstance: Socket | null = null;
let socketRefCount = 0;

export function useSocket() {
  const { user, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    socketRefCount++;

    if (!socketInstance) {
      socketInstance = io('/?XTransformPort=3003', {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 10000,
      });
    }

    socketRef.current = socketInstance;

    const handleConnect = () => {
      setIsConnected(true);
      // Authenticate on connect
      socketInstance?.emit('authenticate', { userId: user.id, role: user.role });
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    socketInstance.on('connect', handleConnect);
    socketInstance.on('disconnect', handleDisconnect);

    // If already connected, authenticate immediately
    if (socketInstance.connected) {
      setIsConnected(true);
      socketInstance.emit('authenticate', { userId: user.id, role: user.role });
    }

    return () => {
      socketInstance?.off('connect', handleConnect);
      socketInstance?.off('disconnect', handleDisconnect);

      socketRefCount--;
      if (socketRefCount <= 0) {
        socketInstance?.disconnect();
        socketInstance = null;
        socketRefCount = 0;
      }
    };
  }, [isAuthenticated, user?.id, user?.role]);

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    socketRef.current?.on(event, handler);
    return () => {
      socketRef.current?.off(event, handler);
    };
  }, []);

  const emit = useCallback((event: string, ...args: any[]) => {
    socketRef.current?.emit(event, ...args);
  }, []);

  return { socket: socketRef.current, isConnected, on, emit };
}
