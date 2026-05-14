import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/debug/db - Debug endpoint to check database connection and user state.
 * TEMPORARY: Remove this after fixing the login issue.
 */
export async function GET() {
  try {
    const dbUrl = process.env.DATABASE_URL || "NOT SET";
    const directUrl = process.env.DIRECT_DATABASE_URL || "NOT SET";
    const nodeEnv = process.env.NODE_ENV || "NOT SET";
    const vercel = process.env.VERCEL || "NOT SET";
    const jwtSecret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || "NOT SET";

    // Mask passwords in URLs for security
    const maskUrl = (url: string) => {
      if (url === "NOT SET") return "NOT SET";
      try {
        const u = new URL(url);
        if (u.password) u.password = "****";
        return u.toString();
      } catch {
        return url.replace(/:([^@]+)@/, ":****@");
      }
    };

    // Try to connect
    let tableInfo = "unknown";
    let userCount = -1;
    let users: Array<{ email: string; role: string; fullName: string }> = [];
    let error = null;

    try {
      const result = await db.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'User'
        ) as exists
      `;
      tableInfo = result[0]?.exists ? "User table EXISTS" : "User table MISSING";

      if (result[0]?.exists) {
        userCount = await db.user.count();
        users = await db.user.findMany({
          select: { email: true, role: true, fullName: true },
          take: 20,
          orderBy: { createdAt: "asc" },
        });
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      const isSQLite = dbUrl.startsWith("file:");
      if (isSQLite) {
        tableInfo = "SQLite (local) - this should NOT be used on Vercel!";
        try {
          userCount = await db.user.count();
        } catch {}
      }
    }

    return NextResponse.json({
      environment: { nodeEnv, vercel },
      database: {
        url: maskUrl(dbUrl),
        directUrl: maskUrl(directUrl),
        isSQLite: dbUrl.startsWith("file:"),
      },
      auth: {
        jwtSecret: jwtSecret === "NOT SET" ? "NOT SET" : "SET (" + jwtSecret.length + " chars)",
      },
      dbState: {
        tableInfo,
        userCount,
        users,
        error: error ? String(error) : null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
