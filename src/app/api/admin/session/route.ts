import { NextResponse } from "next/server";
import {
  clearAdminCookie,
  isValidAdminKey,
  readAdminCookie,
  setAdminCookie,
  signAdminToken,
  verifyAdminToken,
} from "@/lib/admin-session";
import { adminKeySchema } from "@/lib/validation";
import { getClientIp, readJson, tooManyRequests, unauthorized, validationError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Admin dashboard session.
 *
 * The dashboard key is exchanged for a short lived (15 minute) HttpOnly cookie.
 * The key itself is never stored in the browser, so it can no longer be read by
 * any script running on the page.
 */

/** Max 5 key attempts per minute per IP — protects the key against brute force. */
const ADMIN_LOGIN_LIMIT = 5;
const ADMIN_LOGIN_WINDOW_MS = 60_000;

/** Reports whether the caller currently holds a valid admin session. */
export async function GET(request: Request) {
  const token = readAdminCookie(request);
  const authenticated = token ? await verifyAdminToken(token) : false;

  return NextResponse.json({ authenticated });
}

/** Exchanges the dashboard key for an HttpOnly admin session cookie. */
export async function POST(request: Request) {
  const limit = rateLimit(
    `admin:login:${getClientIp(request)}`,
    ADMIN_LOGIN_LIMIT,
    ADMIN_LOGIN_WINDOW_MS
  );
  if (!limit.allowed) {
    return tooManyRequests(limit);
  }

  const body = await readJson(request);
  const parsed = adminKeySchema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  if (!isValidAdminKey(parsed.data.key)) {
    // Generic message and a small artificial delay to blunt timing attacks.
    await new Promise((resolve) => setTimeout(resolve, 250));
    return unauthorized("Invalid admin key");
  }

  const token = await signAdminToken();
  const response = NextResponse.json({ authenticated: true });
  setAdminCookie(response.headers, token);

  return response;
}

/** Ends the admin session. */
export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  clearAdminCookie(response.headers);
  return response;
}
