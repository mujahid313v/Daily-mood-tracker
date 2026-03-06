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

const exportToCSV = (entries: MoodEntry[]) => {
  if (entries.length === 0) return;

  const headers = ["Date", "Mood", "Note", "Created At"];
  const rows = entries.map((entry) => [
    entry.date,
    findMood(entry.mood).label,
    entry.note ? `"${entry.note.replace(/"/g, '""')}"` : "",
    entry.createdAt,
  ]);

  const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const today = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `mood-entries-${today}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

type DateFilter = "all" | "7days" | "30days" | "thisMonth" | "lastMonth" | "custom";

const FILTER_STORAGE_KEY = "mood-date-filter";

const getDateRangeForFilter = (filter: DateFilter, customStart?: string, customEnd?: string) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (filter) {
    case "7days": {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return { start: start.toISOString().slice(0, 10), end: todayISO() };
    }
    case "30days": {
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      return { start: start.toISOString().slice(0, 10), end: todayISO() };
    }
    case "thisMonth": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: start.toISOString().slice(0, 10), end: todayISO() };
    }
    case "lastMonth": {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
    }
    case "custom":
      return { start: customStart || "", end: customEnd || "" };
    default:
      return { start: "", end: "" };
  }
};

const loadFilterFromStorage = (): { filter: DateFilter; customStart: string; customEnd: string } => {
  if (typeof window === "undefined") return { filter: "all", customStart: "", customEnd: "" };
  try {
    const saved = localStorage.getItem(FILTER_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        filter: parsed.filter || "all",
        customStart: parsed.customStart || "",
        customEnd: parsed.customEnd || ""
      };
    }
  } catch {}
  return { filter: "all", customStart: "", customEnd: "" };
};

const saveFilterToStorage = (filter: DateFilter, customStart: string, customEnd: string) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({ filter, customStart, customEnd }));
};

export default function Home() {
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [mood, setMood] = useState<MoodId>("good");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayISO());
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  
  const storedFilter = typeof window !== "undefined" ? loadFilterFromStorage() : { filter: "all" as DateFilter, customStart: "", customEnd: "" };
  const [dateFilter, setDateFilter] = useState<DateFilter>(storedFilter.filter);
  const [customDateStart, setCustomDateStart] = useState(storedFilter.customStart);
  const [customDateEnd, setCustomDateEnd] = useState(storedFilter.customEnd);
  const [showCustomPicker, setShowCustomPicker] = useState(storedFilter.filter === "custom");

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

  useEffect(() => {
    saveFilterToStorage(dateFilter, customDateStart, customDateEnd);
  }, [dateFilter, customDateStart, customDateEnd]);

  const handleFilterChange = (filter: DateFilter) => {
    setDateFilter(filter);
    if (filter === "custom") {
      setShowCustomPicker(true);
    } else {
      setShowCustomPicker(false);
    }
  };

  const filteredEntries = useMemo(() => {
    if (dateFilter === "all") return entries;
    const { start, end } = getDateRangeForFilter(dateFilter, customDateStart, customDateEnd);
    if (!start || !end) return entries;
    return entries.filter((entry) => entry.date >= start && entry.date <= end);
  }, [entries, dateFilter, customDateStart, customDateEnd]);

  const filterCountText = useMemo(() => {
    if (dateFilter === "all") return "";
    return `Showing ${filteredEntries.length} of ${entries.length} entries`;
  }, [dateFilter, filteredEntries.length, entries.length]);

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

  const streak = useMemo(() => {
    if (entries.length === 0) return 0;
    const sortedDates = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let count = 0;
    let currentDate = new Date(today);
    for (let i = 0; i < sortedDates.length; i++) {
      const entryDate = new Date(sortedDates[i].date);
      entryDate.setHours(0, 0, 0, 0);
      const diff = Math.floor((currentDate.getTime() - entryDate.getTime()) / (24 * 60 * 60 * 1000));
      if (diff === 0 || (i === 0 && diff === 1)) {
        count++;
        currentDate = entryDate;
      } else {
        break;
      }
    }
    return count;
  }, [entries]);

  const moodScore: Record<MoodId, number> = {
    ecstatic: 5,
    good: 4,
    neutral: 3,
    low: 2,
    stressed: 1,
  };

  const averageScore = useMemo(() => {
    if (entries.length === 0) return 0;
    const sum = entries.reduce((acc, entry) => acc + moodScore[entry.mood], 0);
    return sum / entries.length;
  }, [entries]);

  const averageLabel = useMemo(() => {
    if (averageScore >= 4) return "Great!";
    if (averageScore >= 3) return "Good";
    if (averageScore >= 2) return "Fair";
    return "Low";
  }, [averageScore]);

  const weeklyTrend = useMemo(() => {
    const days: { date: Date; mood: MoodId | null }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const entry = entries.find((e) => {
        const entryDate = new Date(e.date);
        entryDate.setHours(0, 0, 0, 0);
        return entryDate.getTime() === d.getTime();
      });
      days.push({ date: d, mood: entry?.mood ?? null });
    }
    return days;
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

            {entries.length > 0 && (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                <h3 className="text-base font-semibold text-white">Analytics</h3>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-400">
                      <span>🔥</span> Streak
                    </div>
                    <p className="mt-2 text-3xl font-semibold text-white">{streak}</p>
                    <p className="text-xs text-slate-400">consecutive days</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-400">
                      <span>⭐</span> Average
                    </div>
                    <p className="mt-2 text-3xl font-semibold text-white">{dateFilter === "all" ? averageScore.toFixed(1) : filteredEntries.length > 0 ? (filteredEntries.reduce((acc, entry) => acc + moodScore[entry.mood], 0) / filteredEntries.length).toFixed(1) : "0.0"} / 5.0</p>
                    <p className="text-xs text-emerald-300">{averageLabel}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <p className="text-xs uppercase tracking-widest text-slate-400">Weekly Trend</p>
                  <div className="mt-3 flex items-end justify-between gap-1">
                    {weeklyTrend.map((day, idx) => (
                      <div key={idx} className="flex flex-1 flex-col items-center gap-1">
                        <div
                          className={`w-full rounded-t-lg ${
                            day.mood ? findMood(day.mood).bg : "bg-slate-700"
                          }`}
                          style={{ height: day.mood ? "32px" : "8px" }}
                        />
                        <span className="text-[10px] text-slate-400">
                          {day.date.toLocaleDateString(undefined, { weekday: "short" }).charAt(0)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <p className="text-xs uppercase tracking-widest text-slate-400">Mood Distribution</p>
                  <div className="mt-3 space-y-2">
                    {(() => {
                      const dist: Record<MoodId, number> = { ecstatic: 0, good: 0, neutral: 0, low: 0, stressed: 0 };
                      const targetEntries = dateFilter === "all" ? entries : filteredEntries;
                      targetEntries.forEach((entry) => dist[entry.mood]++);
                      return MOOD_OPTIONS.map((option) => ({
                        ...option,
                        count: dist[option.id],
                        percentage: targetEntries.length > 0 ? Math.round((dist[option.id] / targetEntries.length) * 100) : 0,
                      }));
                    })().map((m) => (
                      <div key={m.id} className="flex items-center gap-2">
                        <span className="text-base">{m.emoji}</span>
                        <span className="w-16 text-sm text-slate-300">{m.label}</span>
                        <div className="flex-1 overflow-hidden rounded-full bg-slate-700">
                          <div
                            className={`h-2 rounded-full ${m.bg}`}
                            style={{ width: `${m.percentage}%` }}
                          />
                        </div>
                        <span className="w-10 text-right text-xs text-slate-400">{m.percentage}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Timeline</p>
              <h2 className="text-2xl font-semibold text-white">Daily reflections</h2>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-sm text-slate-400">Tap an entry to revisit your note.</p>
              {entries.length > 0 && (
                <button
                  onClick={() => exportToCSV(dateFilter === "all" ? entries : filteredEntries)}
                  className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-white/40 hover:bg-white/5"
                >
                  Export CSV
                </button>
              )}
            </div>
          </div>

          {entries.length > 0 && (
            <div className="mt-6 flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-[0.35em] text-slate-400">Filter:</span>
                {[
                  { id: "all" as DateFilter, label: "All time" },
                  { id: "7days" as DateFilter, label: "Last 7 days" },
                  { id: "30days" as DateFilter, label: "Last 30 days" },
                  { id: "thisMonth" as DateFilter, label: "This month" },
                  { id: "lastMonth" as DateFilter, label: "Last month" },
                  { id: "custom" as DateFilter, label: "Custom" },
                ].map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleFilterChange(option.id)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      dateFilter === option.id
                        ? "bg-white text-slate-900"
                        : "border border-white/20 text-slate-300 hover:border-white/40"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              
              {showCustomPicker && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-slate-900/50 p-3">
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    From:
                    <input
                      type="date"
                      value={customDateStart}
                      onChange={(e) => setCustomDateStart(e.target.value)}
                      className="rounded-lg border border-white/10 bg-slate-800 px-2 py-1 text-xs text-white outline-none focus:border-white/40"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    To:
                    <input
                      type="date"
                      value={customDateEnd}
                      onChange={(e) => setCustomDateEnd(e.target.value)}
                      className="rounded-lg border border-white/10 bg-slate-800 px-2 py-1 text-xs text-white outline-none focus:border-white/40"
                    />
                  </label>
                  {customDateStart && customDateEnd && (
                    <button
                      onClick={() => {
                        setShowCustomPicker(false);
                        setDateFilter("all");
                      }}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}

              {filterCountText && (
                <p className="text-xs text-slate-400">{filterCountText}</p>
              )}
            </div>
          )}

          {entries.length === 0 ? (
            <p className="mt-6 text-sm text-slate-300">
              Your timeline is empty. Once you add moods, they will appear here in reverse chronological order.
            </p>
          ) : filteredEntries.length === 0 ? (
            <p className="mt-6 text-sm text-slate-300">
              No entries found for the selected date range. Try a different filter or add a new entry.
            </p>
          ) : (
            <ol className="mt-8 space-y-6 border-l border-white/10 pl-6">
              {filteredEntries.map((entry) => {
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
