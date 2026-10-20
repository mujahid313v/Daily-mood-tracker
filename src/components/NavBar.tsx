"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { emitAuthChange } from "@/lib/session-client";
import { useCurrentUser } from "@/lib/use-current-user";

export function NavBar() {
  const { user, loading } = useCurrentUser();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      // Ignore logout errors — the local UI state is cleared regardless.
    }

    emitAuthChange();
    router.push("/login");
    router.refresh();
  };

  if (loading) {
    return <nav className="flex flex-wrap items-center gap-3 text-sm text-slate-400" />;
  }

  return (
    <nav className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
      {user ? (
        <>
          <Link className="hover:text-white" href="/">
            Home
          </Link>
          <Link className="hover:text-white" href="/admin">
            Admin
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
