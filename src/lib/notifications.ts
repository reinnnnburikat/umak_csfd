/**
 * Shared notification helper.
 * Creates in-app notifications in the database AND pushes them via the Socket.IO relay.
 *
 * Architecture:
 *   Next.js API routes → this helper → (1) Prisma DB write + (2) HTTP POST to relay
 *   Relay (port 3003) → Socket.IO push to connected frontend clients
 *
 * Relay endpoints:
 *   POST /notify     — { userIds: string[], notification: {...} }
 *   POST /broadcast  — { notification: {...}, roles?: string[] }
 *   POST /refresh    — { module: string, action: string, recordId?: string }
 *
 * All relay calls are fire-and-forget — they never block or throw on failure.
 */

import { db } from '@/lib/db';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const RELAY_URL = 'http://localhost:3003';

// ---------------------------------------------------------------------------
// Internal — relay push (fire-and-forget)
// ---------------------------------------------------------------------------

/**
 * Push a notification to specific user rooms via the relay.
 * Uses POST /notify endpoint.
 */
function pushNotificationToRelay(userIds: string[], notification: {
  id: string;
  type: string;
  message: string;
  referenceId: string | null;
  referenceType: string | null;
  createdAt: string;
}): void {
  fetch(`${RELAY_URL}/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userIds, notification }),
  }).catch((err) => {
    console.warn(
      '[Notifications] Failed to push notification to relay:',
      err instanceof Error ? err.message : String(err),
    );
  });
}

/**
 * Push a data-refresh signal to all connected clients via the relay.
 * Uses POST /refresh endpoint.
 */
function pushRefreshToRelay(module: string, action: string, recordId?: string): void {
  fetch(`${RELAY_URL}/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ module, action, recordId }),
  }).catch((err) => {
    console.warn(
      '[Notifications] Failed to push refresh to relay:',
      err instanceof Error ? err.message : String(err),
    );
  });
}

// ---------------------------------------------------------------------------
// Primary API
// ---------------------------------------------------------------------------

/**
 * Create a notification for a single user — DB + real-time push.
 */
export async function createNotification(params: {
  userId: string;
  type: string;
  message: string;
  referenceId?: string;
  referenceType?: string;
}): Promise<{
  id: string;
  userId: string;
  type: string;
  message: string;
  isRead: boolean;
  referenceId: string | null;
  referenceType: string | null;
  createdAt: Date;
} | null> {
  try {
    const notification = await db.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        message: params.message,
        referenceId: params.referenceId || null,
        referenceType: params.referenceType || null,
      },
    });

    // Push via relay (fire-and-forget, don't block)
    pushNotificationToRelay([params.userId], {
      id: notification.id,
      type: notification.type,
      message: notification.message,
      referenceId: notification.referenceId,
      referenceType: notification.referenceType,
      createdAt: notification.createdAt.toISOString(),
    });

    return notification;
  } catch (error) {
    console.error('[Notifications] Failed to create notification:', error);
    return null;
  }
}

/**
 * Create notifications for multiple users — DB + real-time push.
 */
export async function createNotifications(params: {
  userIds: string[];
  type: string;
  message: string;
  referenceId?: string;
  referenceType?: string;
}): Promise<void> {
  if (params.userIds.length === 0) return;

  try {
    await db.notification.createMany({
      data: params.userIds.map((userId) => ({
        userId,
        type: params.type,
        message: params.message,
        referenceId: params.referenceId || null,
        referenceType: params.referenceType || null,
      })),
    });

    // Push via relay (fire-and-forget)
    pushNotificationToRelay(params.userIds, {
      id: `batch-${Date.now()}`,
      type: params.type,
      message: params.message,
      referenceId: params.referenceId || null,
      referenceType: params.referenceType || null,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Notifications] Failed to create batch notifications:', error);
  }
}

/**
 * Notify all staff/admin/superadmin users.
 */
export async function notifyStaff(params: {
  type: string;
  message: string;
  referenceId?: string;
  referenceType?: string;
  excludeUserId?: string;
}): Promise<void> {
  try {
    const staffUsers = await db.user.findMany({
      where: {
        role: { in: ['staff', 'admin', 'superadmin', 'student_assistant', 'makati_internship'] },
        status: 'active',
        ...(params.excludeUserId ? { id: { not: params.excludeUserId } } : {}),
      },
      select: { id: true },
    });

    const userIds = staffUsers.map((u) => u.id);
    await createNotifications({
      userIds,
      type: params.type,
      message: params.message,
      referenceId: params.referenceId,
      referenceType: params.referenceType,
    });
  } catch (error) {
    console.error('[Notifications] Failed to notify staff:', error);
  }
}

/**
 * Notify based on announcement visibility.
 * - "All": notify all active users (staff + students + faculty)
 * - "Staff": notify staff/admin/superadmin only
 * - "Students": notify students/faculty only
 */
export async function notifyByAnnouncementVisibility(params: {
  visibility: string;
  type: string;
  message: string;
  referenceId?: string;
  referenceType?: string;
  excludeUserId?: string;
}): Promise<void> {
  try {
    const whereBase: Record<string, unknown> = {
      status: 'active',
      ...(params.excludeUserId ? { id: { not: params.excludeUserId } } : {}),
    };

    let where: Record<string, unknown>;

    if (params.visibility === 'All') {
      // Notify all active users
      where = whereBase;
    } else if (params.visibility === 'Staff') {
      where = { ...whereBase, role: { in: ['staff', 'admin', 'superadmin', 'student_assistant', 'makati_internship'] } };
    } else if (params.visibility === 'Students') {
      where = { ...whereBase, role: { in: ['student_assistant', 'makati_internship'] } };
    } else {
      // Default: notify staff only
      where = { ...whereBase, role: { in: ['staff', 'admin', 'superadmin', 'student_assistant', 'makati_internship'] } };
    }

    const users = await db.user.findMany({
      where,
      select: { id: true },
    });

    const userIds = users.map((u) => u.id);
    await createNotifications({
      userIds,
      type: params.type,
      message: params.message,
      referenceId: params.referenceId,
      referenceType: params.referenceType,
    });
  } catch (error) {
    console.error('[Notifications] Failed to notify by announcement visibility:', error);
  }
}

/**
 * Signal a data refresh event to all connected clients.
 * This tells the frontend that certain data has changed and should be re-fetched.
 */
export async function signalDataRefresh(params: {
  module: string; // 'complaints' | 'service-requests' | 'announcements' | 'dashboard' | 'disciplinary'
  action: string; // 'create' | 'update' | 'delete' | 'status_change'
  recordId?: string;
}): Promise<void> {
  pushRefreshToRelay(params.module, params.action, params.recordId);
}
