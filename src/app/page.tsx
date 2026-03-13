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

type Theme = "dark" | "light";
type ChartTab = "overview" | "weekly" | "monthly" | "calendar" | "dayOfWeek" | "tags";

const THEME_KEY = "mood-theme";

const getInitialTheme = (): Theme => {
  if (typeof window === "undefined") return "dark";
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return "dark";
};

const saveTheme = (theme: Theme) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_KEY, theme);
};

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
  
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [customDateStart, setCustomDateStart] = useState("");
  const [customDateEnd, setCustomDateEnd] = useState("");
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newCustomTag, setNewCustomTag] = useState("");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [chartTab, setChartTab] = useState<ChartTab>("overview");
  const [theme, setTheme] = useState<Theme>("dark");
  
  const [customTags, setCustomTags] = useState<string[]>([]);

  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState("20:00");
  const [reminderDays, setReminderDays] = useState<string[]>(["mon", "tue", "wed", "thu", "fri"]);
  const [reminderSound, setReminderSound] = useState(true);
  const [showReminderSettings, setShowReminderSettings] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MoodEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<MoodEntry | null>(null);
  const [editMood, setEditMood] = useState<MoodId>("good");
  const [editNote, setEditNote] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  
  const [showBackupSettings, setShowBackupSettings] = useState(false);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{ entries: any[] } | null>(null);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const filterData = loadFilterFromStorage();
    setDateFilter(filterData.filter);
    setCustomDateStart(filterData.customStart);
    setCustomDateEnd(filterData.customEnd);
    setShowCustomPicker(filterData.filter === "custom");
    
    setTheme(getInitialTheme());
    setCustomTags(loadCustomTags());
    
    const reminderData = loadReminderSettings();
    setReminderEnabled(reminderData.enabled);
    setReminderTime(reminderData.time);
    setReminderDays(reminderData.days);
    setReminderSound(reminderData.sound);
  }, []);

  useEffect(() => {
    if (theme === "light") {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    }
    saveTheme(theme);
  }, [theme]);

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

  const openEditModal = (entry: MoodEntry) => {
    setEditingEntry(entry);
    setEditMood(entry.mood);
    setEditNote(entry.note);
    setEditDate(entry.date);
    setEditTags(entry.tags || []);
  };

  const saveEdit = async () => {
    if (!editingEntry) return;

    const response = await fetch("/api/entries", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingEntry.id, mood: editMood, note: editNote.trim(), tags: editTags, date: editDate }),
    });

    const data = await response.json();
    if (!response.ok) {
      setFeedback({ type: "error", text: data.error || "Unable to update entry" });
      setTimeout(() => setFeedback(null), 4000);
      return;
    }

    setEntries((prev) =>
      prev.map((e) =>
        e.id === editingEntry.id
          ? { ...e, mood: editMood, note: editNote, tags: editTags, date: editDate }
          : e
      )
    );
    setEditingEntry(null);
    setFeedback({ type: "success", text: "Entry updated!" });
    setTimeout(() => setFeedback(null), 3000);
  };

  const confirmDelete = async () => {
    if (!deletingEntry) return;

    const response = await fetch(`/api/entries?id=${deletingEntry.id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const data = await response.json();
      setFeedback({ type: "error", text: data.error || "Unable to delete entry" });
      setTimeout(() => setFeedback(null), 4000);
      return;
    }

    setEntries((prev) => prev.filter((e) => e.id !== deletingEntry.id));
    setDeletingEntry(null);
    setFeedback({ type: "success", text: "Entry deleted!" });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleExportPDF = () => {
    const targetEntries = dateFilter === "all" ? entries : filteredEntries;
    if (targetEntries.length === 0) {
      setFeedback({ type: "error", text: "No entries to export" });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    const totalEntries = targetEntries.length;
    const moodCounts: Record<MoodId, number> = { ecstatic: 0, good: 0, neutral: 0, low: 0, stressed: 0 };
    targetEntries.forEach((e) => moodCounts[e.mood]++);
    const avgScore = targetEntries.reduce((acc, e) => acc + moodScore[e.mood], 0) / totalEntries;
    
    const content = `
<!DOCTYPE html>
<html>
<head>
  <title>Mood Report</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
    h1 { color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
    h2 { color: #334155; margin-top: 30px; }
    .summary { display: flex; gap: 20px; margin: 20px 0; }
    .stat { background: #f1f5f9; padding: 15px 25px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 28px; font-weight: bold; color: #0f172a; }
    .stat-label { font-size: 12px; color: #64748b; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { background: #f8fafc; font-weight: 600; }
    .mood-ecstatic { color: #65a30d; }
    .mood-good { color: #059669; }
    .mood-neutral { color: #64748b; }
    .mood-low { color: #ea580c; }
    .mood-stressed { color: #e11d48; }
    .footer { margin-top: 40px; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <h1>Daily Mood Tracker Report</h1>
  <p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
  <p><strong>Account:</strong> ${user?.email || 'Unknown'}</p>
  
  <h2>Summary</h2>
  <div class="summary">
    <div class="stat">
      <div class="stat-value">${totalEntries}</div>
      <div class="stat-label">Total Entries</div>
    </div>
    <div class="stat">
      <div class="stat-value">${avgScore.toFixed(1)}</div>
      <div class="stat-label">Average Score</div>
    </div>
    <div class="stat">
      <div class="stat-value">${streak}</div>
      <div class="stat-label">Current Streak</div>
    </div>
  </div>
  
  <h2>Mood Distribution</h2>
  <table>
    <tr><th>Mood</th><th>Count</th><th>Percentage</th></tr>
    ${MOOD_OPTIONS.map(m => `<tr><td>${m.emoji} ${m.label}</td><td>${moodCounts[m.id]}</td><td>${Math.round((moodCounts[m.id] / totalEntries) * 100)}%</td></tr>`).join('')}
  </table>
  
  <h2>Recent Entries</h2>
  <table>
    <tr><th>Date</th><th>Mood</th><th>Note</th></tr>
    ${targetEntries.slice(0, 20).map(e => `<tr><td>${e.date}</td><td class="mood-${e.mood}">${findMood(e.mood).emoji} ${findMood(e.mood).label}</td><td>${e.note || '-'}</td></tr>`).join('')}
  </table>
  
  <div class="footer">
    Generated by Daily Mood Tracker
  </div>
</body>
</html>
    `;

    const blob = new Blob([content], { type: "text/html;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `mood-report-${today}.html`;
    link.click();
    URL.revokeObjectURL(url);
    
    setFeedback({ type: "success", text: "Report exported!" });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleBackupExport = async () => {
    if (!user) {
      setFeedback({ type: "error", text: "Please login to export backup" });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    try {
      const response = await fetch(`/api/backup?userId=${user.id}`);
      if (!response.ok) {
        throw new Error("Failed to create backup");
      }
      
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data.backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `mood-backup-${today}.json`;
      link.click();
      URL.revokeObjectURL(url);
      
      setFeedback({ type: "success", text: "Backup exported successfully!" });
      setTimeout(() => setFeedback(null), 3000);
    } catch (error) {
      setFeedback({ type: "error", text: "Failed to export backup" });
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.entries && Array.isArray(data.entries)) {
          setImportPreview({ entries: data.entries });
          setImportFile(file);
        } else {
          setFeedback({ type: "error", text: "Invalid backup file format" });
          setTimeout(() => setFeedback(null), 3000);
        }
      } catch {
        setFeedback({ type: "error", text: "Failed to parse backup file" });
        setTimeout(() => setFeedback(null), 3000);
      }
    };
    reader.readAsText(file);
  };

  const handleImportConfirm = async () => {
    if (!user || !importPreview) {
      setFeedback({ type: "error", text: "Please login to import backup" });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    try {
      const response = await fetch("/api/backup/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          entries: importPreview.entries,
          mode: importMode,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to import backup");
      }

      const data = await response.json();
      
      setImportFile(null);
      setImportPreview(null);
      setShowBackupSettings(false);
      
      setFeedback({ type: "success", text: `Imported ${data.importedCount} entries!` });
      setTimeout(() => setFeedback(null), 3000);
      
      const entriesResponse = await fetch(`/api/entries?userId=${user.id}`);
      if (entriesResponse.ok) {
        const entriesData = await entriesResponse.json();
        const normalized: MoodEntry[] = entriesData.entries.map((entry: { id: string; mood: MoodId; note?: string; tags?: string[]; date: string; createdAt: string }) => ({
          id: entry.id,
          mood: entry.mood,
          note: entry.note ?? "",
          tags: entry.tags ?? [],
          date: entry.date.slice(0, 10),
          createdAt: entry.createdAt,
        }));
        setEntries(normalized);
      }
    } catch (error) {
      setFeedback({ type: "error", text: "Failed to import backup" });
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const cancelImport = () => {
    setImportFile(null);
    setImportPreview(null);
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

  const dayOfWeekData = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayStats: { day: string; moods: Record<MoodId, number>; avg: number; count: number }[] = days.map((day) => ({
      day,
      moods: { ecstatic: 0, good: 0, neutral: 0, low: 0, stressed: 0 },
      avg: 0,
      count: 0,
    }));
    
    const targetEntries = dateFilter === "all" ? entries : filteredEntries;
    targetEntries.forEach((entry) => {
      const dayIndex = new Date(entry.date).getDay();
      dayStats[dayIndex].moods[entry.mood]++;
      dayStats[dayIndex].count++;
    });
    
    dayStats.forEach((stat) => {
      if (stat.count > 0) {
        stat.avg = (stat.moods.ecstatic * 5 + stat.moods.good * 4 + stat.moods.neutral * 3 + stat.moods.low * 2 + stat.moods.stressed * 1) / stat.count;
      }
    });
    
    return dayStats;
  }, [entries, dateFilter, filteredEntries]);

  const tagCorrelationData = useMemo(() => {
    const allTags = [...PREDEFINED_TAGS.map(t => t.id), ...customTags];
    const correlations: { tag: string; label: string; emoji: string; moods: Record<MoodId, number>; total: number }[] = [];
    
    const targetEntries = dateFilter === "all" ? entries : filteredEntries;
    
    allTags.forEach((tagId) => {
      const entriesWithTag = targetEntries.filter((e) => e.tags && e.tags.includes(tagId));
      if (entriesWithTag.length > 0) {
        const moods: Record<MoodId, number> = { ecstatic: 0, good: 0, neutral: 0, low: 0, stressed: 0 };
        entriesWithTag.forEach((e) => moods[e.mood]++);
        
        const predefined = PREDEFINED_TAGS.find(t => t.id === tagId);
        correlations.push({
          tag: tagId,
          label: predefined?.label || tagId,
          emoji: predefined?.emoji || "#",
          moods,
          total: entriesWithTag.length,
        });
      }
    });
    
    return correlations.sort((a, b) => b.total - a.total);
  }, [entries, dateFilter, filteredEntries, customTags]);

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
              <button
                type="button"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="mt-3 flex items-center gap-2 rounded-full border border-white/20 px-3 py-1 text-xs text-slate-400 transition hover:border-white/40"
              >
                <span>{theme === "dark" ? "☀️" : "🌙"}</span>
                <span>{theme === "dark" ? "Light" : "Dark"}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowBackupSettings(!showBackupSettings)}
                className="mt-3 flex items-center gap-2 rounded-full border border-white/20 px-3 py-1 text-xs text-slate-400 transition hover:border-white/40"
              >
                <span>💾</span>
                <span>Backup</span>
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

        {showBackupSettings && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Backup & Restore</h3>
              <button
                type="button"
                onClick={() => setShowBackupSettings(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <div className="mt-6 space-y-6">
              <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
                <h4 className="text-sm font-medium text-white">Export Backup</h4>
                <p className="mt-1 text-xs text-slate-400">Download all your entries as a JSON file.</p>
                <button
                  type="button"
                  onClick={handleBackupExport}
                  className="mt-3 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-200"
                >
                  Download Backup
                </button>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
                <h4 className="text-sm font-medium text-white">Import Backup</h4>
                <p className="mt-1 text-xs text-slate-400">Restore entries from a backup file.</p>
                
                {!importPreview ? (
                  <div className="mt-3">
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm text-slate-300 transition hover:border-white/40">
                      <span>📁</span>
                      <span>Choose File</span>
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImportFile}
                        className="hidden"
                      />
                    </label>
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    <p className="text-sm text-emerald-300">{importPreview.entries.length} entries found in file</p>
                    
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm text-slate-300">
                        <input
                          type="radio"
                          name="importMode"
                          checked={importMode === "merge"}
                          onChange={() => setImportMode("merge")}
                          className="text-white"
                        />
                        Merge (skip duplicates)
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-300">
                        <input
                          type="radio"
                          name="importMode"
                          checked={importMode === "replace"}
                          onChange={() => setImportMode("replace")}
                          className="text-white"
                        />
                        Replace (delete existing)
                      </label>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleImportConfirm}
                        className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600"
                      >
                        Import
                      </button>
                      <button
                        type="button"
                        onClick={cancelImport}
                        className="rounded-lg border border-white/20 px-4 py-2 text-sm text-slate-300 transition hover:border-white/40"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
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

                <div className="mt-4 flex gap-2 flex-wrap">
                  {[
                    { id: "overview" as ChartTab, label: "Overview" },
                    { id: "weekly" as ChartTab, label: "Weekly" },
                    { id: "monthly" as ChartTab, label: "Monthly" },
                    { id: "calendar" as ChartTab, label: "Calendar" },
                    { id: "dayOfWeek" as ChartTab, label: "Day of Week" },
                    { id: "tags" as ChartTab, label: "Tags" },
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

                {chartTab === "dayOfWeek" && (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                    <p className="text-xs uppercase tracking-widest text-slate-400">Mood by Day of Week</p>
                    <div className="mt-4 grid grid-cols-7 gap-2">
                      {dayOfWeekData.map((day) => (
                        <div key={day.day} className="flex flex-col items-center">
                          <span className="text-xs text-slate-400">{day.day}</span>
                          <div
                            className="mt-2 w-full rounded-t-md transition-all"
                            style={{
                              height: "80px",
                              backgroundColor: day.count > 0 ? getMoodColor(Object.entries(moodScore).find(([, v]) => Math.round(v) === Math.round(day.avg))?.[0] as MoodId) : "#334155",
                              opacity: day.count > 0 ? 0.7 : 0.2,
                            }}
                          />
                          <span className="mt-1 text-xs font-semibold text-white">{day.count > 0 ? day.avg.toFixed(1) : "-"}</span>
                          <span className="text-[10px] text-slate-500">{day.count} entries</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 rounded-xl bg-slate-800/50 p-3">
                      <p className="text-xs text-slate-300">
                        {(() => {
                          const bestDay = dayOfWeekData.reduce((best, day) => day.avg > best.avg ? day : best, dayOfWeekData[0]);
                          const worstDay = dayOfWeekData.reduce((worst, day) => day.avg < worst.avg ? day : worst, dayOfWeekData[0]);
                          if (bestDay.count === 0) return "Log more entries to see day-of-week patterns.";
                          return `You tend to feel best on ${bestDay.day}s (avg: ${bestDay.avg.toFixed(1)}) and most challenged on ${worstDay.day}s (avg: ${worstDay.avg.toFixed(1)}).`;
                        })()}
                      </p>
                    </div>
                  </div>
                )}

                {chartTab === "tags" && (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                    <p className="text-xs uppercase tracking-widest text-slate-400">Tag Correlations</p>
                    {tagCorrelationData.length === 0 ? (
                      <p className="mt-4 text-sm text-slate-400">Add tags to your entries to see correlations.</p>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {tagCorrelationData.slice(0, 8).map((tag) => {
                          const dominantMood = Object.entries(tag.moods).reduce((a, b) => a[1] > b[1] ? a : b)[0] as MoodId;
                          const positivePct = Math.round(((tag.moods.ecstatic + tag.moods.good) / tag.total) * 100);
                          return (
                            <div key={tag.tag} className="rounded-xl bg-slate-800/50 p-3">
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2 text-sm text-white">
                                  <span>{tag.emoji}</span>
                                  <span>{tag.label}</span>
                                </span>
                                <span className="text-xs text-slate-400">{tag.total} entries</span>
                              </div>
                              <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-slate-700">
                                {MOOD_OPTIONS.map((m) => (
                                  <div
                                    key={m.id}
                                    className="h-full"
                                    style={{
                                      width: `${(tag.moods[m.id] / tag.total) * 100}%`,
                                      backgroundColor: MOOD_COLORS[m.id],
                                    }}
                                  />
                                ))}
                              </div>
                              <div className="mt-2 flex items-center justify-between text-xs">
                                <span className="text-slate-400">Dominant: {findMood(dominantMood).emoji} {findMood(dominantMood).label}</span>
                                <span className={positivePct >= 60 ? "text-emerald-400" : positivePct >= 40 ? "text-slate-400" : "text-rose-400"}>
                                  {positivePct}% positive
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
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
                <>
                  <button
                    onClick={handleExportPDF}
                    className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-white/40 hover:bg-white/5"
                  >
                    Export PDF
                  </button>
                  <button
                    onClick={() => exportToCSV(dateFilter === "all" ? entries : filteredEntries)}
                    className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-white/40 hover:bg-white/5"
                  >
                    Export CSV
                  </button>
                </>
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
                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-xs text-slate-500">Logged at {new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => openEditModal(entry)}
                            className="text-xs text-slate-400 hover:text-white"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingEntry(entry)}
                            className="text-xs text-rose-400 hover:text-rose-300"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {editingEntry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="mx-4 w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900 p-6">
              <h3 className="text-xl font-semibold text-white">Edit Entry</h3>
              
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.35em] text-slate-400">Mood</span>
                  <div className="grid grid-cols-2 gap-2">
                    {MOOD_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setEditMood(option.id)}
                        className={`flex items-center gap-2 rounded-xl border p-3 transition ${
                          editMood === option.id
                            ? "border-white/40 bg-white/10"
                            : "border-white/10 hover:border-white/30"
                        }`}
                      >
                        <span className="text-xl">{option.emoji}</span>
                        <span className="text-sm text-white">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex flex-col text-sm text-slate-200">
                  Date
                  <input
                    type="date"
                    max={todayISO()}
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="mt-2 rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-white outline-none transition focus:border-white/40"
                  />
                </label>

                <label className="flex flex-col text-sm text-slate-200">
                  Note
                  <input
                    type="text"
                    maxLength={80}
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    placeholder="Add a note..."
                    className="mt-2 rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-white placeholder:text-slate-500 outline-none transition focus:border-white/40"
                  />
                </label>

                <div className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.35em] text-slate-400">Tags</span>
                  <div className="flex flex-wrap gap-2">
                    {PREDEFINED_TAGS.map((tag) => {
                      const isSelected = editTags.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setEditTags(editTags.filter((t) => t !== tag.id));
                            } else if (editTags.length < 3) {
                              setEditTags([...editTags, tag.id]);
                            }
                          }}
                          className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition ${
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
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingEntry(null)}
                  className="flex-1 rounded-2xl border border-white/20 py-3 text-sm font-medium text-slate-300 transition hover:border-white/40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  className="flex-1 rounded-2xl bg-white py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {deletingEntry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="mx-4 w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900 p-6">
              <h3 className="text-xl font-semibold text-white">Delete Entry</h3>
              <p className="mt-3 text-sm text-slate-300">
                Are you sure you want to delete this entry? This action cannot be undone.
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeletingEntry(null)}
                  className="flex-1 rounded-2xl border border-white/20 py-3 text-sm font-medium text-slate-300 transition hover:border-white/40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="flex-1 rounded-2xl bg-rose-600 py-3 text-sm font-semibold text-white transition hover:bg-rose-500"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
