import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

// ── GET /api/complaint-form/config ──────────────────────────────────────
// Public endpoint — returns active form configuration grouped by phase.
// No auth required.
export async function GET() {
  try {
    // Fetch all active questions, ordered by phase and sortOrder
    const questions = await db.formQuestion.findMany({
      where: { isActive: true },
      orderBy: [{ phase: 'asc' }, { sortOrder: 'asc' }],
    });

    // Fetch all active sections, ordered by phase and sortOrder
    const sections = await db.formSection.findMany({
      where: { isActive: true },
      orderBy: [{ phase: 'asc' }, { sortOrder: 'asc' }],
    });

    // Group by phase
    const phases: Record<string, typeof questions> = {};
    const phaseSections: Record<string, typeof sections> = {};

    for (const q of questions) {
      // For person phases, apply roleTarget filtering:
      // - complainant phase: show roleTarget IN ('complainant', 'both')
      // - respondent phase: show roleTarget IN ('respondent', 'both')
      // - other phases: show all
      if (q.phase === 'complainant' && q.roleTarget !== 'complainant' && q.roleTarget !== 'both') {
        continue;
      }
      if (q.phase === 'respondent' && q.roleTarget !== 'respondent' && q.roleTarget !== 'both') {
        continue;
      }

      if (!phases[q.phase]) {
        phases[q.phase] = [];
      }
      phases[q.phase].push(q);
    }

    // Group sections by phase
    for (const s of sections) {
      if (!phaseSections[s.phase]) {
        phaseSections[s.phase] = [];
      }
      phaseSections[s.phase].push(s);
    }

    return NextResponse.json({
      version: 1,
      phases,
      sections: phaseSections,
    });
  } catch (error) {
    console.error('Failed to fetch complaint form config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch complaint form config' },
      { status: 500 }
    );
  }
}
