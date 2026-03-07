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
  tags: string[];
  date: string; // ISO
  createdAt: string;
};

type ChartTab = "overview" | "weekly" | "monthly" | "calendar";

const MOOD_COLORS: Record<MoodId, string> = {
  ecstatic: "#a3e635",
  good: "#34d399",
  neutral: "#94a3b8",
  low: "#fb923c",
  stressed: "#fb7185",
};

const getMoodColor = (mood: MoodId) => MOOD_COLORS[mood];

const getWeekNumber = (date: Date): number => {
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - start.getTime();
  const oneWeek = 604800000;
  return Math.ceil((diff + start.getDay() * 86400000) / oneWeek);
};

const getWeeksInRange = (weeks: number): { week: number; year: number }[] => {
  const result: { week: number; year: number }[] = [];
  const now = new Date();
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    result.push({ week: getWeekNumber(d), year: d.getFullYear() });
  }
  return result;
};

const PREDEFINED_TAGS = [
  { id: "work", label: "Work", emoji: "💼" },
  { id: "family", label: "Family", emoji: "👨‍👩‍👧" },
  { id: "health", label: "Health", emoji: "💪" },
  { id: "exercise", label: "Exercise", emoji: "🏃" },
  { id: "sleep", label: "Sleep", emoji: "😴" },
  { id: "social", label: "Social", emoji: "👥" },
  { id: "weather", label: "Weather", emoji: "🌤️" },
  { id: "finances", label: "Finances", emoji: "💰" },
] as const;

const CUSTOM_TAGS_KEY = "mood-custom-tags";

const loadCustomTags = (): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(CUSTOM_TAGS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

const saveCustomTags = (tags: string[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(CUSTOM_TAGS_KEY, JSON.stringify(tags));
};

type ReminderSettings = {
  enabled: boolean;
  time: string;
  days: string[];
  sound: boolean;
  snoozedToday: number;
};

const REMINDER_KEY = "mood-reminder-settings";

const loadReminderSettings = (): ReminderSettings => {
  if (typeof window === "undefined") return { enabled: false, time: "20:00", days: ["mon", "tue", "wed", "thu", "fri"], sound: true, snoozedToday: 0 };
  try {
    const saved = localStorage.getItem(REMINDER_KEY);
    return saved ? JSON.parse(saved) : { enabled: false, time: "20:00", days: ["mon", "tue", "wed", "thu", "fri"], sound: true, snoozedToday: 0 };
  } catch {
    return { enabled: false, time: "20:00", days: ["mon", "tue", "wed", "thu", "fri"], sound: true, snoozedToday: 0 };
  }
};

const saveReminderSettings = (settings: ReminderSettings) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(REMINDER_KEY, JSON.stringify(settings));
};

const getDayName = (date: Date): string => {
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][date.getDay()];
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
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newCustomTag, setNewCustomTag] = useState("");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [chartTab, setChartTab] = useState<ChartTab>("overview");
  
  const storedCustomTags = typeof window !== "undefined" ? loadCustomTags() : [];
  const [customTags, setCustomTags] = useState<string[]>(storedCustomTags);

  const storedReminder = typeof window !== "undefined" ? loadReminderSettings() : { enabled: false, time: "20:00", days: [], sound: true, snoozedToday: 0 };
  const [reminderEnabled, setReminderEnabled] = useState(storedReminder.enabled);
  const [reminderTime, setReminderTime] = useState(storedReminder.time);
  const [reminderDays, setReminderDays] = useState<string[]>(storedReminder.days);
  const [reminderSound, setReminderSound] = useState(storedReminder.sound);
  const [showReminderSettings, setShowReminderSettings] = useState(false);

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
      const normalized: MoodEntry[] = data.entries.map((entry: { id: string; mood: MoodId; note?: string; tags?: string[]; date: string; createdAt: string }) => ({
        id: entry.id,
        mood: entry.mood,
        note: entry.note ?? "",
        tags: entry.tags ?? [],
        date: entry.date.slice(0, 10),
        createdAt: entry.createdAt,
      }));
      setEntries(normalized);
      setTimeout(() => setLoading(false), 0);
    };

    fetchEntries();
  }, []);

  const addCustomTag = () => {
    const tag = newCustomTag.trim();
    if (tag && !customTags.includes(tag) && customTags.length < 10) {
      const updated = [...customTags, tag];
      setCustomTags(updated);
      saveCustomTags(updated);
      setNewCustomTag("");
    }
  };

  const toggleTag = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      setSelectedTags(selectedTags.filter((t) => t !== tagId));
    } else if (selectedTags.length < 3) {
      setSelectedTags([...selectedTags, tagId]);
    }
  };

  const requestNotificationPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    const permission = await Notification.requestPermission();
    return permission === "granted";
  };

  const showReminderNotification = () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "granted") {
      const notification = new Notification("Time to log your mood! 🌟", {
        body: "Take a moment to reflect on how you're feeling today.",
        icon: "/favicon.ico",
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }
  };

  useEffect(() => {
    if (!reminderEnabled) return;
    
    const checkReminder = setInterval(() => {
      const now = new Date();
      const currentDay = getDayName(now);
      const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
      
      if (reminderDays.includes(currentDay) && currentTime === reminderTime) {
        showReminderNotification();
      }
    }, 60000);

    return () => clearInterval(checkReminder);
  }, [reminderEnabled, reminderTime, reminderDays]);

  useEffect(() => {
    saveReminderSettings({
      enabled: reminderEnabled,
      time: reminderTime,
      days: reminderDays,
      sound: reminderSound,
      snoozedToday: 0,
    });
  }, [reminderEnabled, reminderTime, reminderDays, reminderSound]);

  const toggleReminderDay = (day: string) => {
    if (reminderDays.includes(day)) {
      setReminderDays(reminderDays.filter((d) => d !== day));
    } else {
      setReminderDays([...reminderDays, day]);
    }
  };

  const enableReminder = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      setReminderEnabled(true);
    } else {
      alert("Please enable notifications in your browser settings");
    }
  };

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
    let result = entries;
    
    if (dateFilter !== "all") {
      const { start, end } = getDateRangeForFilter(dateFilter, customDateStart, customDateEnd);
      if (start && end) {
        result = result.filter((entry) => entry.date >= start && entry.date <= end);
      }
    }
    
    if (tagFilter !== "all") {
      result = result.filter((entry) => entry.tags && entry.tags.includes(tagFilter));
    }
    
    return result;
  }, [entries, dateFilter, customDateStart, customDateEnd, tagFilter]);

  const filterCountText = useMemo(() => {
    const dateFiltered = dateFilter !== "all";
    const tagFiltered = tagFilter !== "all";
    if (!dateFiltered && !tagFiltered) return "";
    return `Showing ${filteredEntries.length} of ${entries.length} entries`;
  }, [dateFilter, tagFilter, filteredEntries.length, entries.length]);

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
      body: JSON.stringify({ userId: user.id, mood, note: note.trim(), tags: selectedTags, date }),
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
      tags: data.entry.tags ?? [],
      date: data.entry.date.slice(0, 10),
      createdAt: data.entry.createdAt,
    };

    setEntries((prev) => [newEntry, ...prev]);
    setNote("");
    setDate(todayISO());
    setMood("good");
    setSelectedTags([]);
    setFeedback({ type: "success", text: "Mood saved!" });
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

  const lineChartData = useMemo(() => {
    const days: { date: Date; score: number | null }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const entry = entries.find((e) => {
        const entryDate = new Date(e.date);
        entryDate.setHours(0, 0, 0, 0);
        return entryDate.getTime() === d.getTime();
      });
      days.push({ date: d, score: entry ? moodScore[entry.mood] : null });
    }
    return days;
  }, [entries]);

  const barChartData = useMemo(() => {
    const weeks = getWeeksInRange(8);
    return weeks.map(({ week, year }) => {
      const weekEntries = entries.filter((e) => {
        const entryDate = new Date(e.date);
        return getWeekNumber(entryDate) === week && entryDate.getFullYear() === year;
      });
      const avg = weekEntries.length > 0
        ? weekEntries.reduce((sum, e) => sum + moodScore[e.mood], 0) / weekEntries.length
        : null;
      return { week, year, avg, count: weekEntries.length };
    });
  }, [entries]);

  const donutChartData = useMemo(() => {
    const dist: Record<MoodId, number> = { ecstatic: 0, good: 0, neutral: 0, low: 0, stressed: 0 };
    entries.forEach((e) => dist[e.mood]++);
    return MOOD_OPTIONS.map((m) => ({
      mood: m.id,
      label: m.label,
      emoji: m.emoji,
      color: MOOD_COLORS[m.id],
      value: dist[m.id],
      percentage: entries.length > 0 ? Math.round((dist[m.id] / entries.length) * 100) : 0,
    }));
  }, [entries]);

  const heatmapData = useMemo(() => {
    const days: { date: Date; score: number | null }[] = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const entry = entries.find((e) => {
        const entryDate = new Date(e.date);
        entryDate.setHours(0, 0, 0, 0);
        return entryDate.getTime() === d.getTime();
      });
      days.push({ date: d, score: entry ? moodScore[entry.mood] : null });
    }
    return days;
  }, [entries]);

  const trendDirection = useMemo(() => {
    if (lineChartData.filter((d) => d.score !== null).length < 7) return "stable";
    const recent = lineChartData.slice(-7).filter((d) => d.score !== null);
    const previous = lineChartData.slice(-14, -7).filter((d) => d.score !== null);
    if (recent.length === 0 || previous.length === 0) return "stable";
    const recentAvg = recent.reduce((a, b) => a + b.score!, 0) / recent.length;
    const prevAvg = previous.reduce((a, b) => a + b.score!, 0) / previous.length;
    if (recentAvg - prevAvg > 0.3) return "up";
    if (prevAvg - recentAvg > 0.3) return "down";
    return "stable";
  }, [lineChartData]);

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
              <button
                type="button"
                onClick={() => setShowReminderSettings(!showReminderSettings)}
                className={`mt-3 flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition ${
                  reminderEnabled
                    ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300"
                    : "border-white/20 text-slate-400 hover:border-white/40"
                }`}
              >
                <span>🔔</span>
                <span>{reminderEnabled ? "Reminder On" : "Set Reminder"}</span>
              </button>
            </div>
          </div>
        </header>

        {showReminderSettings && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Daily Reminder</h3>
              <button
                type="button"
                onClick={() => setShowReminderSettings(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Enable daily reminder</span>
                <button
                  type="button"
                  onClick={reminderEnabled ? () => setReminderEnabled(false) : enableReminder}
                  className={`relative h-6 w-11 rounded-full transition ${
                    reminderEnabled ? "bg-emerald-500" : "bg-slate-600"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
                      reminderEnabled ? "left-6" : "left-1"
                    }`}
                  />
                </button>
              </div>

              {reminderEnabled && (
                <>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-slate-300">Time:</span>
                    <input
                      type="time"
                      value={reminderTime}
                      onChange={(e) => setReminderTime(e.target.value)}
                      className="rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-sm text-white outline-none focus:border-white/40"
                    />
                  </div>

                  <div>
                    <span className="text-sm text-slate-300">Days:</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[
                        { id: "mon", label: "M" },
                        { id: "tue", label: "T" },
                        { id: "wed", label: "W" },
                        { id: "thu", label: "T" },
                        { id: "fri", label: "F" },
                        { id: "sat", label: "S" },
                        { id: "sun", label: "S" },
                      ].map((day) => (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => toggleReminderDay(day.id)}
                          className={`h-8 w-8 rounded-full text-xs font-medium transition ${
                            reminderDays.includes(day.id)
                              ? "bg-white text-slate-900"
                              : "border border-white/20 text-slate-400 hover:border-white/40"
                          }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">Sound</span>
                    <button
                      type="button"
                      onClick={() => setReminderSound(!reminderSound)}
                      className={`relative h-6 w-11 rounded-full transition ${
                        reminderSound ? "bg-emerald-500" : "bg-slate-600"
                      }`}
                    >
                      <span
                        className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
                          reminderSound ? "left-6" : "left-1"
                        }`}
                      />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

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

              <div className="space-y-3">
                <span className="text-xs uppercase tracking-[0.35em] text-slate-400">Tags (max 3)</span>
                <div className="flex flex-wrap gap-2">
                  {PREDEFINED_TAGS.map((tag) => {
                    const isSelected = selectedTags.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                          isSelected
                            ? "bg-white text-slate-900"
                            : "border border-white/20 text-slate-300 hover:border-white/40"
                        }`}
                      >
                        <span>{tag.emoji}</span>
                        <span>{tag.label}</span>
                      </button>
                    );
                  })}
                  {customTags.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                          isSelected
                            ? "bg-white text-slate-900"
                            : "border border-white/20 text-slate-300 hover:border-white/40"
                        }`}
                      >
                        <span>#</span>
                        <span>{tag}</span>
                      </button>
                    );
                  })}
                </div>
                {customTags.length < 10 && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCustomTag}
                      onChange={(e) => setNewCustomTag(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomTag())}
                      placeholder="Add custom tag..."
                      maxLength={20}
                      className="flex-1 rounded-xl border border-white/10 bg-slate-900/60 px-3 py-1.5 text-xs text-white placeholder:text-slate-500 outline-none transition focus:border-white/40"
                    />
                    <button
                      type="button"
                      onClick={addCustomTag}
                      disabled={!newCustomTag.trim()}
                      className="rounded-xl border border-white/20 px-3 py-1.5 text-xs text-slate-300 transition hover:border-white/40 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                )}
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
                  <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-400">
                      <span>📈</span> Trend
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-2xl">
                        {trendDirection === "up" ? "↑" : trendDirection === "down" ? "↓" : "→"}
                      </span>
                      <span className={`text-lg font-semibold ${
                        trendDirection === "up" ? "text-emerald-400" : trendDirection === "down" ? "text-rose-400" : "text-slate-400"
                      }`}>
                        {trendDirection === "up" ? "Trending Up" : trendDirection === "down" ? "Trending Down" : "Stable"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">vs last week</p>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  {[
                    { id: "overview" as ChartTab, label: "Overview" },
                    { id: "weekly" as ChartTab, label: "Weekly" },
                    { id: "monthly" as ChartTab, label: "Monthly" },
                    { id: "calendar" as ChartTab, label: "Calendar" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setChartTab(tab.id)}
                      className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition ${
                        chartTab === tab.id
                          ? "bg-white text-slate-900"
                          : "border border-white/20 text-slate-400 hover:border-white/40"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {chartTab === "overview" && (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                    <p className="text-xs uppercase tracking-widest text-slate-400">Mood Over Time (30 Days)</p>
                    <div className="mt-3 h-32 flex items-end justify-between gap-1">
                      {lineChartData.map((day, idx) => (
                        <div key={idx} className="flex flex-1 flex-col items-center gap-1">
                          <div
                            className="w-full rounded-t-sm transition-all"
                            style={{
                              height: day.score ? `${day.score * 6.4}px` : "4px",
                              backgroundColor: day.score ? getMoodColor(Object.keys(moodScore).find((k) => moodScore[k as MoodId] === day.score) as MoodId) : "#334155",
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex justify-between text-[10px] text-slate-500">
                      <span>30 days ago</span>
                      <span>Today</span>
                    </div>
                  </div>
                )}

                {chartTab === "weekly" && (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                    <p className="text-xs uppercase tracking-widest text-slate-400">Weekly Averages (8 Weeks)</p>
                    <div className="mt-3 h-32 flex items-end justify-between gap-2">
                      {barChartData.map((week, idx) => (
                        <div key={idx} className="flex flex-1 flex-col items-center gap-1">
                          <div
                            className="w-full rounded-t-sm bg-emerald-500"
                            style={{ height: week.avg ? `${week.avg * 25.6}px` : "4px", opacity: week.avg ? 1 : 0.3 }}
                          />
                          <span className="text-[10px] text-slate-500">W{week.week}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {chartTab === "monthly" && (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                    <p className="text-xs uppercase tracking-widest text-slate-400">Mood Distribution</p>
                    <div className="mt-4 flex items-center justify-center">
                      <div className="relative h-32 w-32">
                        <svg viewBox="0 0 36 36" className="h-32 w-32 rotate-[-90deg]">
                          {donutChartData.reduce((acc, slice, idx) => {
                            if (slice.value === 0) return acc;
                            const offset = acc.offset;
                            const dashArray = (slice.percentage * 0.7854) + " " + (100 - slice.percentage * 0.7854);
                            acc.elements.push(
                              <circle
                                key={slice.mood}
                                cx="18"
                                cy="18"
                                r="15.9155"
                                fill="transparent"
                                stroke={slice.color}
                                strokeWidth="4"
                                strokeDasharray={dashArray}
                                strokeDashoffset={25 - offset}
                              />
                            );
                            acc.offset += slice.percentage * 0.7854;
                            return acc;
                          }, { elements: [] as React.ReactNode[], offset: 0 }).elements}
                        </svg>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {donutChartData.filter((s) => s.value > 0).map((slice) => (
                        <div key={slice.mood} className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: slice.color }} />
                          <span className="text-xs text-slate-300">{slice.emoji} {slice.label}</span>
                          <span className="ml-auto text-xs text-slate-400">{slice.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {chartTab === "calendar" && (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                    <p className="text-xs uppercase tracking-widest text-slate-400">Mood Calendar (90 Days)</p>
                    <div className="mt-3 grid grid-cols-10 gap-1">
                      {heatmapData.map((day, idx) => (
                        <div
                          key={idx}
                          className="h-4 w-4 rounded-sm transition-all"
                          style={{
                            backgroundColor: day.score ? getMoodColor(Object.keys(moodScore).find((k) => moodScore[k as MoodId] === day.score) as MoodId) : "#1e293b",
                            opacity: day.score ? 0.7 : 0.3,
                          }}
                          title={`${day.date.toLocaleDateString()}: ${day.score ? Object.entries(moodScore).find(([, v]) => v === day.score)?.[0] : "No entry"}`}
                        />
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-center gap-4 text-[10px] text-slate-500">
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ backgroundColor: MOOD_COLORS.ecstatic }} /> Great</span>
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ backgroundColor: MOOD_COLORS.good }} /> Good</span>
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ backgroundColor: MOOD_COLORS.neutral }} /> Okay</span>
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ backgroundColor: MOOD_COLORS.low }} /> Low</span>
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ backgroundColor: MOOD_COLORS.stressed }} /> Bad</span>
                    </div>
                  </div>
                )}

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

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-[0.35em] text-slate-400">Tag:</span>
                <select
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  className="rounded-full border border-white/20 bg-slate-900/60 px-3 py-1 text-xs text-slate-300 outline-none transition focus:border-white/40"
                >
                  <option value="all">All tags</option>
                  {PREDEFINED_TAGS.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.emoji} {tag.label}
                    </option>
                  ))}
                  {customTags.map((tag) => (
                    <option key={tag} value={tag}>
                      # {tag}
                    </option>
                  ))}
                </select>
              </div>
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
                      {entry.tags && entry.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {entry.tags.map((tag) => {
                            const predefined = PREDEFINED_TAGS.find((t) => t.id === tag);
                            return (
                              <span key={tag} className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300">
                                <span>{predefined?.emoji || "#"}</span>
                                <span>{predefined?.label || tag}</span>
                              </span>
                            );
                          })}
                        </div>
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
