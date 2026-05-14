import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user || session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const templates = await db.emailTemplate.findMany({
      orderBy: { eventType: 'asc' },
    });

    return NextResponse.json({ data: templates });
  } catch (error) {
    console.error('Failed to fetch email templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email templates' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user || session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { eventType, subject, bodyHtml, variables } = body;

    if (!eventType || !subject || !bodyHtml) {
      return NextResponse.json(
        { error: 'Missing required fields: eventType, subject, bodyHtml' },
        { status: 400 }
      );
    }

    const template = await db.emailTemplate.create({
      data: {
        eventType,
        subject,
        bodyHtml,
        variables: variables ? JSON.stringify(variables) : null,
        updatedBy: session.user.id,
      },
    });

    await createAuditLog({
      performedBy: session.user.id,
      performerName: session.user.fullName,
      performerRole: session.user.role,
      actionType: 'CREATE',
      module: 'email_template',
      recordId: template.id,
      newValue: { eventType, subject },
      remarks: `Created email template: ${eventType}`,
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error('Failed to create email template:', error);
    return NextResponse.json(
      { error: 'Failed to create email template' },
      { status: 500 }
    );
  }
}
