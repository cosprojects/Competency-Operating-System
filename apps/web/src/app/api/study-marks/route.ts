import { NextResponse } from "next/server";
import { getCurrentUser, rateLimit, sameOrigin } from "@/lib/auth";
import { trackServerEvent } from "@/lib/analytics";
import { findCompetency, findStudyItem } from "@/lib/content";
import { getDb } from "@/lib/db";
import { studyMarkSchema } from "@/lib/validation";

/**
 * COS-EAR-017: отметки «усвоено» для знаний/навыков и «изучаю» для компетенций.
 * Одна таблица StudyMark (targetType + targetId), по одной записи на пару.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Некорректный источник запроса" }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Нужен вход" }, { status: 401 });
  if (!rateLimit(`study-mark:${user.id}`, 240, 60 * 60_000)) {
    return NextResponse.json({ ok: true });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const parsed = studyMarkSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Неизвестная отметка" }, { status: 400 });
  const { targetType, targetId, status } = parsed.data;

  const exists =
    targetType === "COMPETENCY"
      ? Boolean(findCompetency(targetId))
      : targetType === "KNOWLEDGE"
        ? findStudyItem(targetId)?.kind === "KNOWLEDGE"
        : findStudyItem(targetId)?.kind === "SKILL";
  if (!exists) return NextResponse.json({ error: "Объект не найден" }, { status: 400 });

  const db = getDb();
  const previous = await db.studyMark.findUnique({
    where: { userId_targetType_targetId: { userId: user.id, targetType, targetId } },
  });

  if (status === "NOT_STARTED") {
    await db.studyMark.deleteMany({ where: { userId: user.id, targetType, targetId } });
  } else {
    await db.studyMark.upsert({
      where: { userId_targetType_targetId: { userId: user.id, targetType, targetId } },
      update: { status },
      create: { userId: user.id, targetType, targetId, status },
    });
  }
  await trackServerEvent({
    name: "study_mark_change",
    userId: user.id,
    props: {
      target_type: targetType,
      target_id: targetId,
      from: previous?.status ?? "NOT_STARTED",
      to: status,
    },
  });
  return NextResponse.json({ status });
}

/** Снять отметку полностью (например, снятый чекбокс «Усвоено»). */
export async function DELETE(request: Request) {
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
  const parsed = studyMarkSchema.omit({ status: true }).safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Неизвестная отметка" }, { status: 400 });
  const db = getDb();
  const { targetType, targetId } = parsed.data;
  await db.studyMark.deleteMany({ where: { userId: user.id, targetType, targetId } });
  return NextResponse.json({ status: "NOT_STARTED" });
}
