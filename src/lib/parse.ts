/**
 * Parses a value that may be a JSON array (as stored in the database), a plain
 * comma separated string, or an actual array.
 *
 * The mood tracker stores list-like columns (`tags`, `completedActivities`) as
 * JSON strings for backwards compatibility with the original schema.
 */
export function parseList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item)).filter(Boolean);
      }
    } catch {
      // Not JSON — fall through to the comma separated format.
    }

    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}
