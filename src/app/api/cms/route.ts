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

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    const where: Record<string, unknown> = {};
    if (key) where.key = key;

    const contents = await db.cmsContent.findMany({
      where,
      orderBy: { key: 'asc' },
    });

    return NextResponse.json({ data: contents });
  } catch (error) {
    console.error('Failed to fetch CMS content:', error);
    return NextResponse.json(
      { error: 'Failed to fetch CMS content' },
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
    const { key, label, value } = body;

    if (!key || !label || value === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: key, label, value' },
        { status: 400 }
      );
    }

    const content = await db.cmsContent.upsert({
      where: { key },
      update: { label, value, updatedBy: session.user.id },
      create: { key, label, value, updatedBy: session.user.id },
    });

    await createAuditLog({
      performedBy: session.user.id,
      performerName: session.user.fullName,
      performerRole: session.user.role,
      actionType: 'UPSERT',
      module: 'cms_content',
      recordId: content.id,
      newValue: { key, label, value },
      remarks: `Updated CMS content: ${key}`,
    });

    return NextResponse.json(content);
  } catch (error) {
    console.error('Failed to update CMS content:', error);
    return NextResponse.json(
      { error: 'Failed to update CMS content' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user || session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { items } = body as { items: Array<{ key: string; label: string; value: string }> };

    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Missing items array' },
        { status: 400 }
      );
    }

    // Execute all upserts in a single atomic transaction for parallelism
    const results = await db.$transaction(
      items.map(item =>
        db.cmsContent.upsert({
          where: { key: item.key },
          update: { label: item.label, value: item.value, updatedBy: session.user.id },
          create: { key: item.key, label: item.label, value: item.value, updatedBy: session.user.id },
        })
      )
    );

    await createAuditLog({
      performedBy: session.user.id,
      performerName: session.user.fullName,
      performerRole: session.user.role,
      actionType: 'BATCH_UPDATE',
      module: 'cms_content',
      newValue: items,
      remarks: `Batch updated ${items.length} CMS content items`,
    });

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error('Failed to batch update CMS content:', error);
    return NextResponse.json(
      { error: 'Failed to batch update CMS content' },
      { status: 500 }
    );
  }
}
