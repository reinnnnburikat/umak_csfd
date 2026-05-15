import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

// Normal flow statuses
const ACTIVE_STATUSES = ['Submitted', 'For Review', 'For Issuance', 'Issued', 'Hold', 'Rejected'];
// Legacy statuses that should map to new ones
const STATUS_ALIASES: Record<string, string> = {
  'New': 'Submitted',
  'Processing': 'For Review',
};

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // GMC, UER, CDC, CAC
    const status = searchParams.get('status'); // Submitted, For Review, For Issuance, Issued, Hold, Rejected
    const search = searchParams.get('search'); // search by request number or name
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const mode = searchParams.get('mode'); // 'list' for all results, 'paginated' for paginated
    const statuses = searchParams.get('statuses'); // comma-separated statuses
    const sortBy = searchParams.get('sortBy') || 'createdAt'; // createdAt, requestorName, requestNumber, status
    const sortOrder = searchParams.get('sortOrder') || 'desc'; // asc, desc

    const where: Record<string, unknown> = {};

    if (type && type !== 'All') {
      where.requestType = type;
    }

    if (status) {
      // Map legacy statuses
      const mappedStatus = STATUS_ALIASES[status] || status;
      where.status = mappedStatus;
    }

    // Multiple statuses filter
    if (statuses) {
      const statusList = statuses.split(',').map(s => {
        const trimmed = s.trim();
        return STATUS_ALIASES[trimmed] || trimmed;
      }).filter(Boolean);
      if (statusList.length > 0) {
        where.status = { in: statusList };
      }
    }

    // Search filter
    // Note: SQLite does not support mode: 'insensitive' — use plain contains
    if (search) {
      where.OR = [
        { requestNumber: { contains: search } },
        { requestorName: { contains: search } },
        { requestorEmail: { contains: search } },
      ];
    }

    // Validate sort
    const validSortFields = ['createdAt', 'requestorName', 'requestNumber', 'status'];
    const validSortOrders = ['asc', 'desc'];
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const safeSortOrder = validSortOrders.includes(sortOrder) ? sortOrder : 'desc';

    // List mode: return all results with counts
    if (mode === 'list' || mode === 'kanban') {
      const allRequests = await db.serviceRequest.findMany({
        where,
        orderBy: { [safeSortBy]: safeSortOrder },
        take: 500,
        select: {
          id: true,
          requestNumber: true,
          requestType: true,
          requestorName: true,
          requestorEmail: true,
          classification: true,
          status: true,
          formData: true,
          fileUrls: true,
          certificatePdfUrl: true,
          remarks: true,
          reviewedByName: true,
          reviewedAt: true,
          issuedByName: true,
          issuedAt: true,
          createdAt: true,
        },
      });

      // Get counts per status
      const statusCounts = await db.serviceRequest.groupBy({
        by: ['status'],
        where: type && type !== 'All' ? { requestType: type } : {},
        _count: { status: true },
      });

      const counts: Record<string, number> = {};
      for (const sc of statusCounts) {
        const mappedStatus = STATUS_ALIASES[sc.status] || sc.status;
        counts[mappedStatus] = (counts[mappedStatus] || 0) + sc._count.status;
      }

      const response = NextResponse.json({
        requests: allRequests,
        total: allRequests.length,
        counts,
      });
      response.headers.set('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
      return response;
    }

    // Default paginated mode
    const [requests, total] = await Promise.all([
      db.serviceRequest.findMany({
        where,
        orderBy: { [safeSortBy]: safeSortOrder },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          requestNumber: true,
          requestType: true,
          requestorName: true,
          requestorEmail: true,
          classification: true,
          status: true,
          formData: true,
          fileUrls: true,
          certificatePdfUrl: true,
          remarks: true,
          reviewedByName: true,
          reviewedAt: true,
          issuedByName: true,
          issuedAt: true,
          createdAt: true,
        },
      }),
      db.serviceRequest.count({ where }),
    ]);

    const response = NextResponse.json({
      requests,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
    response.headers.set('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return response;
  } catch (error) {
    console.error('Service requests list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch service requests' },
      { status: 500 }
    );
  }
}
