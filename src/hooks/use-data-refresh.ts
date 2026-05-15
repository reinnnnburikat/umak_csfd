'use client';

import { useEffect, useCallback, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNotificationContext } from '@/components/providers/notification-provider';

/**
 * Hook that listens for data-refresh events from Socket.IO
 * and triggers a callback when relevant data changes.
 *
 * Uses refreshEventId (monotonically increasing counter) to ensure
 * each event is only handled once, even when components re-mount.
 */
export function useDataRefresh(modules: string[], onRefresh: () => void) {
  const { lastRefreshEvent, refreshEventId } = useNotificationContext();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const onRefreshRef = useRef(onRefresh);
  const lastHandledIdRef = useRef(0);
  const modulesRef = useRef(modules);

  // Keep refs current without triggering the main effect
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    modulesRef.current = modules;
  }, [modules]);

  useEffect(() => {
    // Only process if this is a genuinely NEW event (not already handled)
    if (refreshEventId > lastHandledIdRef.current && lastRefreshEvent) {
      if (modulesRef.current.includes(lastRefreshEvent.module)) {
        lastHandledIdRef.current = refreshEventId;
        const startTimer = setTimeout(() => setIsRefreshing(true), 0);
        onRefreshRef.current();
        // Small delay to show refresh indicator
        const endTimer = setTimeout(() => setIsRefreshing(false), 1000);
        return () => {
          clearTimeout(startTimer);
          clearTimeout(endTimer);
        };
      }
    }
  }, [lastRefreshEvent, refreshEventId]);

  return { isRefreshing };
}

/**
 * Enhanced version that invalidates React Query caches on data-refresh events.
 * Use this in pages that have migrated to React Query — it automatically
 * refetches the relevant query keys when a Socket.IO data-refresh event arrives.
 */
export function useQueryInvalidation(modules: string[]) {
  const queryClient = useQueryClient();
  const { lastRefreshEvent, refreshEventId } = useNotificationContext();
  const lastHandledIdRef = useRef(0);
  const modulesRef = useRef(modules);

  useEffect(() => {
    modulesRef.current = modules;
  }, [modules]);

  useEffect(() => {
    // Only process genuinely NEW events
    if (refreshEventId > lastHandledIdRef.current && lastRefreshEvent) {
      if (modulesRef.current.includes(lastRefreshEvent.module)) {
        lastHandledIdRef.current = refreshEventId;

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
    }
  }, [lastRefreshEvent, refreshEventId, queryClient]);
}
