#!/usr/bin/env node
/**
 * Браузерный QA production-контура (T-009): мобильный/десктопный viewport,
 * горизонтальный скролл, ошибки консоли, 4xx/5xx ресурсов, axe-core WCAG 2.1 A/AA,
 * cookie-баннер и согласие на аналитику.
 *
 * Требования:
 *   - установленный Google Chrome (или CHROME_PATH=/path/to/chrome);
 *   - Node 22+ (встроенный WebSocket);
 *   - сеть до cdn.jsdelivr.net для axe-core или локальный AXE_PATH=/tmp/axe.min.js.
 *
 * Запуск:
 *   node scripts/qa/browser-a11y.mjs
 *   node scripts/qa/browser-a11y.mjs --base https://app.axiona.world --out docs/12-release/reports/screenshots/production-qa-2026-11-10
 *
 * Скриншоты и JSON складываются в --out (по умолчанию /tmp/axiona-browser-qa).
 * Exit code: 0 — нет критичных нарушений/ошибок, 1 — есть.
 */

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const BASE = argValue("--base", process.env.QA_BASE_URL ?? "https://app.axiona.world").replace(/\/$/, "");
const OUT = argValue("--out", "/tmp/axiona-browser-qa");
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = Number(process.env.CHROME_DEBUG_PORT ?? 9333);
const VIEWPORTS = [
  { name: "mobile", width: 360, height: 800, mobile: true },
  { name: "desktop", width: 1280, height: 900, mobile: false },
];
const PAGES = [
  { path: "/", name: "home" },
  { path: "/professions", name: "professions" },
  { path: "/professions/uxui", name: "profession-uxui" },
  { path: "/login", name: "login" },
  { path: "/register", name: "register" },
  { path: "/legal/privacy", name: "legal-privacy" },
  { path: "/feedback", name: "feedback" },
];
const AXE_RUN_OPTIONS = {
  runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
  resultTypes: ["violations"],
};

mkdirSync(OUT, { recursive: true });
const USER_DATA_DIR = join(tmpdir(), `axiona-qa-chrome-${Date.now()}`);

// ─── axe-core ────────────────────────────────────────────────────────────────
let axeSource = null;
try {
  const localAxe = process.env.AXE_PATH ?? "/tmp/axe.min.js";
  if (existsSync(localAxe)) {
    axeSource = readFileSync(localAxe, "utf8");
  } else {
    const response = await fetch("https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js", { signal: AbortSignal.timeout(20_000) });
    if (response.ok) axeSource = await response.text();
  }
} catch {
  axeSource = null;
}

// ─── Chrome + CDP ────────────────────────────────────────────────────────────
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    // Без --no-sandbox рендерер падает в окружениях с песочницей (CI/DSH): Inspector.targetCrashed.
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--hide-scrollbars",
    "--mute-audio",
    "--window-size=1280,900",
    "about:blank",
  ],
  { stdio: "ignore" },
);

async function waitForChrome() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/version`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return response.json();
    } catch {
      // ещё стартует
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Chrome не поднялся на порту отладки");
}

let browserVersion;
try {
  browserVersion = await waitForChrome();
} catch (error) {
  chrome.kill();
  console.error(String(error));
  process.exit(1);
}

function createCdpClient(wsUrl) {
  const socket = new WebSocket(wsUrl);
  const pending = new Map();
  const listeners = new Map();
  let nextId = 1;
  const ready = new Promise((resolve, reject) => {
    socket.addEventListener("open", () => resolve());
    socket.addEventListener("error", (event) => reject(event.error ?? new Error("WS error")));
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(`${message.error.message} (${message.error.code})`));
      else resolve(message.result);
      return;
    }
    if (message.method) {
      for (const handler of listeners.get(message.method) ?? []) handler(message.params, message.sessionId);
    }
  });
  return {
    ready,
    send(method, params = {}, sessionId = undefined) {
      return new Promise((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    on(method, handler) {
      if (!listeners.has(method)) listeners.set(method, new Set());
      listeners.get(method).add(handler);
      return () => listeners.get(method)?.delete(handler);
    },
    close() {
      socket.close();
    },
  };
}

const cdp = createCdpClient(browserVersion.webSocketDebuggerUrl);
await cdp.ready;

// ─── Проверки ────────────────────────────────────────────────────────────────
const findings = [];

async function createPage(browserContextId) {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank", browserContextId });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  await cdp.send("Page.enable", {}, sessionId);
  await cdp.send("Runtime.enable", {}, sessionId);
  await cdp.send("Log.enable", {}, sessionId);
  await cdp.send("Network.enable", {}, sessionId);
  return { targetId, sessionId };
}

function waitForEvent(sessionId, method, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      off();
      reject(new Error(`таймаут ${method}`));
    }, timeoutMs);
    const off = cdp.on(method, (params, eventSessionId) => {
      if (eventSessionId !== sessionId) return;
      clearTimeout(timer);
      off();
      resolve(params);
    });
  });
}

async function evaluate(sessionId, expression, options = {}) {
  const { awaitPromise = false, timeout = 30_000 } = options;
  const result = await cdp.send(
    "Runtime.evaluate",
    { expression, returnByValue: true, awaitPromise, timeout, userGesture: true },
    sessionId,
  );
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  }
  return result.result?.value;
}

async function runAxe(sessionId) {
  if (!axeSource) return null;
  await evaluate(sessionId, `${axeSource}\n//# sourceURL=axe.min.js`);
  return evaluate(
    sessionId,
    `axe.run(document, ${JSON.stringify(AXE_RUN_OPTIONS)}).then((result) => result.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.length,
      targets: violation.nodes.slice(0, 3).map((node) => node.target.join(" ")),
    })))`,
    { awaitPromise: true },
  );
}

async function loadPage(sessionId, url) {
  const errors = { console: [], exceptions: [], log: [], httpErrors: [], failed: [] };
  const requestUrls = new Map();
  const offs = [
    cdp.on("Runtime.consoleAPICalled", (params, eventSessionId) => {
      if (eventSessionId !== sessionId || params.type !== "error") return;
      errors.console.push(params.args.map((arg) => arg.value ?? arg.description ?? arg.type).join(" "));
    }),
    cdp.on("Runtime.exceptionThrown", (params, eventSessionId) => {
      if (eventSessionId !== sessionId) return;
      errors.exceptions.push(params.exceptionDetails.exception?.description ?? params.exceptionDetails.text);
    }),
    cdp.on("Log.entryAdded", (params, eventSessionId) => {
      if (eventSessionId !== sessionId || params.entry.level !== "error") return;
      errors.log.push(`${params.entry.source}: ${params.entry.text}`);
    }),
    cdp.on("Network.requestWillBeSent", (params, eventSessionId) => {
      if (eventSessionId !== sessionId) return;
      requestUrls.set(params.requestId, params.request.url);
    }),
    cdp.on("Network.responseReceived", (params, eventSessionId) => {
      if (eventSessionId !== sessionId) return;
      if (params.response.status >= 400 && params.response.url.startsWith(BASE)) {
        errors.httpErrors.push(`${params.response.status} ${params.response.url}`);
      }
    }),
    cdp.on("Network.loadingFailed", (params, eventSessionId) => {
      if (eventSessionId !== sessionId || params.canceled) return;
      errors.failed.push(`${requestUrls.get(params.requestId) ?? params.requestId}: ${params.errorText}`);
    }),
  ];
  const loaded = waitForEvent(sessionId, "Page.loadEventFired", 25_000).catch(() => null);
  await cdp.send("Page.navigate", { url }, sessionId);
  await loaded;
  await new Promise((resolve) => setTimeout(resolve, 1500));
  offs.forEach((off) => off());
  return errors;
}

async function captureScreenshot(sessionId, filePath) {
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }, sessionId);
  writeFileSync(filePath, Buffer.from(data, "base64"));
}

async function checkConsent(sessionId, mode = "necessary") {
  const label = mode === "all" ? "Принять аналитику" : "Только необходимое";
  const before = await evaluate(
    sessionId,
    `({
      banner: Boolean(document.querySelector(".consent-banner")),
      text: document.querySelector(".consent-banner")?.innerText ?? "",
      cookie: document.cookie,
    })`,
  );
  const eventsBefore = await evaluate(sessionId, `performance.getEntriesByType("resource").filter((e) => e.name.includes("/api/events")).length`);
  const clicked = await evaluate(
    sessionId,
    `(() => {
      const label = ${JSON.stringify(label)};
      const button = [...document.querySelectorAll(".consent-banner button")].find((item) => item.textContent.includes(label));
      if (!button) return false;
      button.click();
      return true;
    })()`,
  );
  await new Promise((resolve) => setTimeout(resolve, mode === "all" ? 1500 : 600));
  const after = await evaluate(
    sessionId,
    `({
      banner: Boolean(document.querySelector(".consent-banner")),
      cookie: document.cookie,
      events: performance.getEntriesByType("resource").filter((e) => e.name.includes("/api/events")).length,
    })`,
  );
  return { mode, before, eventsBefore, clicked, after };
}

const summary = [];

// ─── Прогон ──────────────────────────────────────────────────────────────────
for (const viewport of VIEWPORTS) {
  const { browserContextId } = await cdp.send("Target.createBrowserContext", { disposeOnDetach: false });
  const page = await createPage(browserContextId);
  await cdp.send(
    "Emulation.setDeviceMetricsOverride",
    { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.mobile },
    page.sessionId,
  );

  for (const item of PAGES) {
    const url = `${BASE}${item.path}`;
    const errors = await loadPage(page.sessionId, url);
    const layout = await evaluate(
      page.sessionId,
      `({
        title: document.title,
        h1: document.querySelector("h1")?.innerText ?? null,
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        imagesWithoutAlt: [...document.images].filter((image) => !image.hasAttribute("alt")).length,
        buttonsWithoutName: [...document.querySelectorAll("button")].filter((button) => !(button.innerText.trim() || button.getAttribute("aria-label") || button.getAttribute("title"))).length,
        nestedAnchors: document.querySelectorAll("a a").length,
        lang: document.documentElement.lang,
      })`,
    );
    const overflow = Math.max(layout.scrollWidth, layout.bodyWidth) > layout.innerWidth + 1;
    const violations = await runAxe(page.sessionId).catch((error) => null);
    const screenshot = `${viewport.name}-${item.name}.png`;
    await captureScreenshot(page.sessionId, join(OUT, screenshot));

    const consent = item.name === "home" ? await checkConsent(page.sessionId, viewport.name === "mobile" ? "necessary" : "all") : null;

    const seriousViolations = (violations ?? []).filter((violation) => violation.impact === "critical" || violation.impact === "serious");
    const result = {
      viewport: viewport.name,
      page: item.name,
      url,
      title: layout.title,
      h1: layout.h1,
      overflow,
      innerWidth: layout.innerWidth,
      scrollWidth: Math.max(layout.scrollWidth, layout.bodyWidth),
      imagesWithoutAlt: layout.imagesWithoutAlt,
      buttonsWithoutName: layout.buttonsWithoutName,
      nestedAnchors: layout.nestedAnchors,
      lang: layout.lang,
      consoleErrors: errors.console,
      exceptions: errors.exceptions,
      logErrors: errors.log,
      httpErrors: [...new Set(errors.httpErrors)],
      failedRequests: [...new Set(errors.failed)],
      axe: violations,
      seriousViolations: seriousViolations.length,
      screenshot: join(OUT, screenshot),
      consent,
    };
    summary.push(result);

    const failed = Boolean(errors.console.length || errors.exceptions.length || errors.httpErrors.length || seriousViolations.length || overflow);
    console.error(
      `${failed ? "FAIL" : "ok  "} ${viewport.name} ${item.path} — console:${errors.console.length} exceptions:${errors.exceptions.length} http4xx:${errors.httpErrors.length} axe serious:${seriousViolations.length} overflow:${overflow}`,
    );
  }

  await cdp.send("Target.disposeBrowserContext", { browserContextId }).catch(() => undefined);
}

// ─── Отчёт ───────────────────────────────────────────────────────────────────
writeFileSync(join(OUT, "browser-qa.json"), JSON.stringify({ base: BASE, generatedAt: new Date().toISOString(), chrome: browserVersion["Browser"], summary }, null, 2));

console.log(`\n# Браузерный QA — ${BASE}`);
console.log(`\nChrome: ${browserVersion["Browser"]}  ·  страниц: ${summary.length}  ·  axe-core: ${axeSource ? "подключён (WCAG 2.1 A/AA)" : "НЕ загружен"}\n`);
console.log("| Viewport | Страница | H1 | Ошибки консоли | 4xx/5xx | axe serious/critical | Горизонтальный скролл | HTML | Скриншот |");
console.log("|---|---|---|---|---|---|---|---|---|");
for (const item of summary) {
  const axeCount = item.seriousViolations;
  console.log(
    `| ${item.viewport} | ${item.page} | ${item.h1 ?? "—"} | ${item.consoleErrors.length + item.exceptions.length + item.logErrors.length} | ${item.httpErrors.length} | ${axeCount} | ${item.overflow ? `да (${item.scrollWidth}px)` : "нет"} | ${item.nestedAnchors > 0 ? `вложенные <a>: ${item.nestedAnchors}` : "—"} | [${item.screenshot.split("/").pop()}](${item.screenshot}) |`,
  );
}

const violationsById = new Map();
for (const item of summary) {
  for (const violation of item.axe ?? []) {
    const key = `${violation.id}:${violation.impact}`;
    if (!violationsById.has(key)) violationsById.set(key, { ...violation, pages: [] });
    violationsById.get(key).pages.push(`${item.viewport} ${item.page} (${violation.nodes} узл.)`);
  }
}
if (violationsById.size) {
  console.log("\n## Нарушения доступности\n");
  console.log("| Правило | Влияние | Описание | Где |");
  console.log("|---|---|---|---|");
  for (const violation of [...violationsById.values()].sort((a, b) => (a.impact === "critical" ? -1 : 1))) {
    console.log(`| ${violation.id} | ${violation.impact} | ${violation.help} | ${violation.pages.join("; ")} |`);
  }
}

const consentRuns = summary.filter((item) => item.page === "home" && item.consent);
for (const run of consentRuns) {
  const consent = run.consent;
  console.log("\n## Cookie-баннер и согласие\n");
  console.log(`- баннер на первом визите: ${consent.before.banner ? "есть" : "НЕТ"}; текст: «${(consent.before.text ?? "").replace(/\s+/g, " ").slice(0, 160)}…»`);
  console.log(`- [${run.viewport}] баннер: ${consent.before.banner ? "есть" : "НЕТ"}; кнопка нажата: ${consent.clicked ? "да" : "НЕТ"}`);
  console.log(`- [${run.viewport}] cookie после решения: ${/axiona_consent=(necessary|all)/.exec(consent.after.cookie)?.[0] ?? (consent.after.cookie || "нет")}`);
  console.log(`- [${run.viewport}] баннер после решения: ${consent.after.banner ? "остался" : "скрыт"}`);
  console.log(`- [${run.viewport}] запросы /api/events до согласия: ${consent.eventsBefore}; после решения: ${consent.after.events}`);
}

const problems = summary.filter(
  (item) => item.consoleErrors.length || item.exceptions.length || item.httpErrors.length || item.seriousViolations || item.overflow,
);
console.log(`\nИтог: ${summary.length - problems.length}/${summary.length} страниц без критичных проблем. JSON и скриншоты: ${OUT}`);

chrome.kill();
await new Promise((resolve) => setTimeout(resolve, 500));
try {
  rmSync(USER_DATA_DIR, { recursive: true, force: true, maxRetries: 5 });
} catch {
  // профиль Chrome мог ещё не закрыться — не мешает результату
}
process.exit(problems.length ? 1 : 0);
