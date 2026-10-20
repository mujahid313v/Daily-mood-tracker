import { createHash, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { readCookie } from "./session";

/**
 * Admin dashboard session handling.
 *
 * The admin key is never written to `localStorage` (it used to be, which exposed
 * it to any XSS). Instead the key is exchanged once for a short lived, HttpOnly
 * cookie. The browser can neither read nor forge it.
 *
 * `GET /api/admin/summary` additionally accepts the raw key as a Bearer token so
 * the endpoint stays usable from scripts / CI.
 */

export const ADMIN_COOKIE_NAME = "mood_admin";

/** Admin sessions are deliberately short lived (15 minutes). */
export const ADMIN_TTL_SECONDS = 60 * 15;

function getSecret(): Uint8Array {
  const raw = process.env.JWT_SECRET ?? process.env.AUTH_SECRET;

  if (!raw) {
    throw new Error("JWT_SECRET environment variable is not set");
  }

  return new TextEncoder().encode(raw);
}

/**
 * Constant-time string comparison.
 *
 * Both values are hashed with SHA-256 first so the comparison always operates on
 * two fixed-length 32 byte buffers. That removes the early-return length check
 * (which would otherwise leak the secret length through response timing) and
 * still uses `crypto.timingSafeEqual` for the actual comparison.
 */
export function safeCompare(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a, "utf8").digest();
  const hashB = createHash("sha256").update(b, "utf8").digest();

  return timingSafeEqual(hashA, hashB);
}

/** Verifies a candidate key against `ADMIN_DASHBOARD_KEY`. */
export function isValidAdminKey(candidate: string): boolean {
  const expected = process.env.ADMIN_DASHBOARD_KEY;

  if (!expected || !candidate) return false;

  return safeCompare(expected, candidate);
}

export async function signAdminToken(): Promise<string> {
  return await new SignJWT({ scope: "admin" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject("admin")
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_TTL_SECONDS}s`)
    .setIssuer("daily-mood-tracker")
    .setAudience("daily-mood-tracker-admin")
    .sign(getSecret());
}

export async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
      issuer: "daily-mood-tracker",
      audience: "daily-mood-tracker-admin",
    });
    return true;
  } catch {
    return false;
  }
}

export function readAdminCookie(request: Request): string | null {
  return readCookie(request, ADMIN_COOKIE_NAME);
}

/**
 * Resolves admin authorisation from either the HttpOnly cookie (browser UI) or
 * an `Authorization: Bearer <key>` header (scripts / CI).
 */
export async function isAdminRequest(request: Request): Promise<boolean> {
  const cookieToken = readAdminCookie(request);
  if (cookieToken && (await verifyAdminToken(cookieToken))) {
    return true;
  }

  const header = request.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : header.trim();

  if (bearer && isValidAdminKey(bearer)) {
    return true;
  }

  return false;
}

export function setAdminCookie(response: Headers, token: string): void {
  const parts = [
    `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${ADMIN_TTL_SECONDS}`,
    "Priority=High",
  ];

  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  response.append("Set-Cookie", parts.join("; "));
}

export function clearAdminCookie(response: Headers): void {
  const parts = [
    `${ADMIN_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0",
  ];

  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  response.append("Set-Cookie", parts.join("; "));
}
