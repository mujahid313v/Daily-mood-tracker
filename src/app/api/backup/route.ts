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

export async function GET(request: Request) {
  const session = await getSessionUser(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.userId;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const entries = await prisma.moodEntry.findMany({
      where: { userId },
      orderBy: { date: "desc" },
    });

    const settings = {
      theme: "dark",
      reminderEnabled: false,
      reminderTime: "20:00",
      reminderDays: ["mon", "tue", "wed", "thu", "fri"],
      customTags: [],
    };

    const backup = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      settings,
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
  } catch (error) {
    console.error("Failed to create backup", error);
    return NextResponse.json(
      { error: "Failed to create backup" },
      { status: 500 }
    );
  }
}
