import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession, signToken, getSessionCookieOptions } from '@/lib/session';
import { compareSync, hashSync } from 'bcryptjs';

// GET: Current user profile
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
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
        department: true,
        sex: true,
        role: true,
        status: true,
        profileImageUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Failed to fetch profile:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

// PATCH: Update profile info
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      givenName,
      surname,
      middleName,
      extensionName,
      sex,
      studentNumber,
      collegeInstitute,
      yearLevel,
      department,
      profileImageUrl,
    } = body as {
      givenName?: string;
      surname?: string;
      middleName?: string;
      extensionName?: string;
      sex?: string;
      studentNumber?: string;
      collegeInstitute?: string;
      yearLevel?: string;
      department?: string;
      profileImageUrl?: string;
    };

    // Build the full name from parts
    const nameParts = [givenName, middleName, surname, extensionName].filter(Boolean);
    const fullName = nameParts.join(' ') || session.user.fullName;

    // Handle profileImageUrl: empty string means "remove photo" (set to null)
    const profileImageUrlValue = profileImageUrl === '' ? null : (profileImageUrl ?? undefined);

    const updated = await db.user.update({
      where: { id: session.user.id },
      data: {
        givenName: givenName ?? undefined,
        surname: surname ?? undefined,
        middleName: middleName ?? undefined,
        extensionName: extensionName ?? undefined,
        sex: sex ?? undefined,
        studentNumber: studentNumber ?? undefined,
        collegeInstitute: collegeInstitute ?? undefined,
        yearLevel: yearLevel ?? undefined,
        department: department ?? undefined,
        profileImageUrl: profileImageUrlValue,
        fullName,
      },
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
        department: true,
        sex: true,
        role: true,
        status: true,
        profileImageUrl: true,
        createdAt: true,
      },
    });

    // Re-sign JWT with updated fullName so session reflects changes immediately
    const newToken = await signToken({
      id: session.user.id,
      email: updated.email,
      fullName: updated.fullName,
      role: updated.role,
      studentNumber: updated.studentNumber,
    });

    const cookieOptions = getSessionCookieOptions();
    const response = NextResponse.json(updated);
    response.cookies.set(cookieOptions.name, newToken, {
      httpOnly: cookieOptions.httpOnly,
      secure: cookieOptions.secure,
      sameSite: cookieOptions.sameSite,
      path: cookieOptions.path,
      maxAge: cookieOptions.maxAge,
    });

    return response;
  } catch (error) {
    console.error('Failed to update profile:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}

// POST: Change password
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, newPassword, confirmPassword } = body as {
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
    };

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: 'All password fields are required' },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: 'New password and confirmation do not match' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { passwordHash: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isCurrentValid = compareSync(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      );
    }

    const newHash = hashSync(newPassword, 12);
    await db.user.update({
      where: { id: session.user.id },
      data: { passwordHash: newHash },
    });

    return NextResponse.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Failed to change password:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Failed to change password' },
      { status: 500 }
    );
  }
}
