import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';

// ── Auth guard ──────────────────────────────────────────────────────────
const STAFF_ROLES = ['staff', 'admin', 'superadmin', 'student_assistant', 'makati_internship'];

async function requireStaff() {
  const session = await getSession();
  if (!session?.user || !STAFF_ROLES.includes(session.user.role)) {
    return null;
  }
  return session;
}

async function requireSuperadmin() {
  const session = await getSession();
  if (!session?.user || session.user.role !== 'superadmin') {
    return null;
  }
  return session;
}

// ── GET /api/form-sections ─────────────────────────────────────────────
// List sections, optionally filtered by phase. Staff+ can read.
export async function GET(request: NextRequest) {
  try {
    const session = await requireStaff();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const phase = searchParams.get('phase');

    const where = phase ? { phase } : {};

    const sections = await db.formSection.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { questions: true } },
      },
    });

    return NextResponse.json({ data: sections });
  } catch (error) {
    console.error('Failed to fetch form sections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch form sections' },
      { status: 500 }
    );
  }
}

// ── POST /api/form-sections ────────────────────────────────────────────
// Create a new section. Superadmin only.
export async function POST(request: NextRequest) {
  try {
    const session = await requireSuperadmin();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { phase, title, description, sortOrder } = body;

    if (!phase || !title) {
      return NextResponse.json(
        { error: 'Missing required fields: phase, title' },
        { status: 400 }
      );
    }

    // Get next sortOrder if not provided
    let effectiveSortOrder = sortOrder;
    if (effectiveSortOrder === undefined || effectiveSortOrder === null) {
      const maxSort = await db.formSection.findFirst({
        where: { phase },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });
      effectiveSortOrder = (maxSort?.sortOrder ?? -1) + 1;
    }

    const section = await db.formSection.create({
      data: {
        phase,
        title,
        description: description ?? null,
        sortOrder: effectiveSortOrder,
      },
    });

    await createAuditLog({
      performedBy: session.user.id,
      performerName: session.user.fullName,
      performerRole: session.user.role,
      actionType: 'CREATE',
      module: 'form_sections',
      recordId: section.id,
      newValue: { phase, title },
      remarks: `Created form section: ${title} (${phase})`,
    });

    return NextResponse.json({ data: section }, { status: 201 });
  } catch (error) {
    console.error('Failed to create form section:', error);
    return NextResponse.json(
      { error: 'Failed to create form section' },
      { status: 500 }
    );
  }
}

// ── PATCH /api/form-sections ───────────────────────────────────────────
// Update a section (id in body). Superadmin only.
export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSuperadmin();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { id, ...updateFields } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      );
    }

    const existing = await db.formSection.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    const allowedFields = ['phase', 'title', 'description', 'sortOrder', 'isActive'];
    for (const field of allowedFields) {
      if (updateFields[field] !== undefined) {
        updateData[field] = updateFields[field];
      }
    }

    const updated = await db.formSection.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog({
      performedBy: session.user.id,
      performerName: session.user.fullName,
      performerRole: session.user.role,
      actionType: 'UPDATE',
      module: 'form_sections',
      recordId: id,
      oldValue: { title: existing.title, phase: existing.phase },
      newValue: updateData,
      remarks: `Updated form section: ${updated.title} (${updated.phase})`,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Failed to update form section:', error);
    return NextResponse.json(
      { error: 'Failed to update form section' },
      { status: 500 }
    );
  }
}

// ── DELETE /api/form-sections ──────────────────────────────────────────
// Hard-delete a section. Questions' sectionId will be set to null (onDelete: SetNull).
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireSuperadmin();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      );
    }

    const existing = await db.formSection.findUnique({
      where: { id },
      include: { _count: { select: { questions: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    await db.formSection.delete({
      where: { id },
    });

    await createAuditLog({
      performedBy: session.user.id,
      performerName: session.user.fullName,
      performerRole: session.user.role,
      actionType: 'DELETE',
      module: 'form_sections',
      recordId: id,
      oldValue: { title: existing.title, phase: existing.phase },
      remarks: `Deleted form section "${existing.title}" (${existing.phase}) with ${existing._count.questions} questions (moved to unsectioned)`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete form section:', error);
    return NextResponse.json(
      { error: 'Failed to delete form section' },
      { status: 500 }
    );
  }
}
