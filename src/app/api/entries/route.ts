import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const entries = await prisma.moodEntry.findMany({
    where: { userId },
    orderBy: { date: "desc" },
  });

  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, mood, note, date } = body;

    if (!userId || !mood || !date) {
      return NextResponse.json({ error: "userId, mood and date are required" }, { status: 400 });
    }

    const entry = await prisma.moodEntry.create({
      data: {
        userId,
        mood,
        note,
        date: new Date(date),
      },
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error("Failed to create entry", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 400 }
    );
  }
}
