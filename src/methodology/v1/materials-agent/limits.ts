import type { MaterialKind, MaterialReview } from "../competency/types.ts";

/**
 * Лимиты покрытия материалов (COS-REL-009 §7.1).
 * Одно место правды: цель 2–5 на формат, лимит раундов поиска и cooldown.
 */

export type MaterialFormat = "course" | "video" | "article" | "reference" | "case";

export const MATERIAL_FORMATS: MaterialFormat[] = ["course", "video", "article", "reference", "case"];

export const FORMAT_TITLES: Record<MaterialFormat, string> = {
  course: "Курсы",
  video: "Видео",
  article: "Статьи",
  reference: "Справочники",
  case: "Кейсы",
};

export const COVERAGE_LIMITS = {
  minPerFormat: 2,
  targetPerFormat: 3,
  maxPerFormat: 5,
  targetByTier: {
    foundation: 5,
    core: 3,
    optional: 2,
  },
  maxFormatRounds: 3,
  cooldownDays: 30,
  maxCandidatesPerFormat: 20,
  maxQueriesPerCompetency: 24,
  maxLlmReviewsPerCompetency: 20,
  maxNewAcceptsPerRun: 100,
  queriesPerRound: {
    course: 3,
    video: 3,
    article: 3,
    reference: 2,
    case: 2,
  },
} as const;

export const REVIEW_LIMITS = {
  /** Порог relevance, при котором материал принимается без бейджа. */
  acceptRelevance: 0.7,
  /** Ниже этого relevance материал не принимается вообще. */
  confirmRelevance: 0.5,
  /** Уверенность LLM для автоматической приёмки. */
  acceptConfidence: 0.7,
  /** Уверенность LLM, ниже которой материал уходит в подтверждение. */
  confirmConfidence: 0.5,
} as const;

/** Маппинг вида материала на формат вкладки. */
export function formatOf(kind: MaterialKind): MaterialFormat {
  switch (kind) {
    case "course":
      return "course";
    case "video":
    case "podcast":
      return "video";
    case "article":
      return "article";
    case "book":
    case "docs":
      return "reference";
    case "exercise":
      return "case";
    default:
      return "reference";
  }
}

export type FormatCoverageStatus = "ok" | "below_min" | "insufficient" | "not_started";

export interface FormatCoverageInput {
  accepted: number;
  attempts: number;
  tier: "foundation" | "core" | "optional";
  lastAttemptAt?: string;
  now?: Date;
}

export interface FormatCoverage {
  target: number;
  min: number;
  max: number;
  status: FormatCoverageStatus;
  nextAttemptAt?: string;
}

/** Цель по формату: tier задаёт цель, но она всегда в границах 2–5. */
export function targetForTier(tier: "foundation" | "core" | "optional"): number {
  return Math.min(
    Math.max(COVERAGE_LIMITS.targetByTier[tier], COVERAGE_LIMITS.minPerFormat),
    COVERAGE_LIMITS.maxPerFormat,
  );
}

/** Статус покрытия формата: цель, пробел и когда можно попробовать снова. */
export function resolveFormatCoverage(input: FormatCoverageInput): FormatCoverage {
  const target = targetForTier(input.tier);
  const min = COVERAGE_LIMITS.minPerFormat;
  const max = COVERAGE_LIMITS.maxPerFormat;
  if (input.accepted >= target) return { target, min, max, status: "ok" };
  if (input.accepted >= min) return { target, min, max, status: "ok" };
  if (input.attempts <= 0) {
    return { target, min, max, status: input.accepted > 0 ? "below_min" : "not_started" };
  }
  if (input.attempts >= COVERAGE_LIMITS.maxFormatRounds) {
    const next = nextAttempt(input.lastAttemptAt, input.now);
    return { target, min, max, status: "insufficient", ...(next ? { nextAttemptAt: next } : {}) };
  }
  return { target, min, max, status: "below_min" };
}

function nextAttempt(lastAttemptAt: string | undefined, now = new Date()): string | undefined {
  if (!lastAttemptAt) return undefined;
  const date = new Date(lastAttemptAt);
  if (Number.isNaN(date.getTime())) return undefined;
  date.setDate(date.getDate() + COVERAGE_LIMITS.cooldownDays);
  return date.toISOString().slice(0, 10);
}

export interface CoverageStateEntry {
  accepted?: number;
  attempts?: number;
  lastAttemptAt?: string;
}

export type CoverageState = Record<
  string,
  Partial<Record<MaterialFormat, CoverageStateEntry>>
>;

/** Итог приёмки по вердикту LLM и релевантности связи с компетенцией. */
export function acceptanceOf(
  review: Pick<MaterialReview, "verdict" | "confidence">,
  relevance: number,
): "accepted" | "needs_confirmation" | "rejected" {
  if (review.verdict === "reject") return "rejected";
  if (relevance < REVIEW_LIMITS.confirmRelevance) return "rejected";
  if (
    review.verdict === "accept" &&
    review.confidence >= REVIEW_LIMITS.acceptConfidence &&
    relevance >= REVIEW_LIMITS.acceptRelevance
  ) {
    return "accepted";
  }
  return "needs_confirmation";
}
