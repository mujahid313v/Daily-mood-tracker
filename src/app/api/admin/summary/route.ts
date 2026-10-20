import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest } from "@/lib/admin-session";
import { getClientIp, tooManyRequests, unauthorized } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Admin analytics.
 *
 * Protected on the server side by either the HttpOnly admin session cookie or
 * an `Authorization: Bearer <ADMIN_DASHBOARD_KEY>` header (handy for scripts).
 * The key comparison itself is constant-time (`crypto.timingSafeEqual`).
 */

/** Max 5 summary requests per minute per IP. */
const ADMIN_SUMMARY_LIMIT = 5;
const ADMIN_SUMMARY_WINDOW_MS = 60_000;

export async function GET(request: Request) {
  const limit = rateLimit(
    `admin:summary:${getClientIp(request)}`,
    ADMIN_SUMMARY_LIMIT,
    ADMIN_SUMMARY_WINDOW_MS
  );
  if (!limit.allowed) {
    return tooManyRequests(limit);
  }

  if (!(await isAdminRequest(request))) {
    return unauthorized();
  }

  const [usersCount, entriesCount, users] = await Promise.all([
    prisma.user.count(),
    prisma.moodEntry.count(),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
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
