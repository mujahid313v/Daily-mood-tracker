import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { backupImportSchema } from "@/lib/validation";
import { readJson, unauthorized, validationError } from "@/lib/http";
import { parseList } from "@/lib/parse";

/**
 * Imports a previously exported backup.
 *
 * The whole payload is validated *before* anything is written, and the write
 * runs inside a single transaction. In `replace` mode only the entries that are
 * not part of the backup are deleted, so a failed import can never wipe the
 * user's history.
 */
export async function POST(request: Request) {
  const session = await getSessionUser(request);
  if (!session) {
    return unauthorized();
  }

  const body = await readJson(request);
  const parsed = backupImportSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const userId = session.userId;
  const mode = parsed.data.mode;

  try {
    // De-duplicate by day — the last occurrence wins.
    const incoming = new Map<string, (typeof parsed.data.entries)[number]>();
    for (const entry of parsed.data.entries) {
      incoming.set(entry.date, entry);
    }

    const existing = await prisma.moodEntry.findMany({
      where: { userId },
      select: { id: true, date: true },
    });

    const existingByDay = new Map(
      existing.map((entry) => [entry.date.toISOString().slice(0, 10), entry.id])
    );

    const operations: Prisma.PrismaPromise<unknown>[] = [];

    if (mode === "replace") {
      const incomingDays = [...incoming.keys()];

      // Remove every entry that is not part of the backup.
      operations.push(
        prisma.moodEntry.deleteMany({
          where: {
            userId,
            ...(incomingDays.length > 0 ? { date: { notIn: incomingDays.map((day) => new Date(`${day}T00:00:00.000Z`)) } } : {}),
          },
        })
      );
    }

    let importedCount = 0;
    let skippedCount = 0;

    for (const [day, entry] of incoming) {
      const existingId = existingByDay.get(day);

      if (existingId && mode === "merge") {
        skippedCount += 1;
        continue;
      }

      const tags = parseList(entry.tags);
      const completedActivities = parseList(entry.completedActivities);

      const data = {
        mood: entry.mood,
        note: entry.note ?? null,
        tags: tags.length > 0 ? JSON.stringify(tags) : null,
        date: new Date(`${day}T00:00:00.000Z`),
        sleepHours: entry.sleepHours ?? null,
        exerciseMinutes: entry.exerciseMinutes ?? null,
        waterIntake: entry.waterIntake ?? null,
        medication: entry.medication ?? null,
        completedActivities:
          completedActivities.length > 0 ? JSON.stringify(completedActivities) : null,
      };

      if (existingId) {
        operations.push(prisma.moodEntry.update({ where: { id: existingId }, data }));
      } else {
        operations.push(prisma.moodEntry.create({ data: { ...data, userId } }));
      }

      importedCount += 1;
    }

    if (operations.length > 0) {
      await prisma.$transaction(operations);
    }

    return NextResponse.json({ success: true, importedCount, skippedCount });
  } catch {
    console.error("Failed to import backup");
    return NextResponse.json({ error: "Failed to import backup" }, { status: 500 });
  }
}
