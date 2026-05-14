import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

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

    // Group by phase
    const phases: Record<string, typeof questions> = {};

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

    return NextResponse.json(
      {
        version: 1,
        phases,
      },
      {
        headers: {
          'Cache-Control': 's-maxage=60, stale-while-revalidate=120',
        },
      }
    );
  } catch (error) {
    console.error('Failed to fetch complaint form config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch complaint form config' },
      { status: 500 }
    );
  }
}
