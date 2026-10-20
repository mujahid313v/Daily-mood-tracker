import { NextResponse } from "next/server";
import { authenticateUser, InvalidCredentialsError } from "@/lib/controllers/auth";
import { signSessionToken, setSessionCookie } from "@/lib/session";
import { loginSchema } from "@/lib/validation";
import { getClientIp, readJson, tooManyRequests, validationError } from "@/lib/http";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";

/** Max 5 failed login attempts per minute per IP. */
const LOGIN_LIMIT = 5;
const LOGIN_WINDOW_MS = 60_000;

/** Max 10 attempts per minute for a single account, so one account cannot be
 *  brute forced from many different IPs. */
const ACCOUNT_LIMIT = 10;
const ACCOUNT_WINDOW_MS = 60_000;

export async function POST(request: Request) {
  const ip = getClientIp(request);

  const ipLimit = rateLimit(`login:ip:${ip}`, LOGIN_LIMIT, LOGIN_WINDOW_MS);
  if (!ipLimit.allowed) {
    return tooManyRequests(ipLimit);
  }

  const body = await readJson(request);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const accountKey = `login:account:${parsed.data.email}`;
  const accountLimit = rateLimit(accountKey, ACCOUNT_LIMIT, ACCOUNT_WINDOW_MS);
  if (!accountLimit.allowed) {
    return tooManyRequests(accountLimit);
  }

  try {
    const user = await authenticateUser(parsed.data.email, parsed.data.password);

    // Successful login clears the per-account counter.
    resetRateLimit(accountKey);

    const token = await signSessionToken({ userId: user.id, email: user.email });

    const response = NextResponse.json({ user }, { status: 200 });
    setSessionCookie(response.headers, token);

    return response;
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      // Generic message on purpose: it must not reveal whether the account exists.
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    console.error("Failed to login");
    return NextResponse.json({ error: "Unable to sign in right now" }, { status: 500 });
  }
}
