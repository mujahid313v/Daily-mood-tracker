import { NextResponse } from "next/server";
import { registerUser } from "@/lib/controllers/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const user = await registerUser(email, password, name);

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error("Failed to register user", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 400 }
    );
  }
}
