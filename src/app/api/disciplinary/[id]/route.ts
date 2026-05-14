import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/session';
import { recalculateForStudent, getActionForOffense, getStatusLabel } from '@/lib/offense-counting';
import { Prisma } from '@prisma/client';
import { sendEmail, violationStatusUpdateHtml, downloadFilesAsAttachments, parseFileUrls } from '@/lib/email';
import { notifyStaff, signalDataRefresh } from '@/lib/notifications';
import { revalidatePath } from 'next/cache';

// Helper to extract Prisma-specific error details
function getPrismaErrorDetail(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return `[Prisma ${error.code}] ${error.message} | Meta: ${JSON.stringify(error.meta)}`;
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    return `[Prisma Validation] ${error.message}`;
  }
  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return `[Prisma Unknown] ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const caseRecord = await db.disciplinaryCase.findUnique({
      where: { id },
    });

    if (!caseRecord) {
      return NextResponse.json(
        { error: 'Disciplinary case not found' },
        { status: 404 }
      );
    }

    // Fetch ALL offense history for this student (not just linked to this case)
    const allOffenseHistory = await db.offenseHistory.findMany({
      where: {
        studentNumber: caseRecord.studentNumber,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      ...caseRecord,
      offenseHistory: allOffenseHistory,
    });
  } catch (error) {
    console.error('Failed to fetch disciplinary case:', error);
    return NextResponse.json(
      { error: 'Failed to fetch disciplinary case' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user?.role as string;
    if (!['admin', 'staff', 'superadmin'].includes(userRole)) {
      return NextResponse.json({ error: 'Forbidden: Only staff and administrators can modify disciplinary cases.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await db.disciplinaryCase.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Disciplinary case not found' },
        { status: 404 }
      );
    }

    // Handle clear action — clears offenses based on counting rules:
    // MINOR: clear offenses with the SAME violationType for this student
    // MAJOR: clear ALL major offenses for this student
    // LATE_*/OTHER: clear offenses with the SAME violationCategory for this student
    if (body.action === 'clear') {
      if (!body.clearReason || !body.clearReason.trim()) {
        return NextResponse.json(
          { error: 'A reason is required to clear offenses' },
          { status: 400 }
        );
      }

      const clearedByName = body.clearedByName || 'System';
      const clearReason = body.clearReason.trim();

      // Wrap the entire clear operation in an interactive transaction.
      // This ensures all queries run on the SAME database connection,
      // which is critical when using PgBouncer (Supabase) in transaction mode.
      // Without a transaction, queries can be routed to different backend
      // connections, causing prepared statement errors (42P05).
      const clearResult = await db.$transaction(async (tx) => {
        // Step 1: Build the where clause based on counting rules
        // isCleared is NOT NULL DEFAULT false, so isCleared: false is sufficient
        const clearWhere: Prisma.DisciplinaryCaseWhereInput = {
          studentNumber: existing.studentNumber,
          isCleared: false,
        };

        if (existing.violationCategory === 'MINOR') {
          // For MINOR: clear offenses of the SAME violation type
          clearWhere.violationType = existing.violationType;
          clearWhere.violationCategory = 'MINOR';
        } else if (existing.violationCategory === 'MAJOR') {
          // For MAJOR: clear ALL major offenses
          clearWhere.violationCategory = 'MAJOR';
        } else {
          // For OTHER/LATE_*: clear by same violationCategory
          clearWhere.violationCategory = existing.violationCategory;
        }

        console.log('[CLEAR] Step 1: Finding cases with where:', JSON.stringify(clearWhere));

        const allCasesForGroup = await tx.disciplinaryCase.findMany({
          where: clearWhere,
          select: { id: true },
        });

        const caseIds = allCasesForGroup.map(c => c.id);
        console.log('[CLEAR] Step 2: Found', caseIds.length, 'cases to clear');

        if (caseIds.length === 0) {
          // No cases to clear — still return the current case
          return { clearedCount: 0, caseIds: [] };
        }

        // Step 2: Update all matching cases as cleared
        await tx.disciplinaryCase.updateMany({
          where: {
            id: { in: caseIds },
          },
          data: {
            isCleared: true,
            clearedByName,
            clearedAt: new Date(),
            clearReason,
            status: 'Cleared',
          },
        });
        console.log('[CLEAR] Step 3: Updated', caseIds.length, 'DisciplinaryCase records');

        // Step 3: Update all related offense history entries as cleared
        await tx.offenseHistory.updateMany({
          where: {
            disciplinaryCaseId: { in: caseIds },
          },
          data: {
            isCleared: true,
            clearedByName,
            clearedAt: new Date(),
            clearReason,
          },
        });
        console.log('[CLEAR] Step 4: Updated linked OffenseHistory records');

        // Step 4: Also update any orphaned offense history for the same group
        // (entries that may not be linked to a DisciplinaryCase record)
        const orphanWhere: Prisma.OffenseHistoryWhereInput = {
          studentNumber: existing.studentNumber,
          isCleared: false,
        };

        if (existing.violationCategory === 'MINOR') {
          orphanWhere.violationType = existing.violationType;
          orphanWhere.violationCategory = 'MINOR';
        } else if (existing.violationCategory === 'MAJOR') {
          orphanWhere.violationCategory = 'MAJOR';
        } else {
          orphanWhere.violationCategory = existing.violationCategory;
        }

        await tx.offenseHistory.updateMany({
          where: orphanWhere,
          data: {
            isCleared: true,
            clearedByName,
            clearedAt: new Date(),
            clearReason,
          },
        });
        console.log('[CLEAR] Step 5: Updated orphaned OffenseHistory records');

        return { clearedCount: caseIds.length, caseIds };
      }, {
        maxWait: 15000,  // Max time to wait for a connection from the pool
        timeout: 30000,  // Max time for the entire transaction
      });

      console.log('[CLEAR] Transaction completed. Cleared', clearResult.clearedCount, 'cases');

      // Create audit log (non-blocking — don't let this fail the clear operation)
      try {
        // Safe JSON serialization for Prisma objects with Date fields
        const safeOldValue = JSON.stringify(existing, (_, value) =>
          value instanceof Date ? value.toISOString() : value
        );
        await db.auditLog.create({
          data: {
            actionType: 'CLEAR_OFFENSE',
            module: 'disciplinary',
            recordId: id,
            oldValue: safeOldValue,
            newValue: JSON.stringify({
              clearedCases: clearResult.clearedCount,
              studentNumber: existing.studentNumber,
              violationCategory: existing.violationCategory,
            }),
            performerName: clearedByName,
            remarks: clearReason,
          },
        });
      } catch (auditError) {
        console.error('[CLEAR] Failed to create audit log (non-blocking):', getPrismaErrorDetail(auditError));
      }

      // Send email notification to student about offense clearing (non-blocking)
      if (existing.umakEmail) {
        const fileAttachments = await downloadFilesAsAttachments(parseFileUrls(existing.fileUrls));
        Promise.resolve().then(async () => {
          try {
            await sendEmail({
              to: existing.umakEmail!,
              subject: `Offense Cleared — ${existing.violationType}`,
              html: violationStatusUpdateHtml({
                studentName: existing.studentName,
                violationType: existing.violationType,
                violationCategory: existing.violationCategory,
                action: 'clear',
                actionLabel: 'Offense Cleared',
                details: clearReason,
                performedByName: clearedByName,
              }),
              attachments: fileAttachments.length > 0 ? fileAttachments : undefined,
            });
          } catch (emailError) {
            console.error('[CLEAR] Failed to send clearance email to student:', emailError);
          }
        }).catch(() => {});
      }

      // Notify staff about offense clearing
      try {
        await notifyStaff({
          type: 'disciplinary_update',
          message: `Offense cleared for ${existing.studentName} — ${existing.violationType}: ${clearReason}`,
          referenceId: id,
          referenceType: 'disciplinary',
          excludeUserId: session?.user?.id,
        });
        await signalDataRefresh({ module: 'disciplinary', action: 'clear', recordId: id });
      } catch (notifError) {
        console.error('[CLEAR] Failed to send notification:', notifError);
      }

      // Recalculate offense counts (non-blocking — don't let this fail the clear operation)
      try {
        await recalculateForStudent(existing.studentNumber);
        console.log('[CLEAR] Recalculation completed successfully');
      } catch (recalcError) {
        console.error('[CLEAR] Failed to recalculate offense counts (non-blocking):', getPrismaErrorDetail(recalcError));
      }

      // Return the requested case with updated offense history
      const result = await db.disciplinaryCase.findUnique({
        where: { id },
        include: {
          offenseHistory: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!result) {
        // Edge case: case was deleted between clearing and fetching
        console.warn('[CLEAR] Case not found after clearing, returning minimal response');
        return NextResponse.json({
          id,
          isCleared: true,
          status: 'Cleared',
          _clearedCount: clearResult.clearedCount,
        });
      }

      return NextResponse.json({
        ...result,
        _clearedCount: clearResult.clearedCount,
      });
    }

    // Handle endorse action
    if (body.action === 'endorse') {
      if (!body.endorsementNotes || !body.endorsementNotes.trim()) {
        return NextResponse.json(
          { error: 'Endorsement notes are required' },
          { status: 400 }
        );
      }

      const endorsedByName = body.endorsedByName || 'System';
      const endorsementNotes = body.endorsementNotes.trim();

      const updated = await db.disciplinaryCase.update({
        where: { id },
        data: {
          isEndorsed: true,
          endorsedByName,
          endorsedAt: new Date(),
          endorsementNotes,
        },
      });

      await db.auditLog.create({
        data: {
          actionType: 'ENDORSE',
          module: 'disciplinary',
          recordId: id,
          oldValue: JSON.stringify(existing),
          newValue: JSON.stringify(updated),
          performerName: endorsedByName,
          remarks: endorsementNotes,
        },
      }).catch(auditError => console.error('Failed to create audit log:', getPrismaErrorDetail(auditError)));

      // Send email notification to student about endorsement (non-blocking)
      if (existing.umakEmail) {
        const fileAttachments = await downloadFilesAsAttachments(parseFileUrls(existing.fileUrls));
        Promise.resolve().then(async () => {
          try {
            await sendEmail({
              to: existing.umakEmail!,
              subject: `Case Endorsed — ${existing.violationType}`,
              html: violationStatusUpdateHtml({
                studentName: existing.studentName,
                violationType: existing.violationType,
                violationCategory: existing.violationCategory,
                action: 'endorse',
                actionLabel: 'Case Endorsed for Community Service',
                details: endorsementNotes,
                performedByName: endorsedByName,
              }),
              attachments: fileAttachments.length > 0 ? fileAttachments : undefined,
            });
          } catch (emailError) {
            console.error('[ENDORSE] Failed to send endorsement email to student:', emailError);
          }
        }).catch(() => {});
      }

      try {
        await notifyStaff({
          type: 'disciplinary_update',
          message: `Case endorsed for ${existing.studentName} — ${existing.violationType}`,
          referenceId: id,
          referenceType: 'disciplinary',
          excludeUserId: session?.user?.id,
        });
        await signalDataRefresh({ module: 'disciplinary', action: 'endorse', recordId: id });
      } catch (notifError) {
        console.error('[ENDORSE] Failed to send notification:', notifError);
      }

      const result = await db.disciplinaryCase.findUnique({
        where: { id },
        include: {
          offenseHistory: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      return NextResponse.json(result);
    }

    // Handle deploy action — sets deployment info
    if (body.action === 'deploy') {
      if (!existing.isEndorsed) {
        return NextResponse.json(
          { error: 'Case must be endorsed before setting deployment info' },
          { status: 400 }
        );
      }

      // Validation: if status is Under AIP, aipExpectedOutput is required
      if (body.deploymentStatus === 'Under AIP' && (!body.aipExpectedOutput || !body.aipExpectedOutput.trim())) {
        return NextResponse.json(
          { error: 'AIP Expected Output is required when deployment status is "Under AIP"' },
          { status: 400 }
        );
      }

      const deployData: Record<string, unknown> = {};

      if (body.deploymentStatus !== undefined) deployData.deploymentStatus = body.deploymentStatus;
      if (body.deploymentOffice !== undefined) deployData.deploymentOffice = body.deploymentOffice?.trim() || null;
      if (body.deploymentDateFrom !== undefined) {
        deployData.deploymentDateFrom = body.deploymentDateFrom ? new Date(body.deploymentDateFrom) : null;
      }
      if (body.deploymentDateTo !== undefined) {
        deployData.deploymentDateTo = body.deploymentDateTo ? new Date(body.deploymentDateTo) : null;
      }
      if (body.deploymentHoursToRender !== undefined) deployData.deploymentHoursToRender = body.deploymentHoursToRender?.trim() || null;
      if (body.deploymentAssessmentHours !== undefined) deployData.deploymentAssessmentHours = body.deploymentAssessmentHours?.trim() || null;
      if (body.deploymentRemarks !== undefined) deployData.deploymentRemarks = body.deploymentRemarks?.trim() || null;
      if (body.aipExpectedOutput !== undefined) deployData.aipExpectedOutput = body.aipExpectedOutput?.trim() || null;

      // Only set settlement info when TRANSITIONING to 'Settled' from a different status
      // This prevents resetting the settlement date when editing an already-settled case
      if (body.deploymentStatus === 'Settled' && existing.deploymentStatus !== 'Settled') {
        if (body.settlementDate !== undefined) {
          deployData.settlementDate = body.settlementDate ? new Date(body.settlementDate) : new Date();
        } else {
          deployData.settlementDate = new Date();
        }
        if (body.settledByName !== undefined) {
          deployData.settledByName = body.settledByName;
        } else {
          deployData.settledByName = body.officerName || 'System';
        }
      }

      // If changing from 'Settled' to something else, reset settlement fields
      if (existing.deploymentStatus === 'Settled' && body.deploymentStatus && body.deploymentStatus !== 'Settled') {
        deployData.settlementDate = null;
        deployData.settledByName = null;
      }

      const updated = await db.disciplinaryCase.update({
        where: { id },
        data: deployData,
      });

      await db.auditLog.create({
        data: {
          actionType: 'DEPLOY',
          module: 'disciplinary',
          recordId: id,
          oldValue: JSON.stringify(existing),
          newValue: JSON.stringify(updated),
          performerName: body.officerName || 'System',
          remarks: `Deployment info updated — Status: ${body.deploymentStatus || existing.deploymentStatus}`,
        },
      }).catch(auditError => console.error('Failed to create audit log:', getPrismaErrorDetail(auditError)));

      // Send email notification to student about deployment update (non-blocking)
      if (existing.umakEmail) {
        const fileAttachments = await downloadFilesAsAttachments(parseFileUrls(existing.fileUrls));
        Promise.resolve().then(async () => {
          try {
            await sendEmail({
              to: existing.umakEmail!,
              subject: `Deployment Update — ${existing.violationType}`,
              html: violationStatusUpdateHtml({
                studentName: existing.studentName,
                violationType: existing.violationType,
                violationCategory: existing.violationCategory,
                action: 'deploy',
                actionLabel: 'Deployment Updated',
                details: `Status: ${body.deploymentStatus || existing.deploymentStatus}`,
                performedByName: body.officerName || undefined,
                deploymentStatus: body.deploymentStatus || existing.deploymentStatus,
                deploymentOffice: body.deploymentOffice || existing.deploymentOffice,
                deploymentDateFrom: body.deploymentDateFrom ? new Date(body.deploymentDateFrom).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : undefined,
                deploymentDateTo: body.deploymentDateTo ? new Date(body.deploymentDateTo).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : undefined,
                deploymentHoursToRender: body.deploymentHoursToRender || existing.deploymentHoursToRender,
                deploymentAssessmentHours: body.deploymentAssessmentHours || existing.deploymentAssessmentHours,
                deploymentRemarks: body.deploymentRemarks || existing.deploymentRemarks,
                aipExpectedOutput: body.aipExpectedOutput || existing.aipExpectedOutput,
              }),
              attachments: fileAttachments.length > 0 ? fileAttachments : undefined,
            });
          } catch (emailError) {
            console.error('[DEPLOY] Failed to send deployment email to student:', emailError);
          }
        }).catch(() => {});
      }

      try {
        await notifyStaff({
          type: 'disciplinary_update',
          message: `Deployment updated for ${existing.studentName} — ${existing.violationType}: ${body.deploymentStatus || existing.deploymentStatus}`,
          referenceId: id,
          referenceType: 'disciplinary',
          excludeUserId: session?.user?.id,
        });
        await signalDataRefresh({ module: 'disciplinary', action: 'deploy', recordId: id });
      } catch (notifError) {
        console.error('[DEPLOY] Failed to send notification:', notifError);
      }

      const result = await db.disciplinaryCase.findUnique({
        where: { id },
        include: {
          offenseHistory: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      return NextResponse.json(result);
    }

    // Handle settle action — marks community service as settled
    if (body.action === 'settle') {
      if (!existing.isEndorsed) {
        return NextResponse.json(
          { error: 'Case must be endorsed before settling' },
          { status: 400 }
        );
      }

      if (existing.deploymentStatus === 'Settled') {
        return NextResponse.json(
          { error: 'Case is already settled' },
          { status: 400 }
        );
      }

      const settledByName = body.settledByName || 'System';
      const settlementDate = body.settlementDate ? new Date(body.settlementDate) : new Date();

      const updated = await db.disciplinaryCase.update({
        where: { id },
        data: {
          deploymentStatus: 'Settled',
          settlementDate,
          settledByName,
        },
      });

      await db.auditLog.create({
        data: {
          actionType: 'SETTLE',
          module: 'disciplinary',
          recordId: id,
          oldValue: JSON.stringify(existing),
          newValue: JSON.stringify(updated),
          performerName: settledByName,
          remarks: `Community service settled on ${settlementDate.toISOString()}`,
        },
      }).catch(auditError => console.error('Failed to create audit log:', getPrismaErrorDetail(auditError)));

      // Send email notification to student about settlement (non-blocking)
      if (existing.umakEmail) {
        const fileAttachments = await downloadFilesAsAttachments(parseFileUrls(existing.fileUrls));
        Promise.resolve().then(async () => {
          try {
            await sendEmail({
              to: existing.umakEmail!,
              subject: `Community Service Settled — ${existing.violationType}`,
              html: violationStatusUpdateHtml({
                studentName: existing.studentName,
                violationType: existing.violationType,
                violationCategory: existing.violationCategory,
                action: 'settle',
                actionLabel: 'Community Service Settled',
                performedByName: settledByName,
                settlementDate: settlementDate.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }),
                settledByName: settledByName,
              }),
              attachments: fileAttachments.length > 0 ? fileAttachments : undefined,
            });
          } catch (emailError) {
            console.error('[SETTLE] Failed to send settlement email to student:', emailError);
          }
        }).catch(() => {});
      }

      try {
        await notifyStaff({
          type: 'disciplinary_update',
          message: `Community service settled for ${existing.studentName} — ${existing.violationType}`,
          referenceId: id,
          referenceType: 'disciplinary',
          excludeUserId: session?.user?.id,
        });
        await signalDataRefresh({ module: 'disciplinary', action: 'settle', recordId: id });
      } catch (notifError) {
        console.error('[SETTLE] Failed to send notification:', notifError);
      }

      const result = await db.disciplinaryCase.findUnique({
        where: { id },
        include: {
          offenseHistory: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      return NextResponse.json(result);
    }

    // Regular update — ONLY basic case fields, NOT deployment fields
    // Deployment updates must go through the 'deploy' action which has isEndorsed validation
    const updateData: Record<string, unknown> = {
      studentName: body.studentName ?? existing.studentName,
      studentNumber: body.studentNumber ?? existing.studentNumber,
      sex: body.sex ?? existing.sex,
      collegeInstitute: body.collegeInstitute ?? existing.collegeInstitute,
      umakEmail: body.umakEmail ?? existing.umakEmail,
      violationType: body.violationType ?? existing.violationType,
      violationCategory: body.violationCategory ?? existing.violationCategory,
      otherCategorySpecified: body.otherCategorySpecified !== undefined ? body.otherCategorySpecified : existing.otherCategorySpecified,
      description: body.description ?? existing.description,
      actionTaken: body.actionTaken ?? existing.actionTaken,
      status: body.status ?? existing.status,
      dateOfInfraction: body.dateOfInfraction ?? existing.dateOfInfraction,
      officerName: body.officerName ?? existing.officerName,
    };

    // Handle fileUrls update
    if (body.fileUrls !== undefined) {
      updateData.fileUrls = typeof body.fileUrls === 'string'
        ? body.fileUrls
        : JSON.stringify(body.fileUrls.filter((u: unknown) => typeof u === 'string'));
    }

    const updated = await db.disciplinaryCase.update({
      where: { id },
      data: updateData,
    });

    // Create audit log (non-blocking)
    try {
      await db.auditLog.create({
        data: {
          actionType: 'UPDATE',
          module: 'disciplinary',
          recordId: id,
          oldValue: JSON.stringify(existing),
          newValue: JSON.stringify(updated),
          performerName: body.officerName || 'System',
        },
      });
    } catch (auditError) {
      console.error('Failed to create audit log:', getPrismaErrorDetail(auditError));
    }

    // If key fields changed (violationCategory, violationType, studentNumber), recalculate
    const needsRecalc =
      (body.violationCategory && body.violationCategory !== existing.violationCategory) ||
      (body.violationType && body.violationType !== existing.violationType) ||
      (body.studentNumber && body.studentNumber !== existing.studentNumber);

    if (needsRecalc) {
      // Recalculate for both old and new student numbers (non-blocking)
      try {
        await recalculateForStudent(existing.studentNumber);
      } catch (recalcError) {
        console.error('Failed to recalculate for old student:', getPrismaErrorDetail(recalcError));
      }
      if (body.studentNumber && body.studentNumber !== existing.studentNumber) {
        try {
          await recalculateForStudent(body.studentNumber);
        } catch (recalcError) {
          console.error('Failed to recalculate for new student:', getPrismaErrorDetail(recalcError));
        }
      }
    }

    // Send email notification to student about case update (non-blocking)
    // Email is sent for ALL updates, not just when recalculation is needed
    if (updated.umakEmail) {
      const fileAttachments = await downloadFilesAsAttachments(parseFileUrls(existing.fileUrls));
      Promise.resolve().then(async () => {
        try {
          await sendEmail({
            to: updated.umakEmail!,
            subject: `Violation Record Updated — ${updated.violationType}`,
            html: violationStatusUpdateHtml({
              studentName: updated.studentName,
              violationType: updated.violationType,
              violationCategory: updated.violationCategory,
              action: 'update',
              actionLabel: 'Violation Record Updated',
              performedByName: body.officerName || undefined,
            }),
            attachments: fileAttachments.length > 0 ? fileAttachments : undefined,
          });
        } catch (emailError) {
          console.error('[DISCIPLINARY PATCH] Failed to send update email to student:', emailError);
        }
      }).catch(() => {});
    }

    try {
      await notifyStaff({
        type: 'disciplinary_update',
        message: `Violation record updated for ${existing.studentName} — ${existing.violationType}`,
        referenceId: id,
        referenceType: 'disciplinary',
        excludeUserId: session?.user?.id,
      });
      await signalDataRefresh({ module: 'disciplinary', action: 'update', recordId: id });
    } catch (notifError) {
      console.error('[DISCIPLINARY PATCH] Failed to send notification:', notifError);
    }

    const result = await db.disciplinaryCase.findUnique({
      where: { id },
      include: {
        offenseHistory: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[DISCIPLINARY PATCH] Failed to update disciplinary case:', error);
    const detail = getPrismaErrorDetail(error);
    console.error('[DISCIPLINARY PATCH] Error detail:', detail);
    return NextResponse.json(
      { error: 'Failed to update disciplinary case', detail },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden: Only superadmin can delete disciplinary cases.' }, { status: 403 });
    }

    const { id } = await params;

    const existingCase = await db.disciplinaryCase.findUnique({
      where: { id },
    });

    if (!existingCase) {
      return NextResponse.json({ error: 'Disciplinary case not found' }, { status: 404 });
    }

    // Delete the case — related OffenseHistory records are auto-deleted via onDelete: Cascade
    await db.disciplinaryCase.delete({
      where: { id },
    });

    await db.auditLog.create({
      data: {
        performedBy: session.user.id,
        performerName: session.user.fullName,
        performerRole: session.user.role,
        actionType: 'DELETE',
        module: 'disciplinary',
        recordId: id,
        oldValue: JSON.stringify(existingCase),
        newValue: null,
        remarks: 'Disciplinary case deleted by superadmin',
      },
    });

    // Recalculate offense counts for the student after deletion
    try {
      await recalculateForStudent(existingCase.studentNumber);
    } catch (recalcError) {
      console.error('[DELETE] Failed to recalculate offense counts:', getPrismaErrorDetail(recalcError));
    }

    revalidatePath('/disciplinary');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Disciplinary case delete error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Failed to delete disciplinary case' },
      { status: 500 }
    );
  }
}
