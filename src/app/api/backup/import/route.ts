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
      // fall through
    }
    return value.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export async function POST(request: Request) {
  const session = await getSessionUser(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { entries, mode } = body;
    const userId = session.userId;

    if (mode === "replace") {
      await prisma.moodEntry.deleteMany({
        where: { userId },
      });
    }

    let importedCount = 0;
    let skippedCount = 0;

    for (const entry of entries || []) {
      if (!entry.mood || !entry.date) {
        skippedCount++;
        continue;
      }

      try {
        const existingEntry = await prisma.moodEntry.findUnique({
          where: {
            userId_date: {
              userId,
              date: new Date(entry.date),
            },
          },
        });

        const tagsArray = parseList(entry.tags);
        const completedActivitiesArray = parseList(entry.completedActivities);

        if (existingEntry && mode === "merge") {
          skippedCount++;
          continue;
        }

        if (existingEntry && mode === "replace") {
          await prisma.moodEntry.update({
            where: { id: existingEntry.id },
            data: {
              mood: entry.mood,
              note: entry.note || null,
              tags: tagsArray.length > 0 ? JSON.stringify(tagsArray) : null,
            },
          });
          importedCount++;
        } else {
          await prisma.moodEntry.create({
            data: {
              userId,
              mood: entry.mood,
              note: entry.note || null,
              tags: tagsArray.length > 0 ? JSON.stringify(tagsArray) : null,
              date: new Date(entry.date),
              sleepHours: entry.sleepHours ?? null,
              exerciseMinutes: entry.exerciseMinutes ?? null,
              waterIntake: entry.waterIntake ?? null,
              medication: entry.medication ?? null,
              completedActivities:
                completedActivitiesArray.length > 0
                  ? JSON.stringify(completedActivitiesArray)
                  : null,
            },
          });
          importedCount++;
        }
      } catch (error) {
        console.error("Failed to import entry", entry, error);
        skippedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      importedCount,
      skippedCount,
    });
  } catch (error) {
    console.error("Failed to import backup", error);
    return NextResponse.json(
      { error: "Failed to import backup" },
      { status: 500 }
    );
  }
}
