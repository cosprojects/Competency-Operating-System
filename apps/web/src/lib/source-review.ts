/**
 * Логика подтверждения и блокировки материалов (COS-REL-009).
 *
 * Чистые функции без зависимостей: их использует и сервер (SSR, API), и тесты.
 * Порог зависит от базы: доля от активных залогиненных пользователей с полом и потолком,
 * чтобы один голос не решал на маленькой базе и не требовалось 100% на большой.
 */

export type SourceReviewAction = "CONFIRM" | "BLOCK";

export type SourceReviewReason = "OFF_TOPIC" | "UNRELIABLE" | "BROKEN" | "LOCKED" | "OTHER";

export type SourceReviewStatus =
  | "auto_accepted"
  | "needs_confirmation"
  | "confirmed"
  | "disputed"
  | "blocked";

export interface SourceReviewCounts {
  confirms: number;
  blocks: number;
}

export interface SourceReviewThresholds {
  blockShare: number;
  blockMin: number;
  blockMax: number;
  confirmShare: number;
  confirmMin: number;
  confirmMax: number;
}

/** Стартовые пороги; меняются без релиза, если появятся данные голосований. */
export const SOURCE_REVIEW_THRESHOLDS: SourceReviewThresholds = {
  blockShare: 0.05,
  blockMin: 2,
  blockMax: 10,
  confirmShare: 0.1,
  confirmMin: 2,
  confirmMax: 15,
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/** Сколько голосов нужно для действия при текущем числе активных залогиненных. */
export function requiredVotes(
  action: SourceReviewAction,
  activeUsers: number,
  thresholds: SourceReviewThresholds = SOURCE_REVIEW_THRESHOLDS,
): number {
  const base = Math.max(1, Math.floor(activeUsers));
  if (action === "BLOCK") {
    return clamp(Math.ceil(thresholds.blockShare * base), thresholds.blockMin, thresholds.blockMax);
  }
  return clamp(
    Math.ceil(thresholds.confirmShare * base),
    thresholds.confirmMin,
    thresholds.confirmMax,
  );
}

/**
 * Итоговый статус ресурса в контексте компетенции.
 * `baseStatus` приходит из контента: LLM приняла без бейджа или оставила на подтверждение.
 */
export function resolveSourceReviewStatus(input: {
  baseStatus: "auto_accepted" | "needs_confirmation";
  counts: SourceReviewCounts;
  activeUsers: number;
  thresholds?: SourceReviewThresholds;
  blockedByAdmin?: boolean;
}): SourceReviewStatus {
  if (input.blockedByAdmin) return "blocked";
  const thresholds = input.thresholds ?? SOURCE_REVIEW_THRESHOLDS;
  const blockRequired = requiredVotes("BLOCK", input.activeUsers, thresholds);
  const confirmRequired = requiredVotes("CONFIRM", input.activeUsers, thresholds);
  if (input.counts.blocks >= blockRequired) return "blocked";
  if (input.counts.confirms >= confirmRequired) return "confirmed";
  if (input.counts.blocks >= 1) return "disputed";
  return input.baseStatus;
}

export interface SourceReviewBadge {
  label: string;
  hint: string;
}

/** Текст бейджа и подсказки; нет бейджа — null. */
export function sourceReviewBadge(status: SourceReviewStatus): SourceReviewBadge | null {
  if (status === "needs_confirmation") {
    return {
      label: "Подтвердить",
      hint: "Ресурс не подтверждён — помоги подтвердить его актуальность",
    };
  }
  if (status === "disputed") {
    return {
      label: "Спорный",
      hint: "Есть сомнения в материале — посмотри и скажи, подходит ли он",
    };
  }
  return null;
}

/** Причина блокировки на весь источник, а не только на одну компетенцию. */
export function isSourceWideReason(reason: SourceReviewReason | null | undefined): boolean {
  return reason === "UNRELIABLE" || reason === "BROKEN";
}

/** Приводит полный статус источника к базовому состоянию для голосования. */
export function resolveBaseStatus(
  status: SourceReviewStatus | undefined,
  sourceId: string,
): "auto_accepted" | "needs_confirmation" {
  if (status === "confirmed") return "auto_accepted";
  if (status === "disputed" || status === "blocked") return "needs_confirmation";
  return status ?? defaultBaseStatus(sourceId);
}

/** Статус по умолчанию для контента без явного reviewStatus из пайплайна. */
export function defaultBaseStatus(sourceId: string): "auto_accepted" | "needs_confirmation" {
  // Материалы, которые принял LLM (каталог), показываются с бейджем до подтверждения.
  return sourceId.startsWith("material_") ? "needs_confirmation" : "auto_accepted";
}
