// Shared offense counting logic — single source of truth
// Rules:
//   MINOR: 3-tier, count by same violationType per student
//     1st = Verbal/written warning
//     2nd = Written reprimand + counseling referral
//     3rd = 100hrs community service
//   MAJOR: 5-tier, count across ALL major offenses per student regardless of violation
//     1st = 100hrs community service
//     2nd-5th = Community service per director's decision
//   OTHER/LATE_*: 5-tier, RESPECTIVE counting (same violationCategory only)
//     1st = 100hrs community service
//     2nd = 50hrs community service
//     3rd-5th = Per director's decision

import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

// ─── Action / Consequence Descriptions ────────────────────────────────────────

export function getActionForOffense(category: string, offenseCount: number): string {
  const normalized = category === 'OTHERS' ? 'OTHER' : category;

  if (normalized === 'MINOR') {
    switch (offenseCount) {
      case 1: return 'Verbal/written warning';
      case 2: return 'Written reprimand + counseling referral';
      case 3: return '100 hours community service';
      default: return '100 hours community service';
    }
  }

  if (normalized === 'MAJOR') {
    switch (offenseCount) {
      case 1: return '100 hours community service';
      default: return 'Community service per director\'s decision';
    }
  }

  // OTHER / LATE_* categories
  switch (offenseCount) {
    case 1: return '100 hours community service';
    case 2: return '50 hours community service';
    default: return 'Per director\'s decision';
  }
}

// ─── Status Label ─────────────────────────────────────────────────────────────

export function getStatusLabel(offenseCount: number): string {
  switch (offenseCount) {
    case 1: return '1st Offense';
    case 2: return '2nd Offense';
    case 3: return '3rd Offense';
    case 4: return '4th Offense';
    case 5: return '5th Offense';
    default: return `${offenseCount}th Offense`;
  }
}

// ─── Non-cleared where clause helper ─────────────────────────────────────────
// The isCleared column is NOT NULL DEFAULT false, so we only need isCleared: false.
// Previously we included isCleared: null for null-safety, but Prisma's adapter-pg
// rejects { isCleared: null } for non-nullable Boolean fields, and the DB column
// has no NULL values thanks to the NOT NULL constraint + default.

export function notClearedWhere(): Prisma.DisciplinaryCaseWhereInput {
  return {
    isCleared: false,
  };
}

export function notClearedWhereOffenseHistory(): Prisma.OffenseHistoryWhereInput {
  return {
    isCleared: false,
  };
}

// ─── Build the "where" clause for counting ────────────────────────────────────

export function buildCountWhere(
  studentNumber: string,
  category: string,
  violationType?: string
): Prisma.DisciplinaryCaseWhereInput {
  const normalized = category === 'OTHERS' ? 'OTHER' : category;

  const countWhere: Prisma.DisciplinaryCaseWhereInput = {
    studentNumber,
    ...notClearedWhere(),
  };

  if (normalized === 'MINOR') {
    // MINOR: count offenses of the SAME violation type within MINOR category
    countWhere.violationCategory = 'MINOR';
    countWhere.violationType = violationType;
  } else if (normalized === 'MAJOR') {
    // MAJOR: count across ALL major offenses regardless of specific violation
    countWhere.violationCategory = 'MAJOR';
  } else {
    // OTHER/LATE_*: count respectively (same violationCategory)
    countWhere.violationCategory = normalized;
  }

  return countWhere;
}

// ─── Calculate offense count for a new case ───────────────────────────────────

export async function calculateOffenseCount(
  studentNumber: string,
  category: string,
  violationType?: string
): Promise<number> {
  const countWhere = buildCountWhere(studentNumber, category, violationType);

  const existingCount = await db.disciplinaryCase.count({
    where: countWhere,
  });

  return existingCount + 1;
}

// ─── Recalculate offense counts for ALL cases ─────────────────────────────────
// This is the critical function that fixes stale data.
// It recalculates offenseCount and status for every non-cleared case.
// Uses an interactive transaction to ensure all queries run on the same
// database connection (critical for PgBouncer environments).

export async function recalculateAllOffenseCounts(): Promise<{
  totalCases: number;
  updatedCases: number;
  details: Array<{ id: string; studentName: string; studentNumber: string; oldCount: number; newCount: number; category: string }>;
}> {
  return db.$transaction(async (tx) => {
    // Get ALL non-cleared cases (including isCleared=null for null-safety), grouped by student
    const allCases = await tx.disciplinaryCase.findMany({
      where: notClearedWhere(),
      orderBy: { createdAt: 'asc' }, // Process in chronological order
      select: {
        id: true,
        studentName: true,
        studentNumber: true,
        violationType: true,
        violationCategory: true,
        offenseCount: true,
        createdAt: true,
      },
    });

    // Group cases by student number
    const casesByStudent = new Map<string, typeof allCases>();
    for (const c of allCases) {
      const existing = casesByStudent.get(c.studentNumber) || [];
      existing.push(c);
      casesByStudent.set(c.studentNumber, existing);
    }

    const details: Array<{ id: string; studentName: string; studentNumber: string; oldCount: number; newCount: number; category: string }> = [];
    let updatedCases = 0;

    for (const [_studentNumber, studentCases] of casesByStudent) {
      // For each student, recalculate counts based on rules

      // MINOR: group by violationType
      const minorGroups = new Map<string, typeof studentCases>();
      // MAJOR: all in one group
      const majorGroup: typeof studentCases = [];
      // OTHER/LATE_*: group by violationCategory
      const otherGroups = new Map<string, typeof studentCases>();

      for (const c of studentCases) {
        const cat = c.violationCategory === 'OTHERS' ? 'OTHER' : c.violationCategory;

        if (cat === 'MINOR') {
          const key = c.violationType;
          const arr = minorGroups.get(key) || [];
          arr.push(c);
          minorGroups.set(key, arr);
        } else if (cat === 'MAJOR') {
          majorGroup.push(c);
        } else {
          const arr = otherGroups.get(cat) || [];
          arr.push(c);
          otherGroups.set(cat, arr);
        }
      }

      // Calculate new counts for MINOR groups (by violationType, chronological)
      for (const [_violationType, cases] of minorGroups) {
        for (let i = 0; i < cases.length; i++) {
          const newCount = i + 1;
          const c = cases[i];
          if (c.offenseCount !== newCount) {
            details.push({
              id: c.id,
              studentName: c.studentName,
              studentNumber: c.studentNumber,
              oldCount: c.offenseCount,
              newCount,
              category: 'MINOR',
            });
            await tx.disciplinaryCase.update({
              where: { id: c.id },
              data: {
                offenseCount: newCount,
                status: getStatusLabel(newCount),
              },
            });
            // Also update linked offense history
            await tx.offenseHistory.updateMany({
              where: { disciplinaryCaseId: c.id },
              data: { offenseCount: newCount },
            });
            updatedCases++;
          }
        }
      }

      // Calculate new counts for MAJOR group (all together, chronological)
      for (let i = 0; i < majorGroup.length; i++) {
        const newCount = i + 1;
        const c = majorGroup[i];
        if (c.offenseCount !== newCount) {
          details.push({
            id: c.id,
            studentName: c.studentName,
            studentNumber: c.studentNumber,
            oldCount: c.offenseCount,
            newCount,
            category: 'MAJOR',
          });
          await tx.disciplinaryCase.update({
            where: { id: c.id },
            data: {
              offenseCount: newCount,
              status: getStatusLabel(newCount),
            },
          });
          await tx.offenseHistory.updateMany({
            where: { disciplinaryCaseId: c.id },
            data: { offenseCount: newCount },
          });
          updatedCases++;
        }
      }

      // Calculate new counts for OTHER/LATE_* groups (by violationCategory, chronological)
      for (const [_cat, cases] of otherGroups) {
        for (let i = 0; i < cases.length; i++) {
          const newCount = i + 1;
          const c = cases[i];
          if (c.offenseCount !== newCount) {
            details.push({
              id: c.id,
              studentName: c.studentName,
              studentNumber: c.studentNumber,
              oldCount: c.offenseCount,
              newCount,
              category: c.violationCategory,
            });
            await tx.disciplinaryCase.update({
              where: { id: c.id },
              data: {
                offenseCount: newCount,
                status: getStatusLabel(newCount),
              },
            });
            await tx.offenseHistory.updateMany({
              where: { disciplinaryCaseId: c.id },
              data: { offenseCount: newCount },
            });
            updatedCases++;
          }
        }
      }
    }

    return {
      totalCases: allCases.length,
      updatedCases,
      details,
    };
  }, {
    maxWait: 15000,
    timeout: 60000,
  });
}

// ─── Recalculate for a specific student ───────────────────────────────────────
// Uses an interactive transaction to ensure all queries run on the same
// database connection (critical for PgBouncer environments like Supabase).

export async function recalculateForStudent(studentNumber: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const studentCases = await tx.disciplinaryCase.findMany({
      where: { studentNumber, ...notClearedWhere() },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        violationType: true,
        violationCategory: true,
        offenseCount: true,
      },
    });

    // Group by counting rules
    const minorGroups = new Map<string, typeof studentCases>();
    const majorGroup: typeof studentCases = [];
    const otherGroups = new Map<string, typeof studentCases>();

    for (const c of studentCases) {
      const cat = c.violationCategory === 'OTHERS' ? 'OTHER' : c.violationCategory;

      if (cat === 'MINOR') {
        const arr = minorGroups.get(c.violationType) || [];
        arr.push(c);
        minorGroups.set(c.violationType, arr);
      } else if (cat === 'MAJOR') {
        majorGroup.push(c);
      } else {
        const arr = otherGroups.get(cat) || [];
        arr.push(c);
        otherGroups.set(cat, arr);
      }
    }

    // Update MINOR groups
    for (const [_vt, cases] of minorGroups) {
      for (let i = 0; i < cases.length; i++) {
        const newCount = i + 1;
        const c = cases[i];
        if (c.offenseCount !== newCount) {
          await tx.disciplinaryCase.update({
            where: { id: c.id },
            data: { offenseCount: newCount, status: getStatusLabel(newCount) },
          });
          await tx.offenseHistory.updateMany({
            where: { disciplinaryCaseId: c.id },
            data: { offenseCount: newCount },
          });
        }
      }
    }

    // Update MAJOR group
    for (let i = 0; i < majorGroup.length; i++) {
      const newCount = i + 1;
      const c = majorGroup[i];
      if (c.offenseCount !== newCount) {
        await tx.disciplinaryCase.update({
          where: { id: c.id },
          data: { offenseCount: newCount, status: getStatusLabel(newCount) },
        });
        await tx.offenseHistory.updateMany({
          where: { disciplinaryCaseId: c.id },
          data: { offenseCount: newCount },
        });
      }
    }

    // Update OTHER/LATE_* groups
    for (const [_cat, cases] of otherGroups) {
      for (let i = 0; i < cases.length; i++) {
        const newCount = i + 1;
        const c = cases[i];
        if (c.offenseCount !== newCount) {
          await tx.disciplinaryCase.update({
            where: { id: c.id },
            data: { offenseCount: newCount, status: getStatusLabel(newCount) },
          });
          await tx.offenseHistory.updateMany({
            where: { disciplinaryCaseId: c.id },
            data: { offenseCount: newCount },
          });
        }
      }
    }
  }, {
    maxWait: 15000,
    timeout: 30000,
  });
}
