#!/usr/bin/env node
/**
 * Functional smoke test — verifies the complete user journey still works
 * after the security refactor (register → entry → edit → delete → backup →
 * import → community board).
 *
 *   node scripts/smoke-test.mjs
 */

import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const PORT = Number(process.env.PORT ?? 3478);
const BASE_URL = `http://127.0.0.1:${PORT}`;

const RUN_ID = `smoke-${Date.now()}`;
const USER = { email: `smoke.${RUN_ID}@example.com`, password: "Smoke-Test-1234" };

let passed = 0;
const failures = [];

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  \x1b[32mPASS\x1b[0m  ${name}`);
  } else {
    failures.push({ name, detail });
    console.log(`  \x1b[31mFAIL\x1b[0m  ${name}${detail ? `  → ${detail}` : ""}`);
  }
}

function createJar() {
  const cookies = new Map();
  return {
    header: () => [...cookies.entries()].map(([n, v]) => `${n}=${v}`).join("; "),
    absorb(response) {
      for (const cookie of response.headers.getSetCookie?.() ?? []) {
        const [pair] = cookie.split(";");
        const i = pair.indexOf("=");
        if (i === -1) continue;
        const name = pair.slice(0, i).trim();
        const value = pair.slice(i + 1).trim();
        if (value === "") cookies.delete(name);
        else cookies.set(name, value);
      }
    },
  };
}

async function request(path, { method = "GET", body, jar } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (jar) {
    const cookie = jar.header();
    if (cookie) headers.Cookie = cookie;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (jar) jar.absorb(response);
  const text = await response.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  return { status: response.status, body: parsed, text, headers: response.headers };
}

function loadEnv() {
  const envPath = join(projectRoot, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
}

async function isPortOpen(port) {
  try {
    await fetch(`http://127.0.0.1:${port}/`, { redirect: "manual" });
    return true;
  } catch {
    return false;
  }
}

/** Wait until nothing answers on the port (the socket outlives the process briefly). */
async function waitForPortFree(port, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await isPortOpen(port))) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

async function waitForServer(timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (serverExit !== null) {
      throw new Error(`The server exited immediately (code ${serverExit}). Is port ${PORT} already in use?`);
    }
    try {
      const res = await fetch(`${BASE_URL}/`);
      if (res.status < 500) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

loadEnv();

if (!(await waitForPortFree(PORT))) {
  console.error(`\n✖ Port ${PORT} is still in use. Stop the other process and retry.\n`);
  process.exit(1);
}

const prisma = new PrismaClient();
let serverExit = null;

const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
  cwd: projectRoot,
  env: { ...process.env, NODE_ENV: "production" },
  stdio: "ignore",
});

server.on("exit", (code) => {
  serverExit = code;
});

try {
  if (!(await waitForServer())) {
    console.error("Server did not start");
    process.exit(1);
  }

  const jar = createJar();
  const anonymous = createJar();

  console.log("\n\x1b[1mAccount\x1b[0m");
  const register = await request("/api/register", { method: "POST", body: { ...USER, name: "Smoke" }, jar });
  check("register → 201", register.status === 201, `got ${register.status}`);
  check("register returns the user", register.body?.user?.email === USER.email);
  check("register returns no password", register.body?.user?.password === undefined);

  const me = await request("/api/me", { jar });
  check("GET /api/me → 200 with the right email", me.status === 200 && me.body?.user?.email === USER.email);

  console.log("\n\x1b[1mEntries\x1b[0m");
  const created = await request("/api/entries", {
    method: "POST",
    jar,
    body: {
      mood: "good",
      date: "2026-03-01",
      note: "Shipped the release",
      tags: ["work", "health"],
      sleepHours: 7.5,
      exerciseMinutes: 45,
      waterIntake: 8,
      medication: "Magnesium",
      completedActivities: ["walk", "journal"],
    },
  });
  check("create entry → 201", created.status === 201, `got ${created.status}`);
  check("tags round-trip as an array", Array.isArray(created.body?.entry?.tags) && created.body.entry.tags.length === 2);
  check("activities round-trip as an array", Array.isArray(created.body?.entry?.completedActivities) && created.body.entry.completedActivities.length === 2);
  check("sleep hours persisted", created.body?.entry?.sleepHours === 7.5);
  check("date comes back as a day key", created.body?.entry?.date === "2026-03-01", created.body?.entry?.date);

  const list = await request("/api/entries", { jar });
  check("list entries → 200", list.status === 200);
  check("list contains the new entry", (list.body?.entries ?? []).some((e) => e.id === created.body.entry.id));

  const updated = await request("/api/entries", {
    method: "PUT",
    jar,
    body: { id: created.body.entry.id, mood: "ecstatic", date: "2026-03-01", note: "Even better", tags: ["work"], sleepHours: 8, exerciseMinutes: 60, waterIntake: 9, medication: "", completedActivities: ["walk"] },
  });
  check("update entry → 200", updated.status === 200, `got ${updated.status}`);
  check("mood was updated", updated.body?.entry?.mood === "ecstatic");
  check("note was updated", updated.body?.entry?.note === "Even better");
  check("health metrics were updated", updated.body?.entry?.exerciseMinutes === 60 && updated.body?.entry?.waterIntake === 9);

  console.log("\n\x1b[1mBackup\x1b[0m");
  const backup = await request("/api/backup", { jar });
  check("export backup → 200", backup.status === 200);
  check("backup contains the entry", (backup.body?.backup?.entries ?? []).some((e) => e.id === created.body.entry.id));
  check("backup entries expose the health metrics", backup.body?.backup?.entries?.[0]?.sleepHours === 8);

  const imported = await request("/api/backup/import", {
    method: "POST",
    jar,
    body: { mode: "merge", entries: [{ mood: "neutral", date: "2026-03-02", note: "Imported", tags: ["social"], sleepHours: 6, exerciseMinutes: 0, waterIntake: 5, medication: null, completedActivities: [] }] },
  });
  check("import backup → 200", imported.status === 200, `got ${updated.status}`);
  check("imported one entry", imported.body?.importedCount === 1, JSON.stringify(imported.body));

  const listAfterImport = await request("/api/entries", { jar });
  check("imported entry is visible", (listAfterImport.body?.entries ?? []).some((e) => e.note === "Imported"));
  check("both entries are present", (listAfterImport.body?.entries ?? []).length === 2, `got ${(listAfterImport.body?.entries ?? []).length}`);

  const replaced = await request("/api/backup/import", {
    method: "POST",
    jar,
    body: { mode: "replace", entries: [{ mood: "low", date: "2026-03-03", note: "Only one now", tags: [], sleepHours: null, exerciseMinutes: null, waterIntake: null, medication: null, completedActivities: [] }] },
  });
  check("replace import → 200", replaced.status === 200);
  check("replace imported one entry", replaced.body?.importedCount === 1);

  const listAfterReplace = await request("/api/entries", { jar });
  check("replace left exactly one entry", (listAfterReplace.body?.entries ?? []).length === 1, `got ${(listAfterReplace.body?.entries ?? []).length}`);
  check("replace kept the imported entry", (listAfterReplace.body?.entries ?? [])[0]?.note === "Only one now");

  console.log("\n\x1b[1mCommunity board\x1b[0m");
  const submitted = await request("/api/community/mood", { method: "POST", body: { mood: "good" }, jar: anonymous });
  check("submit community mood → 201", submitted.status === 201, `got ${submitted.status}`);

  const board = await request("/api/community/mood");
  check("read community mood → 200", board.status === 200);
  check("distribution is an array", Array.isArray(board.body?.today?.distribution));
  check("dominant mood is reported", typeof board.body?.today?.dominantMood === "string" || board.body?.today?.dominantMood === null);

  console.log("\n\x1b[1mDelete & logout\x1b[0m");
  // `replace` intentionally makes the imported set the complete set, so the
  // surviving entry is the one that was imported — delete that one.
  const survivingId = (listAfterReplace.body?.entries ?? [])[0]?.id;
  const deleted = await request(`/api/entries?id=${encodeURIComponent(survivingId)}`, { method: "DELETE", jar });
  check("delete entry → 200", deleted.status === 200, `got ${deleted.status}`);

  const listAfterDelete = await request("/api/entries", { jar });
  check("entry was removed", !(listAfterDelete.body?.entries ?? []).some((e) => e.id === survivingId));
  check("the timeline is empty again", (listAfterDelete.body?.entries ?? []).length === 0);

  const logout = await request("/api/logout", { method: "POST", jar });
  check("logout → 200", logout.status === 200);
} finally {
  try {
    await prisma.moodEntry.deleteMany({ where: { user: { email: USER.email } } });
    await prisma.user.deleteMany({ where: { email: USER.email } });
  } catch {
    /* cleanup is best effort */
  }
  await prisma.$disconnect();
  server.kill("SIGTERM");
  await waitForPortFree(PORT);
}

console.log("\n" + "─".repeat(58));
if (failures.length === 0) {
  console.log(`\x1b[32m✔ All ${passed} functional checks passed.\x1b[0m`);
} else {
  console.log(`\x1b[31m✖ ${failures.length} check(s) failed\x1b[0m (${passed} passed)`);
  for (const f of failures) console.log(`   • ${f.name}${f.detail ? ` → ${f.detail}` : ""}`);
  process.exitCode = 1;
}
console.log("─".repeat(58));
