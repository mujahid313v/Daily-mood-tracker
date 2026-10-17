import { SignJWT, jwtVerify } from "jose";

const AUTH_SECRET = process.env.AUTH_SECRET;
const COOKIE_NAME = "mood-session";

let secret: Uint8Array | null = null;

function getSecret(): Uint8Array {
  if (!secret) {
    if (!AUTH_SECRET) {
      throw new Error("AUTH_SECRET environment variable is not set");
    }
    secret = new TextEncoder().encode(AUTH_SECRET);
  }
  return secret;
}

export async function signToken(payload: { userId: string; email: string }): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function getSessionUser(request: Request): Promise<{ userId: string; email: string } | null> {
  try {
    if (!AUTH_SECRET) return null;

    const cookieHeader = request.headers.get("cookie");
    if (!cookieHeader) return null;

    const token = cookieHeader
      .split("; ")
      .find((c) => c.startsWith(`${COOKIE_NAME}=`))
      ?.split("=")[1];

    if (!token) return null;

    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as { userId: string; email: string };
  } catch {
    return null;
  }
}

export function getCookieOptions(): Record<string, string | boolean> {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: "true",
    sameSite: "lax",
    path: "/",
    ...(isProd ? { secure: "true" } : {}),
  };
}

export function setSessionCookie(response: Headers, token: string): void {
  const opts = getCookieOptions();
  const parts = [`${COOKIE_NAME}=${token}`, `Path=${opts.path}`, `HttpOnly`, `SameSite=${opts.sameSite}`];
  if (opts.secure === true) parts.push("Secure");
  const maxAge = 7 * 24 * 60 * 60; // 7 days
  parts.push(`Max-Age=${maxAge}`);
  response.append("Set-Cookie", parts.join("; "));
}

export function clearSessionCookie(response: Headers): void {
  response.append(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=lax; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
  );
}
