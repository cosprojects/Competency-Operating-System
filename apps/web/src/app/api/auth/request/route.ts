import { NextResponse } from "next/server";
import {
  countRecentLoginTokens,
  createLoginToken,
  normalizeEmail,
  rateLimit,
  requestIpHash,
  safeReturnTo,
  sameOrigin,
} from "@/lib/auth";
import { sendMagicLink } from "@/lib/email";
import { loginRequestSchema } from "@/lib/validation";

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

  const parsed = loginRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте email" }, { status: 400 });
  }

  const email = normalizeEmail(parsed.data.email);
  const ipHash = requestIpHash(request);
  if (!rateLimit(`auth:${email}`, 5, 60 * 60_000) || !rateLimit(`auth-ip:${ipHash}`, 20, 60 * 60_000)) {
    return NextResponse.json({ ok: true });
  }

  const recent = await countRecentLoginTokens(email);
  if (recent >= 5) {
    return NextResponse.json({ ok: true });
  }

  const raw = await createLoginToken(
    email,
    safeReturnTo(parsed.data.returnTo),
    process.env.LEGAL_VERSION ?? "1.0.0",
  );
  const appUrl = process.env.APP_URL ?? new URL(request.url).origin;
  const link = new URL(`/auth/verify?token=${encodeURIComponent(raw)}`, appUrl).toString();
  try {
    await sendMagicLink({ to: email, url: link });
  } catch (error) {
    console.error("auth: не удалось отправить magic link", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Не удалось отправить письмо. Попробуйте позже." }, { status: 503 });
  }

  // Всегда одинаковый ответ: не раскрываем, существует ли аккаунт.
  return NextResponse.json({ ok: true });
}
