/**
 * Shadow-режим: политика считается, но ничего не публикуется.
 * Задача — увидеть распределение исходов и выбрать пороги до включения автоматики.
 */
import {
  DEFAULT_REVIEW_POLICY,
  classifyMaterial,
  countOutcomes,
  reviewPolicySchema,
  type ReviewDecision,
  type ReviewPolicy,
  type ReviewSignal,
} from "./policy.ts";

export type ShadowReport = {
  policyVersion: string;
  total: number;
  published: number;
  hidden: number;
  badged: number;
  outcomes: ReturnType<typeof countOutcomes>;
  reasons: Array<{ reason: string; count: number }>;
  byDomain: Array<{ domain: string; total: number; autoAccept: number; rejected: number }>;
  grid: Array<{ confidence: number; relevance: number; autoAccept: number; share: number }>;
  warnings: string[];
};

const CONFIDENCE_GRID = [0.75, 0.8, 0.85, 0.9];
const RELEVANCE_GRID = [0.4, 0.5, 0.6, 0.7];

function withPolicy(policy: ReviewPolicy, overrides: {
  confidence?: number;
  relevance?: number;
}): ReviewPolicy {
  return reviewPolicySchema.parse({
    ...policy,
    autoAccept: {
      ...policy.autoAccept,
      ...(overrides.confidence !== undefined ? { minConfidence: overrides.confidence } : {}),
      ...(overrides.relevance !== undefined ? { minRelevance: overrides.relevance } : {}),
    },
  });
}

export function buildShadowReport(
  signals: ReviewSignal[],
  policy: ReviewPolicy = DEFAULT_REVIEW_POLICY,
): ShadowReport {
  const decisions: ReviewDecision[] = signals.map((signal) => classifyMaterial(signal, policy));
  const outcomes = countOutcomes(decisions);

  const reasons = new Map<string, number>();
  for (const decision of decisions) reasons.set(decision.reason, (reasons.get(decision.reason) ?? 0) + 1);

  const domains = new Map<string, { total: number; autoAccept: number; rejected: number }>();
  for (let index = 0; index < decisions.length; index += 1) {
    const decision = decisions[index];
    const domain = signals[index]?.domain ?? "unknown";
    if (!decision) continue;
    const entry = domains.get(domain) ?? { total: 0, autoAccept: 0, rejected: 0 };
    entry.total += 1;
    if (decision.outcome === "auto_accept") entry.autoAccept += 1;
    if (decision.outcome === "auto_reject") entry.rejected += 1;
    domains.set(domain, entry);
  }

  const grid: ShadowReport["grid"] = [];
  for (const confidence of CONFIDENCE_GRID) {
    for (const relevance of RELEVANCE_GRID) {
      const variant = withPolicy(policy, { confidence, relevance });
      const auto = signals.filter(
        (signal) => classifyMaterial(signal, variant).outcome === "auto_accept",
      ).length;
      grid.push({
        confidence,
        relevance,
        autoAccept: auto,
        share: signals.length === 0 ? 0 : Math.round((auto / signals.length) * 1000) / 1000,
      });
    }
  }

  const warnings: string[] = [];
  const noAccess = signals.filter((signal) => signal.access === undefined).length;
  if (noAccess > 0) warnings.push(`${noAccess} сигналов без данных о доступе (журнал их не содержит)`);
  const noRelevance = signals.filter((signal) => signal.relevance === undefined).length;
  if (noRelevance > 0) warnings.push(`${noRelevance} сигналов без relevance`);
  const unknownDomains = signals.filter((signal) => !signal.domainHistory.known).length;
  if (unknownDomains > 0) warnings.push(`${unknownDomains} новых для нас домены → quarantine`);

  return {
    policyVersion: policy.version,
    total: decisions.length,
    published: decisions.filter((decision) => decision.publish).length,
    hidden: decisions.filter((decision) => !decision.publish).length,
    badged: decisions.filter((decision) => decision.badge).length,
    outcomes,
    reasons: [...reasons.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
    byDomain: [...domains.entries()]
      .map(([domain, value]) => ({ domain, ...value }))
      .sort((a, b) => b.total - a.total),
    grid,
    warnings,
  };
}
