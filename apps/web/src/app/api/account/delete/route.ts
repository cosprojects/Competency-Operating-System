import { NextResponse } from "next/server";
import { clearSessionCookie, getCurrentUser, sameOrigin } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Некорректный источник запроса" }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Нужен вход" }, { status: 401 });

  const db = getDb();
  await db.$transaction([
    db.feedback.deleteMany({ where: { userId: user.id } }),
    db.loginToken.deleteMany({ where: { email: user.email } }),
    db.user.delete({ where: { id: user.id } }),
  ]);
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
