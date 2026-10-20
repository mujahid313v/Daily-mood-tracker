import { NextResponse } from "next/server";
import { registerUser, DuplicateEmailError } from "@/lib/controllers/auth";
import { signSessionToken, setSessionCookie } from "@/lib/session";
import { registerSchema } from "@/lib/validation";
import { getClientIp, readJson, tooManyRequests, validationError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

/** Max 5 registration attempts per minute per IP. */
const REGISTER_LIMIT = 5;
const REGISTER_WINDOW_MS = 60_000;

export async function POST(request: Request) {
  const limit = rateLimit(`register:${getClientIp(request)}`, REGISTER_LIMIT, REGISTER_WINDOW_MS);
  if (!limit.allowed) {
    return tooManyRequests(limit);
  }

  const body = await readJson(request);
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  try {
    const user = await registerUser(parsed.data.email, parsed.data.password, parsed.data.name);

    const token = await signSessionToken({ userId: user.id, email: user.email });

    const response = NextResponse.json({ user }, { status: 201 });
    setSessionCookie(response.headers, token);

    return response;
  } catch (error) {
    if (error instanceof DuplicateEmailError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to register user");
    return NextResponse.json({ error: "Unable to create account" }, { status: 500 });
  }
}
