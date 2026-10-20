import { z } from "zod";

/**
 * Centralised Zod schemas for every API route.
 *
 * Rules enforced here:
 *  - emails are trimmed + lower-cased so `A@B.com` and `a@b.com` are one account
 *  - passwords are at least 8 characters (enforced server-side, not just in the UI)
 *  - `mood` must be one of the five supported values
 *  - `date` must be a real calendar date in `YYYY-MM-DD` form
 *  - every collection has an upper bound so a request cannot be used as a DoS vector
 */

export const MOOD_VALUES = ["ecstatic", "good", "neutral", "low", "stressed"] as const;
export type MoodValue = (typeof MOOD_VALUES)[number];

export const moodSchema = z.enum(MOOD_VALUES, {
  message: `Mood must be one of: ${MOOD_VALUES.join(", ")}`,
});

export const emailSchema = z
  .string({ message: "Email is required" })
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address"));

export const passwordSchema = z
  .string({ message: "Password is required" })
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters");

export const displayNameSchema = z
  .string()
  .trim()
  .max(80, "Name must be at most 80 characters")
  .optional()
  .nullable();

export const noteSchema = z
  .string()
  .trim()
  .max(500, "Note must be at most 500 characters")
  .nullable()
  .optional();

export const medicationSchema = z
  .string()
  .trim()
  .max(100, "Medication must be at most 100 characters")
  .nullable()
  .optional();

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const dateSchema = z
  .string({ message: "Date is required" })
  .trim()
  .regex(DATE_PATTERN, "Date must use the YYYY-MM-DD format")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Date is not a valid calendar date");

export const tagSchema = z
  .string()
  .trim()
  .min(1, "Tag cannot be empty")
  .max(30, "Tag must be at most 30 characters");

export const tagsSchema = z.array(tagSchema).max(10, "At most 10 tags").nullable().optional();

export const activityIdSchema = z
  .string()
  .trim()
  .min(1, "Activity id cannot be empty")
  .max(50, "Activity id must be at most 50 characters");

export const activitiesSchema = z
  .array(activityIdSchema)
  .max(20, "At most 20 activities")
  .nullable()
  .optional();

export const sleepHoursSchema = z.number().min(0, "Sleep must be at least 0").max(24, "Sleep must be at most 24").nullable().optional();
export const exerciseMinutesSchema = z.number().int().min(0, "Exercise must be at least 0").max(480, "Exercise must be at most 480").nullable().optional();
export const waterIntakeSchema = z.number().int().min(0, "Water must be at least 0").max(20, "Water must be at most 20").nullable().optional();

export const entryIdSchema = z.string().trim().min(1, "id is required").max(64, "Invalid id");

/* -------------------------------------------------------------------------- */
/* Route payloads                                                             */
/* -------------------------------------------------------------------------- */

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: displayNameSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  // Login only checks the shape; the length rule is enforced at registration.
  password: z.string().min(1, "Password is required").max(128),
});

export const moodEntrySchema = z.object({
  mood: moodSchema,
  note: noteSchema,
  tags: tagsSchema,
  date: dateSchema,
  sleepHours: sleepHoursSchema,
  exerciseMinutes: exerciseMinutesSchema,
  waterIntake: waterIntakeSchema,
  medication: medicationSchema,
  completedActivities: activitiesSchema,
});

export const moodEntryUpdateSchema = moodEntrySchema.extend({
  id: entryIdSchema,
});

export const communityMoodSchema = z.object({
  mood: moodSchema,
});

export const adminKeySchema = z.object({
  key: z.string().min(1, "Admin key is required").max(256, "Invalid admin key"),
});

export const backupEntrySchema = z.object({
  mood: moodSchema,
  note: noteSchema,
  tags: tagsSchema,
  date: dateSchema,
  sleepHours: sleepHoursSchema,
  exerciseMinutes: exerciseMinutesSchema,
  waterIntake: waterIntakeSchema,
  medication: medicationSchema,
  completedActivities: activitiesSchema,
});

export const backupImportSchema = z.object({
  mode: z.enum(["merge", "replace"]).default("merge"),
  entries: z.array(backupEntrySchema).max(5000, "Backup contains too many entries"),
});

/* -------------------------------------------------------------------------- */
/* Error formatting                                                           */
/* -------------------------------------------------------------------------- */

export type FieldIssue = { field: string; message: string };

export function formatIssues(error: z.ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || "body",
    message: issue.message,
  }));
}
