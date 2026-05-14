'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useSocket } from '@/hooks/use-socket';

type DataModule = 'complaints' | 'service-requests' | 'announcements' | 'dashboard';

/**
 * Hook that listens for real-time data changes and calls a refresh callback.
 * Useful for pages that need to refresh their data when changes happen elsewhere.
 */
export function useRealtimeData(
  modules: DataModule[],
  onRefresh: () => void | Promise<void>,
) {
  const { on } = useSocket();
  // Update ref in effect to avoid accessing ref during render
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  // Stable key for the modules array to avoid unnecessary re-subscriptions
  const modulesKey = modules.join(',');

  useEffect(() => {
    const cleanup = on('data-changed', (data: { module: string; action: string; recordId?: string }) => {
      if (modules.includes(data.module as DataModule)) {
        // Debounce: wait 500ms before refreshing to avoid rapid successive refreshes
        setTimeout(() => {
          onRefreshRef.current();
        }, 500);
      }
    });

    return cleanup;
  }, [on, modulesKey]);
}
