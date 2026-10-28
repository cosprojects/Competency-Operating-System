import { NextResponse } from "next/server";
import { getCurrentUser, sameOrigin } from "@/lib/auth";
import { findCompetency } from "@/lib/content";
import { getDb } from "@/lib/db";
import { trackServerEvent } from "@/lib/analytics";
import { studyStatusSchema } from "@/lib/validation";

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Некорректный источник запроса" }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Нужен вход" }, { status: 401 });

  const parsed = studyStatusSchema.safeParse(await request.json());
  if (!parsed.success || !findCompetency(parsed.data.competencyId)) {
    return NextResponse.json({ error: "Неизвестная компетенция" }, { status: 400 });
  }

  const db = getDb();
  const previous = await db.studyStatus.findUnique({
    where: { userId_competencyId: { userId: user.id, competencyId: parsed.data.competencyId } },
  });
  await db.studyStatus.upsert({
    where: { userId_competencyId: { userId: user.id, competencyId: parsed.data.competencyId } },
    update: { status: parsed.data.status },
    create: {
      userId: user.id,
      competencyId: parsed.data.competencyId,
      status: parsed.data.status,
    },
  });
  await trackServerEvent({
    name: "study_status_change",
    userId: user.id,
    props: {
      competency_id: parsed.data.competencyId,
      from: previous?.status ?? "NOT_STARTED",
      to: parsed.data.status,
    },
  });
  return NextResponse.json({ status: parsed.data.status });
}
