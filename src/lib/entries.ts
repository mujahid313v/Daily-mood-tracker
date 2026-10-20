import type { MoodEntry } from "@prisma/client";
import { parseList } from "./parse";

export type SerializedEntry = {
  id: string;
  mood: string;
  note: string | null;
  tags: string[];
  date: string;
  createdAt: string;
  sleepHours: number | null;
  exerciseMinutes: number | null;
  waterIntake: number | null;
  medication: string | null;
  completedActivities: string[];
};

/**
 * Converts a database row into the shape the client expects.
 *
 * The owning `userId` is intentionally *not* included: the client never needs
 * it and omitting it makes it impossible to accidentally leak another user's
 * identifier from a response.
 */
export function serializeEntry(entry: MoodEntry): SerializedEntry {
  return {
    id: entry.id,
    mood: entry.mood,
    note: entry.note ?? null,
    tags: parseList(entry.tags),
    date: entry.date.toISOString().slice(0, 10),
    createdAt: entry.createdAt.toISOString(),
    sleepHours: entry.sleepHours ?? null,
    exerciseMinutes: entry.exerciseMinutes ?? null,
    waterIntake: entry.waterIntake ?? null,
    medication: entry.medication ?? null,
    completedActivities: parseList(entry.completedActivities),
  };
}

/** Converts a validated `YYYY-MM-DD` day into the UTC-midnight Date used for storage. */
export function toStoredDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}
