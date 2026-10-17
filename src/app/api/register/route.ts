import { NextResponse } from "next/server";
import { registerUser } from "@/lib/controllers/auth";
import { signToken, setSessionCookie } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const user = await registerUser(email, password, name);

    const token = await signToken({ userId: user.id, email: user.email });

    const response = NextResponse.json({ user }, { status: 201 });
    setSessionCookie(response.headers, token);

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("Failed to register user", error);

    let status = 500;
    if (message === "Email already registered") status = 409;

    return NextResponse.json({ error: message }, { status });
  }
}
