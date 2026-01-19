import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.replace("Bearer ", "").trim() : authHeader.trim();
  const secret = process.env.ADMIN_DASHBOARD_KEY;

  if (!secret || !token || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [usersCount, entriesCount, users] = await Promise.all([
    prisma.user.count(),
    prisma.moodEntry.count(),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        entries: {
          orderBy: { date: "desc" },
          take: 1,
          select: {
            mood: true,
            note: true,
            date: true,
            createdAt: true,
          },
        },
        _count: {
          select: { entries: true },
        },
      },
    }),
  ]);

  const userRows = users.map((user) => {
    const latestEntry = user.entries.at(0);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      entriesCount: user._count.entries,
      latestMood: latestEntry?.mood ?? null,
      latestNote: latestEntry?.note ?? null,
      latestDate: latestEntry?.date ?? null,
    };
  });

  return NextResponse.json({ stats: { users: usersCount, entries: entriesCount }, users: userRows });
}
