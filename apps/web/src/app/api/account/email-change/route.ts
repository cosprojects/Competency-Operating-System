import { NextResponse } from "next/server";
import { getCurrentUser, newToken, hashToken, normalizeEmail, sameOrigin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { emailChangeSchema } from "@/lib/validation";
import { sendEmailChangeLink } from "@/lib/email";

/** Запрос на смену email: письмо уходит на новый адрес (COS-EAR-013). */
export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Некорректный источник запроса" }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Нужен вход" }, { status: 401 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const parsed = emailChangeSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Проверь новый email" }, { status: 400 });
  }

  const newEmail = normalizeEmail(parsed.data.newEmail);
  const currentEmail = normalizeEmail(user.email);
  if (newEmail === currentEmail) {
    return NextResponse.json({ error: "Это уже твой адрес" }, { status: 400 });
  }

  const db = getDb();
  const existing = await db.user.findUnique({ where: { email: newEmail } });
  if (existing) {
    return NextResponse.json({ error: "Этот адрес уже зарегистрирован" }, { status: 409 });
  }

  // Одноразовый токен; предыдущие запросы смены для аккаунта отзываем.
  await db.loginToken.deleteMany({
    where: { email: currentEmail, purpose: "email_change" },
  });
  const raw = newToken();
  const appUrl = process.env.APP_URL ?? new URL(request.url).origin;
  await db.loginToken.create({
    data: {
      email: currentEmail,
      newEmail,
      purpose: "email_change",
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + 15 * 60_000),
    },
  });

  const link = new URL(`/auth/email-change?token=${encodeURIComponent(raw)}`, appUrl).toString();
  try {
    await sendEmailChangeLink({ to: newEmail, url: link });
  } catch (error) {
    console.error("email-change: не удалось отправить письмо", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Письмо не ушло. Попробуй ещё раз" }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
