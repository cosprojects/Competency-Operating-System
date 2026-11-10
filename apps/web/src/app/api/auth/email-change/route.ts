import { NextResponse } from "next/server";
import { hashToken, publicOrigin, sameOrigin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { trackServerEvent } from "@/lib/analytics";
import { sendEmailChangedNotice } from "@/lib/email";

/** Применение смены email по одноразовой ссылке. Все сессии отзываются. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.redirect(new URL("/auth/link-invalid", publicOrigin(request)), 303);
  }
  const form = await request.formData();
  const raw = String(form.get("token") ?? "");
  const invalid = () => NextResponse.redirect(new URL("/auth/link-invalid", publicOrigin(request)), 303);
  if (!raw) return invalid();

  const db = getDb();
  const token = await db.loginToken.findUnique({ where: { tokenHash: hashToken(raw) } });
  if (!token || token.purpose !== "email_change" || token.usedAt || token.expiresAt.getTime() <= Date.now() || !token.newEmail) {
    return invalid();
  }

  const newEmail = token.newEmail;
  const user = await db.user.findUnique({ where: { email: token.email } });
  if (!user) return invalid();
  const occupied = await db.user.findUnique({ where: { email: newEmail } });
  if (occupied) return invalid();

  try {
    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { email: newEmail } }),
      db.loginToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
      db.loginToken.deleteMany({
        where: {
          OR: [{ email: token.email }, { email: newEmail }, { newEmail: token.email }],
        },
      }),
      db.session.deleteMany({ where: { userId: user.id } }),
    ]);
  } catch {
    return invalid();
  }

  await trackServerEvent({ name: "account_email_change", userId: user.id });
  // Уведомляем старый адрес (best-effort, адрес нигде не сохраняем).
  try {
    await sendEmailChangedNotice({ to: token.email, newEmail });
  } catch (error) {
    console.error("email-change: не удалось уведомить старый адрес", error instanceof Error ? error.message : error);
  }
  return NextResponse.redirect(new URL("/login?emailChanged=1", publicOrigin(request)), 303);
}
