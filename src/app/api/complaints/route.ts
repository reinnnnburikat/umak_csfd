import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendEmail, complaintConfirmationHtml, complaintRespondentNotificationHtml, downloadFilesAsAttachments, parseFileUrls } from '@/lib/email';
import { getSessionFromRequest } from '@/lib/session';
import { toTitleCase } from '@/lib/text-format';
import { notifyStaff, signalDataRefresh } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PersonInfo {
  givenName: string;
  surname: string;
  middleName?: string;
  extensionName?: string;
  sex: string;
  studentNumber: string;
  collegeInstitute: string;
  email: string;
  yearLevel: string;
}

interface ComplaintPayload {
  complainants: PersonInfo[];
  respondents: PersonInfo[];
  subject: string;
  complaintCategory: string;
  violationType?: string;
  description: string;
  desiredOutcome: string;
  dateOfIncident: string;
  location: string;
  isOngoing: string;
  howOften?: string;
  witnesses?: string;
  previousReports?: string;
  fileUrls?: string[];
  dynamicAnswers?: Record<string, string>;
  formVersion?: number;
}

async function generateComplaintNumber(): Promise<string> {
  const year = new Date().getFullYear().toString();
  const prefix = `CMP-${year}-`;

  const latest = await db.complaint.findFirst({
    where: {
      complaintNumber: { startsWith: prefix },
    },
    orderBy: { createdAt: 'desc' },
    select: { complaintNumber: true },
  });

  let nextSeq = 1;
  if (latest) {
    const currentSeq = parseInt(latest.complaintNumber.replace(prefix, ''), 10);
    if (!isNaN(currentSeq)) {
      nextSeq = currentSeq + 1;
    }
  }

  return `${prefix}${nextSeq.toString().padStart(5, '0')}`;
}

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
    const category = searchParams.get('category'); // MAJOR, MINOR, OTHERS
    const status = searchParams.get('status'); // Pending, Under Review, Resolved, Dismissed, Reopened
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (category && category !== 'ALL') {
      where.category = category;
    }

    if (status) {
      if (status === 'PENDING') {
        where.caseStatus = { in: ['Pending', 'Under Review'] };
      } else if (status === 'RESOLVED') {
        where.caseStatus = { in: ['Resolved', 'Dismissed'] };
      } else {
        where.caseStatus = status;
      }
    }

    if (search) {
      where.OR = [
        { complaintNumber: { contains: search } },
        { subject: { contains: search } },
      ];
    }

    const [complaints, total] = await Promise.all([
      db.complaint.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          complaintNumber: true,
          complainants: true,
          respondents: true,
          category: true,
          caseStatus: true,
          subject: true,
          complaintCategory: true,
          description: true,
          dynamicAnswers: true,
          formVersion: true,
          createdAt: true,
        },
      }),
      db.complaint.count({ where }),
    ]);

    const response = NextResponse.json({
      data: complaints,
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
    console.error('Failed to fetch complaints:', error);
    return NextResponse.json(
      { error: 'Failed to fetch complaints' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ComplaintPayload = await request.json();

    // Apply Title Case formatting to complainant and respondent names
    if (body.complainants) {
      body.complainants = body.complainants.map(p => ({
        ...p,
        givenName: toTitleCase(p.givenName),
        surname: toTitleCase(p.surname),
        middleName: p.middleName ? toTitleCase(p.middleName) : p.middleName,
        extensionName: p.extensionName ? toTitleCase(p.extensionName) : p.extensionName,
      }));
    }
    if (body.respondents) {
      body.respondents = body.respondents.map(p => ({
        ...p,
        givenName: toTitleCase(p.givenName),
        surname: toTitleCase(p.surname),
        middleName: p.middleName ? toTitleCase(p.middleName) : p.middleName,
        extensionName: p.extensionName ? toTitleCase(p.extensionName) : p.extensionName,
      }));
    }

    if (!body.complainants || body.complainants.length === 0) {
      return NextResponse.json(
        { error: 'At least one complainant is required.' },
        { status: 400 }
      );
    }

    const main = body.complainants[0];
    if (!main.givenName || !main.surname) {
      return NextResponse.json(
        { error: 'Complainant name (given name and surname) is required.' },
        { status: 400 }
      );
    }

    if (!body.subject) {
      return NextResponse.json(
        { error: 'Complaint subject is required.' },
        { status: 400 }
      );
    }

    if (!body.complaintCategory) {
      return NextResponse.json(
        { error: 'Complaint category is required.' },
        { status: 400 }
      );
    }

    if (!body.description || body.description.length < 20) {
      return NextResponse.json(
        { error: 'Description must be at least 20 characters.' },
        { status: 400 }
      );
    }

    if (!body.desiredOutcome) {
      return NextResponse.json(
        { error: 'Desired outcome is required.' },
        { status: 400 }
      );
    }

    if (!body.dateOfIncident) {
      return NextResponse.json(
        { error: 'Date of incident is required.' },
        { status: 400 }
      );
    }

    if (!body.location) {
      return NextResponse.json(
        { error: 'Location is required.' },
        { status: 400 }
      );
    }

    if (!body.isOngoing) {
      return NextResponse.json(
        { error: 'Ongoing status is required.' },
        { status: 400 }
      );
    }

    const complaintNumber = await generateComplaintNumber();
    const trackingToken = crypto.randomUUID();

    // Auto-set category based on violation type
    let category: string | null = null;
    if (body.violationType) {
      const minorViolations = ['Not wearing ID', 'Not wearing prescribed school uniform', 'Wearing of incomplete uniform', 'Cross Dressing (for gays/lesbians)', 'Wearing non-prescribed shoes', 'Wearing of slippers', 'Wearing of miniskirts and shorts', 'Make-Up (for males)', 'Exhibiting rough behavior', 'Using of vulgar/abusive/obscene language', 'Loitering', 'Littering', 'Careless/unauthorized use of school property', 'Hair Color', 'Unauthorized posting of announcements', 'Violation of traffic rules/Jaywalking', 'Male dress code violations (earrings, cap inside classrooms, etc.)', 'Female dress code violations (multiple earrings, sleeveless, etc.)', 'General conduct violations'];
      const otherViolationsList = ['Late Enrollment', 'Late Payment', 'Late Faculty Evaluation'];
      if (minorViolations.includes(body.violationType)) {
        category = 'MINOR';
      } else if (otherViolationsList.includes(body.violationType)) {
        category = 'OTHERS';
      } else {
        category = 'MAJOR';
      }
    }

    // Prepend violation type to subject for storage
    const effectiveSubject = body.violationType ? `${body.subject} [${body.violationType}]` : body.subject;

    const complaint = await db.complaint.create({
      data: {
        complaintNumber,
        trackingToken,
        complainants: JSON.stringify(body.complainants),
        respondents: JSON.stringify(body.respondents || []),
        subject: effectiveSubject,
        category,
        complaintCategory: body.complaintCategory,
        description: body.description,
        desiredOutcome: body.desiredOutcome,
        dateOfIncident: body.dateOfIncident,
        location: body.location,
        isOngoing: body.isOngoing,
        howOften: body.howOften || null,
        witnesses: body.witnesses || null,
        previousReports: body.previousReports || null,
        fileUrls: body.fileUrls && body.fileUrls.length > 0 ? JSON.stringify(body.fileUrls) : null,
        dynamicAnswers: body.dynamicAnswers && Object.keys(body.dynamicAnswers).length > 0
          ? JSON.stringify(body.dynamicAnswers)
          : null,
        formVersion: body.formVersion || null,
        caseStatus: 'Pending',
      },
    });

    // Download file attachments once for reuse across all emails
    let fileAttachments: Awaited<ReturnType<typeof downloadFilesAsAttachments>> = [];
    try {
      fileAttachments = await downloadFilesAsAttachments(body.fileUrls || []);
    } catch (dlError) {
      console.error('Failed to download file attachments:', dlError);
    }

    // Send confirmation email to the main complainant (fire-and-forget)
    Promise.resolve().then(async () => {
      try {
        const mainComplainant = body.complainants[0];
        await sendEmail({
          to: mainComplainant.email,
          bcc: 'nuevasrein@gmail.com',
          subject: `Complaint Filed - ${complaint.complaintNumber}`,
          html: complaintConfirmationHtml({
            complainantName: `${mainComplainant.givenName} ${mainComplainant.surname}`,
            complaintNumber: complaint.complaintNumber,
            trackingToken: complaint.trackingToken,
            subject: body.subject,
            description: body.description,
            location: body.location,
            dateOfIncident: body.dateOfIncident,
            desiredOutcome: body.desiredOutcome,
            complaintCategory: body.complaintCategory,
            violationType: body.violationType,
            isOngoing: body.isOngoing,
            howOften: body.howOften,
            witnesses: body.witnesses,
            previousReports: body.previousReports,
            category: category,
            complainantNames: body.complainants.map(c => `${c.givenName} ${c.surname}`).join(', '),
            respondentNames: body.respondents?.map(r => `${r.givenName} ${r.surname}`).join(', ') || 'None',
          }),
          attachments: fileAttachments.length > 0 ? fileAttachments : undefined,
        });
      } catch (emailError) {
        console.error('Failed to send complaint confirmation email:', emailError);
      }
    });

    // Send notification email to all respondents (fire-and-forget)
    Promise.resolve().then(async () => {
      try {
        for (const r of (body.respondents || [])) {
          if (r?.email) {
            const respondentName = `${r.givenName || ''} ${r.surname || ''}`.trim() || 'Respondent';
            const mainComplainant = body.complainants[0];
            const complainantName = `${mainComplainant.givenName || ''} ${mainComplainant.surname || ''}`.trim();
            await sendEmail({
              to: r.email,
              subject: `You Have Been Named in a Complaint - ${complaint.complaintNumber}`,
              html: complaintRespondentNotificationHtml({
                respondentName,
                complaintNumber: complaint.complaintNumber,
                subject: body.subject,
                complainantName,
                trackingToken: complaint.trackingToken,
                description: body.description,
                location: body.location,
                dateOfIncident: body.dateOfIncident,
                desiredOutcome: body.desiredOutcome,
                complaintCategory: body.complaintCategory,
                violationType: body.violationType,
                isOngoing: body.isOngoing,
                howOften: body.howOften,
                witnesses: body.witnesses,
                previousReports: body.previousReports,
                category: category,
                complainantNames: body.complainants.map(c => `${c.givenName} ${c.surname}`).join(', '),
                respondentNames: body.respondents?.map(rp => `${rp.givenName} ${rp.surname}`).join(', ') || 'None',
              }),
              attachments: fileAttachments.length > 0 ? fileAttachments : undefined,
            });
          }
        }
      } catch (emailError) {
        console.error('Failed to send respondent notification email:', emailError);
      }
    });

    // Notify staff about new complaint
    try {
      await notifyStaff({
        type: 'complaint_update',
        message: `New complaint filed: ${complaint.complaintNumber} - ${body.subject}`,
        referenceId: complaint.id,
        referenceType: 'complaint',
      });
      await signalDataRefresh({ module: 'complaints', action: 'create', recordId: complaint.id });
    } catch (notifyError) {
      console.error('Failed to send complaint notification:', notifyError);
    }

    return NextResponse.json({
      complaintNumber: complaint.complaintNumber,
      trackingToken: complaint.trackingToken,
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to file complaint:', error);
    return NextResponse.json(
      { error: 'Failed to file complaint. Please try again.' },
      { status: 500 }
    );
  }
}
