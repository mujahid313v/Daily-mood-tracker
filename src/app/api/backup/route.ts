import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { notFound, unauthorized } from "@/lib/http";
import { parseList } from "@/lib/parse";

/** Exports every entry owned by the session user as a portable JSON document. */
export async function GET(request: Request) {
  const session = await getSessionUser(request);
  if (!session) {
    return unauthorized();
  }

  const userId = session.userId;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    if (!user) {
      return notFound("User not found");
    }

    const entries = await prisma.moodEntry.findMany({
      where: { userId },
      orderBy: { date: "desc" },
    });

    const backup = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      entries: entries.map((entry) => ({
        id: entry.id,
        mood: entry.mood,
        note: entry.note,
        tags: parseList(entry.tags),
        date: entry.date.toISOString().slice(0, 10),
        createdAt: entry.createdAt.toISOString(),
        sleepHours: entry.sleepHours,
        exerciseMinutes: entry.exerciseMinutes,
        waterIntake: entry.waterIntake,
        medication: entry.medication,
        completedActivities: parseList(entry.completedActivities),
      })),
    };

    return NextResponse.json({ backup });
  } catch {
    console.error("Failed to create backup");
    return NextResponse.json({ error: "Failed to create backup" }, { status: 500 });
  }
}
