import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user || !['admin', 'staff', 'superadmin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const period = searchParams.get('period') || 'monthly'; // monthly, quarterly, annual
    const type = searchParams.get('type'); // GMC, UER, CDC, CAC, Complaints, or all
    const status = searchParams.get('status'); // Submitted, For Review, For Issuance, Hold, Rejected, or all

    // Build where clause for service requests
    const srWhere: Record<string, unknown> = {};

    if (dateFrom || dateTo) {
      srWhere.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo + 'T23:59:59.999') } : {}),
      };
    }

    if (type && type !== 'All' && type !== 'Complaints') {
      srWhere.requestType = type;
    }

    if (status && status !== 'All') {
      srWhere.status = status;
    }

    // Build where clause for complaints
    const complaintWhere: Record<string, unknown> = {};
    if (dateFrom || dateTo) {
      complaintWhere.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo + 'T23:59:59.999') } : {}),
      };
    }

    // Get service request counts by type and status
    const includeComplaints = !type || type === 'All' || type === 'Complaints';
    const includeServiceRequests = !type || type === 'All' || type !== 'Complaints';

    // Pre-compute trend date range to fetch trend data in parallel
    const trendMonths = getTrendMonths(period, dateFrom, dateTo);
    let trendStartDate: Date | undefined;
    let trendEndDate: Date | undefined;
    if (trendMonths.length > 0) {
      trendStartDate = new Date(trendMonths[0].year, trendMonths[0].month - 1, 1);
      const lastMonth = trendMonths[trendMonths.length - 1];
      trendEndDate = new Date(lastMonth.year, lastMonth.month, 0, 23, 59, 59, 999);
    }

    // ============================================================
    // BATCH: All 4 queries fired in parallel via Promise.all
    // - Query 1: Service requests (full data → aggregation + raw CSV)
    // - Query 2: Complaints (full data → aggregation + raw CSV)
    // - Query 3: SR trend records (minimal fields, trend range only)
    // - Query 4: Complaint trend records (minimal fields, trend range only)
    //
    // Before: ~42 sequential DB round-trips
    // After:  1 parallel batch of 4 queries
    // ============================================================
    const [serviceRequests, complaints, srTrendRecords, complaintTrendRecords] =
      await Promise.all([
        // Query 1: Service requests — fetch once for aggregation AND raw CSV export
        includeServiceRequests
          ? db.serviceRequest.findMany({
              where: srWhere,
              select: {
                requestNumber: true,
                requestType: true,
                requestorName: true,
                requestorEmail: true,
                status: true,
                createdAt: true,
                reviewedAt: true,
              },
              orderBy: { createdAt: 'desc' },
            })
          : Promise.resolve([] as Array<{
              requestNumber: string;
              requestType: string;
              requestorName: string;
              requestorEmail: string;
              status: string;
              createdAt: Date;
              reviewedAt: Date | null;
            }>),

        // Query 2: Complaints — fetch once for aggregation AND raw CSV export
        includeComplaints
          ? db.complaint.findMany({
              where: complaintWhere,
              select: {
                complaintNumber: true,
                caseStatus: true,
                subject: true,
                createdAt: true,
                category: true,
              },
              orderBy: { createdAt: 'desc' },
            })
          : Promise.resolve([] as Array<{
              complaintNumber: string;
              caseStatus: string;
              subject: string;
              createdAt: Date;
              category: string | null;
            }>),

        // Query 3: Service requests for trend — minimal select, trend date range only
        // Replaces 24 sequential count queries (12 months × 2 metrics)
        trendStartDate && trendEndDate
          ? db.serviceRequest.findMany({
              where: { createdAt: { gte: trendStartDate, lte: trendEndDate } },
              select: { createdAt: true, reviewedAt: true, status: true },
            })
          : Promise.resolve([] as Array<{
              createdAt: Date;
              reviewedAt: Date | null;
              status: string;
            }>),

        // Query 4: Complaints for trend — minimal select, trend date range only
        // Replaces 12 sequential count queries (1 per month)
        trendStartDate && trendEndDate
          ? db.complaint.findMany({
              where: { createdAt: { gte: trendStartDate, lte: trendEndDate } },
              select: { createdAt: true },
            })
          : Promise.resolve([] as Array<{ createdAt: Date }>),
      ]);

    // ============================================================
    // In-memory aggregation — zero additional DB queries
    // ============================================================

    let totalRequests = 0;
    let issuedCount = 0;
    let pendingCount = 0;
    let holdRejectedCount = 0;
    let newCount = 0;
    let processingCount = 0;
    let holdCount = 0;
    let rejectedCount = 0;

    const byType: Record<string, number> = { GMC: 0, UER: 0, CDC: 0, CAC: 0 };
    const byTypeAndStatus: Record<string, Record<string, number>> = {
      GMC: { Submitted: 0, 'For Review': 0, 'For Issuance': 0, Hold: 0, Rejected: 0 },
      UER: { Submitted: 0, 'For Review': 0, 'For Issuance': 0, Hold: 0, Rejected: 0 },
      CDC: { Submitted: 0, 'For Review': 0, 'For Issuance': 0, Hold: 0, Rejected: 0 },
      CAC: { Submitted: 0, 'For Review': 0, 'For Issuance': 0, Hold: 0, Rejected: 0 },
    };

    // Aggregate service requests from already-fetched data
    totalRequests += serviceRequests.length;

    for (const sr of serviceRequests) {
      byType[sr.requestType] = (byType[sr.requestType] || 0) + 1;
      if (byTypeAndStatus[sr.requestType]) {
        byTypeAndStatus[sr.requestType][sr.status] =
          (byTypeAndStatus[sr.requestType][sr.status] || 0) + 1;
      }

      if (sr.status === 'Issued' || sr.status === 'Released') issuedCount++;
      else if (sr.status === 'Submitted') newCount++;
      else if (sr.status === 'For Review') processingCount++;
      else if (sr.status === 'Hold') holdCount++;
      else if (sr.status === 'Rejected') rejectedCount++;
    }

    pendingCount = newCount + processingCount;
    holdRejectedCount = holdCount + rejectedCount;

    // Aggregate complaints from already-fetched data
    let complaintTotal = 0;
    const complaintsByStatus: Record<string, number> = {};

    complaintTotal = complaints.length;
    totalRequests += complaintTotal;

    for (const c of complaints) {
      complaintsByStatus[c.caseStatus] = (complaintsByStatus[c.caseStatus] || 0) + 1;
    }

    // Map complaint statuses to report statuses
    const resolvedComplaints =
      (complaintsByStatus['Resolved'] || 0) + (complaintsByStatus['Dismissed'] || 0);
    issuedCount += resolvedComplaints;
    pendingCount +=
      (complaintsByStatus['Pending'] || 0) + (complaintsByStatus['Under Review'] || 0);
    holdRejectedCount += complaintsByStatus['Reopened'] || 0;

    // Summary KPI
    const summary = {
      totalRequests,
      issuedResolved: issuedCount,
      pendingProcessing: pendingCount,
      holdRejected: holdRejectedCount,
      issuedPct:
        totalRequests > 0 ? Math.round((issuedCount / totalRequests) * 100) : 0,
      pendingPct:
        totalRequests > 0 ? Math.round((pendingCount / totalRequests) * 100) : 0,
      holdRejectedPct:
        totalRequests > 0 ? Math.round((holdRejectedCount / totalRequests) * 100) : 0,
    };

    // Bar chart data: requests by type stacked by status
    const barChartData = Object.entries(byTypeAndStatus).map(([reqType, statuses]) => ({
      name: reqType,
      Submitted: statuses.Submitted || 0,
      'For Review': statuses['For Review'] || 0,
      'For Issuance': statuses['For Issuance'] || 0,
      Hold: statuses.Hold || 0,
      Rejected: statuses.Rejected || 0,
    }));

    // Add complaints row if included
    if (includeComplaints) {
      barChartData.push({
        name: 'Complaints',
        Submitted: complaintsByStatus['Pending'] || 0,
        'For Review': complaintsByStatus['Under Review'] || 0,
        'For Issuance':
          (complaintsByStatus['Resolved'] || 0) + (complaintsByStatus['Dismissed'] || 0),
        Hold: complaintsByStatus['Reopened'] || 0,
        Rejected: 0,
      });
    }

    // Pie chart data: status distribution
    const pieChartData = [
      {
        name: 'Submitted',
        value: newCount + (complaintsByStatus['Pending'] || 0),
        color: '#38A169',
      },
      {
        name: 'For Review',
        value: processingCount + (complaintsByStatus['Under Review'] || 0),
        color: '#4299E1',
      },
      { name: 'For Issuance', value: issuedCount, color: '#68d391' },
      {
        name: 'Hold',
        value: holdCount + (complaintsByStatus['Reopened'] || 0),
        color: '#718096',
      },
      { name: 'Rejected', value: rejectedCount, color: '#E53E3E' },
    ].filter((d) => d.value > 0);

    // ============================================================
    // Trend data — O(n + m) in-memory computation from pre-fetched records
    // Replaces 36 sequential count queries with a single Map lookup
    // ============================================================

    // Build Map<string, count> for each trend metric — O(n) pass
    const srCreatedPerMonth = new Map<string, number>();
    const srResolvedPerMonth = new Map<string, number>();

    for (const sr of srTrendRecords) {
      // Created-in-month count
      const createdKey = `${sr.createdAt.getFullYear()}-${sr.createdAt.getMonth() + 1}`;
      srCreatedPerMonth.set(createdKey, (srCreatedPerMonth.get(createdKey) || 0) + 1);

      // Resolved-in-month count (by reviewedAt, which may differ from createdAt month)
      if (sr.reviewedAt && sr.status === 'For Issuance') {
        const resolvedKey = `${sr.reviewedAt.getFullYear()}-${sr.reviewedAt.getMonth() + 1}`;
        srResolvedPerMonth.set(resolvedKey, (srResolvedPerMonth.get(resolvedKey) || 0) + 1);
      }
    }

    const complaintsPerMonth = new Map<string, number>();
    for (const c of complaintTrendRecords) {
      const key = `${c.createdAt.getFullYear()}-${c.createdAt.getMonth() + 1}`;
      complaintsPerMonth.set(key, (complaintsPerMonth.get(key) || 0) + 1);
    }

    // Look up each month from Maps — O(m) pass
    const trendData = trendMonths.map((month) => {
      const key = `${month.year}-${month.month}`;
      return {
        month: month.label,
        requests: srCreatedPerMonth.get(key) || 0,
        complaints: complaintsPerMonth.get(key) || 0,
        resolved: srResolvedPerMonth.get(key) || 0,
      };
    });

    // ============================================================
    // Raw data for CSV export — reuse already-fetched records
    // No additional DB queries needed
    // ============================================================
    const rawData: Array<Record<string, unknown>> = [];

    for (const sr of serviceRequests) {
      rawData.push({
        type: 'Service Request',
        requestType: sr.requestType,
        requestNumber: sr.requestNumber,
        requestorName: sr.requestorName,
        requestorEmail: sr.requestorEmail,
        status: sr.status,
        createdAt: sr.createdAt.toISOString(),
        reviewedAt: sr.reviewedAt?.toISOString() || '',
      });
    }

    for (const c of complaints) {
      rawData.push({
        type: 'Complaint',
        requestType: 'Complaint',
        requestNumber: c.complaintNumber,
        requestorName: '',
        requestorEmail: '',
        status: c.caseStatus,
        createdAt: c.createdAt.toISOString(),
        reviewedAt: '',
        category: c.category || '',
      });
    }

    // ============================================================
    // Response with Cache-Control
    // ============================================================
    const response = NextResponse.json({
      summary,
      barChartData,
      pieChartData,
      trendData,
      rawData,
    });

    response.headers.set('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return response;
  } catch (error) {
    console.error(
      'Failed to generate report:',
      error instanceof Error ? error.message : String(error)
    );
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}

function getTrendMonths(
  period: string,
  dateFrom: string | null,
  dateTo: string | null
): Array<{ year: number; month: number; label: string }> {
  const months: Array<{ year: number; month: number; label: string }> = [];
  const now = new Date();
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  let start: Date;
  let end: Date;

  if (dateFrom) {
    start = new Date(dateFrom);
  } else {
    // Default: last 12 months
    start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  }

  if (dateTo) {
    end = new Date(dateTo + 'T23:59:59.999');
  } else {
    end = now;
  }

  if (period === 'quarterly') {
    // Group by quarters
    const startYear = start.getFullYear();
    const startQ = Math.floor(start.getMonth() / 3);
    const endYear = end.getFullYear();
    const endQ = Math.floor(end.getMonth() / 3);

    for (let y = startYear; y <= endYear; y++) {
      const qStart = y === startYear ? startQ : 0;
      const qEnd = y === endYear ? endQ : 3;
      for (let q = qStart; q <= qEnd; q++) {
        months.push({
          year: y,
          month: q * 3 + 1,
          label: `Q${q + 1} ${y}`,
        });
      }
    }
  } else if (period === 'annual') {
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();
    for (let y = startYear; y <= endYear; y++) {
      months.push({
        year: y,
        month: 1,
        label: `${y}`,
      });
    }
  } else {
    // Monthly
    const current = new Date(start.getFullYear(), start.getMonth(), 1);
    while (current <= end) {
      months.push({
        year: current.getFullYear(),
        month: current.getMonth() + 1,
        label: `${monthNames[current.getMonth()]} ${current.getFullYear()}`,
      });
      current.setMonth(current.getMonth() + 1);
    }
  }

  return months;
}
