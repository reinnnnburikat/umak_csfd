import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

/**
 * DELETE /api/setup/purge-synthetic
 * Removes all synthetic/sample data from the database while preserving real data.
 * Only accessible to superadmins.
 */
export async function DELETE() {
  try {
    const session = await getSession();
    if (!session || session.user?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Unauthorized. Only superadmins can purge synthetic data.' }, { status: 403 });
    }

    const results = { requests: 0, complaints: 0, disciplinary: 0, offenseHistory: 0 };

    // 1. Delete synthetic service requests (by tracking token or request number)
    const syntheticRequestTokens = [
      'tok-gmc-001-abc123', 'tok-gmc-002-def456', 'tok-uer-001-ghi789',
      'tok-gmc-003-jkl012', 'tok-gmc-004-mno456', 'tok-cdc-001-pqr789',
    ];
    const syntheticRequestNumbers = [
      'GMC-2025-00001', 'GMC-2025-00002', 'UER-2025-00001',
      'GMC-2025-00003', 'GMC-2025-00004', 'CDC-2025-00001',
    ];

    const deletedRequests = await db.serviceRequest.deleteMany({
      where: {
        OR: [
          { trackingToken: { in: syntheticRequestTokens } },
          { requestNumber: { in: syntheticRequestNumbers } },
        ],
      },
    });
    results.requests = deletedRequests.count;

    // 2. Delete synthetic complaints
    const syntheticComplaintTokens = ['tok-cmp-001-mno345', 'tok-cmp-002-pqr678'];
    const syntheticComplaintNumbers = ['CMP-2025-00001', 'CMP-2025-00002'];

    const deletedComplaints = await db.complaint.deleteMany({
      where: {
        OR: [
          { trackingToken: { in: syntheticComplaintTokens } },
          { complaintNumber: { in: syntheticComplaintNumbers } },
        ],
      },
    });
    results.complaints = deletedComplaints.count;

    // 3. Delete synthetic disciplinary cases (fake students)
    const deletedDiscCases = await db.disciplinaryCase.deleteMany({
      where: {
        OR: [
          { studentNumber: 'K1230321' }, // Ricardo Dalisay
          { studentNumber: 'K2200654' }, // Angela Vergara
        ],
      },
    });
    results.disciplinary = deletedDiscCases.count;

    // 4. Delete orphaned offense history for synthetic students
    const deletedHistory = await db.offenseHistory.deleteMany({
      where: {
        OR: [
          { studentNumber: 'K1230321' },
          { studentNumber: 'K2200654' },
        ],
      },
    });
    results.offenseHistory = deletedHistory.count;

    // 5. Show remaining counts
    const [reqCount, compCount, discCount, annCount, userCount] = await Promise.all([
      db.serviceRequest.count(),
      db.complaint.count(),
      db.disciplinaryCase.count(),
      db.announcement.count(),
      db.user.count(),
    ]);

    return NextResponse.json({
      status: 'purged',
      deleted: results,
      remaining: {
        requests: reqCount,
        complaints: compCount,
        disciplinary: discCount,
        announcements: annCount,
        users: userCount,
      },
    });
  } catch (error) {
    console.error('[Purge Synthetic] Error:', error);
    return NextResponse.json(
      { status: 'error', error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
