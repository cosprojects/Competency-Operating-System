import { NextResponse } from "next/server";
import { requireApiCapability } from "@/lib/access";
import { createLoginToken, normalizeEmail, publicOrigin, sameOrigin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { sendMagicLink } from "@/lib/email";
import { adminUserActionSchema } from "@/lib/validation";
import { recordAdminAction } from "@/lib/audit";

/** Управление подтверждёнными email: приглашение и полное удаление (COS-EAR-014). */
export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Некорректный источник запроса" }, { status: 403 });
  }
  const admin = await requireApiCapability("users:manage");
  if (!admin) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const parsed = adminUserActionSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });

  const db = getDb();

  if (parsed.data.action === "invite") {
    const email = normalizeEmail(parsed.data.email);
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Этот адрес уже зарегистрирован" }, { status: 409 });
    }
    // Повторное приглашение отзывает предыдущее.
    await db.loginToken.deleteMany({ where: { email, purpose: "invite" } });
    const raw = await createLoginToken(email, "/", process.env.LEGAL_VERSION ?? "1.0.0", { purpose: "invite" });
    const appUrl = publicOrigin(request);
    const link = new URL(`/auth/verify?token=${encodeURIComponent(raw)}`, appUrl).toString();
    try {
      await sendMagicLink({ to: email, url: link, expiresText: "7 дней" });
    } catch {
      return NextResponse.json({ error: "Письмо не ушло. Попробуй ещё раз" }, { status: 503 });
    }
    await recordAdminAction({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "user.invite",
      targetType: "User",
      targetId: email,
    });
    return NextResponse.json({ ok: true });
  }

  // delete
  const user = await db.user.findUnique({ where: { id: parsed.data.userId } });
  if (!user) return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  if (user.id === admin.id) {
    return NextResponse.json({ error: "Нельзя удалить свой аккаунт здесь" }, { status: 400 });
  }
  await db.$transaction([
    db.feedback.deleteMany({ where: { userId: user.id } }),
    db.loginToken.deleteMany({ where: { email: user.email } }),
    db.user.delete({ where: { id: user.id } }),
  ]);
  await recordAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: "user.delete",
    targetType: "User",
    targetId: user.email,
  });
  return NextResponse.json({ ok: true });
}
