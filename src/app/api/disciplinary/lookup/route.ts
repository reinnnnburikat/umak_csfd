import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user?.role as string;
    if (!['admin', 'staff', 'superadmin'].includes(userRole)) {
      return NextResponse.json({ error: 'Forbidden: Only staff and administrators can look up student records.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const studentNumber = searchParams.get('studentNumber');

    if (!studentNumber) {
      return NextResponse.json({ error: 'Student number is required' }, { status: 400 });
    }

    const normalizedStudentNumber = studentNumber.trim();

    // Fetch cases and offense history in parallel
    const [cases, offenseHistory] = await Promise.all([
      db.disciplinaryCase.findMany({
        where: { studentNumber: normalizedStudentNumber },
        orderBy: { dateOfInfraction: 'desc' },
      }),
      db.offenseHistory.findMany({
        where: { studentNumber: normalizedStudentNumber },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Calculate summary
    const totalOffenses = offenseHistory.length;
    const minorOffenses = offenseHistory.filter(h => h.violationCategory === 'MINOR').length;
    const majorOffenses = offenseHistory.filter(h => h.violationCategory === 'MAJOR').length;
    const clearedOffenses = offenseHistory.filter(h => h.isCleared).length;
    const activeOffenses = totalOffenses - clearedOffenses;

    // Check for pending community service (endorsed but not cleared)
    const pendingCommunityService = cases.filter(c => c.isEndorsed && !c.isCleared);

    // Get unique violation categories
    const violationCategories = [...new Set(offenseHistory.map(h => h.violationCategory))];

    return NextResponse.json({
      studentNumber: normalizedStudentNumber,
      totalOffenses,
      minorOffenses,
      majorOffenses,
      clearedOffenses,
      activeOffenses,
      violationCategories,
      pendingCommunityService: pendingCommunityService.map(c => ({
        id: c.id,
        violationType: c.violationType,
        violationCategory: c.violationCategory,
        description: c.description,
        actionTaken: c.actionTaken,
        dateOfInfraction: c.dateOfInfraction,
        isEndorsed: c.isEndorsed,
        offenseCount: c.offenseCount,
        status: c.status,
        deploymentStatus: c.deploymentStatus,
        deploymentOffice: c.deploymentOffice,
        deploymentDateFrom: c.deploymentDateFrom,
        deploymentDateTo: c.deploymentDateTo,
        deploymentHoursToRender: c.deploymentHoursToRender,
        deploymentAssessmentHours: c.deploymentAssessmentHours,
        deploymentRemarks: c.deploymentRemarks,
        aipExpectedOutput: c.aipExpectedOutput,
        settlementDate: c.settlementDate,
        settledByName: c.settledByName,
      })),
      recentCases: cases.slice(0, 5).map(c => ({
        id: c.id,
        violationType: c.violationType,
        violationCategory: c.violationCategory,
        description: c.description,
        actionTaken: c.actionTaken,
        offenseCount: c.offenseCount,
        status: c.status,
        dateOfInfraction: c.dateOfInfraction,
        isCleared: c.isCleared,
        isEndorsed: c.isEndorsed,
        deploymentStatus: c.deploymentStatus,
        deploymentOffice: c.deploymentOffice,
        settlementDate: c.settlementDate,
        settledByName: c.settledByName,
      })),
    });
  } catch (error) {
    console.error('Failed to fetch disciplinary history:', error);
    return NextResponse.json({ error: 'Failed to fetch disciplinary history' }, { status: 500 });
  }
}
