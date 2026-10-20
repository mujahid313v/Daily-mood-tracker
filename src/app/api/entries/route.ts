import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { moodEntrySchema, moodEntryUpdateSchema } from "@/lib/validation";
import { forbidden, notFound, readJson, unauthorized, validationError } from "@/lib/http";
import { isUniqueConstraintError } from "@/lib/prisma-error";
import { serializeEntry, toStoredDate } from "@/lib/entries";

/**
 * Mood entry CRUD.
 *
 * IDOR protection: the owning user id is ALWAYS taken from the verified session
 * cookie. It is never read from the query string or the request body, so a
 * client cannot read, create, update or delete another user's entries by
 * tampering with the payload. The database keeps a unique constraint on
 * `(userId, date)` which enforces exactly one entry per user per day.
 */

async function requireUserId(request: Request): Promise<string | null> {
  const session = await getSessionUser(request);
  return session?.userId ?? null;
}

export async function GET(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) {
    return unauthorized();
  }

  const entries = await prisma.moodEntry.findMany({
    where: { userId },
    orderBy: { date: "desc" },
  });

  return NextResponse.json({ entries: entries.map(serializeEntry) });
}

export async function POST(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) {
    return unauthorized();
  }

  const body = await readJson(request);
  const parsed = moodEntrySchema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const { mood, note, tags, date, sleepHours, exerciseMinutes, waterIntake, medication, completedActivities } = parsed.data;

  try {
    const entry = await prisma.moodEntry.create({
      data: {
        // The owner comes from the session, never from the payload.
        userId,
        mood,
        note: note ?? null,
        tags: tags && tags.length > 0 ? JSON.stringify(tags) : null,
        date: toStoredDate(date),
        sleepHours: sleepHours ?? null,
        exerciseMinutes: exerciseMinutes ?? null,
        waterIntake: waterIntake ?? null,
        medication: medication ?? null,
        completedActivities:
          completedActivities && completedActivities.length > 0
            ? JSON.stringify(completedActivities)
            : null,
      },
    });

    return NextResponse.json({ entry: serializeEntry(entry) }, { status: 201 });
  } catch (error) {
    // The unique index on (userId, date) rejected a second entry for the same day.
    if (isUniqueConstraintError(error)) {
      return NextResponse.json(
        { error: "You already logged a mood for this day" },
        { status: 409 }
      );
    }

    console.error("Failed to create entry");
    return NextResponse.json({ error: "Unable to save entry" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) {
    return unauthorized();
  }

  const body = await readJson(request);
  const parsed = moodEntryUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const { id, mood, note, tags, date, sleepHours, exerciseMinutes, waterIntake, medication, completedActivities } = parsed.data;

  const existing = await prisma.moodEntry.findUnique({ where: { id } });
  if (!existing) {
    return notFound("Entry not found");
  }

  // Ownership check — the entry must belong to the session user.
  if (existing.userId !== userId) {
    return forbidden();
  }

  try {
    const entry = await prisma.moodEntry.update({
      where: { id },
      data: {
        mood,
        note: note ?? null,
        tags: tags && tags.length > 0 ? JSON.stringify(tags) : null,
        date: toStoredDate(date),
        sleepHours: sleepHours ?? null,
        exerciseMinutes: exerciseMinutes ?? null,
        waterIntake: waterIntake ?? null,
        medication: medication ?? null,
        completedActivities:
          completedActivities && completedActivities.length > 0
            ? JSON.stringify(completedActivities)
            : null,
      },
    });

    return NextResponse.json({ entry: serializeEntry(entry) });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json(
        { error: "You already logged a mood for that day" },
        { status: 409 }
      );
    }

    console.error("Failed to update entry");
    return NextResponse.json({ error: "Unable to update entry" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const userId = await requireUserId(request);
  if (!userId) {
    return unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const existing = await prisma.moodEntry.findUnique({ where: { id } });
  if (!existing) {
    return notFound("Entry not found");
  }

  // Ownership check — the entry must belong to the session user.
  if (existing.userId !== userId) {
    return forbidden();
  }

  await prisma.moodEntry.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
