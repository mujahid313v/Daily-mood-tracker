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

  const normalized = entries.map((entry) => ({
    ...entry,
    tags: entry.tags ? JSON.parse(entry.tags) : [],
  }));

  return NextResponse.json({ entries: normalized });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, mood, note, tags, date } = body;

    if (!userId || !mood || !date) {
      return NextResponse.json({ error: "userId, mood and date are required" }, { status: 400 });
    }

    const entry = await prisma.moodEntry.create({
      data: {
        userId,
        mood,
        note,
        tags: tags && tags.length > 0 ? JSON.stringify(tags) : null,
        date: new Date(date),
      },
    });

    return NextResponse.json({ entry: { ...entry, tags: tags || [] } }, { status: 201 });
  } catch (error) {
    console.error("Failed to create entry", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 400 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, mood, note, tags, date } = body;

    if (!id || !mood || !date) {
      return NextResponse.json({ error: "id, mood and date are required" }, { status: 400 });
    }

    const entry = await prisma.moodEntry.update({
      where: { id },
      data: {
        mood,
        note,
        tags: tags && tags.length > 0 ? JSON.stringify(tags) : null,
        date: new Date(date),
      },
    });

    return NextResponse.json({ entry: { ...entry, tags: tags || [] } });
  } catch (error) {
    console.error("Failed to update entry", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 400 }
    );
  }
}
