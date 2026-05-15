import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Time boundaries (synchronous — no I/O) ──────────────────────────
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date();
    monthEnd.setHours(23, 59, 59, 999);

    const lastMonthStart = new Date();
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
    lastMonthStart.setDate(1);
    lastMonthStart.setHours(0, 0, 0, 0);
    const lastMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0, 23, 59, 59, 999);

    const now = new Date();

    // ════════════════════════════════════════════════════════════════════
    // BATCH 1 — Core counts, summaries & user profile  (20 queries)
    //   Includes: type counts, status counts, totalRequests, unique
    //   counters (2 of 7 — rest derived), daily/monthly summaries, user.
    // ════════════════════════════════════════════════════════════════════
    const [
      gmcCount, uerCount, cdcCount, cacCount, complaintCount,
      submittedCount, forReviewCount, forIssuanceCount, issuedCount, holdCount, rejectedCount,
      totalRequests,
      activeComplaints, disciplinaryThisMonth,
      dailyTotal, dailyPending, dailyIssued,
      monthlyTotal, monthlyPending, monthlyIssued,
      dbUser,
    ] = await Promise.all([
      // — Request type counts —
      db.serviceRequest.count({ where: { requestType: 'GMC' } }),
      db.serviceRequest.count({ where: { requestType: 'UER' } }),
      db.serviceRequest.count({ where: { requestType: 'CDC' } }),
      db.serviceRequest.count({ where: { requestType: 'CAC' } }),
      db.complaint.count(),
      // — Status counts —
      db.serviceRequest.count({ where: { status: { in: ['Submitted', 'New'] } } }),
      db.serviceRequest.count({ where: { status: { in: ['For Review', 'Processing'] } } }),
      db.serviceRequest.count({ where: { status: 'For Issuance' } }),
      db.serviceRequest.count({ where: { status: { in: ['Issued', 'Released'] } } }),
      db.serviceRequest.count({ where: { status: 'Hold' } }),
      db.serviceRequest.count({ where: { status: 'Rejected' } }),
      // — Total requests —
      db.serviceRequest.count(),
      // — Unique counters (only 2; remaining 5 derived from already-fetched values) —
      db.complaint.count({ where: { caseStatus: { in: ['Pending', 'Under Review'] } } }),
      db.disciplinaryCase.count({ where: { createdAt: { gte: monthStart, lte: monthEnd } } }),
      // — Daily summary —
      db.serviceRequest.count({ where: { createdAt: { gte: todayStart, lte: todayEnd } } }),
      db.serviceRequest.count({
        where: {
          createdAt: { gte: todayStart, lte: todayEnd },
          status: { in: ['Submitted', 'For Review', 'New', 'Processing'] },
        },
      }),
      db.serviceRequest.count({
        where: { status: { in: ['Issued', 'Released'] }, issuedAt: { gte: todayStart, lte: todayEnd } },
      }),
      // — Monthly summary —
      db.serviceRequest.count({ where: { createdAt: { gte: monthStart, lte: monthEnd } } }),
      db.serviceRequest.count({
        where: {
          createdAt: { gte: monthStart, lte: monthEnd },
          status: { in: ['Submitted', 'For Review', 'New', 'Processing'] },
        },
      }),
      db.serviceRequest.count({
        where: { status: { in: ['Issued', 'Released'] }, issuedAt: { gte: monthStart, lte: monthEnd } },
      }),
      // — User profile —
      db.user.findUnique({
        where: { id: session.user.id },
        select: { profileImageUrl: true },
      }),
    ]);

    // Derive counters from already-fetched data (eliminates 7 duplicate queries):
    //   pendingRequests   == submittedCount + forReviewCount
    //   todayNewRequests  == dailyTotal           (identical WHERE clause)
    //   forIssuancePending == forIssuanceCount     (identical WHERE clause)
    //   onHoldRequests    == holdCount             (identical WHERE clause)
    //   issuedToday       == dailyIssued           (identical WHERE clause)
    const pendingRequests = submittedCount + forReviewCount;
    const todayNewRequests = dailyTotal;
    const forIssuancePending = forIssuanceCount;
    const onHoldRequests = holdCount;
    const issuedToday = dailyIssued;

    const dailyResolvedPct = dailyTotal > 0 ? Math.round((dailyIssued / dailyTotal) * 100) : 0;
    const monthlyResolvedPct = monthlyTotal > 0 ? Math.round((monthlyIssued / monthlyTotal) * 100) : 0;

    // ════════════════════════════════════════════════════════════════════
    // BATCH 2 — Trend data: 6 months × 4 types  (24 queries in one shot)
    // ════════════════════════════════════════════════════════════════════
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Pre-compute all month ranges synchronously
    const monthRanges = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      return {
        label: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
        start: new Date(d.getFullYear(), d.getMonth(), 1),
        end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999),
      };
    });

    // Fire ALL 24 count queries in a single Promise.all (was 6 sequential iterations)
    const trendCounts = await Promise.all(
      monthRanges.flatMap(({ start, end }) => [
        db.serviceRequest.count({ where: { requestType: 'GMC', createdAt: { gte: start, lte: end } } }),
        db.serviceRequest.count({ where: { requestType: 'UER', createdAt: { gte: start, lte: end } } }),
        db.serviceRequest.count({ where: { requestType: 'CDC', createdAt: { gte: start, lte: end } } }),
        db.serviceRequest.count({ where: { requestType: 'CAC', createdAt: { gte: start, lte: end } } }),
      ]),
    );

    // Reconstruct trend array from flat results
    const trendData = monthRanges.map((range, i) => {
      const base = i * 4;
      return {
        month: range.label,
        GMC: trendCounts[base],
        UER: trendCounts[base + 1],
        CDC: trendCounts[base + 2],
        CAC: trendCounts[base + 3],
        total: trendCounts[base] + trendCounts[base + 1] + trendCounts[base + 2] + trendCounts[base + 3],
      };
    });

    // ════════════════════════════════════════════════════════════════════
    // BATCH 3 — Comparison, categories, latest items & announcements (10 queries)
    //   comparisonData this-month requests  = monthlyTotal    (from batch 1)
    //   comparisonData this-month disciplinary = disciplinaryThisMonth (from batch 1)
    // ════════════════════════════════════════════════════════════════════
    const [
      lastMonthRequests,
      lastMonthComplaints,
      lastMonthDisciplinary,
      thisMonthComplaints,
      complaintCategoryRaw,
      latestServiceRequests,
      latestComplaints,
      latestDisciplinary,
      latestAnnouncements,
      staffAnnouncements,
    ] = await Promise.all([
      // — Comparison: last month —
      db.serviceRequest.count({ where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd } } }),
      db.complaint.count({ where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd } } }),
      db.disciplinaryCase.count({ where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd } } }),
      // — Comparison: this month (requests & disciplinary already fetched in batch 1) —
      db.complaint.count({ where: { createdAt: { gte: monthStart, lte: monthEnd } } }),
      // — Complaint category breakdown (single GROUP BY — replaces findMany of ALL rows) —
      db.$queryRaw<Array<{ name: string; count: number }>>`
        SELECT COALESCE(NULLIF("category",''), NULLIF("complaintCategory",''), 'Uncategorized') AS name, COUNT(*) AS count
        FROM "Complaint"
        GROUP BY name
      `,
      // — Latest 5 service requests —
      db.serviceRequest.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          requestNumber: true,
          requestType: true,
          requestorName: true,
          status: true,
          createdAt: true,
        },
      }),
      // — Latest 5 complaints —
      db.complaint.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          complaintNumber: true,
          subject: true,
          caseStatus: true,
          category: true,
          createdAt: true,
        },
      }),
      // — Latest 5 disciplinary records —
      db.disciplinaryCase.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          studentName: true,
          studentNumber: true,
          violationType: true,
          violationCategory: true,
          status: true,
          createdAt: true,
        },
      }),
      // — Latest announcements —
      db.announcement.findMany({
        where: { postedFrom: { lte: now }, postedTo: { gte: now } },
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        take: 5,
        select: {
          id: true,
          title: true,
          body: true,
          postedFrom: true,
          postedTo: true,
          isPinned: true,
          createdAt: true,
        },
      }),
      // — Staff-visible announcements —
      db.announcement.findMany({
        where: {
          postedFrom: { lte: now },
          postedTo: { gte: now },
          visibility: { in: ['Staff', 'All'] },
        },
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        take: 8,
        select: {
          id: true,
          title: true,
          body: true,
          visibility: true,
          postedFrom: true,
          postedTo: true,
          isPinned: true,
          createdAt: true,
          fileUrl: true,
        },
      }),
    ]);

    // Assemble comparison data (reuses monthlyTotal & disciplinaryThisMonth from batch 1)
    const comparisonData = [
      {
        period: 'Last Month',
        requests: lastMonthRequests,
        complaints: lastMonthComplaints,
        disciplinary: lastMonthDisciplinary,
      },
      {
        period: 'This Month',
        requests: monthlyTotal,
        complaints: thisMonthComplaints,
        disciplinary: disciplinaryThisMonth,
      },
    ];

    // ════════════════════════════════════════════════════════════════════
    // Response
    // ════════════════════════════════════════════════════════════════════
    const response = NextResponse.json({
      // User info
      user: {
        fullName: session.user.fullName,
        role: session.user.role,
        profileImageUrl: dbUser?.profileImageUrl ?? null,
      },

      // Type counts
      requestTypeCounts: { GMC: gmcCount, UER: uerCount, CDC: cdcCount, CAC: cacCount },
      complaintCount,

      // Status counts
      statusCounts: {
        Submitted: submittedCount,
        'For Review': forReviewCount,
        'For Issuance': forIssuanceCount,
        Issued: issuedCount,
        Hold: holdCount,
        Rejected: rejectedCount,
      },
      totalRequests,

      // Announcements
      latestAnnouncements,
      staffAnnouncements,

      // Summaries
      dailySummary: { total: dailyTotal, pending: dailyPending, issued: dailyIssued, resolvedPct: dailyResolvedPct },
      monthlySummary: { total: monthlyTotal, pending: monthlyPending, issued: monthlyIssued, resolvedPct: monthlyResolvedPct },

      // Counters (action-oriented)
      counters: {
        pendingRequests,
        todayNewRequests,
        activeComplaints,
        disciplinaryThisMonth,
        forIssuancePending,
        onHoldRequests,
        issuedToday,
      },

      // Analytics
      trendData,
      comparisonData,
      complaintCategoryData: complaintCategoryRaw.map((row) => ({
        name: row.name,
        count: Number(row.count),
      })),

      // Recent activity
      latestServiceRequests,
      latestComplaints,
      latestDisciplinary,
    });

    response.headers.set('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return response;
  } catch (error) {
    console.error('Failed to fetch dashboard data:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 },
    );
  }
}
