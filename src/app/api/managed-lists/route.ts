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
    const listType = searchParams.get('listType');

    if (!listType) {
      return NextResponse.json(
        { error: 'listType query parameter is required' },
        { status: 400 }
      );
    }

    const items = await db.managedList.findMany({
      where: { listType },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ data: items });
  } catch (error) {
    console.error('Failed to fetch managed list:', error);
    return NextResponse.json(
      { error: 'Failed to fetch managed list' },
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
    const { listType, label, value, sortOrder, extra } = body;

    if (!listType || !label) {
      return NextResponse.json(
        { error: 'Missing required fields: listType, label' },
        { status: 400 }
      );
    }

    // Prevent duplicate labels within the same listType (case-insensitive)
    // SQLite doesn't support mode: 'insensitive', so we use contains + manual check
    const existingItems = await db.managedList.findMany({
      where: {
        listType,
        isActive: true,
      },
      select: { id: true, label: true },
    });
    const duplicate = existingItems.find(
      (item) => item.label.toLowerCase() === label.toLowerCase()
    );
    if (duplicate) {
      return NextResponse.json(
        { error: `An entry with label "${label}" already exists in this list.` },
        { status: 409 }
      );
    }

    const item = await db.managedList.create({
      data: {
        listType,
        label,
        value: value || null,
        sortOrder: sortOrder ?? 0,
        extra: extra ? JSON.stringify(extra) : null,
        createdById: session.user.id,
      },
    });

    await createAuditLog({
      performedBy: session.user.id,
      performerName: session.user.fullName,
      performerRole: session.user.role,
      actionType: 'CREATE',
      module: 'managed_list',
      recordId: item.id,
      newValue: { listType, label, value },
      remarks: `Created managed list item: ${label} (${listType})`,
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error('Failed to create managed list item:', error);
    return NextResponse.json(
      { error: 'Failed to create managed list item' },
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
    const { id, label, value, isActive, sortOrder, extra } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 });
    }

    const existing = await db.managedList.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (label !== undefined) updateData.label = label;
    if (value !== undefined) updateData.value = value;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (extra !== undefined) updateData.extra = JSON.stringify(extra);

    const updated = await db.managedList.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog({
      performedBy: session.user.id,
      performerName: session.user.fullName,
      performerRole: session.user.role,
      actionType: 'UPDATE',
      module: 'managed_list',
      recordId: id,
      oldValue: { label: existing.label, value: existing.value, isActive: existing.isActive, sortOrder: existing.sortOrder },
      newValue: updateData,
      remarks: `Updated managed list item: ${updated.label} (${updated.listType})`,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update managed list item:', error);
    return NextResponse.json(
      { error: 'Failed to update managed list item' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user || session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 });
    }

    const existing = await db.managedList.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    await db.managedList.delete({ where: { id } });

    await createAuditLog({
      performedBy: session.user.id,
      performerName: session.user.fullName,
      performerRole: session.user.role,
      actionType: 'DELETE',
      module: 'managed_list',
      recordId: id,
      oldValue: { label: existing.label, value: existing.value, listType: existing.listType },
      remarks: `Deleted managed list item: ${existing.label} (${existing.listType})`,
    });

    return NextResponse.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Failed to delete managed list item:', error);
    return NextResponse.json(
      { error: 'Failed to delete managed list item' },
      { status: 500 }
    );
  }
}
