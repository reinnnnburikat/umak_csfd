import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { sendEmail, serviceRequestStatusUpdateHtml, gmcReleaseEmailHtml } from '@/lib/email';
import { join } from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120; // Allow up to 120 seconds for batch operations

const ACTION_STATUS_MAP: Record<string, string> = {
  review: 'For Review',
  for_issuance: 'For Issuance',
  issue: 'Issued',
  hold: 'Hold',
  reject: 'Rejected',
  // Legacy support
  process: 'For Review',
  mark_ready: 'For Issuance',
  release: 'Issued',
};

const TRANSITION_RULES: Record<string, string[]> = {
  'Submitted': ['For Review', 'Hold', 'Rejected'],
  'For Review': ['For Issuance', 'Hold', 'Rejected'],
  'For Issuance': ['Issued', 'Hold', 'Rejected'],
  'Issued': [],
  'Hold': ['For Review', 'Rejected'],
  'Rejected': [],
  // Legacy
  'New': ['For Review', 'Hold', 'Rejected'],
  'Processing': ['For Issuance', 'Hold', 'Rejected'],
};

const STATUS_LABELS: Record<string, string> = {
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
 * Generate a GMC certificate PDF and save it to disk.
 * Uses dynamic import for pdfkit to avoid Turbopack bundling issues.
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
}): Promise<{ pdfBuffer: Buffer; certificatePdfUrl: string } | null> {
  try {
    const formData = JSON.parse(existingRequest.formData || '{}');

    const certConfigs = await db.cmsContent.findMany({
      where: { key: { in: ['cert_academic_year', 'cert_background_url', 'cert_esignature_url', 'cert_director_name', 'cert_director_title'] } },
    });
    const configMap: Record<string, string> = {};
    for (const item of certConfigs) {
      configMap[item.key] = item.value;
    }

    let classification = existingRequest.classification || 'currently_enrolled';
    if (classification === 'graduate' || classification === 'graduate_alumni') {
      const graduateSubType = formData.graduateSubType;
      if (graduateSubType === 'hsu') {
        classification = 'graduate_hsu';
      } else {
        classification = 'graduate_college';
      }
    }

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

    // Dynamic import to avoid Turbopack issues
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
    console.error('[GMC Certificate Batch] Failed to generate certificate:', certError);
    return null;
  }
}

/**
 * Read an existing PDF from a data URL, or return null.
 */
function readExistingPdf(certificatePdfUrl: string | null): Buffer | null {
  if (!certificatePdfUrl) return null;

  // Handle data URLs (stored as base64 in DB for Vercel compatibility)
  if (certificatePdfUrl.startsWith('data:')) {
    try {
      const matches = certificatePdfUrl.match(/^data:[^;]+;base64,(.+)$/);
      if (matches) {
        return Buffer.from(matches[1], 'base64');
      }
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Process a single request's PDF + email in the background.
 */
function processBatchRequestInBackground(params: {
  req: {
    id: string;
    requestNumber: string;
    requestType: string;
    requestorName: string;
    requestorEmail: string;
    trackingToken: string;
    reviewedByName: string | null;
    classification: string | null;
    formData: string;
    certificatePdfUrl: string | null;
    status: string;
    remarks: string | null;
  };
  action: string;
  targetStatus: string;
  sessionUser: { id: string; fullName: string; role: string };
  remarks: string | null;
}): void {
  const { req, action, targetStatus, sessionUser, remarks } = params;

  const bgPromise = async () => {
    try {
      const isIssueAction = action === 'issue' || action === 'release';
      const isForIssuanceAction = action === 'for_issuance' || action === 'mark_ready';
      let pdfBuffer: Buffer | null = null;
      let certificatePdfUrl: string | null = req.certificatePdfUrl;

      // Generate PDF for For Issuance stage
      if (isForIssuanceAction && req.requestType === 'GMC') {
        const result = await ensureGmcCertificate(req);
        if (result) {
          pdfBuffer = result.pdfBuffer;
          certificatePdfUrl = result.certificatePdfUrl;
        }
      }

      // Ensure PDF at Issue stage
      if (isIssueAction && req.requestType === 'GMC') {
        pdfBuffer = readExistingPdf(req.certificatePdfUrl || certificatePdfUrl);
        if (!pdfBuffer) {
          const result = await ensureGmcCertificate(req);
          if (result) {
            pdfBuffer = result.pdfBuffer;
            certificatePdfUrl = result.certificatePdfUrl;
          }
        }
      }

      // Update certificatePdfUrl in DB if we generated one
      if (certificatePdfUrl && certificatePdfUrl !== req.certificatePdfUrl) {
        await db.serviceRequest.update({
          where: { id: req.id },
          data: { certificatePdfUrl },
        });
      }

      // Send status update email
      const notifiableStatuses = ['For Review', 'For Issuance', 'Issued', 'Hold', 'Rejected'];
      if (notifiableStatuses.includes(targetStatus)) {
        const statusLabel = STATUS_LABELS[targetStatus] || targetStatus;
        const previousLabel = STATUS_LABELS[req.status] || req.status;

        const emailAttachments: Array<{
          filename: string;
          content: Buffer | string;
          contentType?: string;
        }> = [];

        if (targetStatus === 'Issued' && req.requestType === 'GMC' && pdfBuffer) {
          emailAttachments.push({
            filename: `Good_Moral_Certificate_${req.requestNumber}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          });
        }

        try {
          await sendEmail({
            to: req.requestorEmail,
            bcc: 'nuevasrein@gmail.com',
            subject: `Service Request Update - ${req.requestNumber} - ${statusLabel}`,
            html: serviceRequestStatusUpdateHtml({
              requestorName: req.requestorName,
              requestNumber: req.requestNumber,
              previousStatus: previousLabel,
              newStatus: statusLabel,
              remarks: remarks?.trim() || null,
              trackingToken: req.trackingToken,
              reviewedByName: !isIssueAction ? sessionUser.fullName : (req.reviewedByName || undefined),
              requestType: req.requestType,
              issuedByName: isIssueAction ? sessionUser.fullName : null,
              issuedAt: isIssueAction ? new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null,
            }),
            ...(emailAttachments.length > 0 ? { attachments: emailAttachments } : {}),
          });
        } catch (err) {
          console.error('[Email Batch BG] Failed to send status update email:', err);
        }
      }

      // GMC Issued: Send release email
      if (isIssueAction && req.requestType === 'GMC') {
        try {
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
              filename: `Good_Moral_Certificate_${req.requestNumber}.pdf`,
              content: pdfBuffer,
              contentType: 'application/pdf',
            });
          } else {
            console.error(`[GMC Release Batch BG] No PDF attachment for ${req.requestNumber}.`);
          }

          await sendEmail({
            to: req.requestorEmail,
            bcc: 'nuevasrein@gmail.com',
            from: '"CSFD Good Moral" <csfdgoodmoral@umak.edu.ph>',
            subject: `Good Moral Certificate Request | PROCEED FOR DRY SEAL`,
            html: gmcReleaseEmailHtml({
              requestorName: req.requestorName,
              requestNumber: req.requestNumber,
              formattedDate,
              issuedByName: sessionUser.fullName,
            }),
            ...(releaseAttachments.length > 0 ? { attachments: releaseAttachments } : {}),
          });
        } catch (releaseError) {
          console.error('[Email Batch BG] Failed to send GMC release email:', releaseError);
        }
      }
    } catch (err) {
      console.error('[BG Batch] Unexpected error in background processing:', err);
    }
  };

  bgPromise().catch(err => {
    console.error('[BG Batch] Unhandled error in background processing:', err);
  });
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { ids, action, remarks } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 });
    }

    if (!action || !ACTION_STATUS_MAP[action]) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${Object.keys(ACTION_STATUS_MAP).join(', ')}` },
        { status: 400 }
      );
    }

    // Validate remarks for hold/reject
    const targetStatus = ACTION_STATUS_MAP[action];
    if ((targetStatus === 'Hold' || targetStatus === 'Rejected') && (!remarks || !remarks.trim())) {
      return NextResponse.json(
        { error: 'Remarks are required for Hold/Reject actions.' },
        { status: 400 }
      );
    }

    // Fetch all matching requests
    const requests = await db.serviceRequest.findMany({
      where: { id: { in: ids } },
    });

    const results: { id: string; success: boolean; error?: string; requestNumber?: string }[] = [];
    const successIds: string[] = [];

    for (const req of requests) {
      const allowedTransitions = TRANSITION_RULES[req.status] || [];
      if (!allowedTransitions.includes(targetStatus)) {
        results.push({
          id: req.id,
          success: false,
          error: `Cannot transition from "${STATUS_LABELS[req.status] || req.status}" to "${STATUS_LABELS[targetStatus] || targetStatus}"`,
          requestNumber: req.requestNumber,
        });
        continue;
      }
      successIds.push(req.id);
      results.push({ id: req.id, success: true, requestNumber: req.requestNumber });
    }

    if (successIds.length === 0) {
      return NextResponse.json({
        success: 0,
        failed: results.filter(r => !r.success).length,
        results,
      });
    }

    const updatedRequests = requests.filter(r => successIds.includes(r.id));
    const isIssueAction = action === 'issue' || action === 'release';

    // IMMEDIATE: Update all requests in DB first
    for (const req of updatedRequests) {
      const updateData: Record<string, unknown> = {
        status: targetStatus,
        remarks: remarks?.trim() || req.remarks,
      };

      if (!isIssueAction) {
        updateData.reviewedByName = session.user.fullName;
        updateData.reviewedAt = new Date();
      }

      if (isIssueAction) {
        updateData.issuedByName = session.user.fullName;
        updateData.issuedAt = new Date();
      }

      await db.serviceRequest.update({
        where: { id: req.id },
        data: updateData,
      });

      // Create audit log
      try {
        await db.auditLog.create({
          data: {
            performedBy: session.user.id,
            performerName: session.user.fullName,
            performerRole: session.user.role,
            actionType: 'STATUS_UPDATE',
            module: 'service_request',
            recordId: req.id,
            oldValue: JSON.stringify({ status: req.status }),
            newValue: JSON.stringify({ status: targetStatus, remarks: remarks?.trim() || null, action }),
            remarks: `Batch status change from ${STATUS_LABELS[req.status] || req.status} to ${STATUS_LABELS[targetStatus] || targetStatus}`,
          },
        });
      } catch (auditErr) {
        console.error('[Audit Batch] Failed to create audit log:', auditErr);
      }

      // BACKGROUND: Process PDF + email for this request
      processBatchRequestInBackground({
        req: {
          id: req.id,
          requestNumber: req.requestNumber,
          requestType: req.requestType,
          requestorName: req.requestorName,
          requestorEmail: req.requestorEmail,
          trackingToken: req.trackingToken,
          reviewedByName: req.reviewedByName,
          classification: req.classification,
          formData: req.formData,
          certificatePdfUrl: req.certificatePdfUrl,
          status: req.status,
          remarks: req.remarks,
        },
        action,
        targetStatus,
        sessionUser: {
          id: session.user.id,
          fullName: session.user.fullName,
          role: session.user.role,
        },
        remarks: remarks?.trim() || null,
      });
    }

    return NextResponse.json({
      success: successIds.length,
      failed: results.filter(r => !r.success).length,
      results,
    });
  } catch (error) {
    console.error('Batch action error:', error);
    return NextResponse.json(
      { error: 'Failed to perform batch action' },
      { status: 500 }
    );
  }
}
