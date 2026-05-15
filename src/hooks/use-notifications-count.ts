'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './use-api';

// ─── Response Types ───────────────────────────────────────────

export interface NotificationCountResponse {
  unreadCount: number;
}

// ─── Hook ─────────────────────────────────────────────────────

export function useNotificationCount() {
  return useQuery<NotificationCountResponse>({
    queryKey: ['notifications', 'count'],
    queryFn: () => apiFetch<NotificationCountResponse>('/api/notifications/count'),
    staleTime: 15_000,
    // No refetchInterval — NotificationProvider already polls every 30s
  });
}
