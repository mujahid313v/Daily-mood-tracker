import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const secret = process.env.ADMIN_DASHBOARD_KEY;

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.replace("Bearer ", "").trim() : authHeader.trim();

  if (!secret || !token || !constantTimeEqual(secret, token)) {
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
