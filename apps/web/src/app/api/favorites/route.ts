import { NextResponse } from "next/server";
import { getCurrentUser, sameOrigin } from "@/lib/auth";
import { findCompetency, findSource } from "@/lib/content";
import { getDb } from "@/lib/db";
import { trackServerEvent } from "@/lib/analytics";
import { favoriteSchema } from "@/lib/validation";

async function readPayload(request: Request) {
  const parsed = favoriteSchema.safeParse(await request.json());
  if (!parsed.success) return null;
  const { targetType, targetId } = parsed.data;
  const exists =
    targetType === "COMPETENCY" ? Boolean(findCompetency(targetId)) : Boolean(findSource(targetId));
  if (!exists) return null;
  return parsed.data;
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Некорректный источник запроса" }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Нужен вход" }, { status: 401 });
  const payload = await readPayload(request);
  if (!payload) return NextResponse.json({ error: "Неизвестный объект" }, { status: 400 });

  const db = getDb();
  await db.favorite.upsert({
    where: {
      userId_targetType_targetId: {
        userId: user.id,
        targetType: payload.targetType,
        targetId: payload.targetId,
      },
    },
    update: {},
    create: {
      userId: user.id,
      targetType: payload.targetType,
      targetId: payload.targetId,
    },
  });
  await trackServerEvent({
    name: "favorite_add",
    userId: user.id,
    props: { target_type: payload.targetType, target_id: payload.targetId },
  });
  return NextResponse.json({ saved: true });
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Некорректный источник запроса" }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Нужен вход" }, { status: 401 });
  const payload = await readPayload(request);
  if (!payload) return NextResponse.json({ error: "Неизвестный объект" }, { status: 400 });

  const db = getDb();
  await db.favorite.deleteMany({
    where: { userId: user.id, targetType: payload.targetType, targetId: payload.targetId },
  });
  await trackServerEvent({
    name: "favorite_remove",
    userId: user.id,
    props: { target_type: payload.targetType, target_id: payload.targetId },
  });
  return NextResponse.json({ saved: false });
}
