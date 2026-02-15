"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getAuthUser, type AuthUser } from "@/lib/auth-storage";

const MOOD_OPTIONS = [
  {
    id: "ecstatic",
    label: "Ecstatic",
    description: "Everything feels amazing today",
    emoji: "🤩",
    ring: "ring-lime-300",
    bg: "bg-lime-100",
    text: "text-lime-900",
  },
  {
    id: "good",
    label: "Good",
    description: "Feeling upbeat and motivated",
    emoji: "🙂",
    ring: "ring-emerald-300",
    bg: "bg-emerald-100",
    text: "text-emerald-900",
  },
  {
    id: "neutral",
    label: "Neutral",
    description: "Balanced with no major swings",
    emoji: "😐",
    ring: "ring-slate-300",
    bg: "bg-slate-100",
    text: "text-slate-900",
  },
  {
    id: "low",
    label: "Low",
    description: "A bit tired or down",
    emoji: "😔",
    ring: "ring-orange-300",
    bg: "bg-orange-100",
    text: "text-orange-900",
  },
  {
    id: "stressed",
    label: "Stressed",
    description: "Need some breathing space",
    emoji: "😣",
    ring: "ring-rose-300",
    bg: "bg-rose-100",
    text: "text-rose-900",
  },
] as const;

type MoodId = (typeof MOOD_OPTIONS)[number]["id"];

type MoodEntry = {
  id: string;
  mood: MoodId;
  note: string;
  date: string; // ISO
  createdAt: string;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

const findMood = (id: MoodId) => MOOD_OPTIONS.find((option) => option.id === id)!;

export default function Home() {
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [mood, setMood] = useState<MoodId>("good");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayISO());
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = getAuthUser();
    if (!saved) {
      setTimeout(() => setLoading(false), 0);
      return;
    }
    setTimeout(() => setUser(saved), 0);

    const fetchEntries = async () => {
      const response = await fetch(`/api/entries?userId=${saved.id}`);
      if (!response.ok) {
        console.error("Failed to load entries");
        setTimeout(() => setLoading(false), 0);
        return;
      }
      const data = await response.json();
      const normalized: MoodEntry[] = data.entries.map((entry: { id: string; mood: MoodId; note?: string; date: string; createdAt: string }) => ({
        id: entry.id,
        mood: entry.mood,
        note: entry.note ?? "",
        date: entry.date.slice(0, 10),
        createdAt: entry.createdAt,
      }));
      setEntries(normalized);
      setTimeout(() => setLoading(false), 0);
    };

    fetchEntries();
  }, []);

  const submitEntry = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      setFeedback({ type: "error", text: "Please login to save entries." });
      return;
    }
    const duplicate = entries.some((entry) => entry.date === date);
    if (duplicate) {
      setFeedback({ type: "error", text: "You already logged a mood for this day. Try a different date." });
      setTimeout(() => setFeedback(null), 4000);
      return;
    }

    const response = await fetch("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, mood, note: note.trim(), date }),
    });

    const data = await response.json();
    if (!response.ok) {
      setFeedback({ type: "error", text: data.error || "Unable to save entry" });
      setTimeout(() => setFeedback(null), 4000);
      return;
    }

    const newEntry: MoodEntry = {
      id: data.entry.id,
      mood: data.entry.mood,
      note: data.entry.note ?? "",
      date: data.entry.date.slice(0, 10),
      createdAt: data.entry.createdAt,
    };

    setEntries((prev) => [newEntry, ...prev]);
    setNote("");
    setDate(todayISO());
    setMood("good");
    setFeedback({ type: "success", text: "Mood saved to PostgreSQL!" });
    setTimeout(() => setFeedback(null), 3000);
  };

  const entriesThisWeek = useMemo(() => {
    const now = new Date();
    return entries.filter((entry) => {
      const entryDate = new Date(entry.date);
      const diff = Number(now) - Number(entryDate);
      return diff <= 6 * 24 * 60 * 60 * 1000 && diff >= 0;
    }).length;
  }, [entries]);

  const lastMood = entries[0];

  if (!loading && !user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-950 via-slate-950 to-slate-950 text-slate-100">
        <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center gap-6 px-6 text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Mood tracker</p>
          <h1 className="text-4xl font-semibold text-white sm:text-5xl">Sign in to unlock your journal</h1>
          <p className="max-w-2xl text-base text-slate-300">
            The mood timeline is private to each account. Log in or create an account to view and add entries.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/login" className="rounded-full bg-white px-5 py-2 text-base font-semibold text-slate-900">
              Login
            </Link>
            <Link href="/register" className="rounded-full border border-white/30 px-5 py-2 text-base text-white">
              Create account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-950 via-slate-950 to-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-8">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-white/0 p-8 backdrop-blur">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-1 text-xs uppercase tracking-[0.35em] text-slate-300">
            ✨ Daily tracker
          </p>
          <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold text-white sm:text-5xl">Daily Mood Journal</h1>
              <p className="max-w-2xl text-base text-slate-200">
                Capture how you feel once a day, jot down a quick note, and watch your emotional pattern unfold. Entries are
                synced to PostgreSQL so you can switch devices with confidence.
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-slate-900/70 px-6 py-5 text-sm text-slate-300">
              <p className="text-xs uppercase tracking-widest text-slate-400">This week</p>
              <p className="mt-1 text-4xl font-semibold text-white">{entriesThisWeek}</p>
              <p className="text-xs text-slate-400">entries logged</p>
              {user && <p className="mt-4 text-xs text-emerald-300">Signed in as {user.email}</p>}
            </div>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Log today&apos;s mood</h2>
                <p className="text-sm text-slate-300">Pick the vibe, leave yourself a note, and save once a day.</p>
              </div>
            </div>

            <form onSubmit={submitEntry} className="mt-6 space-y-6">
              <div className="space-y-3">
                <span className="text-xs uppercase tracking-[0.35em] text-slate-400">Mood</span>
                <div className="grid gap-3 sm:grid-cols-2">
                  {MOOD_OPTIONS.map((option) => {
                    const isActive = option.id === mood;
                    return (
                      <label
                        key={option.id}
                        className={`flex cursor-pointer gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/30 ${
                          isActive ? "ring-2 ring-offset-2 ring-offset-slate-950 " + option.ring : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name="mood"
                          value={option.id}
                          className="sr-only"
                          checked={isActive}
                          onChange={() => setMood(option.id)}
                        />
                        <span className="text-3xl" aria-hidden>
                          {option.emoji}
                        </span>
                        <span>
                          <span className="flex items-center gap-2 text-base font-semibold text-white">
                            {option.label}
                            {isActive && (
                              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white">
                                Selected
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block text-sm text-slate-300">{option.description}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col text-sm text-slate-200">
                  Entry date
                  <input
                    type="date"
                    max={todayISO()}
                    value={date}
                    required
                    onChange={(event) => setDate(event.target.value)}
                    className="mt-2 rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-base text-white outline-none transition focus:border-white/40"
                  />
                </label>
                <label className="flex flex-col text-sm text-slate-200">
                  Quick headline (optional)
                  <input
                    type="text"
                    maxLength={80}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="e.g. Productive deep work session"
                    className="mt-2 rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-base text-white placeholder:text-slate-500 outline-none transition focus:border-white/40"
                  />
                </label>
              </div>

              <button
                type="submit"
                className="w-full rounded-2xl bg-gradient-to-r from-teal-200 via-white to-rose-200 px-4 py-3 text-base font-semibold text-slate-900 transition hover:opacity-90"
              >
                Save today&apos;s entry
              </button>
              {feedback && (
                <p
                  className={`text-center text-sm ${feedback.type === "success" ? "text-emerald-300" : "text-rose-300"}`}
                  role="status"
                >
                  {feedback.text}
                </p>
              )}
              <p className="text-center text-xs text-slate-400">
                Entries live in PostgreSQL for the account you&apos;re signed into.
              </p>
            </form>
          </section>

          <section className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <h3 className="text-base font-semibold text-white">Latest vibe</h3>
              {lastMood ? (
                <div className="mt-5 flex flex-col gap-4">
                  <div className={`flex items-center gap-4 rounded-2xl ${findMood(lastMood.mood).bg} ${findMood(lastMood.mood).text} px-4 py-3`}>
                    <span className="text-4xl" aria-hidden>
                      {findMood(lastMood.mood).emoji}
                    </span>
                    <div>
                      <p className="text-sm uppercase tracking-[0.3em]">{formatDate(lastMood.date)}</p>
                      <p className="text-2xl font-semibold">{findMood(lastMood.mood).label}</p>
                      {lastMood.note && <p className="text-sm">{lastMood.note}</p>}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-xs text-slate-300">
                    Keep showing up for yourself. Even a 10-second reflection builds a valuable trend line over time.
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-sm text-slate-300">
                  No entries yet. Log your first mood to start the timeline.
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <h3 className="text-base font-semibold text-white">Quick tips</h3>
              <ul className="mt-4 list-disc space-y-2 pl-4 text-sm text-slate-300">
                <li>Set a reminder at the same time every day.</li>
                <li>Pair your entry with 3 deep breaths.</li>
                <li>Review the timeline weekly to spot trends.</li>
              </ul>
            </div>
          </section>
        </div>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Timeline</p>
              <h2 className="text-2xl font-semibold text-white">Daily reflections</h2>
            </div>
            <p className="text-sm text-slate-400">Tap an entry to revisit your note.</p>
          </div>

          {entries.length === 0 ? (
            <p className="mt-6 text-sm text-slate-300">
              Your timeline is empty. Once you add moods, they will appear here in reverse chronological order.
            </p>
          ) : (
            <ol className="mt-8 space-y-6 border-l border-white/10 pl-6">
              {entries.map((entry) => {
                const moodDetails = findMood(entry.mood);
                return (
                  <li key={entry.id} className="relative transition hover:translate-x-1">
                    <span className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-950 text-lg ${moodDetails.bg}`}>
                      {moodDetails.emoji}
                    </span>
                    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm uppercase tracking-[0.3em] text-slate-400">{formatDate(entry.date)}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${moodDetails.bg} ${moodDetails.text}`}>
                          {moodDetails.label}
                        </span>
                      </div>
                      {entry.note ? (
                        <p className="mt-3 text-base text-slate-100">{entry.note}</p>
                      ) : (
                        <p className="mt-3 text-sm text-slate-400">No note saved for this day.</p>
                      )}
                      <p className="mt-2 text-xs text-slate-500">Logged at {new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
