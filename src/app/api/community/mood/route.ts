import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MOOD_VALUES = ["ecstatic", "good", "neutral", "low", "stressed"];

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const todayMoods = await prisma.communityMood.findMany({
      where: {
        date: {
          gte: today,
        },
      },
    });

    const weekMoods = await prisma.communityMood.findMany({
      where: {
        date: {
          gte: weekAgo,
        },
      },
    });

    const todayDistribution: Record<string, number> = { ecstatic: 0, good: 0, neutral: 0, low: 0, stressed: 0 };
    const weekDistribution: Record<string, number> = { ecstatic: 0, good: 0, neutral: 0, low: 0, stressed: 0 };

    todayMoods.forEach((m) => {
      if (todayDistribution[m.mood] !== undefined) {
        todayDistribution[m.mood]++;
      }
    });

    weekMoods.forEach((m) => {
      if (weekDistribution[m.mood] !== undefined) {
        weekDistribution[m.mood]++;
      }
    });

    const todayTotal = todayMoods.length;
    const weekTotal = weekMoods.length;

    const getPercentages = (dist: Record<string, number>, total: number) => {
      if (total === 0) return {};
      return Object.entries(dist).map(([mood, count]) => ({
        mood,
        count,
        percentage: Math.round((count / total) * 100),
      }));
    };

    const getDominantMood = (dist: Record<string, number>) => {
      let max = 0;
      let dominant = "neutral";
      Object.entries(dist).forEach(([mood, count]) => {
        if (count > max) {
          max = count;
          dominant = mood;
        }
      });
      return dominant;
    };

    return NextResponse.json({
      today: {
        total: todayTotal,
        distribution: getPercentages(todayDistribution, todayTotal),
        dominantMood: todayTotal > 0 ? getDominantMood(todayDistribution) : null,
      },
      week: {
        total: weekTotal,
        distribution: getPercentages(weekDistribution, weekTotal),
        dominantMood: weekTotal > 0 ? getDominantMood(weekDistribution) : null,
      },
    });
  } catch (error) {
    console.error("Failed to get community moods", error);
    return NextResponse.json(
      { error: "Failed to get community moods" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mood } = body;

    if (!mood || !MOOD_VALUES.includes(mood)) {
      return NextResponse.json(
        { error: "Valid mood is required (ecstatic, good, neutral, low, stressed)" },
        { status: 400 }
      );
    }

    const communityMood = await prisma.communityMood.create({
      data: {
        mood,
        date: new Date(),
      },
    });

    return NextResponse.json({ success: true, id: communityMood.id }, { status: 201 });
  } catch (error) {
    console.error("Failed to submit community mood", error);
    return NextResponse.json(
      { error: "Failed to submit community mood" },
      { status: 500 }
    );
  }
}
