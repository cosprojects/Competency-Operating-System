import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getDb } from "./db";

const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-axiona_session" : "axiona_session";
const SESSION_TTL_DAYS = 30;
const TOKEN_TTL_MINUTES = 15;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sessionCookieName(): string {
  return SESSION_COOKIE;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

export async function getCurrentUser() {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const db = getDb();
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;
  if (session.user.deletedAt) return null;
  return session.user;
}

export async function createLoginToken(email: string, returnTo?: string, consentVersion?: string): Promise<string> {
  const db = getDb();
  const raw = newToken();
  await db.loginToken.deleteMany({
    where: { email: normalizeEmail(email), expiresAt: { lt: new Date() } },
  });
  await db.loginToken.create({
    data: {
      email: normalizeEmail(email),
      tokenHash: hashToken(raw),
      returnTo: returnTo ?? null,
      consentVersion: consentVersion ?? null,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000),
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

export async function consumeLoginToken(raw: string): Promise<{
  userId: string;
  email: string;
  sessionToken: string;
  returnTo: string;
  consentVersion: string | null;
} | null> {
  const db = getDb();
  const tokenHash = hashToken(raw);
  const token = await db.loginToken.findUnique({ where: { tokenHash } });
  if (!token) return null;
  if (token.usedAt) return null;
  if (token.expiresAt.getTime() <= Date.now()) return null;

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
  if (claimed.count !== 1) return null;

  if (token.consentVersion) {
    for (const kind of ["TERMS", "PRIVACY"] as const) {
      const existing = await db.consentRecord.findFirst({
        where: { userId: user.id, kind, version: token.consentVersion },
      });
      if (!existing) {
        await db.consentRecord.create({
          data: { userId: user.id, kind, version: token.consentVersion },
        });
      }
    }
  }

  await db.session.create({
    data: {
      userId: user.id,
      tokenHash: sessionHash,
      expiresAt,
    },
  });

  return {
    userId: user.id,
    email: user.email,
    sessionToken: sessionRaw,
    returnTo: token.returnTo || "/saved",
    consentVersion: token.consentVersion,
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

export function safeReturnTo(value: string | null | undefined): string {
  if (!value) return "/saved";
  if (!value.startsWith("/") || value.startsWith("//")) return "/saved";
  if (value.includes("\\") || /[\u0000-\u001f]/.test(value)) return "/saved";
  if (value.startsWith("/api/") || value.startsWith("/auth/")) return "/saved";
  return value;
}

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
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

export function requestIpHash(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const salt = process.env.ANALYTICS_HASH_SALT ?? "axiona-beta";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const appUrl = process.env.APP_URL;
  if (appUrl) {
    try {
      if (origin === new URL(appUrl).origin) return true;
    } catch {
      // ignore invalid APP_URL
    }
  }
  try {
    return origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
