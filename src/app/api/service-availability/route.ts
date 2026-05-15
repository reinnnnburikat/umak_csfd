import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/service-availability
 * Returns availability status for all public services.
 *
 * Reads from the ServiceToggle table (the same table used by the admin
 * /api/service-toggles endpoint), ensuring consistency between what
 * admins configure and what the public sees.
 *
 * Defaults to true (available) if no entry exists.
 */
export async function GET() {
  try {
    const SERVICE_KEYS = [
      'GMC',
      'UER',
      'CDC',
      'CAC',
      'COMPLAINT',
      'DISCIPLINARY',
    ];

    const toggles = await db.serviceToggle.findMany({
      where: {
        serviceKey: { in: SERVICE_KEYS },
      },
    });

    // Build the availability object from ServiceToggle records
    const availability: Record<string, boolean> = {};

    // Initialize all services as available by default
    for (const key of SERVICE_KEYS) {
      availability[key] = true;
    }

    // Override with actual toggle values from the database
    for (const toggle of toggles) {
      if (SERVICE_KEYS.includes(toggle.serviceKey)) {
        availability[toggle.serviceKey] = toggle.isActive;
      }
    }

    const response = NextResponse.json(availability);
    response.headers.set('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return response;
  } catch (error) {
    console.error('Failed to fetch service availability:', error);
    // Fail open: return all services as available
    const fallbackResponse = NextResponse.json({
      GMC: true,
      UER: true,
      CDC: true,
      CAC: true,
      COMPLAINT: true,
      DISCIPLINARY: true,
    });
    fallbackResponse.headers.set('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return fallbackResponse;
  }
}
