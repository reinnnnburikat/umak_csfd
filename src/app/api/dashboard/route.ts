import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Counts by request type ──
    const [gmcCount, uerCount, cdcCount, cacCount, complaintCount] = await Promise.all([
      db.serviceRequest.count({ where: { requestType: 'GMC' } }),
      db.serviceRequest.count({ where: { requestType: 'UER' } }),
      db.serviceRequest.count({ where: { requestType: 'CDC' } }),
      db.serviceRequest.count({ where: { requestType: 'CAC' } }),
      db.complaint.count(),
    ]);

    // ── Counts by status ──
    const [submittedCount, forReviewCount, forIssuanceCount, issuedCount, holdCount, rejectedCount] = await Promise.all([
      db.serviceRequest.count({ where: { status: { in: ['Submitted', 'New'] } } }),
      db.serviceRequest.count({ where: { status: { in: ['For Review', 'Processing'] } } }),
      db.serviceRequest.count({ where: { status: 'For Issuance' } }),
      db.serviceRequest.count({ where: { status: { in: ['Issued', 'Released'] } } }),
      db.serviceRequest.count({ where: { status: 'Hold' } }),
      db.serviceRequest.count({ where: { status: 'Rejected' } }),
    ]);

    const totalRequests = await db.serviceRequest.count();

    // ── Time boundaries ──
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date();
    monthEnd.setHours(23, 59, 59, 999);

    // ── Real-time Counters ──
    const [pendingRequests, todayNewRequests, activeComplaints, disciplinaryThisMonth, forIssuancePending, onHoldRequests, issuedToday] = await Promise.all([
      // Pending = Submitted + For Review
      db.serviceRequest.count({ where: { status: { in: ['Submitted', 'For Review', 'New', 'Processing'] } } }),
      // Today's new
      db.serviceRequest.count({ where: { createdAt: { gte: todayStart, lte: todayEnd } } }),
      // Active complaints
      db.complaint.count({ where: { caseStatus: { in: ['Pending', 'Under Review'] } } }),
      // Disciplinary this month
      db.disciplinaryCase.count({ where: { createdAt: { gte: monthStart, lte: monthEnd } } }),
      // For Issuance (waiting to be issued)
      db.serviceRequest.count({ where: { status: 'For Issuance' } }),
      // On Hold
      db.serviceRequest.count({ where: { status: 'Hold' } }),
      // Issued today
      db.serviceRequest.count({ where: { status: { in: ['Issued', 'Released'] }, issuedAt: { gte: todayStart, lte: todayEnd } } }),
    ]);

    // ── Service Request Trends (last 6 months) ──
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const trendData: Array<{
      month: string;
      GMC: number;
      UER: number;
      CDC: number;
      CAC: number;
      total: number;
    }> = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

      const [gmc, uer, cdc, cac] = await Promise.all([
        db.serviceRequest.count({ where: { requestType: 'GMC', createdAt: { gte: mStart, lte: mEnd } } }),
        db.serviceRequest.count({ where: { requestType: 'UER', createdAt: { gte: mStart, lte: mEnd } } }),
        db.serviceRequest.count({ where: { requestType: 'CDC', createdAt: { gte: mStart, lte: mEnd } } }),
        db.serviceRequest.count({ where: { requestType: 'CAC', createdAt: { gte: mStart, lte: mEnd } } }),
      ]);

      trendData.push({
        month: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
        GMC: gmc,
        UER: uer,
        CDC: cdc,
        CAC: cac,
        total: gmc + uer + cdc + cac,
      });
    }

    // ── Monthly comparison (this month vs last month) ──
    const lastMonthStart = new Date();
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
    lastMonthStart.setDate(1);
    lastMonthStart.setHours(0, 0, 0, 0);
    const lastMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0, 23, 59, 59, 999);

    const comparisonData = await Promise.all([
      {
        period: 'Last Month',
        requests: await db.serviceRequest.count({ where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd } } }),
        complaints: await db.complaint.count({ where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd } } }),
        disciplinary: await db.disciplinaryCase.count({ where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd } } }),
      },
      {
        period: 'This Month',
        requests: await db.serviceRequest.count({ where: { createdAt: { gte: monthStart, lte: monthEnd } } }),
        complaints: await db.complaint.count({ where: { createdAt: { gte: monthStart, lte: monthEnd } } }),
        disciplinary: await db.disciplinaryCase.count({ where: { createdAt: { gte: monthStart, lte: monthEnd } } }),
      },
    ]).then(results => results);

    // ── Complaint category breakdown ──
    const allComplaints = await db.complaint.findMany({
      select: { category: true, complaintCategory: true },
    });

    const complaintCategories: Record<string, number> = {};
    for (const c of allComplaints) {
      const cat = c.category || c.complaintCategory || 'Uncategorized';
      complaintCategories[cat] = (complaintCategories[cat] || 0) + 1;
    }

    const complaintCategoryData = Object.entries(complaintCategories).map(([name, count]) => ({
      name,
      count,
    }));

    // ── Latest 5 service requests ──
    const latestServiceRequests = await db.serviceRequest.findMany({
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
    });

    // ── Latest 5 complaints ──
    const latestComplaints = await db.complaint.findMany({
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
    });

    // ── Latest 5 disciplinary records ──
    const latestDisciplinary = await db.disciplinaryCase.findMany({
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
    });

    // ── Latest announcements ──
    const now = new Date();
    const latestAnnouncements = await db.announcement.findMany({
      where: {
        postedFrom: { lte: now },
        postedTo: { gte: now },
      },
      orderBy: [
        { isPinned: 'desc' },
        { createdAt: 'desc' },
      ],
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
    });

    // ── Staff-visible announcements (visibility = 'Staff' or 'All') ──
    const staffAnnouncements = await db.announcement.findMany({
      where: {
        postedFrom: { lte: now },
        postedTo: { gte: now },
        visibility: { in: ['Staff', 'All'] },
      },
      orderBy: [
        { isPinned: 'desc' },
        { createdAt: 'desc' },
      ],
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
    });

    // ── Daily & Monthly summaries ──
    const [dailyTotal, dailyPending, dailyIssued] = await Promise.all([
      db.serviceRequest.count({ where: { createdAt: { gte: todayStart, lte: todayEnd } } }),
      db.serviceRequest.count({ where: { createdAt: { gte: todayStart, lte: todayEnd }, status: { in: ['Submitted', 'For Review', 'New', 'Processing'] } } }),
      db.serviceRequest.count({ where: { status: { in: ['Issued', 'Released'] }, issuedAt: { gte: todayStart, lte: todayEnd } } }),
    ]);
    const dailyResolvedPct = dailyTotal > 0 ? Math.round((dailyIssued / dailyTotal) * 100) : 0;

    const [monthlyTotal, monthlyPending, monthlyIssued] = await Promise.all([
      db.serviceRequest.count({ where: { createdAt: { gte: monthStart, lte: monthEnd } } }),
      db.serviceRequest.count({ where: { createdAt: { gte: monthStart, lte: monthEnd }, status: { in: ['Submitted', 'For Review', 'New', 'Processing'] } } }),
      db.serviceRequest.count({ where: { status: { in: ['Issued', 'Released'] }, issuedAt: { gte: monthStart, lte: monthEnd } } }),
    ]);
    const monthlyResolvedPct = monthlyTotal > 0 ? Math.round((monthlyIssued / monthlyTotal) * 100) : 0;

    // Fetch profile image from DB (not from JWT cookie — prevents cookie bloat)
    const dbUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { profileImageUrl: true },
    });

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
      statusCounts: { Submitted: submittedCount, 'For Review': forReviewCount, 'For Issuance': forIssuanceCount, Issued: issuedCount, Hold: holdCount, Rejected: rejectedCount },
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
      complaintCategoryData,

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
      { status: 500 }
    );
  }
}
