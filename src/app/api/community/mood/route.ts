import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { communityMoodSchema } from "@/lib/validation";
import { getClientIp, readJson, tooManyRequests, validationError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Anonymous community mood board.
 *
 * Deliberately public and anonymous — no account is required and nothing about
 * the submitter is stored. The write endpoint is rate limited so it cannot be
 * used to flood the table.
 */

const MOOD_VALUES = ["ecstatic", "good", "neutral", "low", "stressed"] as const;

/** Max 20 anonymous submissions per minute per IP. */
const SUBMIT_LIMIT = 20;
const SUBMIT_WINDOW_MS = 60_000;

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [todayMoods, weekMoods] = await Promise.all([
      prisma.communityMood.findMany({ where: { date: { gte: today } } }),
      prisma.communityMood.findMany({ where: { date: { gte: weekAgo } } }),
    ]);

    const emptyDistribution = (): Record<string, number> =>
      Object.fromEntries(MOOD_VALUES.map((mood) => [mood, 0]));

    const todayDistribution = emptyDistribution();
    const weekDistribution = emptyDistribution();

    for (const entry of todayMoods) {
      if (todayDistribution[entry.mood] !== undefined) {
        todayDistribution[entry.mood] += 1;
      }
    }

    for (const entry of weekMoods) {
      if (weekDistribution[entry.mood] !== undefined) {
        weekDistribution[entry.mood] += 1;
      }
    }

    const getPercentages = (distribution: Record<string, number>, total: number) => {
      if (total === 0) return [];

      return Object.entries(distribution).map(([mood, count]) => ({
        mood,
        count,
        percentage: Math.round((count / total) * 100),
      }));
    };

    const getDominantMood = (distribution: Record<string, number>) => {
      let max = 0;
      let dominant: string | null = null;

      for (const [mood, count] of Object.entries(distribution)) {
        if (count > max) {
          max = count;
          dominant = mood;
        }
      }

      return dominant;
    };

    return NextResponse.json({
      today: {
        total: todayMoods.length,
        distribution: getPercentages(todayDistribution, todayMoods.length),
        dominantMood: getDominantMood(todayDistribution),
      },
      week: {
        total: weekMoods.length,
        distribution: getPercentages(weekDistribution, weekMoods.length),
        dominantMood: getDominantMood(weekDistribution),
      },
    });
  } catch {
    console.error("Failed to get community moods");
    return NextResponse.json({ error: "Failed to get community moods" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const limit = rateLimit(
    `community:${getClientIp(request)}`,
    SUBMIT_LIMIT,
    SUBMIT_WINDOW_MS
  );
  if (!limit.allowed) {
    return tooManyRequests(limit);
  }

  const body = await readJson(request);
  const parsed = communityMoodSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  try {
    const communityMood = await prisma.communityMood.create({
      data: { mood: parsed.data.mood, date: new Date() },
      select: { id: true },
    });

    return NextResponse.json({ success: true, id: communityMood.id }, { status: 201 });
  } catch {
    console.error("Failed to submit community mood");
    return NextResponse.json({ error: "Failed to submit community mood" }, { status: 500 });
  }
}
