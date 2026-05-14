import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

/**
 * POST /api/setup/restore-data
 * Restores welcome announcements.
 * Only creates data if the announcements table is empty — safe to call multiple times.
 */
export async function POST() {
  try {
    // Auth check: only superadmin can restore
    const session = await getSession();
    const annCount = await db.announcement.count();

    if (session?.user?.role !== 'superadmin') {
      return NextResponse.json(
        { status: 'error', error: 'Only superadmins can restore data.' },
        { status: 403 }
      );
    }

    // If announcements already exist, skip
    if (annCount > 0) {
      return NextResponse.json({
        status: 'already_has_data',
        message: 'Announcements already exist. No restore needed.',
        counts: { announcements: annCount },
      });
    }

    // Get user IDs for references
    const superAdmin = await db.user.findUnique({ where: { email: 'reinernuevas.acads@gmail.com' } });
    const adminDirector = await db.user.findUnique({ where: { email: 'adamos.pompeyoiii@umak.edu.ph' } });

    // ─── Announcements ───
    await db.announcement.createMany({
      data: [
        {
          title: 'Welcome to iCSFD+ Online Portal',
          body: 'We are pleased to announce the launch of the iCSFD+ Integrated CSFD Digital Management System. Students can now file complaints and request services online, 24/7. Processing of requests will still be done during office hours (Monday-Friday, 8AM-5PM).',
          postedFrom: new Date(),
          postedTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          visibility: 'All',
          isPinned: true,
          createdById: superAdmin?.id,
        },
        {
          title: 'Good Moral Certificate Processing Schedule',
          body: 'Please be informed that processing of Good Moral Certificates may take 3-5 working days. Ensure all required documents are uploaded before submitting your request.',
          postedFrom: new Date(),
          postedTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          visibility: 'All',
          isPinned: false,
          createdById: adminDirector?.id,
        },
      ],
    });

    return NextResponse.json({
      status: 'restored',
      message: 'Welcome announcements restored successfully!',
      created: { announcements: 2 },
      counts: { announcements: 2 },
    });
  } catch (error) {
    console.error('[Setup/Restore] Error:', error);
    return NextResponse.json(
      { status: 'error', error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
