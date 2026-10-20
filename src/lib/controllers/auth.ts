import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isUniqueConstraintError } from "@/lib/prisma-error";

/**
 * Authentication controller.
 *
 * Security notes:
 *  - passwords are hashed with bcrypt (cost 12) and the hash is never returned
 *  - unknown emails still perform a bcrypt comparison against a dummy hash so the
 *    response time does not reveal whether an account exists
 *  - the raw Prisma error is never surfaced to the caller
 */

const SALT_ROUNDS = 12;

/**
 * A real bcrypt hash of a throw-away value. Comparing against it when the
 * email is unknown keeps the timing of `authenticateUser` constant.
 */
const DUMMY_HASH = bcrypt.hashSync("mood-tracker-timing-equalizer", SALT_ROUNDS);

export class AuthError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "AuthError";
    this.status = status;
    this.code = code;
  }
}

export class DuplicateEmailError extends AuthError {
  constructor() {
    super("An account with this email already exists", 409, "EMAIL_TAKEN");
    this.name = "DuplicateEmailError";
  }
}

export class InvalidCredentialsError extends AuthError {
  constructor() {
    super("Invalid email or password", 401, "INVALID_CREDENTIALS");
    this.name = "InvalidCredentialsError";
  }
}

export type SafeUser = {
  id: string;
  email: string;
  name: string | null;
};

export async function registerUser(email: string, password: string, name?: string | null): Promise<SafeUser> {
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    throw new DuplicateEmailError();
  }

  const hashed = await bcrypt.hash(password, SALT_ROUNDS);

  try {
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashed,
        name: name?.trim() ? name.trim() : null,
      },
      select: { id: true, email: true, name: true },
    });

    return user;
  } catch (error) {
    // Two concurrent registrations for the same email: the unique index wins.
    if (isUniqueConstraintError(error)) {
      throw new DuplicateEmailError();
    }
    throw error;
  }
}

export async function authenticateUser(email: string, password: string): Promise<SafeUser> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true, name: true, password: true },
  });

  const passwordHash = user?.password ?? DUMMY_HASH;
  const isValidPassword = await bcrypt.compare(password, passwordHash);

  if (!user || !isValidPassword) {
    throw new InvalidCredentialsError();
  }

  return { id: user.id, email: user.email, name: user.name };
}
