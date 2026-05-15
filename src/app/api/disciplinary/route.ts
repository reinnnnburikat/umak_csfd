import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest, type Session } from '@/lib/session';
import {
  calculateOffenseCount,
  getStatusLabel,
  recalculateForStudent,
  getActionForOffense,
} from '@/lib/offense-counting';
import { sendEmail, violationCitationHtml, downloadFilesAsAttachments, parseFileUrls } from '@/lib/email';
import { notifyStaff, signalDataRefresh } from '@/lib/notifications';

const VALID_CATEGORIES = ['MINOR', 'MAJOR', 'LATE_FACULTY_EVALUATION', 'LATE_ACCESS_ROG', 'LATE_PAYMENT', 'OTHER', 'OTHERS'];

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user?.role as string;

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const studentNumber = searchParams.get('studentNumber');
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    // Restrict students/faculty to only their own records
    if (['student_assistant', 'makati_internship'].includes(userRole)) {
      where.studentNumber = session.user.studentNumber || '';
    }

    if (category && category !== 'All') {
      where.violationCategory = category;
    }

    if (studentNumber) {
      where.studentNumber = studentNumber;
    }

    if (search) {
      // Students/faculty cannot use search to browse other records
      if (['student_assistant', 'makati_internship'].includes(userRole)) {
        where.OR = [
          { studentName: { contains: search }, studentNumber: session.user.studentNumber || '' },
        ];
      } else {
        where.OR = [
          { studentName: { contains: search } },
          { studentNumber: { contains: search } },
          { umakEmail: { contains: search } },
        ];
      }
    }

    // Apply status filter server-side for correct pagination
    if (status && status !== 'all') {
      if (status === 'active') {
        where.isCleared = false;
        where.isEndorsed = false;
      } else if (status === 'cleared') {
        where.isCleared = true;
      } else if (status === 'endorsed') {
        where.isEndorsed = true;
      } else if (status === 'major') {
        where.violationCategory = 'MAJOR';
        where.isCleared = false;
      }
    }

    const [cases, total] = await Promise.all([
      db.disciplinaryCase.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          studentName: true,
          studentNumber: true,
          sex: true,
          collegeInstitute: true,
          umakEmail: true,
          violationType: true,
          violationCategory: true,
          otherCategorySpecified: true,
          description: true,
          actionTaken: true,
          offenseCount: true,
          status: true,
          dateOfInfraction: true,
          isCleared: true,
          isEndorsed: true,
          clearedByName: true,
          clearedAt: true,
          clearReason: true,
          endorsedByName: true,
          endorsedAt: true,
          endorsementNotes: true,
          createdAt: true,
          offenseHistory: {
            select: {
              id: true,
              violationType: true,
              violationCategory: true,
              offenseCount: true,
              isCleared: true,
              dateOfInfraction: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      db.disciplinaryCase.count({ where }),
    ]);

    const response = NextResponse.json({
      data: cases,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
    response.headers.set('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return response;
  } catch (error) {
    console.error('Failed to fetch disciplinary cases:', error);
    return NextResponse.json(
      { error: 'Failed to fetch disciplinary cases' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Hoisted declarations — needed so the retry path in the catch block can access them
  let session: Session | null = null;
  let body: Record<string, unknown> = {};
  let category = '';
  let offenseCount = 1;
  let statusLabel = '';
  let defaultAction = '';
  let sanitizedFileUrls: string | null = null;

  try {
    session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user?.role as string;
    if (!['admin', 'staff', 'superadmin'].includes(userRole)) {
      return NextResponse.json({ error: 'Forbidden: Only staff and administrators can create disciplinary cases.' }, { status: 403 });
    }

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // --- Required field validation ---
    if (!body.studentName || !body.studentNumber || !body.violationType || !body.violationCategory) {
      return NextResponse.json(
        { error: 'Missing required fields: studentName, studentNumber, violationType, violationCategory' },
        { status: 400 }
      );
    }

    // Reject "Other" as a college name — client should resolve it before sending
    if (body.collegeInstitute === 'Other' || !String(body.collegeInstitute || '').trim()) {
      body.collegeInstitute = 'Unspecified';
    }

    // Normalize OTHERS to OTHER
    category = String(body.violationCategory);
    if (category === 'OTHERS') category = 'OTHER';

    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `violationCategory must be one of: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 }
      );
    }

    // Ensure database schema is up-to-date before querying
    // (isCleared column may not exist yet on fresh deployments)
    try {
      const { runAutoMigration } = await import('@/lib/db-migrate');
      await runAutoMigration();
    } catch (migrateErr) {
      console.error('[DISCIPLINARY POST] Auto-migration failed:', migrateErr);
      // Continue anyway — the count will fail and trigger retry with migration
    }

    // Calculate offense count using shared logic
    try {
      offenseCount = await calculateOffenseCount(
        String(body.studentNumber),
        category,
        String(body.violationType)
      );
    } catch (countError) {
      // If count fails (e.g., isCleared column missing), try auto-migration once more
      console.error('[DISCIPLINARY POST] Offense count failed, attempting migration:', countError);
      try {
        const { runAutoMigration } = await import('@/lib/db-migrate');
        await runAutoMigration();
        offenseCount = await calculateOffenseCount(
          String(body.studentNumber),
          category,
          String(body.violationType)
        );
      } catch (retryError) {
        console.error('[DISCIPLINARY POST] Retry also failed:', retryError);
        offenseCount = 1; // Fallback to 1st offense
      }
    }

    // If staff manually overrides the offense count, use their value
    if (typeof body.offenseCountOverride === 'number' && body.offenseCountOverride >= 1) {
      offenseCount = Math.min(Math.round(body.offenseCountOverride), 10);
    }

    // Determine the status label and action based on offense count
    statusLabel = getStatusLabel(offenseCount);
    defaultAction = getActionForOffense(category, offenseCount);

    // Sanitize fileUrls — ensure it's an array of strings
    // IMPORTANT: Filter out base64 data URLs (data:...) which can be extremely large
    // and should not be stored in the database. Only allow http/https or relative URLs.
    const rawFileUrls = Array.isArray(body.fileUrls)
      ? (body.fileUrls as unknown[]).filter((u): u is string => {
          if (typeof u !== 'string') return false;
          if (u.startsWith('data:')) {
            console.warn('[DISCIPLINARY POST] Skipped base64 data URL in fileUrls (too large for storage).');
            return false;
          }
          return true;
        })
      : [];

    sanitizedFileUrls = rawFileUrls.length > 0 ? JSON.stringify(rawFileUrls) : null;

    const newCase = await db.disciplinaryCase.create({
      data: {
        studentName: String(body.studentName),
        studentNumber: String(body.studentNumber),
        sex: body.sex ? String(body.sex) : null,
        collegeInstitute: body.collegeInstitute ? String(body.collegeInstitute) : null,
        umakEmail: body.umakEmail ? String(body.umakEmail) : null,
        violationType: String(body.violationType),
        violationCategory: category,
        otherCategorySpecified: body.otherCategorySpecified ? String(body.otherCategorySpecified) : null,
        description: body.description ? String(body.description) : null,
        actionTaken: body.actionTaken ? String(body.actionTaken) : defaultAction,
        offenseCount,
        status: statusLabel,
        dateOfInfraction: body.dateOfInfraction ? String(body.dateOfInfraction) : null,
        fileUrls: sanitizedFileUrls,
        officerName: body.officerName ? String(body.officerName) : null,
      },
    });

    // Create offense history entry
    await db.offenseHistory.create({
      data: {
        studentNumber: String(body.studentNumber),
        violationType: String(body.violationType),
        violationCategory: category,
        otherCategorySpecified: body.otherCategorySpecified ? String(body.otherCategorySpecified) : null,
        offenseCount,
        disciplinaryCaseId: newCase.id,
        dateOfInfraction: body.dateOfInfraction ? String(body.dateOfInfraction) : null,
      },
    });

    // Send citation notification email to the student (non-blocking)
    if (newCase.umakEmail) {
      Promise.resolve().then(async () => {
        try {
          const offenseLabel = `${offenseCount}${offenseCount === 1 ? 'st' : offenseCount === 2 ? 'nd' : offenseCount === 3 ? 'rd' : 'th'} Offense`;
          // Download attached files (if any) to include as email attachments
          const fileAttachments = await downloadFilesAsAttachments(parseFileUrls(newCase.fileUrls));
          await sendEmail({
            to: newCase.umakEmail!,
            subject: `Violation Citation Notice — ${newCase.violationType}`,
            html: violationCitationHtml({
              studentName: newCase.studentName,
              violationType: newCase.violationType,
              violationCategory: newCase.violationCategory,
              offenseCount,
              offenseLabel,
              actionTaken: newCase.actionTaken || defaultAction,
              dateOfInfraction: newCase.dateOfInfraction || undefined,
              description: newCase.description || undefined,
              officerName: body.officerName ? String(body.officerName) : undefined,
            }),
            attachments: fileAttachments.length > 0 ? fileAttachments : undefined,
          });
        } catch (emailError) {
          console.error('[DISCIPLINARY POST] Failed to send citation email to student:', emailError);
        }
      }).catch(() => {});
    }

    // Create audit log using session user instead of body.officerName (prevents forgery)
    // Non-blocking — don't fail the main operation if audit fails
    try {
      await db.auditLog.create({
        data: {
          actionType: 'CREATE',
          module: 'disciplinary',
          recordId: newCase.id,
          newValue: JSON.stringify(newCase),
          performerName: session.user.fullName || String(body.officerName || 'System'),
          performerRole: session.user.role,
          performedBy: session.user.id,
        },
      });
    } catch (auditError) {
      console.error('Failed to create audit log:', auditError);
    }

    // Recalculate all offense counts for this student to ensure consistency
    try {
      await recalculateForStudent(String(body.studentNumber));
    } catch (recalcError) {
      console.error('[DISCIPLINARY POST] Recalculate failed (non-blocking):', recalcError);
    }

    // Notify staff about new violation citation
    try {
      await notifyStaff({
        type: 'disciplinary_update',
        message: `New violation citation: ${newCase.studentName} — ${newCase.violationType} (${offenseCount === 1 ? '1st' : offenseCount === 2 ? '2nd' : offenseCount === 3 ? '3rd' : offenseCount + 'th'} Offense)`,
        referenceId: newCase.id,
        referenceType: 'disciplinary',
      });
      await signalDataRefresh({ module: 'disciplinary', action: 'create', recordId: newCase.id });
    } catch (notifyError) {
      console.error('[DISCIPLINARY POST] Failed to send notification:', notifyError);
    }

    // Return the new case with offense history
    const result = await db.disciplinaryCase.findUnique({
      where: { id: newCase.id },
      include: {
        offenseHistory: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('[DISCIPLINARY POST] Failed to create disciplinary case:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Session/body must have been populated for the retry path to be valid
    if (!session) {
      return NextResponse.json(
        { error: 'Failed to create disciplinary case', detail: message },
        { status: 500 },
      );
    }

    // If the error is about a missing column, try auto-migration and retry once
    if (message.includes('does not exist') && message.includes('column')) {
      try {
        const { runAutoMigration } = await import('@/lib/db-migrate');
        const migrated = await runAutoMigration();
        if (migrated) {
          // Retry the case creation
          try {
            const newCase = await db.disciplinaryCase.create({
              data: {
                studentName: String(body.studentName),
                studentNumber: String(body.studentNumber),
                sex: body.sex ? String(body.sex) : null,
                collegeInstitute: body.collegeInstitute ? String(body.collegeInstitute) : null,
                umakEmail: body.umakEmail ? String(body.umakEmail) : null,
                violationType: String(body.violationType),
                violationCategory: category,
                otherCategorySpecified: body.otherCategorySpecified ? String(body.otherCategorySpecified) : null,
                description: body.description ? String(body.description) : null,
                actionTaken: body.actionTaken ? String(body.actionTaken) : defaultAction,
                offenseCount,
                status: statusLabel,
                dateOfInfraction: body.dateOfInfraction ? String(body.dateOfInfraction) : null,
                fileUrls: sanitizedFileUrls,
                officerName: body.officerName ? String(body.officerName) : null,
              },
            });

            // Create offense history entry
            await db.offenseHistory.create({
              data: {
                studentNumber: String(body.studentNumber),
                violationType: String(body.violationType),
                violationCategory: category,
                otherCategorySpecified: body.otherCategorySpecified ? String(body.otherCategorySpecified) : null,
                offenseCount,
                disciplinaryCaseId: newCase.id,
                dateOfInfraction: body.dateOfInfraction ? String(body.dateOfInfraction) : null,
              },
            });

            // Create audit log (non-blocking)
            try {
              await db.auditLog.create({
                data: {
                  actionType: 'CREATE',
                  module: 'disciplinary',
                  recordId: newCase.id,
                  newValue: JSON.stringify(newCase),
                  performerName: session.user.fullName || String(body.officerName || 'System'),
                  performerRole: session.user.role,
                  performedBy: session.user.id,
                },
              });
            } catch (auditError) {
              console.error('Failed to create audit log:', auditError);
            }

            // Recalculate all offense counts for this student
            await recalculateForStudent(String(body.studentNumber));

            // Send citation notification email to the student (non-blocking)
            if (newCase.umakEmail) {
              Promise.resolve().then(async () => {
                try {
                  const offenseLabel = `${offenseCount}${offenseCount === 1 ? 'st' : offenseCount === 2 ? 'nd' : offenseCount === 3 ? 'rd' : 'th'} Offense`;
                  const fileAttachments = await downloadFilesAsAttachments(parseFileUrls(newCase.fileUrls));
                  await sendEmail({
                    to: newCase.umakEmail!,
                    subject: `Violation Citation Notice — ${newCase.violationType}`,
                    html: violationCitationHtml({
                      studentName: newCase.studentName,
                      violationType: newCase.violationType,
                      violationCategory: newCase.violationCategory,
                      offenseCount,
                      offenseLabel,
                      actionTaken: newCase.actionTaken || defaultAction,
                      dateOfInfraction: newCase.dateOfInfraction || undefined,
                      description: newCase.description || undefined,
                      officerName: body.officerName ? String(body.officerName) : undefined,
                    }),
                    attachments: fileAttachments.length > 0 ? fileAttachments : undefined,
                  });
                } catch (emailError) {
                  console.error('[DISCIPLINARY POST] Failed to send citation email to student (retry):', emailError);
                }
              }).catch(() => {});
            }

            // Notify staff about new violation citation (retry path)
            try {
              await notifyStaff({
                type: 'disciplinary_update',
                message: `New violation citation: ${newCase.studentName} — ${newCase.violationType} (${offenseCount === 1 ? '1st' : offenseCount === 2 ? '2nd' : offenseCount === 3 ? '3rd' : offenseCount + 'th'} Offense)`,
                referenceId: newCase.id,
                referenceType: 'disciplinary',
              });
              await signalDataRefresh({ module: 'disciplinary', action: 'create', recordId: newCase.id });
            } catch (notifyError) {
              console.error('[DISCIPLINARY POST] Failed to send notification (retry):', notifyError);
            }

            const result = await db.disciplinaryCase.findUnique({
              where: { id: newCase.id },
              include: { offenseHistory: { orderBy: { createdAt: 'desc' } } },
            });

            return NextResponse.json(result, { status: 201 });
          } catch (retryError) {
            const retryMessage = retryError instanceof Error ? retryError.message : 'Unknown error';
            return NextResponse.json(
              { error: 'Failed to create disciplinary case after auto-migration', detail: retryMessage },
              { status: 500 }
            );
          }
        }
      } catch (migrationError) {
        console.error('[DISCIPLINARY POST] Auto-migration failed:', migrationError instanceof Error ? migrationError.message : String(migrationError));
      }
    }

    return NextResponse.json(
      { error: 'Failed to create disciplinary case', detail: message },
      { status: 500 }
    );
  }
}
