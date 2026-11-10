import { NextResponse } from "next/server";
import { requireApiCapability } from "@/lib/access";
import { sameOrigin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { adminFeedbackStatusSchema } from "@/lib/validation";
import { recordAdminAction } from "@/lib/audit";

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Некорректный источник запроса" }, { status: 403 });
  }
  const admin = await requireApiCapability("feedback:write");
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
  await recordAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: "feedback.status.update",
    targetType: "Feedback",
    targetId: parsed.data.id,
    meta: { status: parsed.data.status },
  });
  return NextResponse.json({ ok: true });
}
