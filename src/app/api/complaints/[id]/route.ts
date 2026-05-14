import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendEmail, complaintStatusUpdateHtml, complaintProgressUpdateHtml, complaintRespondentStatusUpdateHtml, complaintRespondentProgressUpdateHtml, downloadFilesAsAttachments, parseFileUrls } from '@/lib/email';
import { getSessionFromRequest } from '@/lib/session';
import { notifyStaff, signalDataRefresh } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user || !['staff', 'admin', 'superadmin', 'student_assistant', 'makati_internship'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized. Only staff, admin, or superadmin can view complaint details.' }, { status: 403 });
    }

    const { id } = await params;
    const complaint = await db.complaint.findUnique({
      where: { id },
    });

    if (!complaint) {
      return NextResponse.json(
        { error: 'Complaint not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(complaint);
  } catch (error) {
    console.error('Failed to fetch complaint:', error);
    return NextResponse.json(
      { error: 'Failed to fetch complaint' },
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
    if (!session?.user || !['staff', 'admin', 'superadmin', 'student_assistant', 'makati_internship'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized. Only staff, admin, or superadmin can modify complaints.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await db.complaint.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Complaint not found' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (body.category !== undefined) updateData.category = body.category;
    if (body.caseStatus !== undefined) updateData.caseStatus = body.caseStatus;
    if (body.subject !== undefined) updateData.subject = body.subject;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.desiredOutcome !== undefined) updateData.desiredOutcome = body.desiredOutcome;
    if (body.complaintCategory !== undefined) updateData.complaintCategory = body.complaintCategory;
    if (body.dateOfIncident !== undefined) updateData.dateOfIncident = body.dateOfIncident;
    if (body.location !== undefined) updateData.location = body.location;
    if (body.isOngoing !== undefined) updateData.isOngoing = body.isOngoing;
    if (body.howOften !== undefined) updateData.howOften = body.howOften;
    if (body.witnesses !== undefined) updateData.witnesses = body.witnesses;
    if (body.previousReports !== undefined) updateData.previousReports = body.previousReports;
    if (body.encodedByName !== undefined) updateData.encodedByName = body.encodedByName;
    if (body.filedCase !== undefined) updateData.filedCase = body.filedCase;

    // Handle complainants update
    if (body.complainants !== undefined) {
      updateData.complainants = typeof body.complainants === 'string'
        ? body.complainants
        : JSON.stringify(body.complainants);
    }

    // Handle respondents update
    if (body.respondents !== undefined) {
      updateData.respondents = typeof body.respondents === 'string'
        ? body.respondents
        : JSON.stringify(body.respondents);
    }

    // Handle file URLs update
    if (body.fileUrls !== undefined) {
      updateData.fileUrls = typeof body.fileUrls === 'string'
        ? body.fileUrls
        : JSON.stringify(body.fileUrls);
    }

    // Handle progress updates - append to existing
    let addedProgress: { subject: string; details: string; asOf: string } | null = null;
    if (body.addProgress) {
      const now = new Date();
      const asOfFormatted = now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }) + ', ' + now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      let existingProgress: unknown[] = [];
      try {
        const parsed = existing.progressUpdates
          ? JSON.parse(existing.progressUpdates)
          : [];
        existingProgress = Array.isArray(parsed) ? parsed : [];
      } catch {
        existingProgress = [];
      }
      const newProgress = {
        ...body.addProgress,
        id: crypto.randomUUID(),
        createdAt: now.toISOString(),
        asOf: asOfFormatted,
      };
      existingProgress.push(newProgress);
      updateData.progressUpdates = JSON.stringify(existingProgress);
      addedProgress = {
        subject: body.addProgress.subject || 'Progress Update',
        details: body.addProgress.details || '',
        asOf: asOfFormatted,
      };
    }

    // Handle modifications - save snapshot before modification
    if (body.saveModification) {
      let existingMods: unknown[] = [];
      try {
        const parsed = existing.modifications
          ? JSON.parse(existing.modifications)
          : [];
        existingMods = Array.isArray(parsed) ? parsed : [];
      } catch {
        existingMods = [];
      }
      // Save current state as a snapshot
      existingMods.push({
        id: crypto.randomUUID(),
        modifiedAt: new Date().toISOString(),
        modifiedBy: body.modifiedBy || 'System',
        snapshot: {
          subject: existing.subject,
          description: existing.description,
          complainants: existing.complainants,
          respondents: existing.respondents,
          category: existing.category,
          caseStatus: existing.caseStatus,
        },
      });
      updateData.modifications = JSON.stringify(existingMods);
    }

    const updated = await db.complaint.update({
      where: { id },
      data: updateData,
    });

    // Helper: extract all complainant emails and names
    const complainantsData = (() => {
      try { return JSON.parse(updateData.complainants as string || existing.complainants || '[]'); } catch { return []; }
    })();

    // Helper: build common complaint detail fields from the existing record
    const complaintDetailFields = {
      description: existing.description,
      location: existing.location,
      dateOfIncident: existing.dateOfIncident,
      desiredOutcome: existing.desiredOutcome,
      complaintCategory: existing.complaintCategory,
      violationType: existing.violationType,
      isOngoing: existing.isOngoing,
      howOften: existing.howOften,
      witnesses: existing.witnesses,
      previousReports: existing.previousReports,
      filedCase: existing.filedCase,
      category: existing.category,
      complainantNames: (() => {
        try {
          const c = JSON.parse(updateData.complainants as string || existing.complainants || '[]');
          return Array.isArray(c) ? c.map((p: { givenName?: string; surname?: string }) => `${p.givenName || ''} ${p.surname || ''}`.trim()).join(', ') : '';
        } catch { return ''; }
      })(),
      respondentNames: (() => {
        try {
          const r = JSON.parse(updateData.respondents as string || existing.respondents || '[]');
          return Array.isArray(r) && r.length > 0 ? r.map((p: { givenName?: string; surname?: string }) => `${p.givenName || ''} ${p.surname || ''}`.trim()).join(', ') : '';
        } catch { return ''; }
      })(),
    };

    // Send email notification when a progress update is added (non-blocking)
    if (addedProgress) {
      // Fire-and-forget — don't block the response, don't fail on error.
      // Use Promise.resolve().then() instead of setImmediate for Vercel compatibility.
      Promise.resolve().then(async () => {
        try {
          const fileAttachments = await downloadFilesAsAttachments(parseFileUrls(existing.fileUrls));
          for (const c of complainantsData) {
            if (c?.email) {
              const complainantName = `${c.givenName || ''} ${c.surname || ''}`.trim() || 'Complainant';
              await sendEmail({
                to: c.email,
                bcc: 'nuevasrein@gmail.com',
                subject: `Update on your complaint ${existing.complaintNumber}`,
                html: complaintProgressUpdateHtml({
                  complainantName,
                  complaintNumber: existing.complaintNumber,
                  trackingToken: existing.trackingToken,
                  progressSubject: addedProgress.subject,
                  progressDetails: addedProgress.details,
                  asOf: addedProgress.asOf,
                  updatedByName: body.encodedByName || body.modifiedBy || undefined,
                  ...complaintDetailFields,
                }),
                attachments: fileAttachments.length > 0 ? fileAttachments : undefined,
              });
            }
          }
        } catch (emailError) {
          console.error('Failed to send complaint progress update email:', emailError);
        }
      }).catch(() => {/* swallow unhandled rejection */});
    }

    // Send email notification to respondents when progress is added (non-blocking)
    if (addedProgress) {
      Promise.resolve().then(async () => {
        try {
          const respondentsData = (() => {
            try { return JSON.parse(existing.respondents || '[]'); } catch { return []; }
          })();
          const fileAttachments = await downloadFilesAsAttachments(parseFileUrls(existing.fileUrls));
          for (const r of respondentsData) {
            if (r?.email) {
              const respondentName = `${r.givenName || ''} ${r.surname || ''}`.trim() || 'Respondent';
              await sendEmail({
                to: r.email,
                subject: `Update on complaint ${existing.complaintNumber}`,
                html: complaintRespondentProgressUpdateHtml({
                  respondentName,
                  complaintNumber: existing.complaintNumber,
                  trackingToken: existing.trackingToken,
                  progressSubject: addedProgress.subject,
                  progressDetails: addedProgress.details,
                  asOf: addedProgress.asOf,
                  updatedByName: body.encodedByName || body.modifiedBy || undefined,
                  ...complaintDetailFields,
                }),
                attachments: fileAttachments.length > 0 ? fileAttachments : undefined,
              });
            }
          }
        } catch (emailError) {
          console.error('Failed to send respondent progress update email:', emailError);
        }
      }).catch(() => {});
    }

    // Send email notification when complaint status changes (non-blocking)
    if (body.caseStatus && body.caseStatus !== existing.caseStatus) {
      // Fire-and-forget — don't block the response, don't fail on error.
      // Use Promise.resolve().then() instead of setImmediate for Vercel compatibility.
      Promise.resolve().then(async () => {
        try {
          const fileAttachments = await downloadFilesAsAttachments(parseFileUrls(existing.fileUrls));
          for (const c of complainantsData) {
            if (c?.email) {
              const complainantName = `${c.givenName || ''} ${c.surname || ''}`.trim() || 'Complainant';
              await sendEmail({
                to: c.email,
                bcc: 'nuevasrein@gmail.com',
                subject: `Complaint Update - ${existing.complaintNumber} - ${body.caseStatus}`,
                html: complaintStatusUpdateHtml({
                  complainantName,
                  complaintNumber: existing.complaintNumber,
                  previousStatus: existing.caseStatus,
                  newStatus: body.caseStatus,
                  trackingToken: existing.trackingToken,
                  remarks: body.remarks,
                  reviewedByName: body.encodedByName || undefined,
                  ...complaintDetailFields,
                }),
                attachments: fileAttachments.length > 0 ? fileAttachments : undefined,
              });
            }
          }
        } catch (emailError) {
          console.error('Failed to send complaint status update email:', emailError);
        }
      }).catch(() => {/* swallow unhandled rejection */});
    }

    // Send email notification to respondents when complaint status changes (non-blocking)
    if (body.caseStatus && body.caseStatus !== existing.caseStatus) {
      Promise.resolve().then(async () => {
        try {
          const respondentsData = (() => {
            try { return JSON.parse(existing.respondents || '[]'); } catch { return []; }
          })();
          const fileAttachments = await downloadFilesAsAttachments(parseFileUrls(existing.fileUrls));
          for (const r of respondentsData) {
            if (r?.email) {
              const respondentName = `${r.givenName || ''} ${r.surname || ''}`.trim() || 'Respondent';
              await sendEmail({
                to: r.email,
                subject: `Complaint Update - ${existing.complaintNumber} - ${body.caseStatus}`,
                html: complaintRespondentStatusUpdateHtml({
                  respondentName,
                  complaintNumber: existing.complaintNumber,
                  previousStatus: existing.caseStatus,
                  newStatus: body.caseStatus,
                  trackingToken: existing.trackingToken,
                  remarks: body.remarks,
                  reviewedByName: body.encodedByName || undefined,
                  ...complaintDetailFields,
                }),
                attachments: fileAttachments.length > 0 ? fileAttachments : undefined,
              });
            }
          }
        } catch (emailError) {
          console.error('Failed to send respondent status update email:', emailError);
        }
      }).catch(() => {});
    }

    // Create audit log (non-blocking — don't fail the main operation if audit fails)
    try {
      await db.auditLog.create({
        data: {
          actionType: 'UPDATE',
          module: 'complaints',
          recordId: id,
          oldValue: JSON.stringify(existing),
          newValue: JSON.stringify(updated),
          performerName: session.user.fullName || body.modifiedBy || body.encodedByName || 'System',
          performedBy: session.user.id,
          performerRole: session.user.role,
        },
      });
    } catch (auditError) {
      console.error('Failed to create audit log:', auditError);
    }

    // Create in-app notifications for complaint updates
    try {
      if (body.caseStatus && body.caseStatus !== existing.caseStatus) {
        // ... existing email code stays ...

        // Also create in-app notification for staff
        await notifyStaff({
          type: 'complaint_update',
          message: `Complaint ${existing.complaintNumber} status: ${existing.caseStatus} → ${body.caseStatus}`,
          referenceId: id,
          referenceType: 'complaint',
          excludeUserId: session.user.id,
        });
        await signalDataRefresh({ module: 'complaints', action: 'status_change', recordId: id });
      }
      if (addedProgress) {
        // ... existing email code stays ...

        // Also create in-app notification for staff
        await notifyStaff({
          type: 'complaint_update',
          message: `Progress update on complaint ${existing.complaintNumber}: ${addedProgress.subject}`,
          referenceId: id,
          referenceType: 'complaint',
          excludeUserId: session.user.id,
        });
        await signalDataRefresh({ module: 'complaints', action: 'update', recordId: id });
      }
    } catch (notifError) {
      console.error('Failed to send complaint notification:', notifError);
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[COMPLAINT PATCH] Failed to update complaint:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to update complaint', detail: message },
      { status: 500 }
    );
  }
}
