import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { sendEmail, serviceRequestConfirmationHtml } from '@/lib/email';
import { toTitleCase, toProperTitle } from '@/lib/text-format';
import { notifyStaff, signalDataRefresh } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const REQUEST_TYPE_PREFIXES: Record<string, string> = {
  GMC: 'GMC',
  UER: 'UER',
  CDC: 'CDC',
  CAC: 'CAC',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { requestType, requestorName, requestorEmail, classification, formData, fileUrls } = body;

    // Apply text formatting to name and degree fields
    const formattedRequestorName = toTitleCase(requestorName);

    // Normalize formData fields
    let processedFormData = formData;
    if (formData && typeof formData === 'object') {
      processedFormData = { ...formData };
      if (processedFormData.fullName) processedFormData.fullName = toTitleCase(processedFormData.fullName);
      if (processedFormData.givenName) processedFormData.givenName = toTitleCase(processedFormData.givenName);
      if (processedFormData.surname) processedFormData.surname = toTitleCase(processedFormData.surname);
      if (processedFormData.middleName) processedFormData.middleName = toTitleCase(processedFormData.middleName);
      if (processedFormData.extensionName) processedFormData.extensionName = toTitleCase(processedFormData.extensionName);
      if (processedFormData.degreeTitle) processedFormData.degreeTitle = toProperTitle(processedFormData.degreeTitle);
    }

    // Validate required fields
    if (!requestType || !requestorName || !requestorEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: requestType, requestorName, requestorEmail' },
        { status: 400 }
      );
    }

    const prefix = REQUEST_TYPE_PREFIXES[requestType];
    if (!prefix) {
      return NextResponse.json(
        { error: `Invalid requestType. Must be one of: ${Object.keys(REQUEST_TYPE_PREFIXES).join(', ')}` },
        { status: 400 }
      );
    }

    // Generate request number: {TYPE}-YYYY-{5-digit sequential}
    const year = new Date().getFullYear();
    const prefixStr = `${prefix}-${year}-`;

    const latestRequest = await db.serviceRequest.findFirst({
      where: {
        requestNumber: { startsWith: prefixStr },
      },
      orderBy: { createdAt: 'desc' },
      select: { requestNumber: true },
    });

    let nextSeq = 1;
    if (latestRequest) {
      const currentSeq = parseInt(latestRequest.requestNumber.replace(prefixStr, ''), 10);
      if (!isNaN(currentSeq)) {
        nextSeq = currentSeq + 1;
      }
    }

    const sequence = String(nextSeq).padStart(5, '0');
    const requestNumber = `${prefixStr}${sequence}`;

    // Generate tracking token
    const trackingToken = uuidv4();

    // Create service request
    const serviceRequest = await db.serviceRequest.create({
      data: {
        requestNumber,
        requestType,
        requestorName: formattedRequestorName,
        requestorEmail,
        classification: classification || null,
        status: 'Submitted',
        formData: typeof processedFormData === 'string' ? processedFormData : JSON.stringify(processedFormData),
        trackingToken,
        fileUrls: fileUrls && fileUrls.length > 0 ? JSON.stringify(fileUrls) : null,
      },
    });

    // Send confirmation email (non-blocking — errors are logged, not thrown)
    try {
      await sendEmail({
        to: serviceRequest.requestorEmail,
        bcc: 'nuevasrein@gmail.com',
        subject: `Service Request Submitted - ${serviceRequest.requestNumber}`,
        html: serviceRequestConfirmationHtml({
          requestorName: serviceRequest.requestorName,
          requestType: serviceRequest.requestType,
          requestNumber: serviceRequest.requestNumber,
          trackingToken: serviceRequest.trackingToken,
          dateSubmitted: new Date().toLocaleDateString('en-PH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
          processedByName: undefined, // No staff assigned yet for new requests
        }),
      });
    } catch (emailError) {
      console.error('Failed to send service request confirmation email:', emailError);
    }

    // Notify staff about new service request
    try {
      await notifyStaff({
        type: 'status_change',
        message: `New ${requestType} request: ${serviceRequest.requestNumber} from ${formattedRequestorName}`,
        referenceId: serviceRequest.id,
        referenceType: 'service_request',
      });
      await signalDataRefresh({ module: 'service-requests', action: 'create', recordId: serviceRequest.id });
    } catch (notifError) {
      console.error('Failed to send service request notification:', notifError);
    }

    return NextResponse.json(
      {
        requestNumber: serviceRequest.requestNumber,
        trackingToken: serviceRequest.trackingToken,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Service request creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create service request' },
      { status: 500 }
    );
  }
}
