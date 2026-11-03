import { NextResponse } from "next/server";
import { getAdminOrNull } from "@/lib/admin";
import { sameOrigin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { adminSourceReviewSchema } from "@/lib/validation";

/**
 * Принудительная блокировка/разблокировка материала админом (COS-REL-009 §7.4).
 * Админ-блок — голос с actorKey `admin:<id>` и scope=source; снятие удаляет только админские голоса.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Некорректный источник запроса" }, { status: 403 });
  }
  const admin = await getAdminOrNull();
  if (!admin) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const parsed = adminSourceReviewSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  const { sourceId, action } = parsed.data;
  const db = getDb();
  const actorKey = `admin:${admin.id}`;

  if (action === "UNBLOCK") {
    const removed = await db.sourceReview.deleteMany({
      where: { sourceId, action: "BLOCK", actorKey: { startsWith: "admin:" } },
    });
    return NextResponse.json({ ok: true, removed: removed.count });
  }

  await db.sourceReview.upsert({
    where: {
      sourceId_competencyId_actorKey: { sourceId, competencyId: "*", actorKey },
    },
    create: {
      sourceId,
      competencyId: "*",
      scope: "source",
      action: "BLOCK",
      reason: "OTHER",
      comment: "Админ-блок",
      userId: admin.id,
      actorKey,
      pagePath: "/admin/reviews",
    },
    update: { scope: "source", action: "BLOCK", reason: "OTHER" },
  });
  return NextResponse.json({ ok: true });
}
