import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/session';
import { sendEmail, serviceRequestStatusUpdateHtml, gmcReleaseEmailHtml } from '@/lib/email';
import { join } from 'path';
import { notifyStaff, signalDataRefresh } from '@/lib/notifications';
import { revalidatePath } from 'next/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds for PDF generation + email

// New status flow: Submitted → For Review → For Issuance → Issued
// Hold and Rejected are exceptional statuses

// Action → status mapping
const ACTION_STATUS_MAP: Record<string, string> = {
  review: 'For Review',
  for_issuance: 'For Issuance',
  issue: 'Issued',
  hold: 'Hold',
  reject: 'Rejected',
  regenerate: 'Issued', // Regenerate PDF without changing status
  // Legacy action support for backward compatibility
  process: 'For Review',
  mark_ready: 'For Issuance',
  release: 'Issued',
};

// Valid direct statuses
const VALID_STATUSES = ['Submitted', 'For Review', 'For Issuance', 'Issued', 'Hold', 'Rejected'];

// Status transition rules
const TRANSITION_RULES: Record<string, string[]> = {
  'Submitted': ['For Review', 'Hold', 'Rejected'],
  'For Review': ['For Issuance', 'Hold', 'Rejected'],
  'For Issuance': ['Issued', 'Hold', 'Rejected'],
  'Issued': [],
  'Hold': ['For Review', 'Rejected'],
  'Rejected': [],
  // Legacy status support
  'New': ['For Review', 'Hold', 'Rejected'],
  'Processing': ['For Issuance', 'Hold', 'Rejected'],
};

// User-friendly status labels
export const STATUS_LABELS: Record<string, string> = {
  'Submitted': 'Submitted',
  'For Review': 'For Review',
  'For Issuance': 'For Issuance',
  'Issued': 'Issued',
  'Hold': 'On Hold',
  'Rejected': 'Rejected',
  // Legacy
  'New': 'Submitted',
  'Processing': 'For Review',
};

/**
 * Helper: Generate a GMC certificate PDF and save it to disk.
 * Returns the PDF buffer, the public URL path, and any error message.
 * Uses dynamic import for pdfkit to avoid Turbopack bundling issues.
 *
 * NOTE: This function does NOT update the database. The caller is responsible
 * for persisting the certificatePdfUrl to the database.
 */
async function ensureGmcCertificate(existingRequest: {
  id: string;
  requestNumber: string;
  requestType: string;
  requestorName: string;
  requestorEmail: string;
  classification: string | null;
  formData: string;
  certificatePdfUrl: string | null;
}): Promise<{ pdfBuffer: Buffer; certificatePdfUrl: string; error?: string } | { pdfBuffer: null; certificatePdfUrl: null; error: string }> {
  try {
    // Parse form data
    const formData = JSON.parse(existingRequest.formData || '{}');

    // Get certificate config from CmsContent
    const certConfigs = await db.cmsContent.findMany({
      where: { key: { in: ['cert_academic_year', 'cert_background_url', 'cert_esignature_url', 'cert_director_name', 'cert_director_title'] } },
    });
    const configMap: Record<string, string> = {};
    for (const item of certConfigs) {
      configMap[item.key] = item.value;
    }

    // Determine classification
    let classification = existingRequest.classification || 'currently_enrolled';
    if (classification === 'graduate' || classification === 'graduate_alumni') {
      const graduateSubType = formData.graduateSubType;
      if (graduateSubType === 'hsu') {
        classification = 'graduate_hsu';
      } else {
        classification = 'graduate_college';
      }
    }

    // Build config for certificate generator
    const certConfig: Record<string, string> = {};
    if (configMap['cert_background_url']) {
      const bgUrl = configMap['cert_background_url'];
      if (bgUrl.startsWith('/')) {
        certConfig.backgroundPath = join(process.cwd(), 'public', bgUrl);
      }
    }
    if (configMap['cert_esignature_url']) {
      const sigUrl = configMap['cert_esignature_url'];
      if (sigUrl.startsWith('/')) {
        certConfig.esignaturePath = join(process.cwd(), 'public', sigUrl);
      }
    }

    // Import the certificate generator (uses dynamic import internally for pdfkit)
    const { generateGmcCertificate } = await import('@/lib/generate-gmc-certificate');

    const pdfBuffer = await generateGmcCertificate({
      fullName: existingRequest.requestorName,
      classification,
      yearLevel: formData.yearLevel || undefined,
      collegeInstitute: formData.collegeInstitute || existingRequest.collegeInstitute || undefined,
      academicYear: configMap['cert_academic_year'] || undefined,
      degreeTitle: formData.degreeTitle || undefined,
      purpose: formData.purpose || 'General',
      requestNumber: existingRequest.requestNumber,
      trackingToken: existingRequest.trackingToken,
      signaturePreference: formData.signaturePreference || 'wet_sign',
      config: certConfig,
    });

    // Store PDF as base64 data URL (Vercel filesystem is read-only)
    const certificatePdfUrl = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;

    return { pdfBuffer, certificatePdfUrl };
  } catch (certError) {
    const errorMsg = certError instanceof Error ? certError.message : String(certError);
    console.error('[GMC Certificate] Failed:', certError instanceof Error ? certError.message : String(certError));
    return { pdfBuffer: null, certificatePdfUrl: null, error: errorMsg };
  }
}

/**
 * Read an existing PDF from a data URL, or return null.
 */
async function readExistingPdf(certificatePdfUrl: string | null): Promise<Buffer | null> {
  if (!certificatePdfUrl) return null;

  // Handle data URLs (stored as base64 in DB for Vercel compatibility)
  if (certificatePdfUrl.startsWith('data:')) {
    try {
      const matches = certificatePdfUrl.match(/^data:[^;]+;base64,(.+)$/);
      if (matches) {
        const buf = Buffer.from(matches[1], 'base64');
        return buf;
      }
    } catch (err) {
      console.warn('[GMC] Failed to decode PDF data URL:', err);
      return null;
    }
  }

  return null;
}

/**
 * Send the status update email (fire-and-forget).
 */
async function sendStatusUpdateEmail(params: {
  to: string;
  requestorName: string;
  requestNumber: string;
  requestType: string;
  previousStatus: string;
  newStatus: string;
  remarks: string | null;
  trackingToken: string;
  reviewedByName: string | null;
  sessionUserFullName: string;
  action: string;
  pdfBuffer: Buffer | null;
}): Promise<void> {
  const {
    to, requestorName, requestNumber, requestType,
    previousStatus, newStatus, remarks, trackingToken,
    reviewedByName, sessionUserFullName, action, pdfBuffer,
  } = params;

  const statusLabel = STATUS_LABELS[newStatus] || newStatus;
  const previousLabel = STATUS_LABELS[previousStatus] || previousStatus;
  const notifiableStatuses = ['For Review', 'For Issuance', 'Issued', 'Hold', 'Rejected', 'Processing', 'Released'];

  if (!notifiableStatuses.includes(newStatus)) return;

  const statusUpdateAttachments: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }> = [];

  // Attach PDF for GMC Issued status
  if (newStatus === 'Issued' && requestType === 'GMC' && pdfBuffer) {
    statusUpdateAttachments.push({
      filename: `Good_Moral_Certificate_${requestNumber}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf',
    });
  }

  try {
    await sendEmail({
      to,
      bcc: 'nuevasrein@gmail.com',
      subject: `Service Request Update - ${requestNumber} - ${statusLabel}`,
      html: serviceRequestStatusUpdateHtml({
        requestorName,
        requestNumber,
        previousStatus: previousLabel,
        newStatus: statusLabel,
        remarks: remarks?.trim() || null,
        trackingToken,
        reviewedByName: (action !== 'issue' && action !== 'release') ? sessionUserFullName : (reviewedByName || undefined),
        requestType,
        issuedByName: (action === 'issue' || action === 'release') ? sessionUserFullName : null,
        issuedAt: (action === 'issue' || action === 'release') ? new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null,
      }),
      ...(statusUpdateAttachments.length > 0 ? { attachments: statusUpdateAttachments } : {}),
    });
  } catch (err) {
    console.error('[Email] Failed to send status update email:', err);
  }
}

/**
 * Send the GMC release email with PDF attachment (fire-and-forget).
 */
async function sendGmcReleaseEmail(params: {
  to: string;
  requestorName: string;
  requestNumber: string;
  issuedByName: string;
  pdfBuffer: Buffer | null;
}): Promise<void> {
  const { to, requestorName, requestNumber, issuedByName, pdfBuffer } = params;

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const releaseAttachments: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }> = [];

  if (pdfBuffer) {
    releaseAttachments.push({
      filename: `Good_Moral_Certificate_${requestNumber}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf',
    });
  } else {
    console.error(`[GMC Release] No PDF attachment for ${requestNumber}.`);
  }

  try {
    await sendEmail({
      to,
      bcc: 'nuevasrein@gmail.com',
      from: '"CSFD Good Moral" <csfdgoodmoral@umak.edu.ph>',
      subject: `Good Moral Certificate Request | PROCEED FOR DRY SEAL`,
      html: gmcReleaseEmailHtml({
        requestorName,
        requestNumber,
        formattedDate,
        issuedByName,
      }),
      ...(releaseAttachments.length > 0 ? { attachments: releaseAttachments } : {}),
    });
  } catch (releaseError) {
    console.error('[Email] Failed to send GMC release email:', releaseError);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { status, action, remarks, formData: updatedFormData, classification: updatedClassification } = body as {
      status?: string;
      action?: string;
      remarks?: string;
      formData?: Record<string, unknown>;
      classification?: string;
    };

    // Determine the target status from action or direct status
    let targetStatus: string | undefined;
    if (action) {
      targetStatus = ACTION_STATUS_MAP[action];
      if (!targetStatus) {
        return NextResponse.json(
          { error: `Invalid action. Must be one of: ${Object.keys(ACTION_STATUS_MAP).join(', ')}` },
          { status: 400 }
        );
      }
    } else if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
          { status: 400 }
        );
      }
      targetStatus = status;
    } else {
      return NextResponse.json(
        { error: 'Either action or status must be provided.' },
        { status: 400 }
      );
    }

    // Validate remarks for Hold and Reject
    if ((targetStatus === 'Hold' || targetStatus === 'Rejected') && (!remarks || !remarks.trim())) {
      return NextResponse.json(
        { error: 'Remarks are required for Hold/Reject actions.' },
        { status: 400 }
      );
    }

    // Find the existing request
    const existingRequest = await db.serviceRequest.findUnique({
      where: { id },
    });

    if (!existingRequest) {
      return NextResponse.json({ error: 'Service request not found' }, { status: 404 });
    }

    const previousStatus = existingRequest.status;

    // Validate status transitions
    // Skip transition validation for 'regenerate' action (stays in same status)
    const isRegenerate = action === 'regenerate';
    const allowedTransitions = TRANSITION_RULES[previousStatus] || [];
    if (!isRegenerate && !allowedTransitions.includes(targetStatus) && targetStatus !== previousStatus) {
      return NextResponse.json(
        { error: `Cannot transition from "${STATUS_LABELS[previousStatus] || previousStatus}" to "${STATUS_LABELS[targetStatus] || targetStatus}".` },
        { status: 400 }
      );
    }
    // For regenerate, ensure the request is in Issued or For Issuance status
    if (isRegenerate && previousStatus !== 'Issued' && previousStatus !== 'For Issuance') {
      return NextResponse.json(
        { error: 'Can only regenerate certificates for requests in Issued or For Issuance status.' },
        { status: 400 }
      );
    }

    // ── For GMC "issue" action: Generate PDF SYNCHRONOUSLY before updating DB ──
    // This ensures the user gets immediate feedback if PDF generation fails
    let pdfBuffer: Buffer | null = null;
    let certificatePdfUrl: string | null = existingRequest.certificatePdfUrl;

    let pdfError: string | null = null;

    if ((action === 'issue' || action === 'release') && existingRequest.requestType === 'GMC') {
      // Try to read existing PDF from disk first
      pdfBuffer = await readExistingPdf(existingRequest.certificatePdfUrl);

      // If no existing PDF, generate a new one
      if (!pdfBuffer) {
        const result = await ensureGmcCertificate(existingRequest);
        if (result.pdfBuffer) {
          pdfBuffer = result.pdfBuffer;
          certificatePdfUrl = result.certificatePdfUrl;
        } else {
          pdfError = result.error || 'Unknown PDF generation error';
          console.error(`[GMC Issue] Failed to generate PDF: ${pdfError}`);
          // Don't block the status update — PDF generation can be retried later
        }
      }
    }

    // ── For "for_issuance" action on GMC: Also generate PDF synchronously ──
    if ((action === 'for_issuance' || action === 'mark_ready') && existingRequest.requestType === 'GMC') {
      const result = await ensureGmcCertificate(existingRequest);
      if (result.pdfBuffer) {
        pdfBuffer = result.pdfBuffer;
        certificatePdfUrl = result.certificatePdfUrl;
      } else {
        pdfError = result.error || 'Unknown PDF generation error';
        console.warn(`[GMC For Issuance] PDF generation failed: ${pdfError}`);
      }
    }

    // ── For "regenerate" action: Generate PDF synchronously ──
    if (isRegenerate && existingRequest.requestType === 'GMC') {
      let requestForPdf = { ...existingRequest };
      if (updatedFormData && typeof updatedFormData === 'object') {
        const mergedFormData = { ...JSON.parse(existingRequest.formData || '{}'), ...updatedFormData };
        requestForPdf.formData = JSON.stringify(mergedFormData);
      }
      if (updatedClassification) {
        requestForPdf.classification = updatedClassification;
      }

      const result = await ensureGmcCertificate(requestForPdf);
      if (result.pdfBuffer) {
        pdfBuffer = result.pdfBuffer;
        certificatePdfUrl = result.certificatePdfUrl;
      } else {
        pdfError = result.error || 'Unknown PDF generation error';
        console.error(`[GMC Regenerate] Failed to regenerate PDF: ${pdfError}`);
      }
    }

    // ── IMMEDIATE: Update the request in the database ──
    const updateData: Record<string, unknown> = {};

    // Only update status if not regenerating (regenerate keeps same status)
    if (!isRegenerate) {
      updateData.status = targetStatus;
      updateData.remarks = remarks?.trim() || existingRequest.remarks;
    }

    // For regenerate, update formData and classification if provided
    if (isRegenerate) {
      if (updatedFormData && typeof updatedFormData === 'object') {
        const mergedFormData = { ...JSON.parse(existingRequest.formData || '{}'), ...updatedFormData };
        updateData.formData = JSON.stringify(mergedFormData);
      }
      if (updatedClassification) {
        updateData.classification = updatedClassification;
      }
    }

    // Set reviewedByName only for review/for_issuance actions, NOT for issue
    if (action === 'review' || action === 'for_issuance' || action === 'process' || action === 'mark_ready') {
      updateData.reviewedByName = session.user.fullName;
      updateData.reviewedAt = new Date();
    }

    // When issuing/releasing, also set issuedByName and issuedAt
    if (action === 'issue' || action === 'release') {
      updateData.issuedByName = session.user.fullName;
      updateData.issuedAt = new Date();
    }

    // Update certificatePdfUrl if we generated a new PDF
    if (certificatePdfUrl && certificatePdfUrl !== existingRequest.certificatePdfUrl) {
      updateData.certificatePdfUrl = certificatePdfUrl;
    }

    // Ensure we always have at least one field to update for Prisma
    if (isRegenerate && Object.keys(updateData).length === 0) {
      updateData.updatedAt = new Date();
    }

    const updatedRequest = await db.serviceRequest.update({
      where: { id },
      data: updateData,
    });

    // Create audit log entry (non-blocking)
    try {
      await db.auditLog.create({
        data: {
          performedBy: session.user.id,
          performerName: session.user.fullName,
          performerRole: session.user.role,
          actionType: isRegenerate ? 'CERTIFICATE_REGENERATED' : 'STATUS_UPDATE',
          module: 'service_request',
          recordId: id,
          oldValue: JSON.stringify({ status: previousStatus }),
          newValue: JSON.stringify({
            status: isRegenerate ? previousStatus : targetStatus,
            remarks: remarks?.trim() || null,
            action: action || null,
            pdfGenerated: !!pdfBuffer,
            ...(isRegenerate ? { formDataUpdated: !!updatedFormData, classificationUpdated: !!updatedClassification } : {}),
          }),
          remarks: isRegenerate
            ? `Certificate regenerated for ${existingRequest.requestNumber}`
            : `Status changed from ${STATUS_LABELS[previousStatus] || previousStatus} to ${STATUS_LABELS[targetStatus] || targetStatus}`,
        },
      });
    } catch (auditErr) {
      console.error('[Audit] Failed to create audit log:', auditErr);
    }

    // Create in-app notification for service request status change
    if (!isRegenerate && targetStatus !== previousStatus) {
      try {
        await notifyStaff({
          type: 'status_change',
          message: `Request ${existingRequest.requestNumber}: ${STATUS_LABELS[previousStatus] || previousStatus} → ${STATUS_LABELS[targetStatus] || targetStatus}`,
          referenceId: id,
          referenceType: 'service_request',
          excludeUserId: session.user.id,
        });
        await signalDataRefresh({ module: 'service-requests', action: 'status_change', recordId: id });
      } catch (notifyError) {
        console.error('Failed to send service request status notification:', notifyError);
      }
    }

    // ── Send emails SYNCHRONOUSLY before returning ──
    // Vercel serverless functions terminate after response, killing fire-and-forget promises.
    // For GMC issuance with PDF attachment, we MUST await the email send.
    let emailSent = false;
    let emailError: string | null = null;

    try {
      // 1. Send status update email
      if (!isRegenerate) {
        await sendStatusUpdateEmail({
          to: existingRequest.requestorEmail,
          requestorName: existingRequest.requestorName,
          requestNumber: existingRequest.requestNumber,
          requestType: existingRequest.requestType,
          previousStatus,
          newStatus: targetStatus,
          remarks: remarks?.trim() || null,
          trackingToken: existingRequest.trackingToken,
          reviewedByName: existingRequest.reviewedByName,
          sessionUserFullName: session.user.fullName,
          action: action || '',
          pdfBuffer,
        });
        emailSent = true;
      }

      // 2. GMC Issued: Send release email with PDF attachment
      if ((action === 'issue' || action === 'release') && existingRequest.requestType === 'GMC') {
        await sendGmcReleaseEmail({
          to: existingRequest.requestorEmail,
          requestorName: existingRequest.requestorName,
          requestNumber: existingRequest.requestNumber,
          issuedByName: session.user.fullName,
          pdfBuffer,
        });
        emailSent = true;
      }

      // 3. GMC Regenerate: Send updated release email
      if (isRegenerate && existingRequest.requestType === 'GMC' && pdfBuffer) {
        await sendGmcReleaseEmail({
          to: existingRequest.requestorEmail,
          requestorName: existingRequest.requestorName,
          requestNumber: existingRequest.requestNumber,
          issuedByName: session.user.fullName,
          pdfBuffer,
        });
        emailSent = true;
      }
    } catch (emailErr) {
      console.error('[Email] Error sending email:', emailErr);
      emailError = emailErr instanceof Error ? emailErr.message : String(emailErr);
    }

    // Return the updated request
    return NextResponse.json({
      ...updatedRequest,
      _meta: {
        emailSent,
        emailError,
        pdfGenerated: !!pdfBuffer,
        pdfError,
        certificatePdfUrl: certificatePdfUrl || existingRequest.certificatePdfUrl,
        regenerated: isRegenerate,
      },
    });
  } catch (error) {
    console.error('Service request update error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Failed to update service request' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const serviceRequest = await db.serviceRequest.findUnique({
      where: { id },
    });

    if (!serviceRequest) {
      return NextResponse.json({ error: 'Service request not found' }, { status: 404 });
    }

    return NextResponse.json(serviceRequest);
  } catch (error) {
    console.error('Service request fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch service request' },
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
      return NextResponse.json({ error: 'Forbidden: Only superadmin can delete service requests.' }, { status: 403 });
    }

    const { id } = await params;

    const existingRequest = await db.serviceRequest.findUnique({
      where: { id },
    });

    if (!existingRequest) {
      return NextResponse.json({ error: 'Service request not found' }, { status: 404 });
    }

    await db.serviceRequest.delete({
      where: { id },
    });

    await db.auditLog.create({
      data: {
        performedBy: session.user.id,
        performerName: session.user.fullName,
        performerRole: session.user.role,
        actionType: 'DELETE',
        module: 'service_request',
        recordId: id,
        oldValue: JSON.stringify(existingRequest),
        newValue: null,
        remarks: 'Service request deleted by superadmin',
      },
    });

    revalidatePath('/service-requests');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Service request delete error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Failed to delete service request' },
      { status: 500 }
    );
  }
}
