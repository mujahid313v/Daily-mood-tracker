import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

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
        tags: entry.tags ? JSON.parse(entry.tags) : [],
        date: entry.date.toISOString().slice(0, 10),
        createdAt: entry.createdAt.toISOString(),
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
