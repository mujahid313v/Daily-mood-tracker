"use client";

import { useEffect, useState } from "react";

type AdminSummary = {
  stats: { users: number; entries: number };
  users: Array<{
    id: string;
    email: string;
    name: string | null;
    createdAt: string;
    entriesCount: number;
    latestMood: string | null;
    latestNote: string | null;
    latestDate: string | null;
  }>;
};

const fetcher = async (path: string, token: string) => {
  const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to fetch admin data" }));
    throw new Error(error.error || "Failed to fetch admin data");
  }
  return res.json();
};

export default function AdminDashboard() {
  const [token, setToken] = useState("");
  const [input, setInput] = useState("");
  const [data, setData] = useState<AdminSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("mood-admin-token");
    if (stored) {
      setToken(prevToken => prevToken || stored);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        const payload = await fetcher("/api/admin/summary", token);
        setData(payload);
        setError(null);
      } catch (error: unknown) {
        if (error instanceof Error) {
          setError(error.message);
        } else {
          setError('An error occurred');
        }
        setData(null);
        localStorage.removeItem("mood-admin-token");
        setToken("");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setToken(input.trim());
    localStorage.setItem("mood-admin-token", input.trim());
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-10 backdrop-blur">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Admin</p>
        <h1 className="mt-3 text-4xl font-semibold text-white">Analytics overview</h1>
        <p className="mt-3 max-w-lg text-sm text-slate-400">
          Enter the dashboard access key (set in <code>.env</code> as <code>ADMIN_DASHBOARD_KEY</code>) to unlock usage stats for your mood app.
        </p>
      </div>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        {!token ? (
          <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            <label className="block text-slate-300">
              Access key
              <input
                required
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Paste the admin key"
                type="password"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/80 px-3 py-2 text-white outline-none transition focus:border-white/40"
              />
            </label>
            <button className="w-full rounded-2xl bg-white/90 px-4 py-3 font-semibold text-slate-900 transition hover:bg-white">
              Unlock dashboard
            </button>
          </form>
        ) : loading ? (
          <p className="text-sm text-slate-300">Loading...</p>
        ) : error ? (
          <div className="rounded-2xl border border-rose-400/40 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : data ? (
          <div className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Users</p>
                <p className="mt-3 text-4xl font-semibold text-white">{data.stats.users}</p>
                <p className="text-sm text-slate-400">Registered accounts</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Entries</p>
                <p className="mt-3 text-4xl font-semibold text-white">{data.stats.entries}</p>
                <p className="text-sm text-slate-400">Total moods logged</p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Users</p>
                  <h2 className="text-xl font-semibold text-white">Recent signups</h2>
                </div>
                <span className="text-xs text-slate-400">{data.users.length} users</span>
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-sm text-slate-300">
                  <thead className="text-xs uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="border-b border-white/5 py-2 pr-4">User</th>
                      <th className="border-b border-white/5 py-2 pr-4">Entries</th>
                      <th className="border-b border-white/5 py-2 pr-4">Latest mood</th>
                      <th className="border-b border-white/5 py-2 pr-4">Latest note</th>
                      <th className="border-b border-white/5 py-2">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.users.map((user) => (
                      <tr key={user.id} className="border-b border-white/5">
                        <td className="py-3 pr-4">
                          <p className="font-medium text-white">{user.name || "Unknown"}</p>
                          <p className="text-xs text-slate-400">{user.email}</p>
                        </td>
                        <td className="py-3 pr-4 text-white">{user.entriesCount}</td>
                        <td className="py-3 pr-4">
                          {user.latestMood ? (
                            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white">{user.latestMood}</span>
                          ) : (
                            <span className="text-xs text-slate-500">None</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-slate-300">
                          {user.latestNote || <span className="text-xs text-slate-500">—</span>}
                        </td>
                        <td className="py-3 text-xs text-slate-400">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
