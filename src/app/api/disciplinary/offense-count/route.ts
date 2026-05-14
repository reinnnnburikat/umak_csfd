import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/session';
import { buildCountWhere, calculateOffenseCount, getActionForOffense, getStatusLabel } from '@/lib/offense-counting';

// GET /api/disciplinary/offense-count?studentNumber=K12345678&category=MAJOR&violationType=Theft
// Returns the current offense count + detailed breakdown for preview
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user?.role as string;
    if (!['admin', 'staff', 'superadmin'].includes(userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const studentNumber = searchParams.get('studentNumber');
    const category = searchParams.get('category');
    const violationType = searchParams.get('violationType') || undefined;

    if (!studentNumber || !category) {
      return NextResponse.json(
        { error: 'Missing required params: studentNumber, category' },
        { status: 400 }
      );
    }

    // Normalize OTHERS to OTHER
    const normalizedCategory = category === 'OTHERS' ? 'OTHER' : category;

    // Calculate the offense count using the same shared logic as POST
    const nextOffenseCount = await calculateOffenseCount(studentNumber, normalizedCategory, violationType);
    const currentCount = nextOffenseCount - 1;

    // Get the existing cases that are being counted (for transparency/debugging)
    const countWhere = buildCountWhere(studentNumber, normalizedCategory, violationType);
    const existingCases = await db.disciplinaryCase.findMany({
      where: countWhere,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        violationType: true,
        violationCategory: true,
        offenseCount: true,
        isCleared: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      studentNumber,
      category: normalizedCategory,
      violationType: violationType || null,
      currentCount,
      nextOffenseCount,
      statusLabel: getStatusLabel(nextOffenseCount),
      action: getActionForOffense(normalizedCategory, nextOffenseCount),
      existingCases: existingCases.map(c => ({
        id: c.id,
        violationType: c.violationType,
        violationCategory: c.violationCategory,
        offenseCount: c.offenseCount,
        isCleared: c.isCleared,
        status: c.status,
        createdAt: c.createdAt,
      })),
    });
  } catch (error) {
    console.error('[OFFENSE-COUNT] Failed to calculate offense count:', error);
    return NextResponse.json(
      { error: 'Failed to calculate offense count' },
      { status: 500 }
    );
  }
}
