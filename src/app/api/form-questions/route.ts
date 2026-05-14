import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';

// ── Auth guard ──────────────────────────────────────────────────────────
async function requireSuperadmin() {
  const session = await getSession();
  if (!session?.user || session.user.role !== 'superadmin') {
    return null;
  }
  return session;
}

const STAFF_ROLES = ['staff', 'admin', 'superadmin', 'student_assistant', 'makati_internship'];

async function requireStaff() {
  const session = await getSession();
  if (!session?.user || !STAFF_ROLES.includes(session.user.role)) {
    return null;
  }
  return session;
}

// ── GET /api/form-questions ─────────────────────────────────────────────
// List all questions, optionally filtered by phase. Staff+ can read, superadmin can write.
export async function GET(request: NextRequest) {
  try {
    const session = await requireStaff();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const phase = searchParams.get('phase');

    const where = phase ? { phase } : {};

    const questions = await db.formQuestion.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ data: questions });
  } catch (error) {
    console.error('Failed to fetch form questions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch form questions' },
      { status: 500 }
    );
  }
}

// ── POST /api/form-questions ────────────────────────────────────────────
// Create a new question. Superadmin only.
export async function POST(request: NextRequest) {
  try {
    const session = await requireSuperadmin();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const {
      phase,
      fieldType,
      label,
      helpText,
      placeholder,
      required,
      roleTarget,
      sortOrder,
      choices,
      content,
      allowMultiple,
      defaultValue,
      validation,
    } = body;

    if (!phase || !fieldType || !label) {
      return NextResponse.json(
        { error: 'Missing required fields: phase, fieldType, label' },
        { status: 400 }
      );
    }

    const question = await db.formQuestion.create({
      data: {
        phase,
        fieldType,
        label,
        helpText: helpText ?? null,
        placeholder: placeholder ?? null,
        required: required ?? false,
        roleTarget: roleTarget ?? 'both',
        sortOrder: sortOrder ?? 0,
        choices: choices ?? null,
        content: content ?? null,
        allowMultiple: allowMultiple ?? false,
        defaultValue: defaultValue ?? null,
        validation: validation ?? null,
      },
    });

    await createAuditLog({
      performedBy: session.user.id,
      performerName: session.user.fullName,
      performerRole: session.user.role,
      actionType: 'CREATE',
      module: 'form_questions',
      recordId: question.id,
      newValue: { phase, fieldType, label, required },
      remarks: `Created form question: ${label} (${phase})`,
    });

    return NextResponse.json({ data: question }, { status: 201 });
  } catch (error) {
    console.error('Failed to create form question:', error);
    return NextResponse.json(
      { error: 'Failed to create form question' },
      { status: 500 }
    );
  }
}

// ── PATCH /api/form-questions ───────────────────────────────────────────
// Update a question (id in body). Superadmin only.
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

    const existing = await db.formQuestion.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // Build update data — only include fields that are provided
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'phase', 'fieldType', 'label', 'helpText', 'placeholder',
      'required', 'roleTarget', 'sortOrder', 'choices', 'content',
      'allowMultiple', 'defaultValue', 'validation', 'isActive',
    ];
    for (const field of allowedFields) {
      if (updateFields[field] !== undefined) {
        updateData[field] = updateFields[field];
      }
    }

    const updated = await db.formQuestion.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog({
      performedBy: session.user.id,
      performerName: session.user.fullName,
      performerRole: session.user.role,
      actionType: 'UPDATE',
      module: 'form_questions',
      recordId: id,
      oldValue: { label: existing.label, phase: existing.phase },
      newValue: updateData,
      remarks: `Updated form question: ${updated.label} (${updated.phase})`,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Failed to update form question:', error);
    return NextResponse.json(
      { error: 'Failed to update form question' },
      { status: 500 }
    );
  }
}

// ── DELETE /api/form-questions ──────────────────────────────────────────
// Soft-delete (set isActive=false). Superadmin only.
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

    const existing = await db.formQuestion.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    const updated = await db.formQuestion.update({
      where: { id },
      data: { isActive: false },
    });

    await createAuditLog({
      performedBy: session.user.id,
      performerName: session.user.fullName,
      performerRole: session.user.role,
      actionType: 'DELETE',
      module: 'form_questions',
      recordId: id,
      oldValue: { label: existing.label, phase: existing.phase, isActive: existing.isActive },
      newValue: { isActive: false },
      remarks: `Soft-deleted form question: ${existing.label} (${existing.phase})`,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Failed to delete form question:', error);
    return NextResponse.json(
      { error: 'Failed to delete form question' },
      { status: 500 }
    );
  }
}
