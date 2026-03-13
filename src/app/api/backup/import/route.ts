import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, entries, mode } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

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
              tags: entry.tags && entry.tags.length > 0 ? JSON.stringify(entry.tags) : null,
            },
          });
          importedCount++;
        } else {
          await prisma.moodEntry.create({
            data: {
              userId,
              mood: entry.mood,
              note: entry.note || null,
              tags: entry.tags && entry.tags.length > 0 ? JSON.stringify(entry.tags) : null,
              date: new Date(entry.date),
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
