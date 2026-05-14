import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

/**
 * Returns the current session (user info).
 * Compatible with NextAuth's /api/auth/session endpoint shape.
 *
 * NOTE: profileImageUrl is fetched from DB (not from JWT cookie) to avoid
 * cookie bloat. The JWT only stores id, email, fullName, role, studentNumber.
 */
export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({});
    }

    // Fetch profileImageUrl from DB — it's NOT in the JWT (prevents cookie bloat)
    let profileImageUrl: string | null = null;
    if (session.user.id) {
      try {
        const user = await db.user.findUnique({
          where: { id: session.user.id },
          select: { profileImageUrl: true },
        });
        profileImageUrl = user?.profileImageUrl ?? null;
      } catch {
        // Non-critical — just return null
      }
    }

    return NextResponse.json({
      user: {
        ...session.user,
        profileImageUrl,
      },
      expires: session.expires,
    });
  } catch (error) {
    console.error("[Auth/Session] error:", error);
    return NextResponse.json({});
  }
}
