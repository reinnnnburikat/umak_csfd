'use client';

import { useEffect, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNotificationContext } from '@/components/providers/notification-provider';

/**
 * Hook that listens for data-refresh events from Socket.IO
 * and triggers a callback when relevant data changes.
 */
export function useDataRefresh(modules: string[], onRefresh: () => void) {
  const { lastRefreshEvent } = useNotificationContext();
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (lastRefreshEvent && modules.includes(lastRefreshEvent.module)) {
      const startTimer = setTimeout(() => setIsRefreshing(true), 0);
      onRefresh();
      // Small delay to show refresh indicator
      const endTimer = setTimeout(() => setIsRefreshing(false), 1000);
      return () => {
        clearTimeout(startTimer);
        clearTimeout(endTimer);
      };
    }
  }, [lastRefreshEvent, modules, onRefresh]);

  return { isRefreshing };
}

/**
 * Enhanced version that invalidates React Query caches on data-refresh events.
 * Use this in pages that have migrated to React Query — it automatically
 * refetches the relevant query keys when a Socket.IO data-refresh event arrives.
 */
export function useQueryInvalidation(modules: string[]) {
  const queryClient = useQueryClient();
  const { lastRefreshEvent } = useNotificationContext();

  useEffect(() => {
    if (lastRefreshEvent && modules.includes(lastRefreshEvent.module)) {
      // Map module names to query key prefixes
      const moduleToKeys: Record<string, string[][]> = {
        complaints: [['complaints']],
        disciplinary: [['disciplinary']],
        'service-requests': [['service-requests']],
        reports: [['reports']],
        notifications: [['notifications']],
        dashboard: [['dashboard']],
      };

      const keys = moduleToKeys[lastRefreshEvent.module];
      if (keys) {
        keys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
      }
    }
  }, [lastRefreshEvent, modules, queryClient]);
}
