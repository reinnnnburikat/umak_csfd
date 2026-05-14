import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/session';
import { notifyByAnnouncementVisibility, signalDataRefresh } from '@/lib/notifications';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth check: require staff/admin/superadmin
    const session = await getSessionFromRequest(request);
    if (!session?.user || !['staff', 'admin', 'superadmin', 'student_assistant', 'makati_internship'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized. Only staff, admin, or superadmin can edit announcements.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await db.announcement.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Announcement not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.body !== undefined) updateData.body = body.body;
    if (body.postedFrom !== undefined) updateData.postedFrom = new Date(body.postedFrom);
    if (body.postedTo !== undefined) updateData.postedTo = new Date(body.postedTo);
    if (body.visibility !== undefined) {
      const validVisibilities = ['All', 'Students', 'Staff'];
      updateData.visibility = validVisibilities.includes(body.visibility) ? body.visibility : 'All';
    }
    if (body.isPinned !== undefined) updateData.isPinned = body.isPinned;
    if (body.fileUrl !== undefined) updateData.fileUrl = body.fileUrl;

    const updated = await db.announcement.update({
      where: { id },
      data: updateData,
    });

    // Create audit log (non-blocking)
    try {
      await db.auditLog.create({
        data: {
          actionType: 'UPDATE',
          module: 'announcements',
          recordId: id,
          oldValue: JSON.stringify(existing),
          newValue: JSON.stringify(updated),
          performedBy: session.user.id,
          performerName: session.user.fullName,
          performerRole: session.user.role,
        },
      });
    } catch (auditError) {
      console.error('Failed to create audit log:', auditError);
    }

    // Send notifications based on new visibility whenever an announcement is updated
    try {
      await notifyByAnnouncementVisibility({
        visibility: (updated.visibility as string) || existing.visibility,
        type: 'announcement',
        message: `Updated announcement: ${(updated.title as string) || existing.title}`,
        referenceId: id,
        referenceType: 'announcement',
        excludeUserId: session.user.id,
      });
      await signalDataRefresh({ module: 'announcements', action: 'update', recordId: id });
    } catch (notifError) {
      console.error('Failed to send announcement notification:', notifError);
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update announcement:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Failed to update announcement' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth check: require staff/admin/superadmin
    const session = await getSessionFromRequest(request);
    if (!session?.user || !['staff', 'admin', 'superadmin', 'student_assistant', 'makati_internship'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized. Only staff, admin, or superadmin can delete announcements.' }, { status: 403 });
    }

    const { id } = await params;

    const existing = await db.announcement.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Announcement not found' },
        { status: 404 }
      );
    }

    await db.announcement.delete({ where: { id } });

    // Create audit log (non-blocking)
    try {
      await db.auditLog.create({
        data: {
          actionType: 'DELETE',
          module: 'announcements',
          recordId: id,
          oldValue: JSON.stringify(existing),
          performedBy: session.user.id,
          performerName: session.user.fullName,
          performerRole: session.user.role,
        },
      });
    } catch (auditError) {
      console.error('Failed to create audit log:', auditError);
    }

    try {
      await signalDataRefresh({ module: 'announcements', action: 'delete', recordId: id });
    } catch (notifError) {
      console.error('Failed to send announcement deletion notification:', notifError);
    }

    return NextResponse.json({ message: 'Announcement deleted successfully' });
  } catch (error) {
    console.error('Failed to delete announcement:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Failed to delete announcement' },
      { status: 500 }
    );
  }
}
