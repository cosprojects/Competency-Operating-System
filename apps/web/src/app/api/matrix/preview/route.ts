import { NextResponse } from "next/server";
import { rateLimit, requestIpHash, sameOrigin } from "@/lib/auth";
import {
  getMatrixGrade,
  getMatrixProfession,
  getMatrixRows,
  matrixContentVersion,
  summarizeMatrix,
  type MatrixLevel,
  type MatrixPreview,
} from "@/lib/matrix";
import { matrixSchema } from "@/lib/validation";

/**
 * Предпросмотр матрицы без аккаунта.
 *
 * Человек проходит самооценку до регистрации: уровни остаются в его браузере,
 * а сюда он присылает их, чтобы сервер посчитал разрывы и сильные стороны.
 * В БД ничего не пишется; в ответе только содержание чек-листа и сводка.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Некорректный источник запроса" }, { status: 403 });
  }
  const ipHash = requestIpHash(request);
  if (!rateLimit(`matrix-preview:${ipHash}`, 60, 60 * 60_000)) {
    return NextResponse.json({ error: "Слишком много запросов. Попробуй позже." }, { status: 429 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const parsed = matrixSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Некорректная матрица" }, { status: 400 });

  const { professionSlug, gradeCode } = parsed.data;
  const profession = getMatrixProfession(professionSlug);
  const grade = getMatrixGrade(professionSlug, gradeCode);
  if (!profession || !grade) {
    return NextResponse.json({ error: "Профессия или грейд недоступны" }, { status: 404 });
  }

  const rows = getMatrixRows(professionSlug, gradeCode);
  const levels: Record<string, MatrixLevel> = {};
  for (const row of rows) {
    const value = parsed.data.levels[row.id];
    levels[row.id] = (value === 0 || value === 1 || value === 2 || value === 3 || value === 4 ? value : 0) as MatrixLevel;
  }

  const titles = Object.fromEntries(rows.map((row) => [row.id, row.title]));
  const preview: MatrixPreview = {
    contentVersion: matrixContentVersion,
    profession,
    grade,
    rows,
    levels,
  };
  return NextResponse.json({ ...preview, summary: summarizeMatrix(grade.requirements, levels, titles) });
}
