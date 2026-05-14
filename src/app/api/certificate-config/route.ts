import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

const CERT_CONFIG_KEYS = [
  'cert_background_url',
  'cert_esignature_url',
  'cert_academic_year',
  'cert_director_name',
  'cert_director_title',
];

export async function GET() {
  try {
    const contents = await db.cmsContent.findMany({
      where: { key: { in: CERT_CONFIG_KEYS } },
    });

    const configMap: Record<string, string> = {};
    for (const item of contents) {
      configMap[item.key] = item.value;
    }

    return NextResponse.json({
      data: {
        certBackgroundUrl: configMap['cert_background_url'] || '',
        certEsignatureUrl: configMap['cert_esignature_url'] || '',
        certAcademicYear: configMap['cert_academic_year'] || '2025-2026',
        certDirectorName: configMap['cert_director_name'] || 'Assoc. Prof. POMPEYO C. ADAMOS III, M.A',
        certDirectorTitle: configMap['cert_director_title'] || 'Director, Center for Student Formation and Discipline',
      },
    });
  } catch (error) {
    console.error('Failed to fetch certificate config:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Failed to fetch certificate config' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user?.role as string;
    if (!['admin', 'superadmin'].includes(userRole)) {
      return NextResponse.json({ error: 'Forbidden: Only administrators can modify certificate configuration.' }, { status: 403 });
    }

    const body = await request.json();
    const { certAcademicYear, certDirectorName, certDirectorTitle } = body;

    const items = [
      { key: 'cert_academic_year', label: 'Certificate Academic Year', value: certAcademicYear || '' },
      { key: 'cert_director_name', label: 'Certificate Director Name', value: certDirectorName || '' },
      { key: 'cert_director_title', label: 'Certificate Director Title', value: certDirectorTitle || '' },
    ];

    // Only update image URLs if provided
    if (body.certBackgroundUrl !== undefined) {
      items.push({ key: 'cert_background_url', label: 'Certificate Background URL', value: body.certBackgroundUrl });
    }
    if (body.certEsignatureUrl !== undefined) {
      items.push({ key: 'cert_esignature_url', label: 'Certificate E-Signature URL', value: body.certEsignatureUrl });
    }

    const results = [];
    for (const item of items) {
      const content = await db.cmsContent.upsert({
        where: { key: item.key },
        update: { label: item.label, value: item.value, updatedBy: session.user.id },
        create: { key: item.key, label: item.label, value: item.value, updatedBy: session.user.id },
      });
      results.push(content);
    }

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error('Failed to update certificate config:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Failed to update certificate config' },
      { status: 500 }
    );
  }
}
