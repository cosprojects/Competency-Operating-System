import { NextResponse } from "next/server";
import { requireApiCapability } from "@/lib/access";
import { sameOrigin } from "@/lib/auth";
import { findSource } from "@/lib/content";
import { getDb } from "@/lib/db";
import { recordAdminAction } from "@/lib/audit";
import { adminMaterialDecisionSchema } from "@/lib/validation";

/** Финальное решение владельца по материалу (COS-EAR-014). */
export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Некорректный источник запроса" }, { status: 403 });
  }
  const admin = await requireApiCapability("source-review:moderate");
  if (!admin) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const parsed = adminMaterialDecisionSchema.safeParse(payload);
  if (!parsed.success || !findSource(parsed.data.sourceId)) {
    return NextResponse.json({ error: "Некорректный материал" }, { status: 400 });
  }

  const db = getDb();
  const { sourceId, action, reason } = parsed.data;
  const now = new Date();

  await db.$transaction(async (tx) => {
    await tx.materialDecision.updateMany({
      where: { sourceId, revokedAt: null },
      data: { revokedAt: now },
    });
    if (action !== "RESET") {
      await tx.materialDecision.create({
        data: {
          sourceId,
          action,
          reason: reason ?? null,
          actorId: admin.id,
        },
      });
    }
  });

  await recordAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: action === "RESET" ? "material.decision.reset" : `material.decision.${action.toLowerCase()}`,
    targetType: "Source",
    targetId: sourceId,
    meta: reason ? { reason } : undefined,
  });

  return NextResponse.json({ ok: true });
}
