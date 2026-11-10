import { cookies } from "next/headers";
import { getDb } from "./db";
import {
  DEFAULT_LEGAL_VERSION,
  SESSION_TTL_DAYS,
  INVITE_TTL_DAYS,
  LOGIN_TTL_DEFAULT_MINUTES,
  TOKEN_TTL_MINUTES,
  hashToken,
  newToken,
  normalizeEmail,
  requestIpHashValues,
  sameOriginValues,
} from "./auth-core";

/**
 * Аутентификация по magic link (COS-REL-008, ADR-005, ADR-022).
 * Чистые помощники — в `auth-core.ts`; здесь cookies, БД и жизненный цикл токенов.
 */

export {
  DEFAULT_LEGAL_VERSION,
  SESSION_TTL_DAYS,
  INVITE_TTL_DAYS,
  LOGIN_TTL_DEFAULT_MINUTES,
  TOKEN_TTL_MINUTES,
  hashToken,
  newToken,
  normalizeEmail,
  rateLimit,
  safeReturnTo,
  shouldSendLink,
} from "./auth-core";

const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-axiona_session" : "axiona_session";

/** Версия правовых документов, под которой фиксируется согласие. */
export function legalVersion(): string {
  return process.env.LEGAL_VERSION || DEFAULT_LEGAL_VERSION;
}

export function sessionCookieName(): string {
  return SESSION_COOKIE;
}

/** Срок ссылки для входа: по умолчанию 30 дней, переопределяется LOGIN_LINK_TTL_MINUTES. */
export function loginLinkTtlMinutes(): number {
  const configured = Number(process.env.LOGIN_LINK_TTL_MINUTES);
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : LOGIN_TTL_DEFAULT_MINUTES;
}

function plural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** Человеческий текст срока ссылки для писем и интерфейса. */
export function loginLinkTtlText(): string {
  const minutes = loginLinkTtlMinutes();
  if (minutes >= 1440 && minutes % 1440 === 0) {
    const days = minutes / 1440;
    return `${days} ${plural(days, "день", "дня", "дней")}`;
  }
  if (minutes >= 60 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} ${plural(hours, "час", "часа", "часов")}`;
  }
  return `${minutes} ${plural(minutes, "минута", "минуты", "минут")}`;
}

/**
 * Фиксация решения по аналитике в ConsentRecord (доказательство согласия, ч. 3 ст. 9 152-ФЗ).
 * Вызывается из /api/consent и при входе (решение из cookie переносится в аккаунт).
 */
export async function recordAnalyticsConsent(
  userId: string,
  decision: "all" | "necessary",
): Promise<void> {
  const db = getDb();
  const version = legalVersion();
  try {
    if (decision === "all") {
      await db.consentRecord.upsert({
        where: { userId_kind_version: { userId, kind: "ANALYTICS", version } },
        update: { revokedAt: null },
        create: { userId, kind: "ANALYTICS", version },
      });
      return;
    }
    await db.consentRecord.updateMany({
      where: { userId, kind: "ANALYTICS", revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch (error) {
    console.error("consent: не удалось записать решение по аналитике", error instanceof Error ? error.message : error);
  }
}

/**
 * Публичный origin контура для абсолютных редиректов и ссылок в письмах.
 *
 * `request.url` в Next 15 за reverse-proxy может содержать внутренний адрес
 * (`http://localhost:3000`), поэтому сначала берём APP_URL, затем заголовки Caddy,
 * и только в конце — request.url. См. T-009 / F-01.
 */
export function publicOrigin(request: Request): string {
  const configured = process.env.APP_URL;
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // некорректный APP_URL — пробуем заголовки ниже
    }
  }
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host) {
    const forwardedProto = request.headers.get("x-forwarded-proto");
    let protocol = forwardedProto;
    if (protocol !== "http" && protocol !== "https") {
      try {
        protocol = new URL(request.url).protocol === "https:" ? "https" : "http";
      } catch {
        protocol = "https";
      }
    }
    return `${protocol}://${host}`;
  }
  try {
    return new URL(request.url).origin;
  } catch {
    return "https://app.axiona.world";
  }
}

/** OWNER_EMAILS (новый список) с fallback на ADMIN_EMAILS — этап Beta. */
export function adminEmails(): string[] {
  const raw = process.env.OWNER_EMAILS ?? process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}

export async function getCurrentUser() {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const db = getDb();
  let session;
  try {
    session = await db.session.findUnique({
      where: { tokenHash: hashToken(raw) },
      include: { user: true },
    });
  } catch {
    // Demo/preview без БД: анонимный просмотр остаётся доступным.
    return null;
  }
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    // Попутно убираем просроченную сессию, чтобы таблица не росла.
    try {
      await db.session.deleteMany({ where: { id: session.id } });
    } catch {
      // Чистка не должна ломать чтение сессии.
    }
    return null;
  }
  if (session.user.deletedAt) return null;
  return session.user;
}

export async function createLoginToken(
  email: string,
  returnTo?: string,
  consentVersion?: string,
  options?: { purpose?: string; newEmail?: string },
): Promise<string> {
  const db = getDb();
  const raw = newToken();
  const purpose = options?.purpose ?? "login";
  const normalizedEmail = normalizeEmail(email);
  // Просроченные ссылки никому не нужны: чистим перед выпуском новой.
  await db.loginToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  // Новая ссылка для входа отменяет предыдущие невыбранные: старое письмо перестаёт работать.
  if (purpose === "login") {
    await db.loginToken.updateMany({
      where: { email: normalizedEmail, purpose: "login", usedAt: null },
      data: { usedAt: new Date() },
    });
  }
  const ttlMs =
    purpose === "invite"
      ? INVITE_TTL_DAYS * 86_400_000
      : purpose === "email_change"
        ? TOKEN_TTL_MINUTES * 60_000
        : loginLinkTtlMinutes() * 60_000;
  await db.loginToken.create({
    data: {
      email: normalizedEmail,
      tokenHash: hashToken(raw),
      purpose,
      ...(options?.newEmail ? { newEmail: options.newEmail } : {}),
      returnTo: returnTo ?? null,
      consentVersion: consentVersion ?? null,
      expiresAt: new Date(Date.now() + ttlMs),
    },
  });
  return raw;
}

export async function countRecentLoginTokens(email: string, windowMinutes = 60): Promise<number> {
  const db = getDb();
  return db.loginToken.count({
    where: {
      email: normalizeEmail(email),
      createdAt: { gte: new Date(Date.now() - windowMinutes * 60_000) },
    },
  });
}

export interface LoginTokenInfo {
  email: string;
  purpose: string;
  consentVersion: string | null;
  expiresAt: Date;
  usedAt: Date | null;
}

/** Чтение токена без погашения: нужно GET-странице подтверждения, чтобы не тратить ссылку. */
export async function peekLoginToken(raw: string): Promise<LoginTokenInfo | null> {
  if (!raw) return null;
  const db = getDb();
  const token = await db.loginToken.findUnique({ where: { tokenHash: hashToken(raw) } });
  if (!token) return null;
  return {
    email: token.email,
    purpose: token.purpose,
    consentVersion: token.consentVersion,
    expiresAt: token.expiresAt,
    usedAt: token.usedAt,
  };
}

export type ConsumeLoginTokenResult =
  | {
      ok: true;
      userId: string;
      email: string;
      sessionToken: string;
      returnTo: string;
      isNewUser: boolean;
    }
  | { ok: false; reason: "invalid" };

/**
 * Погашение ссылки. Согласие считается принятым по факту продолжения:
 * на форме входа и регистрации стоит пассивная строка «Нажимая …» (как в макете),
 * а записи ConsentRecord фиксируются здесь — в момент, когда аккаунт создаётся.
 */
export async function consumeLoginToken(raw: string): Promise<ConsumeLoginTokenResult> {
  const db = getDb();
  const tokenHash = hashToken(raw);
  const token = await db.loginToken.findUnique({ where: { tokenHash } });
  if (!token) return { ok: false, reason: "invalid" };
  if (token.purpose === "email_change") return { ok: false, reason: "invalid" };
  if (token.usedAt) return { ok: false, reason: "invalid" };
  if (token.expiresAt.getTime() <= Date.now()) return { ok: false, reason: "invalid" };

  const consentVersion = token.consentVersion ?? legalVersion();

  const existing = await db.user.findUnique({ where: { email: token.email } });
  const isNewUser = !existing;

  const sessionRaw = newToken();
  const sessionHash = hashToken(sessionRaw);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
  const user = await db.user.upsert({
    where: { email: token.email },
    update: { lastSeenAt: new Date() },
    create: { email: token.email },
  });

  // Атомарно забираем токен: два параллельных POST не создадут две сессии.
  const claimed = await db.loginToken.updateMany({
    where: { id: token.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (claimed.count !== 1) return { ok: false, reason: "invalid" };

  // Согласие фиксируется под версией из токена; повторный вход не плодит дублей.
  for (const kind of ["TERMS", "PRIVACY"] as const) {
    await db.consentRecord.upsert({
      where: { userId_kind_version: { userId: user.id, kind, version: consentVersion } },
      update: { revokedAt: null },
      create: { userId: user.id, kind, version: consentVersion },
    });
  }

  await db.session.create({
    data: {
      userId: user.id,
      tokenHash: sessionHash,
      expiresAt,
    },
  });

  return {
    ok: true,
    userId: user.id,
    email: user.email,
    sessionToken: sessionRaw,
    returnTo: token.returnTo || "/saved",
    isNewUser,
  };
}

export async function setSessionCookie(raw: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 86_400,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function deleteCurrentSession(): Promise<void> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (raw) {
    const db = getDb();
    await db.session.deleteMany({ where: { tokenHash: hashToken(raw) } });
  }
  await clearSessionCookie();
}

export function requestIpHash(request: Request): string {
  return requestIpHashValues(
    request.headers.get("x-forwarded-for"),
    request.headers.get("x-real-ip"),
    process.env.ANALYTICS_HASH_SALT ?? "axiona-beta",
  );
}

export function sameOrigin(request: Request): boolean {
  return sameOriginValues(request.headers.get("origin"), request.url, process.env.APP_URL);
}
