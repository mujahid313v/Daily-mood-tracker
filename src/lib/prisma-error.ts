/**
 * Small helpers for working with Prisma errors without importing the runtime
 * error classes (keeps the API responses free of driver internals).
 */

const PRISMA_ERROR_CODES = {
  UNIQUE_CONSTRAINT: "P2002",
  RECORD_NOT_FOUND: "P2025",
  FOREIGN_KEY_CONSTRAINT: "P2003",
} as const;

export function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === code
  );
}

export function isUniqueConstraintError(error: unknown): boolean {
  return isPrismaError(error, PRISMA_ERROR_CODES.UNIQUE_CONSTRAINT);
}

export function isRecordNotFoundError(error: unknown): boolean {
  return isPrismaError(error, PRISMA_ERROR_CODES.RECORD_NOT_FOUND);
}
