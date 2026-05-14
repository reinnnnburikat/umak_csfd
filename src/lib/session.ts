import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

// ── Types ──────────────────────────────────────────────────────────────
export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  studentNumber?: string | null;
}

// NOTE: profileImageUrl is intentionally NOT in SessionUser/JWT to avoid cookie bloat.
// (base64 data URLs can be 1-5MB, causing Vercel 494 REQUEST_HEADER_TOO_LARGE)
// Fetch it separately via /api/user/avatar when needed.

export interface Session {
  user: SessionUser;
  expires: string;
}

// ── Constants ──────────────────────────────────────────────────────────
const COOKIE_NAME = 'csfd-session-token';
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'fallback-secret-change-me'
);
const MAX_AGE = 24 * 60 * 60; // 24 hours in seconds

// ── JWT Helpers ────────────────────────────────────────────────────────
export async function signToken(payload: SessionUser): Promise<string> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(JWT_SECRET);
  return token;
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      id: payload.id as string,
      email: payload.email as string,
      fullName: payload.fullName as string,
      role: payload.role as string,
      studentNumber: (payload.studentNumber as string) || null,
    };
  } catch {
    return null;
  }
}

// ── Cookie Helpers ─────────────────────────────────────────────────────
export function getSessionCookieOptions() {
  // In production (Vercel HTTPS), cookies MUST be secure
  const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: MAX_AGE,
    name: COOKIE_NAME,
  };
}

export function getLogoutCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
    name: COOKIE_NAME,
    value: '',
  };
}

// ── Session Helpers (Drop-in replacement for getServerSession) ────────

/**
 * Get the current session from cookies (for server components / API routes).
 * Drop-in replacement for: const session = await getServerSession(authOptions)
 *
 * Usage:
 *   Before: const session = await getServerSession(authOptions);
 *   After:  const session = await getSession();
 *
 * The returned session.user has the same shape as NextAuth's session.
 */
export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) return null;

  const user = await verifyToken(token);
  if (!user) return null;

  return {
    user,
    expires: new Date(Date.now() + MAX_AGE * 1000).toISOString(),
  };
}

/**
 * Get session from a NextRequest object (useful in middleware).
 */
export async function getSessionFromRequest(req: NextRequest): Promise<Session | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token) return null;

  const user = await verifyToken(token);
  if (!user) return null;

  return {
    user,
    expires: new Date(Date.now() + MAX_AGE * 1000).toISOString(),
  };
}
