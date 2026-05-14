import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

// ── PATCH /api/form-sections/reorder ──────────────────────────────────
// Reorder sections within a phase. Superadmin only.
// Body: { sectionIds: string[] }
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user || session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { sectionIds } = body;

    if (!Array.isArray(sectionIds)) {
      return NextResponse.json(
        { error: 'Missing required field: sectionIds' },
        { status: 400 }
      );
    }

    // Verify all section IDs exist
    const existingSections = await db.formSection.findMany({
      where: { id: { in: sectionIds } },
      select: { id: true },
    });

    if (existingSections.length !== sectionIds.length) {
      const foundIds = new Set(existingSections.map((s) => s.id));
      const missingIds = sectionIds.filter((id: string) => !foundIds.has(id));
      return NextResponse.json(
        { error: 'Some section IDs not found', missingIds },
        { status: 400 }
      );
    }

    // Update sortOrder for each section in a transaction
    const updates = sectionIds.map((id: string, index: number) =>
      db.formSection.update({
        where: { id },
        data: { sortOrder: index },
      })
    );

    await db.$transaction(updates);

    revalidatePath('/api/complaint-form/config');

    await createAuditLog({
      performedBy: session.user.id,
      performerName: session.user.fullName,
      performerRole: session.user.role,
      actionType: 'REORDER',
      module: 'form_sections',
      newValue: { sectionIds },
      remarks: `Reordered ${sectionIds.length} sections`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to reorder form sections:', error);
    return NextResponse.json(
      { error: 'Failed to reorder form sections' },
      { status: 500 }
    );
  }
}
