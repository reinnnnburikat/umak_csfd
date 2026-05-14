import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';

// ── PATCH /api/form-questions/reorder ───────────────────────────────────
// Reorder questions within a phase. Superadmin only.
// Body: { phase: string, questionIds: string[] }
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user || session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { phase, questionIds } = body;

    if (!phase || !Array.isArray(questionIds)) {
      return NextResponse.json(
        { error: 'Missing required fields: phase, questionIds' },
        { status: 400 }
      );
    }

    // Verify all question IDs exist and belong to the specified phase
    const existingQuestions = await db.formQuestion.findMany({
      where: {
        id: { in: questionIds },
        phase,
      },
      select: { id: true },
    });

    if (existingQuestions.length !== questionIds.length) {
      const foundIds = new Set(existingQuestions.map((q) => q.id));
      const missingIds = questionIds.filter((id: string) => !foundIds.has(id));
      return NextResponse.json(
        { error: 'Some question IDs not found or do not belong to the specified phase', missingIds },
        { status: 400 }
      );
    }

    // Update sortOrder for each question based on array position
    const updates = questionIds.map((id: string, index: number) =>
      db.formQuestion.update({
        where: { id },
        data: { sortOrder: index },
      })
    );

    await db.$transaction(updates);

    await createAuditLog({
      performedBy: session.user.id,
      performerName: session.user.fullName,
      performerRole: session.user.role,
      actionType: 'REORDER',
      module: 'form_questions',
      newValue: { phase, questionIds },
      remarks: `Reordered ${questionIds.length} questions in phase: ${phase}`,
    });

    // Return updated questions
    const updatedQuestions = await db.formQuestion.findMany({
      where: { phase, id: { in: questionIds } },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ data: updatedQuestions });
  } catch (error) {
    console.error('Failed to reorder form questions:', error);
    return NextResponse.json(
      { error: 'Failed to reorder form questions' },
      { status: 500 }
    );
  }
}
