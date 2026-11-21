/**
 * Черновик матрицы в браузере до входа.
 *
 * Незарегистрированный человек может пройти самооценку: уровни лежат только
 * в localStorage и никуда не отправляются. В аккаунт матрица попадает после
 * входа/регистрации — тогда `PendingMatrixGate` сохраняет черновик через API.
 */

export const MATRIX_DRAFT_KEY = "axiona.matrixDraft.v1";

export interface MatrixDraft {
  professionSlug: string;
  gradeCode: string;
  levels: Record<string, number>;
  savedAt: string;
}

function isLevel(value: unknown): value is number {
  return value === 0 || value === 1 || value === 2 || value === 3 || value === 4;
}

export function readMatrixDraft(): MatrixDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MATRIX_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MatrixDraft> | null;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.professionSlug !== "string" || typeof parsed.gradeCode !== "string") return null;
    if (!parsed.levels || typeof parsed.levels !== "object") return null;
    const levels: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed.levels)) {
      if (isLevel(value)) levels[key] = value;
    }
    if (Object.keys(levels).length === 0) return null;
    return {
      professionSlug: parsed.professionSlug,
      gradeCode: parsed.gradeCode,
      levels,
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function writeMatrixDraft(draft: MatrixDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MATRIX_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Приватный режим или переполненное хранилище не должны ломать самооценку.
  }
}

export function clearMatrixDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(MATRIX_DRAFT_KEY);
  } catch {
    // см. writeMatrixDraft
  }
}
