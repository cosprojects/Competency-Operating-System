/**
 * COS-ARCH-171 · политика приёмки материалов при масштабе.
 *
 * Человек больше не гейт: он аудитор и разборщик эскалаций. Политика решает
 * не «пропустить/не пропустить», а **каким статусом опубликовать**.
 *
 * Пять исходов:
 *   auto_accept    — публикуем без бейджа (два независимых сигнала согласны)
 *   badge          — публикуем с бейджем «помоги подтвердить»
 *   quarantine     — публикуем с бейджем, но домен новый: усиленный аудит
 *   queue          — публикуем с бейджем, приоритет аудита (человек/сообщество)
 *   auto_reject    — не публикуем (жёсткие причины)
 *
 * Все пороги — параметры версионируемой политики, а не константы в коде.
 */
import { z } from "zod";

export const REVIEW_POLICY_VERSION = "1.0.0" as const;

export const reviewOutcomeSchema = z.enum([
  "auto_accept",
  "badge",
  "quarantine",
  "queue",
  "auto_reject",
]);
export type ReviewOutcome = z.infer<typeof reviewOutcomeSchema>;

export const reviewSignalSchema = z.object({
  materialId: z.string().min(1),
  /** Вердикт LLM-методолога (Pass E). */
  verdict: z.enum(["accept", "confirm", "reject"]).optional(),
  confidence: z.number().min(0).max(1).optional(),
  /** Релевантность компетенции (score из расширения / relevance из Pass D). */
  relevance: z.number().min(0).max(1).optional(),
  usefulness: z.number().min(0).max(1).optional(),
  flags: z.array(z.string()).default([]),
  language: z.enum(["ru", "en", "other"]).optional(),
  access: z.enum(["free", "freemium", "paid", "unknown"]).optional(),
  domain: z.string().optional(),
  provider: z.string().optional(),
  ageDays: z.number().int().nonnegative().optional(),
  sourceStatus: z
    .enum(["active", "planned", "blocked", "degraded", "duplicate"])
    .optional(),
  /** Контекст компетенции: есть ли уже принятые материалы и сколько по формату. */
  competency: z
    .object({
      hasAcceptedMaterials: z.boolean().default(false),
      acceptedInFormat: z.number().int().nonnegative().default(0),
      maxPerFormat: z.number().int().positive().default(5),
      conflictingAccepted: z.boolean().default(false),
    })
    .default({
      hasAcceptedMaterials: false,
      acceptedInFormat: 0,
      maxPerFormat: 5,
      conflictingAccepted: false,
    }),
  /** История домена: сколько материалов с него принято и сколько заблокировано. */
  domainHistory: z
    .object({
      known: z.boolean().default(false),
      accepted: z.number().int().nonnegative().default(0),
      blocked: z.number().int().nonnegative().default(0),
    })
    .default({ known: false, accepted: 0, blocked: 0 }),
});
export type ReviewSignal = z.infer<typeof reviewSignalSchema>;

export const reviewPolicySchema = z.object({
  version: z.string().min(1),
  autoAccept: z
    .object({
      minConfidence: z.number().min(0).max(1).default(0.85),
      minRelevance: z.number().min(0).max(1).default(0.6),
      requireKnownDomain: z.boolean().default(true),
      requireOpenAccess: z.boolean().default(true),
      maxAgeDays: z.number().int().positive().default(365),
    })
    .default({
      minConfidence: 0.85,
      minRelevance: 0.6,
      requireKnownDomain: true,
      requireOpenAccess: true,
      maxAgeDays: 365,
    }),
  badge: z
    .object({ minConfidence: z.number().min(0).max(1).default(0.6) })
    .default({ minConfidence: 0.6 }),
  reject: z
    .object({ maxRelevance: z.number().min(0).max(1).default(0.4) })
    .default({ maxRelevance: 0.4 }),
});
export type ReviewPolicy = z.infer<typeof reviewPolicySchema>;

export const DEFAULT_REVIEW_POLICY: ReviewPolicy = reviewPolicySchema.parse({
  version: REVIEW_POLICY_VERSION,
});

/** Флаги, при которых материал не публикуем вообще. */
export const HARD_REJECT_FLAGS = ["off_topic", "wrong_language", "duplicate", "invalid_response"] as const;

/** Флаги, при которых публикуем с бейджем: качество спорное, но материал по теме. */
export const SOFT_BADGE_FLAGS = [
  "marketing",
  "paywall",
  "no_practice",
  "outdated",
  "generic",
  "no_snippet",
] as const;

export type ReviewDecision = {
  materialId: string;
  outcome: ReviewOutcome;
  /** Публикуем ли материал (при «публикуем всё» скрываются только auto_reject). */
  publish: boolean;
  badge: boolean;
  reason: string;
  policyVersion: string;
};

function decide(signal: ReviewSignal, policy: ReviewPolicy): { outcome: ReviewOutcome; reason: string; publish: boolean } {
  const hasFlag = (flag: string): boolean => signal.flags.includes(flag);

  if (signal.sourceStatus === "blocked" || signal.sourceStatus === "duplicate") {
    return { outcome: "auto_reject", reason: `source_${signal.sourceStatus}`, publish: false };
  }
  if (signal.verdict === "reject") {
    return { outcome: "auto_reject", reason: "verdict_reject", publish: false };
  }
  const hardFlag = HARD_REJECT_FLAGS.find((flag) => hasFlag(flag));
  if (hardFlag) {
    return { outcome: "auto_reject", reason: `flag_${hardFlag}`, publish: false };
  }
  if (signal.relevance !== undefined && signal.relevance < policy.reject.maxRelevance) {
    return { outcome: "auto_reject", reason: "low_relevance", publish: false };
  }
  if (signal.domainHistory.blocked > 0) {
    return { outcome: "auto_reject", reason: "domain_blocked", publish: false };
  }

  // Дальше — только публикация, различается статус доверия.
  if (signal.competency.hasAcceptedMaterials === false) {
    return { outcome: "queue", reason: "first_material_for_competency", publish: true };
  }
  if (signal.domainHistory.known === false) {
    return { outcome: "quarantine", reason: "new_domain", publish: true };
  }
  if (signal.access === "paid" && policy.autoAccept.requireOpenAccess) {
    return { outcome: "badge", reason: "paid_access", publish: true };
  }
  const softFlag = SOFT_BADGE_FLAGS.find((flag) => hasFlag(flag));
  if (softFlag) {
    return { outcome: "badge", reason: `flag_${softFlag}`, publish: true };
  }
  if (signal.competency.conflictingAccepted) {
    return { outcome: "badge", reason: "conflict_with_accepted", publish: true };
  }
  if (signal.ageDays !== undefined && signal.ageDays > policy.autoAccept.maxAgeDays) {
    return { outcome: "badge", reason: "stale_source", publish: true };
  }
  if (signal.competency.acceptedInFormat >= signal.competency.maxPerFormat) {
    return { outcome: "badge", reason: "format_limit", publish: true };
  }

  const strongSignals =
    signal.verdict === "accept" &&
    (signal.confidence ?? 0) >= policy.autoAccept.minConfidence &&
    (signal.relevance ?? 0) >= policy.autoAccept.minRelevance &&
    (!policy.autoAccept.requireKnownDomain || signal.domainHistory.known) &&
    (!policy.autoAccept.requireOpenAccess || signal.access !== "paid") &&
    signal.competency.acceptedInFormat < signal.competency.maxPerFormat;

  if (strongSignals) {
    return { outcome: "auto_accept", reason: "two_independent_signals", publish: true };
  }
  if ((signal.confidence ?? 0) >= policy.badge.minConfidence) {
    return { outcome: "badge", reason: "needs_badge", publish: true };
  }
  return { outcome: "queue", reason: "ambiguous", publish: true };
}

/** Чистая функция: тот же вход → тот же исход. Обязательное условие воспроизводимости. */
export function classifyMaterial(
  input: ReviewSignal,
  policy: ReviewPolicy = DEFAULT_REVIEW_POLICY,
): ReviewDecision {
  const signal = reviewSignalSchema.parse(input);
  const { outcome, reason, publish } = decide(signal, policy);
  return {
    materialId: signal.materialId,
    outcome,
    publish,
    badge: publish && outcome !== "auto_accept",
    reason,
    policyVersion: policy.version,
  };
}

/** Маппинг в контракт стадии приёмки (`review.materials.decisions[].decision`). */
export function toStageDecision(decision: ReviewDecision): "accepted" | "needs_confirmation" | "rejected" {
  if (decision.outcome === "auto_accept") return "accepted";
  if (!decision.publish) return "rejected";
  return "needs_confirmation";
}

export type OutcomeCounts = Record<ReviewOutcome, number>;

export function countOutcomes(decisions: ReviewDecision[]): OutcomeCounts {
  const counts: OutcomeCounts = {
    auto_accept: 0,
    badge: 0,
    quarantine: 0,
    queue: 0,
    auto_reject: 0,
  };
  for (const decision of decisions) counts[decision.outcome] += 1;
  return counts;
}
