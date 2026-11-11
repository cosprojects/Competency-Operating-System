import { createHash, randomBytes } from "node:crypto";

/**
 * Чистые помощники аутентификации: без Next.js, cookies и Prisma.
 * Здесь живёт всё, что можно покрыть unit-тестами (`tests/auth-core.test.ts`);
 * работа с БД, cookies и письмами — в `auth.ts` и роутах.
 */

export const SESSION_TTL_DAYS = 30;
export const TOKEN_TTL_MINUTES = 15;
/** Срок ссылки для входа по умолчанию; переопределяется LOGIN_LINK_TTL_MINUTES. */
export const LOGIN_TTL_DEFAULT_MINUTES = 30 * 24 * 60;
/** Приглашение живёт дольше magic link: его открывают не сразу. */
export const INVITE_TTL_DAYS = 7;
export const DEFAULT_LEGAL_VERSION = "1.1.0";

/** Адрес приводится к нижнему регистру: «User@Example.COM» и «user@example.com» — один аккаунт. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** В БД хранится только SHA-256 от токена: утечка таблицы не даёт войти. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Возврат после входа только внутрь приложения: без чужих origin и технических маршрутов. */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value) return "/saved";
  if (!value.startsWith("/") || value.startsWith("//")) return "/saved";
  if (value.includes("\\") || /[\u0000-\u001f]/.test(value)) return "/saved";
  if (value.startsWith("/api/") || value.startsWith("/auth/")) return "/saved";
  return value;
}

const buckets = new Map<string, { count: number; resetAt: number }>();

/** Простой in-memory лимит: один инстанс, окно фиксированной длины. */
export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  if (buckets.size > 10_000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
  }
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

/** Сравнение Origin запроса с нашим приложением; пустой Origin (форма/навигация) допустим. */
export function sameOriginValues(
  origin: string | null,
  requestUrl: string,
  appUrl?: string | undefined,
): boolean {
  if (!origin) return true;
  if (appUrl) {
    try {
      if (origin === new URL(appUrl).origin) return true;
    } catch {
      // ignore invalid APP_URL
    }
  }
  try {
    return origin === new URL(requestUrl).origin;
  } catch {
    return false;
  }
}

/** Хэш IP для анти-спама: сырой адрес нигде не сохраняем. */
export function requestIpHashValues(
  forwardedFor: string | null,
  realIp: string | null,
  salt: string,
): string {
  const ip = forwardedFor?.split(",")[0]?.trim() || realIp || "unknown";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

/**
 * Политика выдачи ссылки: при выключенной публичной регистрации
 * письмо уходит только тем, у кого аккаунт уже есть.
 */
export function shouldSendLink(input: {
  registrationDisabled: boolean;
  userExists: boolean;
}): boolean {
  if (!input.registrationDisabled) return true;
  return input.userExists;
}
