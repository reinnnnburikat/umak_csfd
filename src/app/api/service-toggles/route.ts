import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';

// Default service definitions to seed
const DEFAULT_SERVICES = [
  {
    serviceKey: 'GMC',
    serviceName: 'Good Moral Certificate',
    description: 'Request a certificate of good moral character',
  },
  {
    serviceKey: 'UER',
    serviceName: 'Uniform Exemption Request',
    description: 'Apply for uniform policy exemption',
  },
  {
    serviceKey: 'CDC',
    serviceName: 'Cross-Dressing Clearance',
    description: 'Request clearance for cross-dressing',
  },
  {
    serviceKey: 'CAC',
    serviceName: 'Child Admission Clearance',
    description: 'Obtain clearance for bringing a child to campus',
  },
  {
    serviceKey: 'COMPLAINT',
    serviceName: 'File a Complaint',
    description: 'Report a concern or file a formal complaint',
  },
  {
    serviceKey: 'DISCIPLINARY',
    serviceName: 'Disciplinary Record Tracking',
    description: 'Track disciplinary records and violations',
  },
];

const AUTH_ROLES = ['staff', 'admin', 'superadmin', 'student_assistant', 'makati_internship'];

function isAuthorized(role: string): boolean {
  return AUTH_ROLES.includes(role);
}

// GET /api/service-toggles — Fetch all service toggles
export async function GET() {
  try {
    const toggles = await db.serviceToggle.findMany({
      orderBy: { serviceKey: 'asc' },
    });

    return NextResponse.json({ data: toggles });
  } catch (error) {
    console.error('Failed to fetch service toggles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch service toggles' },
      { status: 500 }
    );
  }
}

// POST /api/service-toggles — Initialize/seed service toggles
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user || !isAuthorized(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const services = body?.services ?? DEFAULT_SERVICES;

    const results = [];
    for (const svc of services) {
      const toggle = await db.serviceToggle.upsert({
        where: { serviceKey: svc.serviceKey },
        update: {
          serviceName: svc.serviceName,
          description: svc.description,
        },
        create: {
          serviceKey: svc.serviceKey,
          serviceName: svc.serviceName,
          description: svc.description,
          isActive: true,
          updatedBy: session.user.id,
        },
      });
      results.push(toggle);
    }

    await createAuditLog({
      performedBy: session.user.id,
      performerName: session.user.fullName,
      performerRole: session.user.role,
      actionType: 'INITIALIZE',
      module: 'service_toggles',
      newValue: results,
      remarks: `Initialized ${results.length} service toggles`,
    });

    return NextResponse.json({ data: results }, { status: 201 });
  } catch (error) {
    console.error('Failed to initialize service toggles:', error);
    return NextResponse.json(
      { error: 'Failed to initialize service toggles' },
      { status: 500 }
    );
  }
}

// PATCH /api/service-toggles — Toggle a service on/off
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user || !isAuthorized(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { serviceKey, isActive } = body;

    if (!serviceKey || typeof isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required fields: serviceKey, isActive' },
        { status: 400 }
      );
    }

    const existing = await db.serviceToggle.findUnique({
      where: { serviceKey },
    });

    if (!existing) {
      return NextResponse.json(
        { error: `Service toggle "${serviceKey}" not found` },
        { status: 404 }
      );
    }

    const updated = await db.serviceToggle.update({
      where: { serviceKey },
      data: {
        isActive,
        updatedBy: session.user.id,
      },
    });

    await createAuditLog({
      performedBy: session.user.id,
      performerName: session.user.fullName,
      performerRole: session.user.role,
      actionType: isActive ? 'ENABLE' : 'DISABLE',
      module: 'service_toggles',
      recordId: updated.id,
      oldValue: { serviceKey, isActive: existing.isActive },
      newValue: { serviceKey, isActive },
      remarks: `${isActive ? 'Enabled' : 'Disabled'} service: ${existing.serviceName}`,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Failed to toggle service:', error);
    return NextResponse.json(
      { error: 'Failed to toggle service' },
      { status: 500 }
    );
  }
}
