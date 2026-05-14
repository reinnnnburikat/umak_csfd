'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  BellOff,
  AlertCircle,
  CheckCircle2,
  Info,
  AlertTriangle,
  FileText,
  Megaphone,
  CheckCheck,
  Clock,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useNotificationContext } from '@/components/providers/notification-provider';
import { useQueryInvalidation } from '@/hooks/use-data-refresh';

interface Notification {
  id: string;
  userId: string;
  type: string;
  message: string;
  isRead: boolean;
  referenceId: string | null;
  referenceType: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: Notification[];
  total: number;
  page: number;
  totalPages: number;
}

const typeIcons: Record<string, React.ReactNode> = {
  status_change: <AlertCircle className="size-4 text-status-pending" />,
  request_issued: <CheckCircle2 className="size-4 text-status-approved" />,
  request_hold: <AlertTriangle className="size-4 text-status-hold" />,
  request_rejected: <AlertCircle className="size-4 text-status-major" />,
  complaint_update: <FileText className="size-4 text-umak-blue" />,
  announcement: <Megaphone className="size-4 text-umak-gold" />,
  info: <Info className="size-4 text-umak-blue" />,
  default: <Bell className="size-4 text-muted-foreground" />,
};

function getTypeIcon(type: string) {
  return typeIcons[type] || typeIcons.default;
}

function getRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay} days ago`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)} week${Math.floor(diffDay / 7) > 1 ? 's' : ''} ago`;
  if (diffDay < 365) return `${Math.floor(diffDay / 30)} month${Math.floor(diffDay / 30) > 1 ? 's' : ''} ago`;
  return `${Math.floor(diffDay / 365)} year${Math.floor(diffDay / 365) > 1 ? 's' : ''} ago`;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
  const { lastNotification, lastRefreshEvent, isConnected, decrementUnread, resetUnread, refreshUnreadCount } = useNotificationContext();
  const prevConnectedRef = useRef(false);

  // React Query invalidation for data-refresh events (future-proofing)
  useQueryInvalidation(['notifications']);

  const fetchNotifications = useCallback(async (pageNum: number, append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      }
      const res = await fetch(`/api/notifications?page=${pageNum}&limit=20`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        if (append) {
          setAllNotifications((prev) => [...prev, ...json.notifications]);
        } else {
          setAllNotifications(json.notifications);
        }
      }
    } catch (err) {
      // Notifications fetch error
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications(1);
  }, [fetchNotifications]);

  // Refetch on socket reconnect
  useEffect(() => {
    if (isConnected && prevConnectedRef.current === false) {
      fetchNotifications(1);
    }
    prevConnectedRef.current = isConnected;
  }, [isConnected, fetchNotifications]);

  // Prepend new notification from Socket.IO
  useEffect(() => {
    if (lastNotification && !allNotifications.find(n => n.id === lastNotification.id)) {
      setAllNotifications(prev => [
        { ...lastNotification, userId: (lastNotification as unknown as Record<string, unknown>).userId as string || '', isRead: false },
        ...prev,
      ]);
    }
  }, [lastNotification, allNotifications]);

  // Refresh when data-changed events arrive for relevant modules
  useEffect(() => {
    if (lastRefreshEvent && ['complaints', 'service-requests', 'announcements'].includes(lastRefreshEvent.module)) {
      fetchNotifications(1);
    }
  }, [lastRefreshEvent, fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
      if (res.ok) {
        setAllNotifications((prev) =>
          prev.map((n) => ({ ...n, isRead: true }))
        );
        resetUnread();
        toast.success('All notifications marked as read');
      }
    } catch (err) {
      // Mark all read error
      toast.error('Failed to mark all as read');
    }
  };

  const handleMarkAsRead = async (notification: Notification) => {
    if (notification.isRead) {
      // Navigate to related record if already read
      navigateToReference(notification);
      return;
    }

    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: [notification.id] }),
      });
      if (res.ok) {
        setAllNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, isRead: true } : n
          )
        );
        decrementUnread(1);
      }
    } catch (err) {
      // Mark as read error
    }

    navigateToReference(notification);
  };

  const navigateToReference = (notification: Notification) => {
    if (notification.referenceType === 'service_request' && notification.referenceId) {
      router.push('/service-requests');
    } else if (notification.referenceType === 'complaint' && notification.referenceId) {
      router.push(`/complaints/${notification.referenceId}`);
    } else if (notification.referenceType === 'announcement' && notification.referenceId) {
      router.push('/announcements');
    }
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchNotifications(nextPage, true);
  };

  // Sync unread count with server when page loads
  useEffect(() => {
    refreshUnreadCount();
  }, [refreshUnreadCount]);

  const unreadCount = allNotifications.filter((n) => !n.isRead).length;

  if (loading) {
    return <NotificationsSkeleton />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-umak-gold/15 flex items-center justify-center">
            <Bell className="size-5 text-umak-gold" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wider">NOTIFICATIONS</h1>
            <p className="text-sm text-muted-foreground">
              Stay updated on request and complaint activities
            </p>
          </div>
          {unreadCount > 0 && (
            <Badge className="ml-2 bg-umak-gold text-umak-navy font-semibold">
              {unreadCount} unread
            </Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            className="gap-2 text-xs"
          >
            <CheckCheck className="size-3.5" />
            Mark all as read
          </Button>
        )}
      </div>

      {/* Notification List */}
      {allNotifications.length === 0 ? (
        <Card className="glass border-0 shadow-sm">
          <CardContent className="py-16">
            <div className="text-center">
              <BellOff className="size-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-1">No Notifications</h3>
              <p className="text-sm text-muted-foreground">
                You&apos;re all caught up! Notifications will appear here when there are updates.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {allNotifications.map((notification) => (
            <Card
              key={notification.id}
              className={`glass border-0 shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md ${
                !notification.isRead ? 'border-l-2 border-l-umak-gold' : ''
              }`}
              onClick={() => handleMarkAsRead(notification)}
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="mt-0.5 shrink-0">
                    {getTypeIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm ${
                        notification.isRead
                          ? 'text-muted-foreground'
                          : 'text-foreground font-medium'
                      }`}
                    >
                      {notification.message}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="size-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {getRelativeTime(notification.createdAt)}
                      </span>
                      {notification.referenceType && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0"
                        >
                          {notification.referenceType.replace('_', ' ')}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Unread indicator */}
                  {!notification.isRead && (
                    <div className="size-2.5 rounded-full bg-umak-gold shrink-0 mt-1.5" />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Load More */}
      {data && page < data.totalPages && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="gap-2"
          >
            {loadingMore ? (
              <>
                <span className="size-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                Loading...
              </>
            ) : (
              'Load More'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

function NotificationsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-lg" />
        <div>
          <Skeleton className="h-6 w-48 mb-1" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="glass rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Skeleton className="size-5 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="size-2.5 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
