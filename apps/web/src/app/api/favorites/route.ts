import { NextResponse } from "next/server";
import { getCurrentUser, sameOrigin } from "@/lib/auth";
import { findCompetencies, findCompetency, findSource, getProfession } from "@/lib/content";
import { getDb } from "@/lib/db";
import { trackServerEvent } from "@/lib/analytics";
import { favoriteSchema } from "@/lib/validation";

async function readPayload(request: Request) {
  const parsed = favoriteSchema.safeParse(await request.json());
  if (!parsed.success) return null;
  const { targetType, targetId } = parsed.data;
  const exists =
    targetType === "COMPETENCY"
      ? Boolean(findCompetency(targetId))
      : targetType === "PROFESSION"
        ? Boolean(getProfession(targetId))
        : Boolean(findSource(targetId));
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

  // Связка «компетенция ↔ профессия» (COS-EAR-013): сохранил компетенцию —
  // профессия тоже попадает в сохранённое.
  if (payload.targetType === "COMPETENCY") {
    const occurrences = findCompetencies(payload.targetId);
    const context = payload.professionSlug
      ? occurrences.find((occurrence) => occurrence.profession.slug === payload.professionSlug)
      : occurrences[0];
    if (context) {
      await db.favorite.upsert({
        where: {
          userId_targetType_targetId: {
            userId: user.id,
            targetType: "PROFESSION",
            targetId: context.profession.slug,
          },
        },
        update: {},
        create: {
          userId: user.id,
          targetType: "PROFESSION",
          targetId: context.profession.slug,
        },
      });
    }
  }
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

  // Снял профессию — снимаются и её компетенции из сохранённого.
  if (payload.targetType === "PROFESSION") {
    const profession = getProfession(payload.targetId);
    if (profession) {
      const competencyIds = profession.sections.flatMap((section) =>
        section.competencies.map((competency) => competency.id),
      );
      await db.favorite.deleteMany({
        where: {
          userId: user.id,
          targetType: "COMPETENCY",
          targetId: { in: competencyIds },
        },
      });
    }
  }
  await trackServerEvent({
    name: "favorite_remove",
    userId: user.id,
    props: { target_type: payload.targetType, target_id: payload.targetId },
  });
  return NextResponse.json({ saved: false });
}
