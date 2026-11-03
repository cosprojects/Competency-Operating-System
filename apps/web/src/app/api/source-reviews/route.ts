import { NextResponse } from "next/server";
import { getCurrentUser, rateLimit, sameOrigin } from "@/lib/auth";
import { findCompetency } from "@/lib/content";
import { getDb } from "@/lib/db";
import {
  isSourceWideReason,
  resolveBaseStatus,
  resolveSourceReviewStatus,
  type SourceReviewAction,
  type SourceReviewReason,
} from "@/lib/source-review";
import { getActiveLoggedInUsers } from "@/lib/source-review-server";
import { trackServerEvent } from "@/lib/analytics";
import { sourceReviewSchema } from "@/lib/validation";

/**
 * Подтверждение или блокировка материала (COS-REL-009).
 * Голосуют только залогиненные; один голос на пару «ресурс × компетенция».
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Некорректный источник запроса" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Войди, чтобы подтвердить материал" }, { status: 401 });
  }
  if (!rateLimit(`source-review:${user.id}`, 30, 60 * 60_000)) {
    return NextResponse.json({ error: "Слишком много действий. Попробуй позже." }, { status: 429 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const parsed = sourceReviewSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Проверь поля" },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const competency = findCompetency(data.competencyId);
  const source = competency?.competency.sources.find((item) => item.id === data.sourceId);
  if (!competency || !source) {
    return NextResponse.json({ error: "Материал не найден" }, { status: 400 });
  }

  const db = getDb();
  const actorKey = `u:${user.id}`;
  const scope = data.action === "BLOCK" && isSourceWideReason(data.reason) ? "source" : "competency";
  const reason = (data.reason ?? null) as SourceReviewReason | null;
  const action: SourceReviewAction = data.action;

  await db.sourceReview.upsert({
    where: {
      sourceId_competencyId_actorKey: {
        sourceId: data.sourceId,
        competencyId: data.competencyId,
        actorKey,
      },
    },
    create: {
      sourceId: data.sourceId,
      competencyId: data.competencyId,
      scope,
      action,
      reason,
      comment: data.comment ?? null,
      userId: user.id,
      actorKey,
      pagePath: data.pagePath,
    },
    update: {
      scope,
      action,
      reason,
      comment: data.comment ?? null,
      pagePath: data.pagePath,
    },
  });

  const [pairRows, wideRows, activeUsers] = await Promise.all([
    db.sourceReview.findMany({
      where: { sourceId: data.sourceId, competencyId: data.competencyId, scope: "competency" },
      select: { action: true },
    }),
    db.sourceReview.findMany({
      where: { sourceId: data.sourceId, scope: "source" },
      select: { action: true },
    }),
    getActiveLoggedInUsers(db),
  ]);
  const confirms = pairRows.filter((row) => row.action === "CONFIRM").length;
  const blocks =
    pairRows.filter((row) => row.action === "BLOCK").length +
    wideRows.filter((row) => row.action === "BLOCK").length;
  const baseStatus = resolveBaseStatus(source.reviewStatus, source.id);
  const status = resolveSourceReviewStatus({
    baseStatus,
    counts: { confirms, blocks },
    activeUsers,
  });

  await trackServerEvent({
    name: "source_review_submit",
    props: {
      source_id: data.sourceId,
      competency_id: data.competencyId,
      action,
      ...(data.reason ? { reason: data.reason } : {}),
    },
    path: data.pagePath,
    userId: user.id,
  });

  return NextResponse.json({ ok: true, status, confirms, blocks });
}
