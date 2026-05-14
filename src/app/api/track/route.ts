import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Timeline stages for service requests (updated to match new status flow)
const serviceRequestTimeline = ['Submitted', 'For Review', 'For Issuance', 'Issued'];
// Actual DB statuses mapped to timeline index
const serviceStatusToTimelineIndex: Record<string, number> = {
  'Submitted': 0,
  'For Review': 1,
  'For Issuance': 2,
  'Issued': 3,
  'Hold': 1,       // Hold = stuck at For Review
  'Rejected': 1,   // Rejected = stopped at For Review
  // Legacy status support
  'New': 0,
  'Processing': 1,
  'Released': 3,
};

// Timeline stages for complaints
const complaintTimeline = ['Submitted', 'Under Review', 'Resolution', 'Resolved'];
// Actual DB statuses mapped to timeline index
const complaintStatusToTimelineIndex: Record<string, number> = {
  'Pending': 0,
  'Under Review': 1,
  'Resolved': 3,
  'Dismissed': 1, // Dismissed = stopped at Under Review
  'Reopened': 1,  // Reopened = back at Under Review
};

// Estimated working days per stage for service requests
const serviceEstimatedDays: Record<string, number> = {
  'Submitted': 3,        // ~3 days to start review
  'For Review': 3,       // ~3 working days for review
  'For Issuance': 2,     // ~2 working days to issue
  'Issued': 0,           // Already issued (final)
  'Hold': 7,             // On hold, extended
  'Rejected': 0,
  // Legacy
  'New': 3,
  'Processing': 5,
  'Released': 0,
};

const complaintEstimatedDays: Record<string, number> = {
  'Pending': 3,
  'Under Review': 7,
  'Resolved': 0,
  'Dismissed': 0,
  'Reopened': 7,
};

function addWorkingDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return result;
}

function getStageTimestamps(
  createdAt: Date,
  updatedAt: Date,
  status: string,
  type: 'service_request' | 'complaint'
): { stage: string; timestamp: string | null }[] {
  const timeline = type === 'service_request' ? serviceRequestTimeline : complaintTimeline;
  const statusToIndex = type === 'service_request' ? serviceStatusToTimelineIndex : complaintStatusToTimelineIndex;
  const currentIdx = statusToIndex[status] ?? 0;

  return timeline.map((stage, index) => {
    if (index === 0) {
      return { stage, timestamp: createdAt.toISOString() };
    }
    if (index <= currentIdx) {
      // Past stage - use updatedAt as approximate timestamp
      // For stages between submitted and current, distribute dates
      const totalMs = updatedAt.getTime() - createdAt.getTime();
      const fraction = index / (currentIdx || 1);
      const estimated = new Date(createdAt.getTime() + totalMs * fraction);
      return { stage, timestamp: estimated.toISOString() };
    }
    return { stage, timestamp: null };
  });
}

function getEstimatedCompletion(
  createdAt: Date,
  status: string,
  type: 'service_request' | 'complaint'
): string | null {
  const estDays = type === 'service_request' ? serviceEstimatedDays : complaintEstimatedDays;

  // If already in final state, no estimated completion
  const finalStatuses = type === 'service_request'
    ? ['Issued', 'Released', 'Rejected']
    : ['Resolved', 'Dismissed'];
  if (finalStatuses.includes(status)) return null;

  const days = estDays[status] ?? 5;
  const completion = addWorkingDays(createdAt, days);
  return completion.toISOString();
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const number = searchParams.get('number')?.trim();
  const token = searchParams.get('token')?.trim();
  const trackType = searchParams.get('type')?.trim(); // 'service_request' or 'complaint'

  // Both number and token are required for all lookups (prevents PII leakage)
  if (!token || !number) {
    return NextResponse.json(
      { error: 'Both a reference number and tracking token are required. Please enter your request/complaint number and the tracking token sent to your email.' },
      { status: 400 }
    );
  }

  // Auto-detect type from number prefix if not explicitly set
  const upperNumber = number.toUpperCase();
  let effectiveType = trackType;
  if (!effectiveType) {
    if (upperNumber.startsWith('CMP-')) {
      effectiveType = 'complaint';
    } else if (/^(GMC|UER|CDC|CAC)-/.test(upperNumber)) {
      effectiveType = 'service_request';
    }
    // If still not determined, search both types
  }

  // Build the where clause dynamically based on track type and provided parameters
  // Both number and token are always provided (enforced above)
  const buildServiceWhere = () => {
    return { requestNumber: number, trackingToken: token };
  };

  const buildComplaintWhere = () => {
    return { complaintNumber: number, trackingToken: token };
  };

  // Determine which searches to run based on track type (with auto-detect)
  const shouldSearchService = effectiveType !== 'complaint'; // Search service requests unless auto-detected or explicitly complaint
  const shouldSearchComplaint = effectiveType !== 'service_request'; // Search complaints unless auto-detected or explicitly service_request

  // Try service_requests
  let serviceRequestError: string | null = null;
  if (shouldSearchService) {
    try {
      const serviceWhere = buildServiceWhere();
      const serviceRequest = await db.serviceRequest.findFirst({
        where: serviceWhere,
        select: {
          id: true,
          requestNumber: true,
          requestType: true,
          requestorName: true,
          status: true,
          remarks: true,
          reviewedByName: true,
          reviewedAt: true,
          issuedByName: true,
          issuedAt: true,
          certificatePdfUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (serviceRequest) {
        const timelineIndex = serviceStatusToTimelineIndex[serviceRequest.status] ?? 0;
        const stageTimestamps = getStageTimestamps(
          serviceRequest.createdAt,
          serviceRequest.updatedAt,
          serviceRequest.status,
          'service_request'
        );
        const estimatedCompletion = getEstimatedCompletion(
          serviceRequest.createdAt,
          serviceRequest.status,
          'service_request'
        );

        return NextResponse.json({
          type: 'service_request',
          number: serviceRequest.requestNumber,
          requestType: serviceRequest.requestType,
          requestorName: serviceRequest.requestorName,
          status: serviceRequest.status,
          remarks: serviceRequest.remarks,
          reviewedByName: serviceRequest.reviewedByName,
          reviewedAt: serviceRequest.reviewedAt?.toISOString() ?? null,
          issuedByName: serviceRequest.issuedByName,
          issuedAt: serviceRequest.issuedAt?.toISOString() ?? null,
          certificatePdfUrl: serviceRequest.certificatePdfUrl,
          createdAt: serviceRequest.createdAt.toISOString(),
          updatedAt: serviceRequest.updatedAt.toISOString(),
          stages: serviceRequestTimeline,
          currentStageIndex: timelineIndex,
          timeline: stageTimestamps,
          estimatedCompletion,
          claimLocation: 'CSFD Office, 2nd Floor, Admin Building',
        });
      }
    } catch (error) {
      serviceRequestError = error instanceof Error ? error.message : String(error);
      console.error('[Track] Error searching service_requests:', error);
    }
  }

  // Try complaints
  let complaintError: string | null = null;
  if (shouldSearchComplaint) {
    try {
      const complaintWhere = buildComplaintWhere();
      const complaint = await db.complaint.findFirst({
        where: complaintWhere,
        select: {
          id: true,
          complaintNumber: true,
          subject: true,
          caseStatus: true,
          category: true,
          complaintCategory: true,
          progressUpdates: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (complaint) {
        const timelineIndex = complaintStatusToTimelineIndex[complaint.caseStatus] ?? 0;
        const stageTimestamps = getStageTimestamps(
          complaint.createdAt,
          complaint.updatedAt,
          complaint.caseStatus,
          'complaint'
        );
        const estimatedCompletion = getEstimatedCompletion(
          complaint.createdAt,
          complaint.caseStatus,
          'complaint'
        );

        // Parse progress updates for the tracker
        let parsedProgressUpdates: Array<{ id: string; subject: string; date: string; details: string; asOf?: string }> = [];
        try {
          parsedProgressUpdates = JSON.parse(complaint.progressUpdates || '[]');
        } catch { /* empty */ }

        return NextResponse.json({
          type: 'complaint',
          number: complaint.complaintNumber,
          subject: complaint.subject,
          caseStatus: complaint.caseStatus,
          category: complaint.category,
          complaintCategory: complaint.complaintCategory,
          progressUpdates: parsedProgressUpdates,
          createdAt: complaint.createdAt.toISOString(),
          updatedAt: complaint.updatedAt.toISOString(),
          stages: complaintTimeline,
          currentStageIndex: timelineIndex,
          timeline: stageTimestamps,
          estimatedCompletion,
          claimLocation: 'CSFD Office, 2nd Floor, Admin Building',
        });
      }
    } catch (error) {
      complaintError = error instanceof Error ? error.message : String(error);
      console.error('[Track] Error searching complaints:', error);
    }
  }

  // Build a helpful error message based on effective type
  const searchDesc = effectiveType === 'complaint'
    ? 'complaint number and token combination'
    : effectiveType === 'service_request'
      ? 'request number and token combination'
      : 'number and token combination';

  // If both queries errored, report a server error instead of "not found"
  if (serviceRequestError && complaintError) {
    console.error('[Track] Both queries failed. Service error:', serviceRequestError, 'Complaint error:', complaintError);
    return NextResponse.json(
      { error: 'Unable to search records at this time. Please try again later.' },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { error: `No record found with the provided ${searchDesc}. Please check your input and try again.` },
    { status: 404 }
  );
}
