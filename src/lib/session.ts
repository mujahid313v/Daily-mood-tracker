import { SignJWT, jwtVerify } from "jose";

/**
 * Server-side session handling.
 *
 * The session is a signed JWT (HS256) stored in an HttpOnly cookie, so the
 * browser's JavaScript can never read or forge it. The client only ever learns
 * *that* a session exists via `GET /api/me`.
 *
 * Environment:
 *  - `JWT_SECRET`  – required, used to sign and verify the token
 *  - `AUTH_SECRET` – deprecated fallback kept for backwards compatibility with
 *                    deployments created before `JWT_SECRET` was introduced
 */

export const SESSION_COOKIE_NAME = "mood_session";

/** Session lifetime: 7 days. Kept in sync with the cookie `Max-Age`. */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export type SessionUser = {
  userId: string;
  email: string;
};

function getSecret(): Uint8Array {
  const raw = process.env.JWT_SECRET ?? process.env.AUTH_SECRET;

  if (!raw) {
    throw new Error("JWT_SECRET environment variable is not set");
  }

  if (raw.length < 16) {
    throw new Error("JWT_SECRET must be at least 16 characters long");
  }

  return new TextEncoder().encode(raw);
}

export async function signSessionToken(payload: SessionUser): Promise<string> {
  return await new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .setIssuer("daily-mood-tracker")
    .setAudience("daily-mood-tracker")
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
      issuer: "daily-mood-tracker",
      audience: "daily-mood-tracker",
    });

    if (!payload.sub) return null;

    return {
      userId: payload.sub,
      email: typeof payload.email === "string" ? payload.email : "",
    };
  } catch {
    return null;
  }
}

/** Reads a single cookie value out of the `Cookie` request header. */
export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;

    const key = part.slice(0, separator).trim();
    if (key === name) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }

  return null;
}

/**
 * Resolves the currently authenticated user from the request cookie.
 * Returns `null` for missing, malformed, expired or tampered tokens.
 */
export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  const token = readCookie(request, SESSION_COOKIE_NAME);
  if (!token) return null;

  return verifySessionToken(token);
}

function buildSessionCookie(token: string): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_TTL_SECONDS}`,
    "Priority=High",
  ];

  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function setSessionCookie(response: Headers, token: string): void {
  response.append("Set-Cookie", buildSessionCookie(token));
}

export function clearSessionCookie(response: Headers): void {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    "Priority=High",
  ];

  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  response.append("Set-Cookie", parts.join("; "));
}
