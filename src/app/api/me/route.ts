import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/http";

/**
 * Returns the currently authenticated user.
 *
 * The user id is read from the verified session cookie — never from a query
 * parameter or request body — so this endpoint cannot be used to look up an
 * arbitrary account.
 */
export async function GET(request: Request) {
  const session = await getSessionUser(request);
  if (!session) {
    return unauthorized();
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, createdAt: true },
  });

  if (!user) {
    return unauthorized("Session is no longer valid");
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
    },
  });
}
