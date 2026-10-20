/**
 * Client-side session helpers.
 *
 * The session itself lives in an HttpOnly cookie that JavaScript cannot touch.
 * The client only asks the server "who am I?" via `GET /api/me`; there is no
 * token, no user object and no credential of any kind kept in `localStorage`,
 * `sessionStorage` or IndexedDB.
 */

export type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
  createdAt?: string;
};

/** Dispatched on `window` whenever the session changes so every component stays in sync. */
export const AUTH_EVENT_NAME = "mood-auth-change";

export function emitAuthChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_EVENT_NAME));
}

/**
 * Deduplicates concurrent `/api/me` requests so that several components
 * mounting at the same time only trigger a single round trip.
 */
let inFlight: Promise<AuthUser | null> | null = null;

export function fetchCurrentUser(): Promise<AuthUser | null> {
  if (typeof window === "undefined") return Promise.resolve(null);

  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const response = await fetch("/api/me", {
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) return null;

      const data = (await response.json()) as { user?: AuthUser | null };
      return data.user ?? null;
    } catch {
      return null;
    } finally {
      // Release the shared promise on the next tick so concurrent callers share it.
      setTimeout(() => {
        inFlight = null;
      }, 0);
    }
  })();

  return inFlight;
}
