import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

// GET: List notifications for current user (paginated)
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      db.notification.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.notification.count({
        where: { userId: session.user.id },
      }),
    ]);

    return NextResponse.json({
      notifications,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Failed to fetch notifications:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

// PATCH: Mark notification(s) as read
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { notificationIds, markAll } = body as {
      notificationIds?: string[];
      markAll?: boolean;
    };

    if (markAll) {
      await db.notification.updateMany({
        where: {
          userId: session.user.id,
          isRead: false,
        },
        data: { isRead: true },
      });
      return NextResponse.json({ message: 'All notifications marked as read' });
    }

    if (notificationIds && Array.isArray(notificationIds) && notificationIds.length > 0) {
      await db.notification.updateMany({
        where: {
          id: { in: notificationIds },
          userId: session.user.id,
        },
        data: { isRead: true },
      });
      return NextResponse.json({ message: 'Notifications marked as read' });
    }

    return NextResponse.json(
      { error: 'No notification IDs provided' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Failed to update notifications:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Failed to update notifications' },
      { status: 500 }
    );
  }
}

// POST: Create a notification (for internal server-side use)
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, type, message, referenceId, referenceType } = body as {
      userId: string;
      type: string;
      message: string;
      referenceId?: string;
      referenceType?: string;
    };

    // Prevent cross-user notification creation unless admin/staff/superadmin
    if (userId && userId !== session.user.id) {
      const userRole = session.user?.role as string;
      if (!['admin', 'staff', 'superadmin'].includes(userRole)) {
        return NextResponse.json({ error: 'Forbidden: Cannot create notifications for other users.' }, { status: 403 });
      }
    }

    // If no userId provided, default to session user
    const targetUserId = userId || session.user.id;

    if (!type || !message) {
      return NextResponse.json(
        { error: 'type and message are required' },
        { status: 400 }
      );
    }

    const notification = await db.notification.create({
      data: {
        userId: targetUserId,
        type,
        message,
        referenceId,
        referenceType,
      },
    });

    return NextResponse.json(notification, { status: 201 });
  } catch (error) {
    console.error('Failed to create notification:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Failed to create notification' },
      { status: 500 }
    );
  }
}
