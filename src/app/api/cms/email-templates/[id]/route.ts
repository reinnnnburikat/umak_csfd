import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user || session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { subject, bodyHtml } = body;

    const existing = await db.emailTemplate.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = { updatedBy: session.user.id };
    if (subject !== undefined) updateData.subject = subject;
    if (bodyHtml !== undefined) updateData.bodyHtml = bodyHtml;

    const updated = await db.emailTemplate.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog({
      performedBy: session.user.id,
      performerName: session.user.fullName,
      performerRole: session.user.role,
      actionType: 'UPDATE',
      module: 'email_template',
      recordId: id,
      oldValue: { subject: existing.subject },
      newValue: { subject: updated.subject },
      remarks: `Updated email template: ${existing.eventType}`,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update email template:', error);
    return NextResponse.json(
      { error: 'Failed to update email template' },
      { status: 500 }
    );
  }
}
