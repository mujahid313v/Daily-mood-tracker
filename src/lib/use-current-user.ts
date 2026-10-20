"use client";

import { useCallback, useEffect, useState } from "react";
import { AUTH_EVENT_NAME, fetchCurrentUser, type AuthUser } from "./session-client";

/**
 * Resolves the signed-in user from the HttpOnly session cookie.
 *
 * There is no local copy of the session in the browser — the cookie is the only
 * source of truth and it is never readable from JavaScript.
 */
export function useCurrentUser() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const applyUser = useCallback((current: AuthUser | null) => {
    setUser((previous) =>
      previous?.id === current?.id && previous?.email === current?.email ? previous : current
    );
    setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    const current = await fetchCurrentUser();
    applyUser(current);
    return current;
  }, [applyUser]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const current = await fetchCurrentUser();
      if (cancelled) return;
      applyUser(current);
    };

    void load();

    const handleAuthChange = () => {
      void load();
    };

    window.addEventListener(AUTH_EVENT_NAME, handleAuthChange);

    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_EVENT_NAME, handleAuthChange);
    };
  }, [applyUser]);

  return { user, loading, refresh };
}
