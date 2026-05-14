import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { notifyByAnnouncementVisibility, signalDataRefresh } from '@/lib/notifications';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isPublic = searchParams.get('public') === 'true';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || (isPublic ? '6' : '20'), 10);
    const skip = (page - 1) * limit;

    // Build where clause based on public flag
    const where: Record<string, unknown> = {};

    if (isPublic) {
      const now = new Date();
      // Show announcements that are currently active:
      // postedFrom must be in the past or now, postedTo must be in the future or now
      // Using start-of-day for postedTo comparison to be more forgiving with timezones
      where.postedFrom = { lte: now };
      where.postedTo = { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) };
      where.visibility = { in: ['All', 'Students'] };
    }

    const [announcements, total] = await Promise.all([
      db.announcement.findMany({
        where,
        orderBy: [
          { isPinned: 'desc' },
          { createdAt: 'desc' },
        ],
        skip,
        take: limit,
        include: {
          createdBy: {
            select: { fullName: true },
          },
        },
      }),
      db.announcement.count({ where }),
    ]);

    return NextResponse.json({
      data: announcements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Failed to fetch announcements:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Failed to fetch announcements' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Auth check: require staff/admin/superadmin
    const session = await getSession();
    if (!session?.user || !['staff', 'admin', 'superadmin', 'student_assistant', 'makati_internship'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized. Only staff, admin, or superadmin can create announcements.' }, { status: 403 });
    }

    const body = await request.json();

    if (!body.title || !body.body || !body.postedFrom || !body.postedTo) {
      return NextResponse.json(
        { error: 'Missing required fields: title, body, postedFrom, postedTo' },
        { status: 400 }
      );
    }

    // Validate visibility
    const validVisibilities = ['All', 'Students', 'Staff'];
    const visibility = validVisibilities.includes(body.visibility) ? body.visibility : 'All';

    // Validate postedTo >= postedFrom
    const fromDate = new Date(body.postedFrom);
    const toDate = new Date(body.postedTo);
    if (toDate < fromDate) {
      return NextResponse.json(
        { error: 'End date (Posted To) must be on or after the start date (Posted From).' },
        { status: 400 }
      );
    }

    const announcement = await db.announcement.create({
      data: {
        title: body.title,
        body: body.body,
        postedFrom: fromDate,
        postedTo: toDate,
        visibility,
        isPinned: body.isPinned || false,
        fileUrl: body.fileUrl || null,
        createdById: session.user.id,
      },
    });

    // Create audit log (non-blocking — don't fail the main operation if audit fails)
    try {
      await db.auditLog.create({
        data: {
          actionType: 'CREATE',
          module: 'announcements',
          recordId: announcement.id,
          newValue: JSON.stringify(announcement),
          performedBy: session.user.id,
          performerName: session.user.fullName,
          performerRole: session.user.role,
        },
      });
    } catch (auditError) {
      console.error('Failed to create audit log:', auditError);
    }

    // Send notifications based on visibility
    try {
      await notifyByAnnouncementVisibility({
        visibility,
        type: 'announcement',
        message: `New announcement: ${announcement.title}`,
        referenceId: announcement.id,
        referenceType: 'announcement',
        excludeUserId: session.user.id,
      });
      await signalDataRefresh({ module: 'announcements', action: 'create', recordId: announcement.id });
    } catch (notifError) {
      console.error('Failed to send announcement notification:', notifError);
    }

    return NextResponse.json(announcement, { status: 201 });
  } catch (error) {
    console.error('Failed to create announcement:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Failed to create announcement' },
      { status: 500 }
    );
  }
}
