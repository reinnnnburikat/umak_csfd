import { NextResponse } from "next/server";
import { getLogoutCookieOptions } from "@/lib/session";

export async function POST() {
  const cookieOptions = getLogoutCookieOptions();
  const response = NextResponse.json({ success: true });

  response.cookies.set(cookieOptions.name, cookieOptions.value, cookieOptions);

  return response;
}

export async function GET() {
  return POST();
}
