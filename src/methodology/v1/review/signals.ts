/**
 * Сбор сигналов для политики приёмки из реальных данных:
 * каталог (что уже принято), реестр источников (что заблокировано), журнал расширения.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { catalogFileSchema, registryFileSchema } from "../contracts/adapters.ts";
import { reviewSignalSchema, type ReviewSignal } from "./policy.ts";

export type ReviewContext = {
  /** domain → сколько материалов принято / заблокировано и известен ли он нам вообще. */
  domains: Map<string, { accepted: number; blocked: number; known: boolean }>;
  /** model competencyId → сколько материалов принято и по форматам. */
  competencies: Map<string, { accepted: number; byFormat: Map<string, number> }>;
};

export function domainOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

/** Каталог хранит связи с блоками (comp_*), а модель — канонические id. Сводим их. */
function blockToCanonicalMap(root: string): Map<string, string> {
  const catalog = catalogFileSchema.parse(
    JSON.parse(readFileSync(resolve(root, "src/methodology/v1/competency/catalog/it.json"), "utf8")),
  );
  const map = new Map<string, string>();
  for (const block of catalog.blocks) {
    const canonical = block.canonicalIds ?? [];
    if (canonical.length === 1 && canonical[0]) map.set(block.id, canonical[0]);
  }
  return map;
}

export function buildReviewContext(root: string = process.cwd()): ReviewContext {
  const catalog = catalogFileSchema.parse(
    JSON.parse(readFileSync(resolve(root, "src/methodology/v1/competency/catalog/it.json"), "utf8")),
  );
  const registry = registryFileSchema.parse(
    JSON.parse(readFileSync(resolve(root, "src/methodology/v1/learning-sources/registry.json"), "utf8")),
  );
  const blockToCanonical = blockToCanonicalMap(root);

  const domains = new Map<string, { accepted: number; blocked: number; known: boolean }>();
  const touch = (domain: string | undefined) => {
    if (!domain) return undefined;
    const entry = domains.get(domain) ?? { accepted: 0, blocked: 0, known: false };
    domains.set(domain, entry);
    return entry;
  };

  for (const material of catalog.materials) {
    const entry = touch(domainOf(material.url));
    if (entry) entry.accepted += 1;
  }
  for (const source of registry.sources) {
    const entry = touch(domainOf(source.url));
    if (!entry) continue;
    // Любой домен из реестра уже прошёл проверку — он «известен», даже без принятых материалов.
    if (source.status === "active" || source.status === "degraded") entry.known = true;
    if (source.status === "blocked") entry.blocked += 1;
  }

  const competencies = new Map<string, { accepted: number; byFormat: Map<string, number> }>();
  for (const material of catalog.materials) {
    const format = String((material as { kind?: unknown }).kind ?? "unknown");
    for (const link of (material.links ?? []) as Array<{ competencyId: string }>) {
      const canonical = blockToCanonical.get(link.competencyId) ?? link.competencyId;
      const entry = competencies.get(canonical) ?? { accepted: 0, byFormat: new Map() };
      entry.accepted += 1;
      entry.byFormat.set(format, (entry.byFormat.get(format) ?? 0) + 1);
      competencies.set(canonical, entry);
    }
  }

  return { domains, competencies };
}

const candidateSchema = z
  .object({
    canonicalUrl: z.string(),
    url: z.string().optional(),
    title: z.string(),
    provider: z.string().optional(),
    domain: z.string().optional(),
    competencyId: z.string().optional(),
    kind: z.string().optional(),
    languages: z.array(z.string()).optional(),
    score: z.number().optional(),
    review: z
      .object({
        verdict: z.string().optional(),
        confidence: z.number().optional(),
        usefulness: z.number().optional(),
        flags: z.array(z.string()).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type JournalCandidate = z.infer<typeof candidateSchema>;

export function signalsFromCandidate(
  candidate: JournalCandidate,
  context: ReviewContext,
  options: { maxPerFormat?: number } = {},
): ReviewSignal {
  const domain = candidate.domain ?? domainOf(candidate.canonicalUrl);
  const domainState = domain ? context.domains.get(domain) : undefined;
  const competencyId = candidate.competencyId;
  const competencyState = competencyId ? context.competencies.get(competencyId) : undefined;
  const format = candidate.kind ?? "unknown";
  const lang = candidate.languages?.[0];

  return reviewSignalSchema.parse({
    materialId: candidate.canonicalUrl,
    ...(candidate.review?.verdict
      ? { verdict: candidate.review.verdict as "accept" | "confirm" | "reject" }
      : {}),
    ...(candidate.review?.confidence !== undefined
      ? { confidence: candidate.review.confidence }
      : {}),
    ...(candidate.review?.usefulness !== undefined
      ? { relevance: candidate.review.usefulness }
      : {}),
    ...(candidate.review?.usefulness !== undefined
      ? { usefulness: candidate.review.usefulness }
      : {}),
    flags: candidate.review?.flags ?? [],
    ...(lang === "ru" || lang === "en" ? { language: lang } : {}),
    ...(domain ? { domain } : {}),
    ...(candidate.provider ? { provider: candidate.provider } : {}),
    competency: {
      hasAcceptedMaterials: (competencyState?.accepted ?? 0) > 0,
      acceptedInFormat: competencyState?.byFormat.get(format) ?? 0,
      maxPerFormat: options.maxPerFormat ?? 5,
      conflictingAccepted: false,
    },
    domainHistory: {
      known: Boolean(domainState?.known || (domainState?.accepted ?? 0) > 0),
      accepted: domainState?.accepted ?? 0,
      blocked: domainState?.blocked ?? 0,
    },
  });
}

/** Вход стадии приёмки (после резолва стадий). Один формат для рантайма и shadow. */
export type ReviewItemInput = {
  materialId: string;
  title?: string;
  sourceId?: string;
  competencyId?: string;
  confidence?: number;
  relevance?: number;
  verdict?: "accept" | "confirm" | "reject";
  flags?: string[];
  access?: "free" | "freemium" | "paid" | "unknown";
  language?: "ru" | "en" | "other";
  provider?: string;
  kind?: string;
  domain?: string;
};

/**
 * Единственный построитель сигнала из материала стадии.
 * Раньше логика дублировалась в обработчике и shadow-режиме — и разошлась
 * (проверка домена). Теперь источник один.
 */
export function signalFromReviewItem(
  item: ReviewItemInput,
  context: ReviewContext,
  options: { maxPerFormat?: number } = {},
): ReviewSignal {
  const domain = item.domain ?? domainOf(item.sourceId);
  const competency = item.competencyId ? context.competencies.get(item.competencyId) : undefined;
  const domainState = domain ? context.domains.get(domain) : undefined;

  return reviewSignalSchema.parse({
    materialId: item.materialId,
    ...(item.verdict ? { verdict: item.verdict } : {}),
    ...(item.confidence !== undefined ? { confidence: item.confidence } : {}),
    ...(item.relevance !== undefined ? { relevance: item.relevance } : {}),
    flags: item.flags ?? [],
    ...(item.language ? { language: item.language } : {}),
    ...(item.access ? { access: item.access } : {}),
    ...(domain ? { domain } : {}),
    ...(item.provider ? { provider: item.provider } : {}),
    competency: {
      hasAcceptedMaterials: (competency?.accepted ?? 0) > 0,
      acceptedInFormat: competency?.byFormat.get(item.kind ?? "unknown") ?? 0,
      maxPerFormat: options.maxPerFormat ?? 5,
      conflictingAccepted: false,
    },
    domainHistory: {
      known: Boolean(domainState?.known || (domainState?.accepted ?? 0) > 0),
      accepted: domainState?.accepted ?? 0,
      blocked: domainState?.blocked ?? 0,
    },
  });
}
