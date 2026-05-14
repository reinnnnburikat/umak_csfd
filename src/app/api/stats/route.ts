import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user || !['staff', 'admin', 'superadmin', 'student_assistant', 'makati_internship'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const totalRequests = await db.serviceRequest.count();
    const issuedCount = await db.serviceRequest.count({ where: { status: { in: ['Issued', 'Released'] } } });
    const complaintCount = await db.complaint.count();
    const disciplinaryCount = await db.disciplinaryCase.count();

    // Count unique requestors without exposing PII — only need the count, not emails
    const uniqueRequestorCount = await db.serviceRequest.groupBy({
      by: ['requestorEmail'],
      _count: { _all: true },
    });

    // Monthly requests this year
    const yearStart = new Date();
    yearStart.setMonth(0, 1);
    yearStart.setHours(0, 0, 0, 0);
    const monthlyRequests = await db.serviceRequest.count({
      where: { createdAt: { gte: yearStart } },
    });

    return NextResponse.json({
      totalRequests,
      certificatesIssued: issuedCount,
      activeStudents: uniqueRequestorCount.length,
      complaintsFiled: complaintCount,
      disciplinaryRecords: disciplinaryCount,
      monthlyRequests,
    });
  } catch (error) {
    console.error('Failed to fetch stats:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
