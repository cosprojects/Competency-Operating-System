import { NextResponse } from "next/server";
import { getCurrentUser, rateLimit, requestIpHash, sameOrigin } from "@/lib/auth";
import { findCompetency, findSource } from "@/lib/content";
import { getDb } from "@/lib/db";
import { feedbackSchema } from "@/lib/validation";

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Некорректный источник запроса" }, { status: 403 });
  }

  const ipHash = requestIpHash(request);
  if (!rateLimit(`feedback:${ipHash}`, 5, 60 * 60_000)) {
    return NextResponse.json({ error: "Слишком много отзывов. Попробуйте позже." }, { status: 429 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const parsed = feedbackSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Проверьте поля отзыва" },
      { status: 400 },
    );
  }

  const data = parsed.data;
  if ((data.targetType && !data.targetId) || (data.targetId && !data.targetType)) {
    return NextResponse.json({ error: "Некорректный объект отзыва" }, { status: 400 });
  }
  if (data.targetType && data.targetId) {
    const exists =
      data.targetType === "COMPETENCY"
        ? Boolean(findCompetency(data.targetId))
        : Boolean(findSource(data.targetId));
    if (!exists) {
      return NextResponse.json({ error: "Объект отзыва не найден" }, { status: 400 });
    }
  }

  const user = await getCurrentUser();
  const db = getDb();
  await db.feedback.create({
    data: {
      ...(user ? { userId: user.id } : {}),
      type: data.type,
      ...(data.targetType ? { targetType: data.targetType } : {}),
      ...(data.targetId ? { targetId: data.targetId } : {}),
      ...(data.rating ? { rating: data.rating } : {}),
      ...(data.comment ? { comment: data.comment } : {}),
      ...(data.contactEmail ? { contactEmail: data.contactEmail } : {}),
      pagePath: data.pagePath,
    },
  });

  return NextResponse.json({ ok: true });
}
