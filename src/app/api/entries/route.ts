import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

function parseList(value: unknown): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fall through to comma split
    }
    return value.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

async function requireAuth(request: Request): Promise<{ userId: string } | null> {
  const session = await getSessionUser(request);
  if (!session) return null;
  return { userId: session.userId };
}

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entries = await prisma.moodEntry.findMany({
    where: { userId: auth.userId },
    orderBy: { date: "desc" },
  });

  const normalized = entries.map((entry) => ({
    ...entry,
    tags: parseList(entry.tags),
    completedActivities: parseList(entry.completedActivities),
  }));

  return NextResponse.json({ entries: normalized });
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { mood, note, tags, date, sleepHours, exerciseMinutes, waterIntake, medication, completedActivities } = body;

    if (!mood || !date) {
      return NextResponse.json({ error: "mood and date are required" }, { status: 400 });
    }

    const tagsArray = parseList(tags);
    const activitiesArray = parseList(completedActivities);

    const entry = await prisma.moodEntry.create({
      data: {
        userId: auth.userId,
        mood,
        note: note ?? null,
        tags: tagsArray.length > 0 ? JSON.stringify(tagsArray) : null,
        date: new Date(date),
        sleepHours: sleepHours ?? null,
        exerciseMinutes: exerciseMinutes ?? null,
        waterIntake: waterIntake ?? null,
        medication: medication ?? null,
        completedActivities: activitiesArray.length > 0 ? JSON.stringify(activitiesArray) : null,
      },
    });

    return NextResponse.json(
      {
        entry: {
          ...entry,
          tags: tagsArray,
          completedActivities: activitiesArray,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create entry", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 400 }
    );
  }
}

export async function PUT(request: Request) {
  const auth = await requireAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, mood, note, tags, date, sleepHours, exerciseMinutes, waterIntake, medication, completedActivities } = body;

    if (!id || !mood || !date) {
      return NextResponse.json({ error: "id, mood and date are required" }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.moodEntry.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }
    if (existing.userId !== auth.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const tagsArray = parseList(tags);
    const activitiesArray = parseList(completedActivities);

    const entry = await prisma.moodEntry.update({
      where: { id },
      data: {
        mood,
        note: note ?? null,
        tags: tagsArray.length > 0 ? JSON.stringify(tagsArray) : null,
        date: new Date(date),
        sleepHours: sleepHours ?? null,
        exerciseMinutes: exerciseMinutes ?? null,
        waterIntake: waterIntake ?? null,
        medication: medication ?? null,
        completedActivities: activitiesArray.length > 0 ? JSON.stringify(activitiesArray) : null,
      },
    });

    return NextResponse.json({
      entry: { ...entry, tags: tagsArray, completedActivities: activitiesArray },
    });
  } catch (error) {
    console.error("Failed to update entry", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.moodEntry.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }
    if (existing.userId !== auth.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.moodEntry.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete entry", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 400 }
    );
  }
}
