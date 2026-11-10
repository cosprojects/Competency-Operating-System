#!/usr/bin/env node
/**
 * Production smoke QA для контура app.axiona.world (T-009).
 *
 * Проверяет только чтение и негативные (невалидные) запросы: реальные сохранения,
 * отзывы и входы не создаются. Регистрация закрыта — запрос ссылки для несуществующего
 * email проверяется как «тихий 200», токен при этом не создаётся.
 *
 * Запуск:
 *   node scripts/qa/production-smoke.mjs
 *   node scripts/qa/production-smoke.mjs --base https://app.axiona.world --json /tmp/qa.json
 *
 * Exit code: 0 — нет FAIL, 1 — есть FAIL (WARN не мешает).
 * Зависимостей нет: только встроенный fetch (Node 20+).
 */

const args = process.argv.slice(2);
function argValue(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

const BASE = argValue("--base", process.env.QA_BASE_URL ?? "https://app.axiona.world").replace(/\/$/, "");
const BASE_ORIGIN = new URL(BASE).origin;
const JSON_OUT = argValue("--json", null);
const TIMEOUT_MS = 20_000;

const results = [];

function record(group, id, title, expect, status, detail, ms) {
  results.push({ group, id, title, expect, status, detail, ms });
}

function truncate(value, max = 160) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

async function request(path, options = {}) {
  const { method = "GET", headers = {}, body, redirect = "manual", url = null } = options;
  const target = url ?? (path.startsWith("http") ? path : `${BASE}${path}`);
  const startedAt = Date.now();
  let response;
  try {
    response = await fetch(target, {
      method,
      headers,
      body,
      redirect,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    return { error, ms: Date.now() - startedAt, url: target };
  }
  const text = await response.text().catch(() => "");
  return { response, text, ms: Date.now() - startedAt, url: target };
}

function fullHeaders(response) {
  const map = {};
  for (const [key, value] of response.headers.entries()) map[key.toLowerCase()] = value;
  return map;
}

async function check(group, id, title, expect, run) {
  try {
    const outcome = await run();
    const { status, detail } = typeof outcome === "string" ? { status: "PASS", detail: outcome } : outcome;
    record(group, id, title, expect, status, detail, outcome?.ms);
  } catch (error) {
    record(group, id, title, expect, "FAIL", error instanceof Error ? error.message : String(error));
  }
}

function expectStatus(result, expected) {
  if (result.error) throw new Error(`сетевая ошибка: ${result.error.message}`);
  const actual = result.response.status;
  const allowed = Array.isArray(expected) ? expected : [expected];
  return { actual, allowed, ok: allowed.includes(actual) };
}

function page(path, { marker = null, title = null } = {}) {
  return async () => {
    const result = await request(path);
    const { actual, allowed, ok } = expectStatus(result, 200);
    if (!ok) return { status: "FAIL", detail: `HTTP ${actual}, ожидался ${allowed.join("/")}`, ms: result.ms };
    const notes = [`HTTP 200, ${(result.text.length / 1024).toFixed(1)} КБ, ${result.ms} мс`];
    if (marker && !result.text.includes(marker)) {
      notes.push(`нет маркера «${marker}»`);
      return { status: "FAIL", detail: notes.join("; "), ms: result.ms };
    }
    if (title && !new RegExp(title, "i").test(result.text)) {
      notes.push(`нет заголовка /${title}/`);
      return { status: "FAIL", detail: notes.join("; "), ms: result.ms };
    }
    return { status: "PASS", detail: notes.join("; "), ms: result.ms };
  };
}

function redirectToLogin(path, expectedReturnTo) {
  return async () => {
    const result = await request(path);
    if (result.error) throw new Error(`сетевая ошибка: ${result.error.message}`);
    const location = result.response.headers.get("location") ?? "";
    const status = result.response.status;
    if (![302, 303, 307, 308].includes(status)) {
      return { status: "FAIL", detail: `HTTP ${status}, ожидался redirect`, ms: result.ms };
    }
    if (!location.startsWith("/login")) {
      return { status: "FAIL", detail: `redirect на ${location || "—"}, ожидался /login`, ms: result.ms };
    }
    if (expectedReturnTo && !location.includes(encodeURIComponent(expectedReturnTo))) {
      return { status: "FAIL", detail: `returnTo не сохранён: ${location}`, ms: result.ms };
    }
    return { status: "PASS", detail: `${status} → ${location}`, ms: result.ms };
  };
}

const JSON_HEADERS = { "content-type": "application/json", origin: BASE_ORIGIN, "user-agent": "axiona-qa-smoke/1.0" };

async function postApi(path, { body = "{}", headers = JSON_HEADERS } = {}) {
  return request(path, { method: "POST", headers, body });
}

// ─────────────────────────────────────────────────────────────────────────────
// A. Публичная доступность
// ─────────────────────────────────────────────────────────────────────────────
await check("Доступность", "QA-01", "GET /", "200, HTML, маркер «Профессии»", page("/", { marker: "Профессии" }));
await check("Доступность", "QA-02", "GET /professions", "200, маркер «Профессии»", page("/professions", { marker: "Профессии" }));
await check("Доступность", "QA-03", "GET /professions/uxui", "200, страница профессии", page("/professions/uxui", { title: "UX" }));
await check("Доступность", "QA-04", "GET /competencies/ux-design-thinking", "307 на профессию с ?competency=", async () => {
  const result = await request("/competencies/ux-design-thinking");
  if (result.error) throw new Error(result.error.message);
  const status = result.response.status;
  const location = result.response.headers.get("location") ?? "";
  if (status !== 307 || !location.includes("?competency=ux-design-thinking")) {
    return { status: "FAIL", detail: `HTTP ${status} → ${location || "—"}`, ms: result.ms };
  }
  return { status: "PASS", detail: `307 → ${location}`, ms: result.ms };
});
await check("Доступность", "QA-05", "GET /canvas", "307 на /professions", async () => {
  const result = await request("/canvas");
  if (result.error) throw new Error(result.error.message);
  const location = result.response.headers.get("location") ?? "";
  const ok = result.response.status === 307 && location.endsWith("/professions");
  return { status: ok ? "PASS" : "FAIL", detail: `HTTP ${result.response.status} → ${location || "—"}`, ms: result.ms };
});
await check("Доступность", "QA-06", "GET /login", "200, форма входа", page("/login", { marker: "Войти" }));
await check("Доступность", "QA-07", "GET /register", "200: форма регистрации или состояние «закрытая Beta»", async () => {
  const result = await request("/register");
  if (result.error) throw new Error(`сетевая ошибка: ${result.error.message}`);
  const status = result.response.status;
  if (status !== 200) return { status: "FAIL", detail: `HTTP ${status}, ожидался 200`, ms: result.ms };
  const open = result.text.includes("Создай аккаунт");
  const closed = result.text.includes("закрытой Beta") || result.text.includes("приглашени");
  return {
    status: open || closed ? "PASS" : "FAIL",
    detail: `HTTP 200, режим: ${closed ? "закрытая Beta (по приглашениям)" : "открытая регистрация"}`,
    ms: result.ms,
  };
});
await check("Доступность", "QA-08", "GET /feedback", "200, форма отзыва", page("/feedback", { marker: "Обратная связь" }));
await check("Доступность", "QA-09", "GET /legal/privacy", "200, политика", page("/legal/privacy", { marker: "Политика конфиденциальности" }));
await check("Доступность", "QA-10", "GET /legal/terms", "200, условия", page("/legal/terms", { marker: "Условия использования" }));
await check("Доступность", "QA-11", "GET /legal/cookies", "200, cookie", page("/legal/cookies", { marker: "Cookie" }));
await check("Доступность", "QA-12", "GET /auth/link-invalid", "200, экран недействительной ссылки", page("/auth/link-invalid", { marker: "ссылк" }));
await check("Доступность", "QA-13", "GET /api/health", "200, JSON ok + db ok", async () => {
  const result = await request("/api/health");
  if (result.error) throw new Error(result.error.message);
  if (result.response.status !== 200) return { status: "FAIL", detail: `HTTP ${result.response.status}`, ms: result.ms };
  let body;
  try {
    body = JSON.parse(result.text);
  } catch {
    return { status: "FAIL", detail: "ответ не JSON", ms: result.ms };
  }
  const ok = body.ok === true && body.db === "ok";
  return { status: ok ? "PASS" : "FAIL", detail: `200, ${truncate(result.text, 120)}`, ms: result.ms };
});
await check("Доступность", "QA-14", "GET /nonexistent-page", "404", async () => {
  const result = await request("/nonexistent-page-qa");
  const { actual } = expectStatus(result, 200);
  const ok = actual === 404;
  return { status: ok ? "PASS" : "FAIL", detail: `HTTP ${actual}, ожидался 404`, ms: result.ms };
});
await check("Доступность", "QA-15", "GET /legal/unknown-doc", "404", async () => {
  const result = await request("/legal/unknown-doc-qa");
  const { actual } = expectStatus(result, 200);
  const ok = actual === 404;
  return { status: ok ? "PASS" : "FAIL", detail: `HTTP ${actual}, ожидался 404`, ms: result.ms };
});
await check("Доступность", "QA-16", "http → https", "301/308 на https", async () => {
  const httpBase = BASE.replace(/^https:/, "http:");
  const result = await request(`${BASE_ORIGIN}/`, { url: `${httpBase}/` });
  if (result.error) throw new Error(result.error.message);
  const location = result.response.headers.get("location") ?? "";
  const ok = [301, 308].includes(result.response.status) && location.startsWith("https://");
  return { status: ok ? "PASS" : "FAIL", detail: `HTTP ${result.response.status} → ${location || "—"}`, ms: result.ms };
});
await check("Доступность", "QA-17", "Время ответа главной", "< 3000 мс", async () => {
  const result = await request("/");
  if (result.error) throw new Error(result.error.message);
  return { status: result.ms < 3000 ? "PASS" : "WARN", detail: `${result.ms} мс`, ms: result.ms };
});

// ─────────────────────────────────────────────────────────────────────────────
// B. Доступ к приватным страницам без сессии
// ─────────────────────────────────────────────────────────────────────────────
await check("Доступ без сессии", "QA-20", "GET /profile", "redirect на /login?returnTo=/profile", redirectToLogin("/profile", "/profile"));
await check("Доступ без сессии", "QA-21", "GET /account", "redirect на /login?returnTo=/account", redirectToLogin("/account", "/account"));
await check("Доступ без сессии", "QA-22", "GET /saved", "redirect на /login?returnTo=/saved", redirectToLogin("/saved", "/saved"));
await check("Доступ без сессии", "QA-23", "GET /admin", "redirect на /login (admin/materials)", redirectToLogin("/admin", "/admin/materials"));
await check("Доступ без сессии", "QA-24", "GET /admin/users", "redirect на /login?returnTo=/admin/users", redirectToLogin("/admin/users", null));
await check("Доступ без сессии", "QA-25", "GET /admin/feedback", "redirect на /login?returnTo=/admin/feedback", redirectToLogin("/admin/feedback", null));
await check("Доступ без сессии", "QA-26", "GET /admin/metrics", "redirect на /login?returnTo=/admin/metrics", redirectToLogin("/admin/metrics", null));
await check("Доступ без сессии", "QA-27", "GET /admin/feedback/export", "401 JSON, а не выгрузка", async () => {
  const result = await request("/admin/feedback/export");
  if (result.error) throw new Error(result.error.message);
  const ok = result.response.status === 401;
  return { status: ok ? "PASS" : "FAIL", detail: `HTTP ${result.response.status}: ${truncate(result.text, 100)}`, ms: result.ms };
});

// ─────────────────────────────────────────────────────────────────────────────
// C. API: защита без сессии и негативные кейсы
// ─────────────────────────────────────────────────────────────────────────────
const protectedEndpoints = [
  ["/api/favorites", "POST /api/favorites"],
  ["/api/favorites", "DELETE /api/favorites"],
  ["/api/study-status", "POST /api/study-status"],
  ["/api/source-views", "POST /api/source-views"],
  ["/api/account/delete", "POST /api/account/delete"],
  ["/api/account/email-change", "POST /api/account/email-change"],
  ["/api/admin/users", "POST /api/admin/users"],
  ["/api/admin/materials", "POST /api/admin/materials"],
  ["/api/admin/source-reviews", "POST /api/admin/source-reviews"],
  ["/api/admin/feedback/status", "POST /api/admin/feedback/status"],
  ["/api/source-reviews", "POST /api/source-reviews"],
];

let apiIndex = 30;
for (const [path, label] of protectedEndpoints) {
  const method = label.split(" ")[0];
  await check("Защита API", `QA-${apiIndex++}`, label, "401 без сессии", async () => {
    const result = await request(path, { method, headers: JSON_HEADERS, body: "{}" });
    if (result.error) throw new Error(result.error.message);
    const status = result.response.status;
    const ok = status === 401;
    return { status: ok ? "PASS" : "FAIL", detail: `HTTP ${status}: ${truncate(result.text, 120)}`, ms: result.ms };
  });
}

await check("Защита API", "QA-45", "POST /api/events без согласия", "204, событие не пишется", async () => {
  const result = await postApi("/api/events", { body: JSON.stringify({ name: "page_view", path: "/" }) });
  if (result.error) throw new Error(result.error.message);
  return { status: result.response.status === 204 ? "PASS" : "FAIL", detail: `HTTP ${result.response.status}: ${truncate(result.text, 100)}`, ms: result.ms };
});
await check("Защита API", "QA-46", "POST /api/events с согласием, битый JSON", "400 (валидация, без записи)", async () => {
  const result = await postApi("/api/events", {
    body: "{not-json",
    headers: { ...JSON_HEADERS, cookie: "axiona_consent=all" },
  });
  if (result.error) throw new Error(result.error.message);
  return { status: result.response.status === 400 ? "PASS" : "FAIL", detail: `HTTP ${result.response.status}: ${truncate(result.text, 100)}`, ms: result.ms };
});
await check("Защита API", "QA-47", "POST /api/feedback с пустым телом", "400 (валидация, без записи)", async () => {
  const result = await postApi("/api/feedback", { body: "{}" });
  if (result.error) throw new Error(result.error.message);
  return { status: result.response.status === 400 ? "PASS" : "FAIL", detail: `HTTP ${result.response.status}: ${truncate(result.text, 160)}`, ms: result.ms };
});
await check("Защита API", "QA-48", "POST /api/auth/request c невалидным email", "400", async () => {
  const result = await postApi("/api/auth/request", { body: JSON.stringify({ email: "not-an-email" }) });
  if (result.error) throw new Error(result.error.message);
  return { status: result.response.status === 400 ? "PASS" : "FAIL", detail: `HTTP ${result.response.status}: ${truncate(result.text, 100)}`, ms: result.ms };
});
await check("Защита API", "QA-49", "POST /api/auth/request с чужим Origin", "403 (CSRF)", async () => {
  const result = await postApi("/api/auth/request", {
    body: JSON.stringify({ email: "qa-probe@example.com" }),
    headers: { "content-type": "application/json", origin: "https://evil.example" },
  });
  if (result.error) throw new Error(result.error.message);
  return { status: result.response.status === 403 ? "PASS" : "FAIL", detail: `HTTP ${result.response.status}: ${truncate(result.text, 100)}`, ms: result.ms };
});
await check("Защита API", "QA-50", "POST /api/auth/request для нового email при закрытой регистрации", "200 {ok:true}, без раскрытия существования аккаунта", async () => {
  const email = `qa-probe-${Date.now()}@example.com`;
  const result = await postApi("/api/auth/request", { body: JSON.stringify({ email }) });
  if (result.error) throw new Error(result.error.message);
  if (result.response.status !== 200) return { status: "FAIL", detail: `HTTP ${result.response.status}: ${truncate(result.text, 120)}`, ms: result.ms };
  let body = {};
  try {
    body = JSON.parse(result.text);
  } catch {
    return { status: "FAIL", detail: "ответ не JSON", ms: result.ms };
  }
  const ok = body.ok === true && !("exists" in body) && !("token" in body);
  return { status: ok ? "PASS" : "FAIL", detail: `200 ${truncate(result.text, 80)} (пробный адрес, письмо не уходит)`, ms: result.ms };
});
await check("Защита API", "QA-51", "GET /api/link-preview без url", "400", async () => {
  const result = await request("/api/link-preview");
  if (result.error) throw new Error(result.error.message);
  return { status: result.response.status === 400 ? "PASS" : "FAIL", detail: `HTTP ${result.response.status}`, ms: result.ms };
});
await check("Защита API", "QA-52", "GET /api/link-preview?url=http://127.0.0.1", "200 без title (внутренний адрес заблокирован)", async () => {
  const result = await request(`/api/link-preview?url=${encodeURIComponent("http://127.0.0.1:3000/api/health")}`);
  if (result.error) throw new Error(result.error.message);
  if (result.response.status !== 200) return { status: "FAIL", detail: `HTTP ${result.response.status}`, ms: result.ms };
  let body = {};
  try {
    body = JSON.parse(result.text);
  } catch {
    return { status: "FAIL", detail: "ответ не JSON", ms: result.ms };
  }
  const ok = !body.title && !body.image && body.url?.includes("127.0.0.1");
  return { status: ok ? "PASS" : "FAIL", detail: `200 ${truncate(result.text, 80)}`, ms: result.ms };
});
await check("Защита API", "QA-53", "POST /api/auth/verify с поддельным токеном", "303 на /auth/link-invalid", async () => {
  const result = await request("/api/auth/verify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: BASE_ORIGIN },
    body: "token=qa-fake-token",
    redirect: "manual",
  });
  if (result.error) throw new Error(result.error.message);
  const location = result.response.headers.get("location") ?? "";
  const ok = result.response.status === 303 && location.endsWith("/auth/link-invalid");
  return { status: ok ? "PASS" : "FAIL", detail: `HTTP ${result.response.status} → ${location || "—"}`, ms: result.ms };
});
await check("Защита API", "QA-54", "POST /api/auth/logout без сессии", "303 на /", async () => {
  const result = await request("/api/auth/logout", {
    method: "POST",
    headers: JSON_HEADERS,
    body: "{}",
    redirect: "manual",
  });
  if (result.error) throw new Error(result.error.message);
  const location = result.response.headers.get("location") ?? "";
  const ok = result.response.status === 303 && new URL(location, BASE).pathname === "/";
  return { status: ok ? "PASS" : "FAIL", detail: `HTTP ${result.response.status} → ${location || "—"}`, ms: result.ms };
});

await check("Защита API", "QA-55", "POST /api/auth/email-change без токена", "303 на /auth/link-invalid", async () => {
  const result = await request("/api/auth/email-change", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: BASE_ORIGIN },
    body: "",
    redirect: "manual",
  });
  if (result.error) throw new Error(result.error.message);
  const location = result.response.headers.get("location") ?? "";
  const ok = result.response.status === 303 && location.endsWith("/auth/link-invalid");
  return { status: ok ? "PASS" : "FAIL", detail: `HTTP ${result.response.status} → ${location || "—"}`, ms: result.ms };
});

await check("Защита API", "QA-56", "POST /api/auth/verify: Location ведёт на домен контура", "Location начинается с https://app.axiona.world, а не localhost", async () => {
  const result = await request("/api/auth/verify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: BASE_ORIGIN },
    body: "token=qa-fake-token",
    redirect: "manual",
  });
  if (result.error) throw new Error(result.error.message);
  const location = result.response.headers.get("location") ?? "";
  const ok = location.startsWith(BASE_ORIGIN);
  return {
    status: ok ? "PASS" : "FAIL",
    detail: ok ? location : `${location} — абсолютный redirect собран из внутреннего адреса Next (localhost:3000); вход по ссылке не завершится`,
    ms: result.ms,
  };
});
await check("Защита API", "QA-57", "POST /api/auth/logout: Location ведёт на домен контура", "Location начинается с https://app.axiona.world", async () => {
  const result = await request("/api/auth/logout", { method: "POST", headers: JSON_HEADERS, body: "{}", redirect: "manual" });
  if (result.error) throw new Error(result.error.message);
  const location = result.response.headers.get("location") ?? "";
  const ok = location.startsWith(BASE_ORIGIN);
  return { status: ok ? "PASS" : "FAIL", detail: ok ? location : `${location} (внутренний адрес Next)`, ms: result.ms };
});
await check("Защита API", "QA-58", "Редирект страницы /admin без сессии", "относительный Location /login?..., без утечки хоста", async () => {
  const result = await request("/admin");
  if (result.error) throw new Error(result.error.message);
  const location = result.response.headers.get("location") ?? "";
  const ok = result.response.status === 307 && location.startsWith("/login");
  return { status: ok ? "PASS" : "FAIL", detail: `HTTP ${result.response.status} → ${location || "—"}`, ms: result.ms };
});

// ─────────────────────────────────────────────────────────────────────────────
// D. Заголовки и базовая безопасность
// ─────────────────────────────────────────────────────────────────────────────
const home = await request("/");
const headers = home.response ? fullHeaders(home.response) : {};

function headerCheck(group, id, title, headerName, expect, validate) {
  return check(group, id, title, expect, async () => {
    const value = headers[headerName];
    if (!value) return { status: "FAIL", detail: `заголовок ${headerName} отсутствует` };
    if (validate && !validate(value)) return { status: "FAIL", detail: `${headerName}: ${truncate(value, 160)}` };
    return { status: "PASS", detail: truncate(value, 160) };
  });
}

await headerCheck("Заголовки", "QA-60", "Content-Security-Policy", "content-security-policy", "CSP с default-src 'self' и form-action 'self'", (value) => value.includes("default-src 'self'") && value.includes("form-action 'self'"));
await headerCheck("Заголовки", "QA-61", "Strict-Transport-Security", "strict-transport-security", "max-age ≥ 1 год, includeSubDomains", (value) => {
  const match = value.match(/max-age=(\d+)/);
  return Boolean(match) && Number(match[1]) >= 31_536_000 && value.includes("includeSubDomains");
});
await headerCheck("Заголовки", "QA-62", "X-Content-Type-Options", "x-content-type-options", "nosniff", (value) => value.includes("nosniff"));
await headerCheck("Заголовки", "QA-63", "X-Frame-Options или frame-ancestors", "x-frame-options", "SAMEORIGIN или DENY", (value) => /sameorigin|deny/i.test(value));
await headerCheck("Заголовки", "QA-64", "Referrer-Policy", "referrer-policy", "strict-origin-when-cross-origin", (value) => value.includes("strict-origin-when-cross-origin"));
await headerCheck("Заголовки", "QA-65", "Permissions-Policy", "permissions-policy", "camera/microphone/geolocation выключены", (value) => value.includes("camera=()") && value.includes("microphone=()"));
await check("Заголовки", "QA-66", "Дубли security-заголовков", "нет дублей (Caddy + Next)", async () => {
  const duplicated = ["strict-transport-security", "x-content-type-options", "referrer-policy"].filter((name) => {
    const value = headers[name];
    return value && value.split(", ").length > 1;
  });
  return duplicated.length
    ? { status: "WARN", detail: `дублируются: ${duplicated.join(", ")}` }
    : { status: "PASS", detail: "дублей нет" };
});
await check("Заголовки", "QA-67", "X-Powered-By", "не отдаётся (poweredByHeader: false)", async () => {
  const value = headers["x-powered-by"];
  return value ? { status: "WARN", detail: `отдаётся: ${value}` } : { status: "PASS", detail: "заголовка нет" };
});
await check("Заголовки", "QA-68", "Сжатие HTML", "br или gzip", async () => {
  const result = await request("/", { headers: { "accept-encoding": "br, gzip" } });
  if (result.error) throw new Error(result.error.message);
  const encoding = result.response.headers.get("content-encoding");
  return encoding ? { status: "PASS", detail: encoding } : { status: "WARN", detail: "content-encoding не отдан" };
});
await check("Заголовки", "QA-69", "HTTP/3 (alt-svc)", "alt-svc h3", async () => {
  const value = headers["alt-svc"] ?? "";
  return value.includes("h3") ? { status: "PASS", detail: truncate(value) } : { status: "WARN", detail: "alt-svc не найден" };
});

// ─────────────────────────────────────────────────────────────────────────────
// E. Legal-страницы и черновики (T-005)
// ─────────────────────────────────────────────────────────────────────────────
await check("Legal", "QA-70", "Политика: плашка «Черновик Beta 1»", "WARN: черновик виден пользователю до T-005", async () => {
  const result = await request("/legal/privacy");
  const hasDraft = result.text.includes("Черновик Beta 1");
  return hasDraft
    ? { status: "WARN", detail: "на странице политики видна плашка «Черновик Beta 1» — до T-005 публиковать нельзя" }
    : { status: "PASS", detail: "плашки черновика нет" };
});
await check("Legal", "QA-71", "Политика: контакты и реквизиты", "есть privacy@axiona.world, реквизиты — плейсхолдер", async () => {
  const result = await request("/legal/privacy");
  const hasEmail = result.text.includes("privacy@axiona.world");
  const placeholder = result.text.includes("ИП [наименование");
  return {
    status: hasEmail && placeholder ? "WARN" : hasEmail ? "PASS" : "FAIL",
    detail: `privacy@: ${hasEmail ? "есть" : "нет"}; плейсхолдер реквизитов: ${placeholder ? "есть (блокер T-005)" : "нет"}`,
  };
});
await check("Legal", "QA-72", "Условия: контакт support@axiona.world", "есть", async () => {
  const result = await request("/legal/terms");
  return { status: result.text.includes("support@axiona.world") ? "PASS" : "FAIL", detail: result.text.includes("support@axiona.world") ? "найден" : "контакт не найден" };
});
await check("Legal", "QA-73", "Cookie-описание: axiona_aid и сроки", "есть", async () => {
  const result = await request("/legal/cookies");
  const ok = result.text.includes("axiona_aid");
  return { status: ok ? "PASS" : "FAIL", detail: ok ? "найден axiona_aid" : "нет упоминания axiona_aid" };
});
await check("Legal", "QA-74", "Футер: ссылки на 3 legal-документа", "privacy, terms, cookies", async () => {
  const result = await request("/");
  const links = ["/legal/privacy", "/legal/terms", "/legal/cookies"];
  const missing = links.filter((link) => !result.text.includes(link));
  return { status: missing.length ? "FAIL" : "PASS", detail: missing.length ? `нет: ${missing.join(", ")}` : "все 3 ссылки в HTML" };
});
await check("Legal", "QA-75", "Форма входа: ссылки на документы в consent-строке", "terms + privacy", async () => {
  const result = await request("/login");
  const ok = result.text.includes("/legal/terms") && result.text.includes("/legal/privacy");
  return { status: ok ? "PASS" : "FAIL", detail: ok ? "обе ссылки есть" : "не хватает ссылок на документы" };
});
await check("Legal", "QA-76", "Cookie-баннер в SSR-разметке", "ожидаемо отсутствует (клиентский), проверить в браузере", async () => {
  const result = await request("/");
  const inHtml = result.text.includes("consent-banner");
  return { status: inHtml ? "PASS" : "WARN", detail: inHtml ? "баннер в SSR" : "баннер рендерится клиентом — проверить в браузерном QA" };
});

// ─────────────────────────────────────────────────────────────────────────────
// F. Ассеты и статика
// ─────────────────────────────────────────────────────────────────────────────
const assets = [
  ["/brand/logo-mark.svg", "image/svg"],
  ["/brand/logo-wordmark.svg", "image/svg"],
  ["/brand/logo-mark-white.svg", "image/svg"],
  ["/brand/Footer/big-logo-footer.svg", "image/svg"],
  ["/fonts/Geist-VariableFont_wght.ttf", "font/ttf"],
];
let assetIndex = 80;
for (const [path, type] of assets) {
  await check("Ассеты", `QA-${assetIndex++}`, `GET ${path}`, `200, ${type}`, async () => {
    const result = await request(path);
    if (result.error) throw new Error(result.error.message);
    const status = result.response.status;
    if (status !== 200) return { status: "FAIL", detail: `HTTP ${status}`, ms: result.ms };
    const contentType = result.response.headers.get("content-type") ?? "";
    const ok = contentType.includes(type.split("/")[0]);
    return { status: ok ? "PASS" : "WARN", detail: `200, ${contentType}, ${result.ms} мс`, ms: result.ms };
  });
}
await check("Ассеты", "QA-85", "Иконка сайта", "200 /favicon.ico или /icon.svg", async () => {
  const favicon = await request("/favicon.ico");
  const icon = await request("/icon.svg");
  const faviconStatus = favicon.response?.status ?? 0;
  const iconStatus = icon.response?.status ?? 0;
  if (faviconStatus === 200 || iconStatus === 200) {
    return { status: "PASS", detail: `favicon.ico ${faviconStatus}, icon.svg ${iconStatus}`, ms: icon.ms };
  }
  return { status: "WARN", detail: `favicon.ico ${faviconStatus}, icon.svg ${iconStatus}`, ms: icon.ms };
});

// ─────────────────────────────────────────────────────────────────────────────
// G. SEO/служебные файлы
// ─────────────────────────────────────────────────────────────────────────────
await check("SEO", "QA-86", "robots.txt", "200, Disallow /admin и /api", async () => {
  const result = await request("/robots.txt");
  if (result.error) throw new Error(result.error.message);
  if (result.response.status !== 200) return { status: "FAIL", detail: `HTTP ${result.response.status}`, ms: result.ms };
  const text = result.text;
  const ok = text.includes("Disallow: /admin") && text.includes("Disallow: /api");
  return { status: ok ? "PASS" : "WARN", detail: truncate(text, 160), ms: result.ms };
});
await check("SEO", "QA-87", "sitemap.xml: домен контура", "URL на app.axiona.world, а не на axiona.world", async () => {
  const result = await request("/sitemap.xml");
  if (result.error) throw new Error(result.error.message);
  if (result.response.status !== 200) return { status: "FAIL", detail: `HTTP ${result.response.status}`, ms: result.ms };
  const foreign = /https:\/\/axiona\.world\//.test(result.text) || /<loc>https:\/\/axiona\.world<\/loc>/.test(result.text);
  if (foreign) return { status: "FAIL", detail: "sitemap ссылается на axiona.world (корпоративный сайт) — APP_URL отсутствует на этапе сборки", ms: result.ms };
  const ok = result.text.includes("https://app.axiona.world");
  return { status: ok ? "PASS" : "WARN", detail: ok ? "домен контура верный" : "домен контура не найден", ms: result.ms };
});
await check("SEO", "QA-88", "robots.txt: Sitemap на домен контура", "Sitemap: https://app.axiona.world/sitemap.xml", async () => {
  const result = await request("/robots.txt");
  if (result.error) throw new Error(result.error.message);
  const match = result.text.match(/^Sitemap:\s*(\S+)/m);
  const url = match?.[1] ?? "";
  if (!url) return { status: "WARN", detail: "Sitemap не указан" };
  const ok = url.startsWith("https://app.axiona.world/");
  return { status: ok ? "PASS" : "FAIL", detail: `Sitemap: ${url}` };
});

// ─────────────────────────────────────────────────────────────────────────────
// H. Шум сканеров/утечки
// ─────────────────────────────────────────────────────────────────────────────
const probePaths = [["/.env", "переменные окружения"], ["/.git/config", "git-конфиг"], ["/backup.zip", "архив бэкапа"]];
let probeIndex = 90;
for (const [path, label] of probePaths) {
  await check("Утечки", `QA-${probeIndex++}`, `GET ${path}`, "404, без содержимого", async () => {
    const result = await request(path);
    if (result.error) throw new Error(result.error.message);
    const status = result.response.status;
    const ok = status === 404;
    return { status: ok ? "PASS" : "FAIL", detail: `HTTP ${status} (${label})`, ms: result.ms };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Итог
// ─────────────────────────────────────────────────────────────────────────────
const counts = { PASS: 0, WARN: 0, FAIL: 0, SKIP: 0 };
for (const item of results) counts[item.status] = (counts[item.status] ?? 0) + 1;
const groups = [...new Set(results.map((item) => item.group))];
const icon = { PASS: "✅", WARN: "⚠️", FAIL: "❌", SKIP: "⏭" };

console.log(`\n# Production smoke QA — ${BASE}`);
console.log(`\nДата: ${new Date().toISOString()}  ·  проверок: ${results.length}  ·  ✅ ${counts.PASS}  ⚠️ ${counts.WARN}  ❌ ${counts.FAIL}\n`);
for (const group of groups) {
  const items = results.filter((item) => item.group === group);
  console.log(`## ${group}\n`);
  console.log("| ID | Проверка | Ожидание | Статус | Факт |");
  console.log("|---|---|---|---|---|");
  for (const item of items) {
    const detail = truncate(item.detail, 220).replace(/\|/g, "\\|");
    console.log(`| ${item.id} | ${item.title} | ${item.expect} | ${icon[item.status]} ${item.status} | ${detail} |`);
  }
  console.log("");
}
if (JSON_OUT) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(JSON_OUT, JSON.stringify({ base: BASE, generatedAt: new Date().toISOString(), counts, results }, null, 2));
  console.log(`JSON: ${JSON_OUT}`);
}
process.exit(counts.FAIL > 0 ? 1 : 0);
