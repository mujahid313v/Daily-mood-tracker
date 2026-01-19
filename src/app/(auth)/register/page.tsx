"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAuthUser, saveAuthUser } from "@/lib/auth-storage";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const existing = getAuthUser();
    if (existing) {
      router.replace("/");
    }
  }, [router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to register");
      }

      saveAuthUser(data.user);
      setMessage("Account created! Redirecting to your journal…");
      router.push("/");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-white">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur">
        <div className="mb-8 text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Daily Mood</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Create account</h1>
          <p className="mt-2 text-sm text-slate-400">Sync your entries securely via PostgreSQL.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block text-sm text-slate-200">
            Full name (optional)
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/70 px-3 py-2 text-white outline-none transition focus:border-white/40"
              placeholder="Jamie Lee"
            />
          </label>

          <label className="block text-sm text-slate-200">
            Email address
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/70 px-3 py-2 text-white outline-none transition focus:border-white/40"
              placeholder="you@example.com"
            />
          </label>

          <label className="block text-sm text-slate-200">
            Password
            <input
              required
              minLength={6}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/70 px-3 py-2 text-white outline-none transition focus:border-white/40"
              placeholder="At least 6 characters"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-white/90 px-4 py-3 text-base font-semibold text-slate-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Creating account…" : "Sign up"}
          </button>
        </form>

        {message && (
          <p className="mt-4 text-center text-sm text-rose-200" role="status">
            {message}
          </p>
        )}

        <p className="mt-6 text-center text-sm text-slate-400">
          Already have an account?{" "}
          <Link href="/login" className="text-white underline-offset-4 hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
