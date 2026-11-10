import { NextResponse } from "next/server";
import {
  countRecentLoginTokens,
  createLoginToken,
  legalVersion,
  normalizeEmail,
  rateLimit,
  requestIpHash,
  safeReturnTo,
  sameOrigin,
  shouldSendLink,
} from "@/lib/auth";
import { getDb } from "@/lib/db";
import { sendMagicLink } from "@/lib/email";
import { loginRequestSchema } from "@/lib/validation";

/** Одинаковый ответ на любой запрос: не раскрываем, существует ли аккаунт. */
function uniformOk() {
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Некорректный источник запроса" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  // Honeypot: скрытое поле заполняют только боты — тихо делаем вид, что письмо ушло.
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const website = (payload as { website?: unknown }).website;
    if (typeof website === "string" && website.trim() !== "") return uniformOk();
  }

  const parsed = loginRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте email" }, { status: 400 });
  }

  const email = normalizeEmail(parsed.data.email);
  const ipHash = requestIpHash(request);
  if (!rateLimit(`auth:${email}`, 5, 60 * 60_000) || !rateLimit(`auth-ip:${ipHash}`, 20, 60 * 60_000)) {
    return uniformOk();
  }

  // Аварийный стоп публичной регистрации: письма уходят только существующим аккаунтам.
  const registrationDisabled = process.env.AUTH_REGISTRATION_DISABLED === "1";
  if (registrationDisabled) {
    const user = await getDb()
      .user.findUnique({ where: { email }, select: { id: true } })
      .catch(() => null);
    if (!shouldSendLink({ registrationDisabled, userExists: Boolean(user) })) return uniformOk();
  }

  const recent = await countRecentLoginTokens(email);
  if (recent >= 5) {
    return uniformOk();
  }

  let raw: string;
  try {
    raw = await createLoginToken(email, safeReturnTo(parsed.data.returnTo), legalVersion());
  } catch (error) {
    console.error("auth: не удалось создать токен", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Не удалось отправить письмо. Попробуйте позже." }, { status: 503 });
  }

  const appUrl = process.env.APP_URL ?? new URL(request.url).origin;
  const link = new URL(`/auth/verify?token=${encodeURIComponent(raw)}`, appUrl).toString();
  try {
    await sendMagicLink({ to: email, url: link });
  } catch (error) {
    console.error("auth: не удалось отправить magic link", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Не удалось отправить письмо. Попробуйте позже." }, { status: 503 });
  }

  return uniformOk();
}
