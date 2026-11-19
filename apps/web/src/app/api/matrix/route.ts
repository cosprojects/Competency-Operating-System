import { NextResponse } from "next/server";
import { getCurrentUser, rateLimit, sameOrigin } from "@/lib/auth";
import { trackServerEvent } from "@/lib/analytics";
import { getDb } from "@/lib/db";
import {
  getMatrixGrade,
  getMatrixProfession,
  getMatrixRows,
  matrixContentVersion,
} from "@/lib/matrix";
import { matrixSchema } from "@/lib/validation";

/** MVP «План»: сохранить снимок самооценки матрицы. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Некорректный источник запроса" }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Нужен вход" }, { status: 401 });
  if (!rateLimit(`matrix:${user.id}`, 30, 60 * 60_000)) {
    return NextResponse.json({ error: "Слишком много сохранений. Попробуй позже." }, { status: 429 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const parsed = matrixSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Некорректная матрица" }, { status: 400 });

  const { professionSlug, gradeCode, levels } = parsed.data;
  const profession = getMatrixProfession(professionSlug);
  const grade = getMatrixGrade(professionSlug, gradeCode);
  if (!profession || !grade) {
    return NextResponse.json({ error: "Профессия или грейд недоступны" }, { status: 404 });
  }

  const rows = getMatrixRows(professionSlug, gradeCode);
  const missing = rows.filter((row) => levels[row.id] === undefined);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: "Заполни все компетенции матрицы", missing: missing.map((row) => row.id) },
      { status: 422 },
    );
  }

  // Сохраняем только то, что входит в требования грейда; лишние ключи отбрасываем.
  const clean: Record<string, number> = {};
  for (const row of rows) clean[row.id] = levels[row.id] ?? 0;

  const db = getDb();
  const run = await db.matrixRun.create({
    data: {
      userId: user.id,
      professionSlug,
      gradeCode,
      levelsJson: JSON.stringify(clean),
      contentVersion: matrixContentVersion,
    },
  });

  await trackServerEvent({
    name: "matrix_saved",
    userId: user.id,
    props: {
      profession_slug: professionSlug,
      grade_code: gradeCode,
      requirement_count: rows.length,
    },
  });

  return NextResponse.json({ id: run.id });
}
