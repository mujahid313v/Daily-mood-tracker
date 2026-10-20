#!/usr/bin/env node
/**
 * End-to-end security verification for Daily Mood Tracker.
 *
 * Boots the production server, exercises every security control over HTTP and
 * cleans up the fixtures it creates.
 *
 *   node scripts/security-check.mjs
 *   BASE_URL=http://localhost:3000 node scripts/security-check.mjs   # use a running server
 *
 * Requires a built application (`npm run build`) and a reachable DATABASE_URL.
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

/* -------------------------------------------------------------------------- */
/* Configuration                                                               */
/* -------------------------------------------------------------------------- */

const PORT = Number(process.env.PORT ?? 3457);
const EXTERNAL_BASE_URL = process.env.BASE_URL ?? null;
const BASE_URL = EXTERNAL_BASE_URL ?? `http://127.0.0.1:${PORT}`;

const RUN_ID = `sectest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const USER_A = { email: `alice.${RUN_ID}@example.com`, password: "Correct-Horse-9" };
const USER_B = { email: `bob.${RUN_ID}@example.com`, password: "Correct-Horse-9" };

const ENTRY_DAY = "2026-01-15";
const ENTRY_DAY_2 = "2026-01-16";

/* -------------------------------------------------------------------------- */
/* Tiny test harness                                                           */
/* -------------------------------------------------------------------------- */

let passed = 0;
const failures = [];
let currentGroup = "";

function group(name) {
  currentGroup = name;
  console.log(`\n\x1b[1m${name}\x1b[0m`);
}

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  \x1b[32mPASS\x1b[0m  ${name}`);
  } else {
    failures.push({ group: currentGroup, name, detail });
    console.log(`  \x1b[31mFAIL\x1b[0m  ${name}${detail ? `  → ${detail}` : ""}`);
  }
}

function checkStatus(name, response, expected) {
  const ok = Array.isArray(expected) ? expected.includes(response.status) : response.status === expected;
  check(name, ok, ok ? "" : `expected ${expected}, got ${response.status} ${response.text.slice(0, 160)}`);
  return ok;
}

/* -------------------------------------------------------------------------- */
/* HTTP helper with a cookie jar                                              */
/* -------------------------------------------------------------------------- */

function createJar() {
  const cookies = new Map();

  return {
    header() {
      return [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
    },
    absorb(response) {
      const raw = response.headers.getSetCookie?.() ?? [];
      for (const cookie of raw) {
        const [pair] = cookie.split(";");
        const separator = pair.indexOf("=");
        if (separator === -1) continue;

        const name = pair.slice(0, separator).trim();
        const value = pair.slice(separator + 1).trim();

        if (value === "") cookies.delete(name);
        else cookies.set(name, value);
      }
    },
    has(name) {
      return cookies.has(name);
    },
    clear() {
      cookies.clear();
    },
  };
}

async function request(path, { method = "GET", body, jar, headers = {} } = {}) {
  const requestHeaders = { ...headers };

  if (body !== undefined) {
    requestHeaders["Content-Type"] = "application/json";
  }

  if (jar) {
    const cookie = jar.header();
    if (cookie) requestHeaders.Cookie = cookie;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });

  if (jar) jar.absorb(response);

  const text = await response.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }

  return { status: response.status, headers: response.headers, body: parsed, text };
}

/* -------------------------------------------------------------------------- */
/* Environment helpers                                                         */
/* -------------------------------------------------------------------------- */

function loadEnv() {
  const envPath = join(projectRoot, ".env");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;

    const key = match[1];
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);

    if (process.env[key] === undefined) process.env[key] = value;
  }
}

/* -------------------------------------------------------------------------- */
/* Server lifecycle                                                            */
/* -------------------------------------------------------------------------- */

let server = null;
let serverExit = null;

async function isPortOpen(port) {
  try {
    await fetch(`http://127.0.0.1:${port}/`, { redirect: "manual" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Waits until nothing answers on the port.
 *
 * Killing a process does not release the listening socket instantly on every
 * platform. Without this wait the next `next start` can fail with
 * EADDRINUSE and the suite would silently keep talking to the *old* server —
 * including its already exhausted rate-limit counters.
 */
async function waitForPortFree(port, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await isPortOpen(port))) return true;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
}

async function waitForServer(timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    // A dead server means the port is taken by something else — bail out.
    if (serverExit !== null) {
      throw new Error(
        `The server exited immediately (code ${serverExit}). Is port ${PORT} already in use?`
      );
    }

    try {
      const response = await fetch(`${BASE_URL}/`, { redirect: "manual" });
      if (response.status < 500) return true;
    } catch {
      // Server not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  return false;
}

async function startServer() {
  if (EXTERNAL_BASE_URL) {
    console.log(`Using the already running server at ${BASE_URL}`);
    return;
  }

  const nextBin = join(projectRoot, "node_modules", "next", "dist", "bin", "next");

  if (!existsSync(join(projectRoot, ".next"))) {
    console.error("\n✖ No production build found. Run `npm run build` first.\n");
    process.exit(1);
  }

  if (!(await waitForPortFree(PORT))) {
    console.error(`\n✖ Port ${PORT} is still in use. Stop the other process and retry.\n`);
    process.exit(1);
  }

  console.log(`Starting the production server on port ${PORT} …`);

  serverExit = null;

  server = spawn(process.execPath, [nextBin, "start", "-p", String(PORT)], {
    cwd: projectRoot,
    env: { ...process.env, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  server.on("exit", (code) => {
    serverExit = code;
  });

  server.stdout.on("data", (chunk) => process.stdout.write(`  [server] ${chunk}`));
  server.stderr.on("data", (chunk) => process.stderr.write(`  [server] ${chunk}`));
}

async function stopServer() {
  if (server && !server.killed) {
    server.kill("SIGTERM");
  }
  server = null;

  if (!EXTERNAL_BASE_URL) {
    await waitForPortFree(PORT);
  }
}

/* -------------------------------------------------------------------------- */
/* Tests                                                                       */
/* -------------------------------------------------------------------------- */

async function run() {
  const prisma = new PrismaClient();

  try {
    await startServer();

    const ready = await waitForServer();
    if (!ready) {
      console.error("\n✖ The server did not become ready in time.\n");
      process.exitCode = 1;
      return;
    }

    console.log(`\nServer ready at ${BASE_URL}\n`);

    const jarA = createJar();
    const jarB = createJar();
    const adminJar = createJar();

    /* ------------------------------------------------------------------ */
    group("1. Unauthenticated requests are rejected");

    checkStatus("GET  /api/entries        → 401", await request("/api/entries"), 401);
    checkStatus("GET  /api/me             → 401", await request("/api/me"), 401);
    checkStatus("POST /api/entries        → 401", await request("/api/entries", { method: "POST", body: { mood: "good", date: ENTRY_DAY } }), 401);
    checkStatus("PUT  /api/entries        → 401", await request("/api/entries", { method: "PUT", body: { id: "x", mood: "good", date: ENTRY_DAY } }), 401);
    checkStatus("DEL  /api/entries        → 401", await request("/api/entries?id=x", { method: "DELETE" }), 401);
    checkStatus("GET  /api/backup         → 401", await request("/api/backup"), 401);
    checkStatus("POST /api/backup/import  → 401", await request("/api/backup/import", { method: "POST", body: { mode: "merge", entries: [] } }), 401);

    const meUnauth = await request("/api/me");
    check("401 body does not leak internals", !/prisma|P20\d\d|at \w+ \(/i.test(meUnauth.text), meUnauth.text.slice(0, 120));

    /* ------------------------------------------------------------------ */
    group("2. Input validation (400 for malformed payloads)");

    const badEmail = await request("/api/register", { method: "POST", body: { email: "not-an-email", password: "longenough1" } });
    checkStatus("register with invalid email      → 400", badEmail, 400);
    check("invalid email reports a field error", Array.isArray(badEmail.body?.details) && badEmail.body.details.length > 0);

    const shortPassword = await request("/api/register", { method: "POST", body: { email: USER_A.email, password: "short" } });
    checkStatus("register with password < 8 chars  → 400", shortPassword, 400);

    /* ------------------------------------------------------------------ */
    group("3. Registration + session cookie");

    const registerA = await request("/api/register", { method: "POST", body: { email: USER_A.email, password: USER_A.password, name: "Alice" }, jar: jarA });
    checkStatus("register user A                   → 201", registerA, 201);
    check("register response has no password field", registerA.body?.user && registerA.body.user.password === undefined);

    const registerB = await request("/api/register", { method: "POST", body: { email: USER_B.email, password: USER_B.password, name: "Bob" }, jar: jarB });
    checkStatus("register user B                   → 201", registerB, 201);

    const setCookieA = registerA.headers.getSetCookie?.() ?? [];
    const sessionCookieA = setCookieA.find((c) => c.startsWith("mood_session="));
    check("session cookie is set", Boolean(sessionCookieA), setCookieA.join(" | ").slice(0, 160));
    check("session cookie is HttpOnly", Boolean(sessionCookieA?.includes("HttpOnly")));
    check("session cookie is SameSite=Lax", Boolean(sessionCookieA?.includes("SameSite=Lax")));
    check("session cookie has an expiry (Max-Age)", Boolean(sessionCookieA?.includes("Max-Age=")));
    check("session cookie value is not the password", !sessionCookieA?.includes(USER_A.password));

    /* ------------------------------------------------------------------ */
    group("4. Login: generic errors + no account enumeration");

    const wrongPassword = await request("/api/login", { method: "POST", body: { email: USER_A.email, password: "definitely-wrong" } });
    checkStatus("login with wrong password         → 401", wrongPassword, 401);
    check("wrong password message is generic", wrongPassword.body?.error === "Invalid email or password", wrongPassword.body?.error);

    const unknownEmail = await request("/api/login", { method: "POST", body: { email: `ghost.${RUN_ID}@example.com`, password: "whatever123" } });
    checkStatus("login with unknown email          → 401", unknownEmail, 401);
    check("unknown email message is identical", unknownEmail.body?.error === wrongPassword.body?.error, `${unknownEmail.body?.error} vs ${wrongPassword.body?.error}`);

    const loginA = await request("/api/login", { method: "POST", body: { email: USER_A.email, password: USER_A.password }, jar: jarA });
    checkStatus("login user A                      → 200", loginA, 200);
    check("login response has no password field", loginA.body?.user && loginA.body.user.password === undefined);

    const loginB = await request("/api/login", { method: "POST", body: { email: USER_B.email, password: USER_B.password }, jar: jarB });
    checkStatus("login user B                      → 200", loginB, 200);

    const meA = await request("/api/me", { jar: jarA });
    checkStatus("GET  /api/me with session         → 200", meA, 200);
    check("GET  /api/me never returns a password hash", !meA.text.includes("$2a$") && !meA.text.includes("$2b$") && meA.body?.user?.password === undefined);

    /* ------------------------------------------------------------------ */
    group("5. Validation on the entries API");

    const badMood = await request("/api/entries", { method: "POST", body: { mood: "happy", date: ENTRY_DAY }, jar: jarA });
    checkStatus("entry with invalid mood           → 400", badMood, 400);

    const badDate = await request("/api/entries", { method: "POST", body: { mood: "good", date: "20-10-2026" }, jar: jarA });
    checkStatus("entry with invalid date format    → 400", badDate, 400);

    const impossibleDate = await request("/api/entries", { method: "POST", body: { mood: "good", date: "2026-02-31" }, jar: jarA });
    checkStatus("entry with impossible date        → 400", impossibleDate, 400);

    const longNote = await request("/api/entries", { method: "POST", body: { mood: "good", date: ENTRY_DAY, note: "x".repeat(501) }, jar: jarA });
    checkStatus("entry with 501 character note      → 400", longNote, 400);

    const noInternals = ![badMood, badDate, longNote].some((r) => /prisma|P20\d\d|at \w+ \(/i.test(r.text));
    check("400 responses do not leak internals", noInternals);

    /* ------------------------------------------------------------------ */
    group("6. IDOR: users cannot reach each other's data");

    const entryA = await request("/api/entries", { method: "POST", body: { mood: "good", date: ENTRY_DAY, note: "Alice private note" }, jar: jarA });
    checkStatus("user A creates an entry            → 201", entryA, 201);
    const entryB = await request("/api/entries", { method: "POST", body: { mood: "low", date: ENTRY_DAY, note: "Bob private note" }, jar: jarB });
    checkStatus("user B creates an entry            → 201", entryB, 201);

    const listA = await request("/api/entries", { jar: jarA });
    const listB = await request("/api/entries", { jar: jarB });

    const idsA = (listA.body?.entries ?? []).map((e) => e.id);
    const idsB = (listB.body?.entries ?? []).map((e) => e.id);

    check("user A only sees their own entries", idsA.length === 1 && idsA[0] === entryA.body.entry.id, `saw ${idsA.length}`);
    check("user B only sees their own entries", idsB.length === 1 && idsB[0] === entryB.body.entry.id, `saw ${idsB.length}`);
    check("user A cannot see user B's note", !listA.text.includes("Bob private note"));
    check("user B cannot see user A's note", !listB.text.includes("Alice private note"));

    // Tampering with the body must not change the owner.
    const tampered = await request("/api/entries", {
      method: "POST",
      body: { mood: "good", date: ENTRY_DAY_2, note: "planted", userId: loginB.body.user.id },
      jar: jarA,
    });
    checkStatus("POST with a forged userId in body  → 201", tampered, 201);

    const listA2 = await request("/api/entries", { jar: jarA });
    const listB2 = await request("/api/entries", { jar: jarB });

    check("forged userId did not write into B's list", !(listB2.body?.entries ?? []).some((e) => e.note === "planted"));
    check("forged userId wrote into A's list", (listA2.body?.entries ?? []).some((e) => e.note === "planted"));

    // Tampering with the query string must not change the owner either.
    const listA3 = await request(`/api/entries?userId=${encodeURIComponent(loginB.body.user.id)}`, { jar: jarA });
    check("GET ?userId=… is ignored", !(listA3.body?.entries ?? []).some((e) => e.note === "Bob private note"));

    const putForeign = await request("/api/entries", { method: "PUT", body: { id: entryB.body.entry.id, mood: "stressed", date: ENTRY_DAY }, jar: jarA });
    checkStatus("PUT on another user's entry       → 403", putForeign, 403);

    const deleteForeign = await request(`/api/entries?id=${encodeURIComponent(entryB.body.entry.id)}`, { method: "DELETE", jar: jarA });
    checkStatus("DELETE on another user's entry    → 403", deleteForeign, 403);

    const listB3 = await request("/api/entries", { jar: jarB });
    check("user B's entry survived the attack", (listB3.body?.entries ?? []).some((e) => e.id === entryB.body.entry.id));

    /* ------------------------------------------------------------------ */
    group("7. One entry per user per day (unique constraint)");

    const duplicate = await request("/api/entries", { method: "POST", body: { mood: "good", date: ENTRY_DAY }, jar: jarA });
    checkStatus("second entry for the same day     → 409", duplicate, 409);
    check("409 message does not leak Prisma internals", !/P20\d\d|prisma/i.test(duplicate.text), duplicate.text.slice(0, 120));

    /* ------------------------------------------------------------------ */
    group("8. Admin dashboard protection");

    const adminKey = process.env.ADMIN_DASHBOARD_KEY ?? "";
    check("ADMIN_DASHBOARD_KEY is configured", adminKey.length > 0);

    checkStatus("summary without a key              → 401", await request("/api/admin/summary"), 401);
    checkStatus("summary with a wrong key          → 401", await request("/api/admin/summary", { headers: { Authorization: "Bearer definitely-wrong" } }), 401);
    checkStatus("admin session with a wrong key     → 401", await request("/api/admin/session", { method: "POST", body: { key: "definitely-wrong" } }), 401);

    const adminLogin = await request("/api/admin/session", { method: "POST", body: { key: adminKey }, jar: adminJar });
    checkStatus("admin session with the right key   → 200", adminLogin, 200);

    const adminSetCookie = adminLogin.headers.getSetCookie?.() ?? [];
    const adminCookie = adminSetCookie.find((c) => c.startsWith("mood_admin="));
    check("admin cookie is HttpOnly", Boolean(adminCookie?.includes("HttpOnly")));
    check("admin cookie has a short expiry", Boolean(adminCookie?.includes("Max-Age=900")), adminCookie ?? "missing");
    check("admin key is not stored in the browser", !adminLogin.text.includes(adminKey) && adminLogin.text.length < 200);

    checkStatus("summary with the admin cookie     → 200", await request("/api/admin/summary", { jar: adminJar }), 200);
    checkStatus("summary with a Bearer key         → 200", await request("/api/admin/summary", { headers: { Authorization: `Bearer ${adminKey}` } }), 200);

    const adminPage = await fetch(`${BASE_URL}/admin`);
    const adminHtml = await adminPage.text();
    check("admin page does not use localStorage for the key", !adminHtml.includes("mood-admin-token"));

    /* ------------------------------------------------------------------ */
    group("9. Rate limiting");

    // Restart the server so the in-memory limiter starts from zero and the
    // exact threshold can be asserted deterministically.
    if (!EXTERNAL_BASE_URL) {
      await stopServer();
      await startServer();
      const rateLimitReady = await waitForServer();
      check("server restarted for the rate limit test", rateLimitReady);
    }

    const statuses = [];
    let blocked = null;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await request("/api/login", {
        method: "POST",
        body: { email: `ratelimit.${RUN_ID}@example.com`, password: "wrong-password" },
      });
      statuses.push(response.status);
      if (response.status === 429) {
        blocked = response;
        break;
      }
    }

    const firstBlocked = statuses.indexOf(429);
    check("repeated login attempts return 429", firstBlocked !== -1, `statuses: ${statuses.join(", ")}`);

    if (!EXTERNAL_BASE_URL) {
      check(
        "exactly 5 attempts are allowed before the limiter kicks in",
        firstBlocked === 5,
        `expected the 6th attempt to be blocked, statuses: ${statuses.join(", ")}`
      );
    }

    check(
      "the 429 response carries a Retry-After header",
      Boolean(blocked?.headers.get("retry-after")),
      blocked ? "missing header" : "no 429 response captured"
    );

    /* ------------------------------------------------------------------ */
    group("10. Security headers");

    const home = await fetch(`${BASE_URL}/`);
    const csp = home.headers.get("content-security-policy") ?? "";
    check("Content-Security-Policy is present", csp.length > 0);
    check("CSP forbids framing (frame-ancestors 'none')", csp.includes("frame-ancestors 'none'"));
    check("CSP restricts default-src", csp.includes("default-src 'self'"));
    check("X-Frame-Options is DENY", home.headers.get("x-frame-options") === "DENY");
    check("X-Content-Type-Options is nosniff", home.headers.get("x-content-type-options") === "nosniff");
    check("Referrer-Policy is set", Boolean(home.headers.get("referrer-policy")));
    check("Permissions-Policy is set", Boolean(home.headers.get("permissions-policy")));

    /* ------------------------------------------------------------------ */
    group("11. Logout invalidates the session");

    const logout = await request("/api/logout", { method: "POST", jar: jarA });
    checkStatus("POST /api/logout                  → 200", logout, 200);
    const cleared = (logout.headers.getSetCookie?.() ?? []).find((c) => c.startsWith("mood_session="));
    check("logout expires the session cookie", Boolean(cleared?.includes("Max-Age=0")), cleared ?? "missing");
    jarA.clear();
    checkStatus("GET  /api/me after logout         → 401", await request("/api/me", { jar: jarA }), 401);
  } finally {
    // Clean up the fixtures.
    try {
      await prisma.moodEntry.deleteMany({
        where: { user: { email: { in: [USER_A.email, USER_B.email] } } },
      });
      await prisma.user.deleteMany({
        where: { email: { in: [USER_A.email, USER_B.email] } },
      });
      console.log("\nCleaned up the test users.");
    } catch (error) {
      console.error("Cleanup failed:", error?.message ?? error);
    }

    await prisma.$disconnect();
    await stopServer();
  }

  /* -------------------------------------------------------------------- */
  console.log("\n" + "─".repeat(62));
  if (failures.length === 0) {
    console.log(`\x1b[32m✔ All ${passed} security checks passed.\x1b[0m`);
  } else {
    console.log(`\x1b[31m✖ ${failures.length} check(s) failed\x1b[0m (${passed} passed)`);
    for (const failure of failures) {
      console.log(`   • [${failure.group}] ${failure.name}${failure.detail ? ` → ${failure.detail}` : ""}`);
    }
    process.exitCode = 1;
  }
  console.log("─".repeat(62));
}

loadEnv();
await run();
