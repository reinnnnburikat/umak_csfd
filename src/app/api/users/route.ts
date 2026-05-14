import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashSync } from 'bcryptjs';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user || !['admin', 'superadmin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const role = searchParams.get('role');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (role && role !== 'all') {
      where.role = role;
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          fullName: true,
          givenName: true,
          surname: true,
          role: true,
          status: true,
          department: true,
          profileImageUrl: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.user.count({ where }),
    ]);

    return NextResponse.json({
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user || session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Only Super Admin can create users' }, { status: 403 });
    }

    const body = await request.json();
    const { fullName, email, role, password } = body;

    if (!fullName || !email || !role || !password) {
      return NextResponse.json(
        { error: 'Missing required fields: fullName, email, role, password' },
        { status: 400 }
      );
    }

    const validRoles = ['admin', 'staff', 'student_assistant', 'makati_internship', 'superadmin'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }

    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 409 }
      );
    }

    const passwordHash = hashSync(password, 12);

    const newUser = await db.user.create({
      data: {
        fullName,
        givenName: body.givenName || null,
        surname: body.surname || null,
        email,
        role,
        department: body.department || null,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        givenName: true,
        surname: true,
        role: true,
        status: true,
        department: true,
        profileImageUrl: true,
        createdAt: true,
      },
    });

    await createAuditLog({
      performedBy: session.user.id,
      performerName: session.user.fullName,
      performerRole: session.user.role,
      actionType: 'CREATE',
      module: 'user',
      recordId: newUser.id,
      newValue: newUser,
      remarks: `Created user ${newUser.fullName} (${newUser.email}) with role ${newUser.role}`,
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error('Failed to create user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
