import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { recalculateAllOffenseCounts } from '@/lib/offense-counting';

/**
 * POST /api/db-migrate
 * Normalizes legacy statuses in the database so ALL records use the new status names.
 * Also fixes user roles so staff have the correct 'staff' role instead of 'admin'.
 * Requires superadmin authentication.
 *
 * Migrations:
 *   1. ServiceRequest: 'New' → 'Submitted', 'Processing' → 'For Review', 'Released' → 'Issued'
 *   2. User: Staff with incorrect 'admin' role → 'staff' (keeps adamos.pompeyoiii@umak.edu.ph as admin)
 *   3. DisciplinaryCase: 'First Offense' → '1st Offense' (normalize status format)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user || session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Only Super Admin can run database migrations' }, { status: 403 });
    }

    const results: Record<string, number> = {};

    // 1. Normalize ServiceRequest statuses
    const newToSubmitted = await db.serviceRequest.updateMany({
      where: { status: 'New' },
      data: { status: 'Submitted' },
    });
    results['New → Submitted'] = newToSubmitted.count;

    const processingToForReview = await db.serviceRequest.updateMany({
      where: { status: 'Processing' },
      data: { status: 'For Review' },
    });
    results['Processing → For Review'] = processingToForReview.count;

    const releasedToIssued = await db.serviceRequest.updateMany({
      where: { status: 'Released' },
      data: { status: 'Issued' },
    });
    results['Released → Issued'] = releasedToIssued.count;

    // 2. Fix user roles — staff should have 'staff' role, not 'admin'
    // Only fix known staff emails (not the director)
    const staffEmails = [
      'mariafe.samares@umak.edu.ph',
      'alma.fraginal@umak.edu.ph',
      'cbasilio@umak.edu.ph',
    ];

    const staffRoleFix = await db.user.updateMany({
      where: {
        email: { in: staffEmails },
        role: 'admin',
      },
      data: { role: 'staff' },
    });
    results['Staff role fixed (admin → staff)'] = staffRoleFix.count;

    // 3. Normalize DisciplinaryCase statuses
    const statusMap: Record<string, string> = {
      'First Offense': '1st Offense',
      'Second Offense': '2nd Offense',
      'Third Offense': '3rd Offense',
      'Fourth Offense': '4th Offense',
      'Fifth Offense': '5th Offense',
    };

    for (const [oldStatus, newStatus] of Object.entries(statusMap)) {
      const updated = await db.disciplinaryCase.updateMany({
        where: { status: oldStatus },
        data: { status: newStatus },
      });
      if (updated.count > 0) {
        results[`${oldStatus} → ${newStatus}`] = updated.count;
      }
    }

    // 4. Also recalculate all offense counts
    const recalcResult = await recalculateAllOffenseCounts();
    results['Offense counts recalculated'] = recalcResult.updatedCases;

    return NextResponse.json({
      success: true,
      message: 'Database migration complete',
      migrations: results,
    });
  } catch (error) {
    console.error('Database migration error:', error);
    return NextResponse.json(
      { error: 'Database migration failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
