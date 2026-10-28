import { NextResponse } from "next/server";
import { getAdminOrNull } from "@/lib/admin";
import { sameOrigin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { adminFeedbackStatusSchema } from "@/lib/validation";

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Некорректный источник запроса" }, { status: 403 });
  }
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const parsed = adminFeedbackStatusSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректный статус" }, { status: 400 });
  }

  const db = getDb();
  await db.feedback.update({
    where: { id: parsed.data.id },
    data: {
      status: parsed.data.status,
      resolvedAt: parsed.data.status === "RESOLVED" ? new Date() : null,
    },
  });
  return NextResponse.json({ ok: true });
}
