import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { recalculateAllOffenseCounts, recalculateForStudent } from '@/lib/offense-counting';

/**
 * POST /api/disciplinary/recalculate
 * Recalculates offense counts for all existing cases.
 * This fixes any stale/incorrect offenseCount values.
 *
 * Body options:
 *   - studentNumber: (optional) if provided, only recalculate for this student
 *   - all: (optional) if true, recalculate for ALL students
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can trigger recalculation
    if (session.user?.role && !['superadmin', 'admin', 'staff'].includes(session.user.role as string)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));

    if (body.studentNumber) {
      // Recalculate for a specific student
      await recalculateForStudent(body.studentNumber);
      return NextResponse.json({
        success: true,
        message: `Offense counts recalculated for student ${body.studentNumber}`,
      });
    }

    // Recalculate for ALL students
    const result = await recalculateAllOffenseCounts();

    return NextResponse.json({
      success: true,
      message: `Recalculated offense counts: ${result.updatedCases} of ${result.totalCases} cases updated`,
      totalCases: result.totalCases,
      updatedCases: result.updatedCases,
      details: result.details.slice(0, 50), // Return first 50 changes for debugging
    });
  } catch (error) {
    console.error('Failed to recalculate offense counts:', error);
    return NextResponse.json(
      { error: 'Failed to recalculate offense counts' },
      { status: 500 }
    );
  }
}
