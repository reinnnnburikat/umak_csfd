import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashSync } from 'bcryptjs';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user || !['admin', 'superadmin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        givenName: true,
        surname: true,
        middleName: true,
        extensionName: true,
        studentNumber: true,
        collegeInstitute: true,
        yearLevel: true,
        sex: true,
        role: true,
        status: true,
        department: true,
        profileImageUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Failed to fetch user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user || !['admin', 'superadmin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { fullName, email, role, password, status } = body;

    const existingUser = await db.user.findUnique({ where: { id } });
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Role change requires superadmin
    if (role && role !== existingUser.role && session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Only Super Admin can change user roles' }, { status: 403 });
    }

    // Only superadmin can assign superadmin role
    if (role === 'superadmin' && session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Only Super Admin can assign the superadmin role' }, { status: 403 });
    }

    // Prevent non-superadmin from changing their own role
    if (role && role !== existingUser.role && existingUser.id === session.user.id && session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'You cannot change your own role' }, { status: 403 });
    }

    const oldValue = {
      fullName: existingUser.fullName,
      email: existingUser.email,
      role: existingUser.role,
      status: existingUser.status,
    };

    const updateData: Record<string, unknown> = {};
    if (fullName) updateData.fullName = fullName;
    if (email) updateData.email = email;
    if (role) {
      const validRoles = ['admin', 'staff', 'student_assistant', 'makati_internship', 'superadmin'];
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
      updateData.role = role;
    }
    if (password && password.trim()) {
      updateData.passwordHash = hashSync(password, 12);
    }
    if (status) {
      const validStatuses = ['active', 'deactivated'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      updateData.status = status;
    }

    const updatedUser = await db.user.update({
      where: { id },
      data: updateData,
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
      actionType: 'UPDATE',
      module: 'user',
      recordId: id,
      oldValue,
      newValue: {
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        role: updatedUser.role,
        status: updatedUser.status,
      },
      remarks: `Updated user ${updatedUser.fullName} (${updatedUser.email})`,
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Failed to update user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user || session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Only Super Admin can delete users' }, { status: 403 });
    }

    const { id } = await params;

    const existingUser = await db.user.findUnique({ where: { id } });
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent deleting yourself
    if (existingUser.id === session.user.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    await db.user.update({
      where: { id },
      data: { status: 'deactivated' },
    });

    await createAuditLog({
      performedBy: session.user.id,
      performerName: session.user.fullName,
      performerRole: session.user.role,
      actionType: 'DELETE',
      module: 'user',
      recordId: id,
      oldValue: {
        fullName: existingUser.fullName,
        email: existingUser.email,
        role: existingUser.role,
        status: existingUser.status,
      },
      newValue: {
        status: 'deactivated',
      },
      remarks: `Soft-deleted (deactivated) user ${existingUser.fullName} (${existingUser.email})`,
    });

    return NextResponse.json({ message: 'User deactivated successfully' });
  } catch (error) {
    console.error('Failed to delete user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}
