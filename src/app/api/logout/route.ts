import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session";

/** Destroys the session by expiring the HttpOnly cookie. */
export async function POST() {
  const response = NextResponse.json({ success: true });
  clearSessionCookie(response.headers);
  return response;
}
