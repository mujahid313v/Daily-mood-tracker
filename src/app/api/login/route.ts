import { NextResponse } from "next/server";
import { authenticateUser } from "@/lib/controllers/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const user = await authenticateUser(email, password);

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Failed to login", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 400 }
    );
  }
}
