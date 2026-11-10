import { NextResponse } from "next/server";
import { getCurrentUser, rateLimit, sameOrigin } from "@/lib/auth";
import { findSource } from "@/lib/content";
import { getDb } from "@/lib/db";
import { trackServerEvent } from "@/lib/analytics";
import { sourceViewSchema } from "@/lib/validation";

/** Отметка «материал просмотрен» (COS-EAR-013). Не зависит от согласия на аналитику. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Некорректный источник запроса" }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Нужен вход" }, { status: 401 });
  if (!rateLimit(`source-view:${user.id}`, 120, 60 * 60_000)) {
    return NextResponse.json({ ok: true });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const parsed = sourceViewSchema.safeParse(payload);
  if (!parsed.success || !findSource(parsed.data.sourceId)) {
    return NextResponse.json({ error: "Материал не найден" }, { status: 400 });
  }

  const db = getDb();
  await db.sourceView.upsert({
    where: {
      userId_sourceId: { userId: user.id, sourceId: parsed.data.sourceId },
    },
    create: { userId: user.id, sourceId: parsed.data.sourceId },
    update: { lastViewedAt: new Date() },
  });
  await trackServerEvent({
    name: "source_view_submit",
    userId: user.id,
    props: { source_id: parsed.data.sourceId },
  });
  return NextResponse.json({ ok: true, viewed: true });
}
