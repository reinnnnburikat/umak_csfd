import { NextRequest, NextResponse } from "next/server";
import { compareSync } from "bcryptjs";
import { db } from "@/lib/db";
import { signToken, getSessionCookieOptions } from "@/lib/session";
import { ensureDatabaseReady } from "@/lib/db-setup";

/**
 * Custom login API endpoint.
 * Validates credentials, creates a JWT, and sets it as an httpOnly cookie.
 *
 * AUTO-SETUP: On first Vercel deployment, if the database is empty (no tables/users),
 * this endpoint automatically creates all tables and seeds default accounts.
 * This ensures the app works out-of-the-box without manual setup.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    console.log("[Auth/Login] attempt for:", normalizedEmail);

    // ── Auto-setup: Ensure database is ready (tables + users) ──
    // This handles first-time Vercel deployments where Supabase is empty.
    // It's safe to call on every login — it's a no-op if data already exists.
    try {
      const userCount = await db.user.count();
      if (userCount === 0) {
        console.log("[Auth/Login] Empty database — running auto-setup...");
        await ensureDatabaseReady();
        console.log("[Auth/Login] Auto-setup complete.");
      }
    } catch (autoSetupErr) {
      // If user count fails (table doesn't exist), run full auto-setup
      console.log("[Auth/Login] DB check failed — running full auto-setup...");
      try {
        await ensureDatabaseReady();
        console.log("[Auth/Login] Full auto-setup complete.");
      } catch (fullSetupErr) {
        console.error("[Auth/Login] Auto-setup failed:", fullSetupErr);
        // Continue with login — the user lookup error will provide feedback
      }
    }

    // Find user
    let user;
    try {
      user = await db.user.findUnique({
        where: { email: normalizedEmail },
      });
    } catch (dbError) {
      // Database error - table might not exist or DB is unreachable
      console.error("[Auth/Login] database error:", dbError);
      return NextResponse.json(
        { error: "Database is not initialized. Please run database setup first.", code: "DB_NOT_READY" },
        { status: 503 }
      );
    }

    if (!user) {
      console.log("[Auth/Login] no user found for:", normalizedEmail);
      return NextResponse.json(
        { error: "Invalid email or password", code: "USER_NOT_FOUND" },
        { status: 401 }
      );
    }

    if (user.status === "deactivated") {
      console.log("[Auth/Login] account deactivated:", normalizedEmail);
      return NextResponse.json(
        { error: "Your account has been deactivated. Please contact an administrator.", code: "DEACTIVATED" },
        { status: 403 }
      );
    }

    // Verify password
    const isPasswordValid = compareSync(password, user.passwordHash);
    console.log("[Auth/Login] password check:", isPasswordValid, "for:", normalizedEmail);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Invalid email or password", code: "WRONG_PASSWORD" },
        { status: 401 }
      );
    }

    console.log("[Auth/Login] success for:", normalizedEmail, "role:", user.role);

    // Create JWT token (profileImageUrl excluded to prevent cookie bloat / 494 error)
    const token = await signToken({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      studentNumber: user.studentNumber,
    });

    // Set JWT as httpOnly cookie
    const cookieOptions = getSessionCookieOptions();
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        profileImageUrl: user.profileImageUrl || null,
      },
    });

    response.cookies.set(cookieOptions.name, token, cookieOptions);

    return response;
  } catch (error) {
    console.error("[Auth/Login] error:", error);
    return NextResponse.json(
      { error: "Authentication service unavailable. Please try again later.", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
