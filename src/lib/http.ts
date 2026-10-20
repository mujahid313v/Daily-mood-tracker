import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { formatIssues } from "./validation";
import type { RateLimitResult } from "./rate-limit";

/**
 * Best-effort client IP resolution.
 *
 * `x-forwarded-for` is set by the reverse proxy / CDN in front of the app and
 * contains a comma separated list where the first entry is the original client.
 * Falls back to the other common proxy headers and finally to a constant so the
 * limiter still degrades gracefully (single bucket) when running without a proxy.
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("fly-client-ip") ??
    "unknown"
  );
}

export function unauthorized(message = "Unauthorized"): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "Forbidden"): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function notFound(message = "Not found"): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function badRequest(message = "Invalid request"): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

/** 400 response with per-field messages. Never contains stack traces or driver text. */
export function validationError(error: ZodError): NextResponse {
  return NextResponse.json(
    { error: "Validation failed", details: formatIssues(error) },
    { status: 400 }
  );
}

export function tooManyRequests(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    { error: "Too many attempts. Please wait a moment and try again." },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
      },
    }
  );
}

/** Reads and parses a JSON body, tolerating a missing / malformed body. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
