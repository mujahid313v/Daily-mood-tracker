"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AUTH_EVENT_NAME, clearAuthUser, getAuthUser } from "@/lib/auth-storage";

type Props = {
  onSignOut?: () => void;
};

export function NavBar({ onSignOut }: Props) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const syncAuthState = () => setIsAuthenticated(!!getAuthUser());
    syncAuthState();

    const handler = () => syncAuthState();
    window.addEventListener(AUTH_EVENT_NAME, handler);
    return () => window.removeEventListener(AUTH_EVENT_NAME, handler);
  }, []);

  const handleSignOut = () => {
    clearAuthUser();
    setIsAuthenticated(false);
    onSignOut?.();
    router.push("/login");
  };

  return (
    <nav className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
      {isAuthenticated ? (
        <>
          <Link className="hover:text-white" href="/">
            Home
          </Link>
          <button
            onClick={handleSignOut}
            className="rounded-full border border-white/20 px-3 py-1 text-white transition hover:border-white"
          >
            Sign out
          </button>
        </>
      ) : (
        <>
          <Link className="hover:text-white" href="/login">
            Login
          </Link>
          <Link className="hover:text-white" href="/register">
            Register
          </Link>
        </>
      )}
    </nav>
  );
}
