import type { CacheOptions } from "../profile/cache.ts";
import type {
  CompetencyCandidate,
  LlmMeta,
  TagRecord,
} from "./types.ts";
import { hashId, normalizeTitle, slugify, uniqueBy } from "./sources/common.ts";
import type { CandidateResponse } from "./llm/schemas.ts";
import { candidateResponseSchema } from "./llm/schemas.ts";
import { buildCandidatePrompt } from "./llm/prompts.ts";
import { runStructuredStep } from "./llm/run.ts";
import type { LlmPolicy } from "./llm/policy.ts";
import { LlmBudget } from "./llm/policy.ts";
import type { LlmTransport } from "./llm/transport.ts";

export interface CandidateBuildInput {
  domain: string;
  tags: TagRecord[];
  professionTitles?: Record<string, string>;
  transport: LlmTransport;
  policy: LlmPolicy;
  budget: LlmBudget;
  cache?: CacheOptions;
  existingCatalogTitles?: string[];
  batchSize?: number;
  limitBatches?: number;
  allowRepair?: boolean;
}

export interface CandidateBuildResult {
  candidates: CompetencyCandidate[];
  unassignedTagIds: string[];
  issues: string[];
  runs: LlmMeta[];
}

export interface ValidatedCandidate {
  title: string;
  titleEn?: string;
  aliases: string[];
  definition: string;
  scopeHint: "universal" | "profession";
  tagIds: string[];
  issues: string[];
}

export function validateCandidateResponse(
  response: CandidateResponse,
  input: {
    allowedTags: Map<string, TagRecord>;
    existingTitles: string[];
  },
): { candidates: ValidatedCandidate[]; unassigned: string[]; issues: string[] } {
  const issues: string[] = [];
  const candidates: ValidatedCandidate[] = [];
  const assigned = new Set<string>();
  const titles = new Set(input.existingTitles.map((title) => normalizeTitle(title)));
  const responseTitles = new Set<string>();

  for (const candidate of response.candidates) {
    const candidateIssues: string[] = [];
    const normalizedTitle = normalizeTitle(candidate.title);
    if (!normalizedTitle) candidateIssues.push("пустое название кандидата");
    if (titles.has(normalizedTitle)) candidateIssues.push("компетенция с таким названием уже существует");
    if (responseTitles.has(normalizedTitle)) candidateIssues.push("дубль кандидата в ответе");
    responseTitles.add(normalizedTitle);
    titles.add(normalizedTitle);

    const tagIds: string[] = [];
    for (const tagId of candidate.tagIds) {
      const tag = input.allowedTags.get(tagId);
      if (!tag) {
        candidateIssues.push(`неизвестный tagId «${tagId}»`);
        continue;
      }
      if (tag.kind === "tool" || tag.kind === "transversal") {
        candidateIssues.push(`инструмент/трансверсальный тег «${tag.title}» не может быть компетенцией`);
        continue;
      }
      if (assigned.has(tagId)) {
        candidateIssues.push(`tagId «${tagId}» назначен дважды`);
        continue;
      }
      assigned.add(tagId);
      tagIds.push(tagId);
    }
    issues.push(...candidateIssues.map((issue) => `${candidate.title}: ${issue}`));
    if (tagIds.length < 2) {
      issues.push(`кандидат «${candidate.title}»: меньше 2 тегов`);
      continue;
    }
    candidates.push({
      title: candidate.title,
      ...(candidate.titleEn ? { titleEn: candidate.titleEn } : {}),
      aliases: candidate.aliases,
      definition: candidate.definition,
      scopeHint: candidate.scopeHint,
      tagIds,
      issues: candidateIssues,
    });
    issues.push(...candidateIssues.map((issue) => `${candidate.title}: ${issue}`));
  }

  const unassigned = new Set(
    response.unassignedTagIds.filter((tagId) => input.allowedTags.has(tagId) && !assigned.has(tagId)),
  );
  for (const tagId of input.allowedTags.keys()) {
    if (!assigned.has(tagId)) unassigned.add(tagId);
  }

  return { candidates, unassigned: [...unassigned], issues };
}

export async function buildCandidates(input: CandidateBuildInput): Promise<CandidateBuildResult> {
  const eligible = input.tags.filter((tag) => tag.kind === "knowledge" || tag.kind === "skill");
  const batchSize = input.batchSize ?? 20;
  const batches: TagRecord[][] = [];
  for (let offset = 0; offset < eligible.length; offset += batchSize) {
    batches.push(eligible.slice(offset, offset + batchSize));
  }
  const selectedBatches = input.limitBatches ? batches.slice(0, input.limitBatches) : batches;
  const existingTitles = [...(input.existingCatalogTitles ?? [])];
  const byTitle = new Map<string, CompetencyCandidate>();
  const unassigned = new Set<string>();
  const issues: string[] = [];
  const runs: LlmMeta[] = [];

  for (const batch of selectedBatches) {
    const allowedTags = new Map(batch.map((tag) => [tag.id, tag]));
    const prompt = buildCandidatePrompt({
      domain: input.domain,
      professionTitles: uniqueBy(
        batch.flatMap((tag) =>
          tag.professionIds.map((id) => input.professionTitles?.[id] ?? id),
        ),
        (title) => title,
      ),
      tags: batch,
      existingCatalogTitles: existingTitles,
    });
    const step = await runStructuredStep({
      transport: input.transport,
      prompt,
      schema: candidateResponseSchema,
      policy: input.policy,
      budget: input.budget,
      ...(input.cache ? { cache: input.cache } : {}),
      ...(input.allowRepair === false ? { allowRepair: false } : {}),
    });
    runs.push(step.meta);
    if (!step.data) {
      issues.push(...step.issues.map((issue) => `batch ${existingTitles.length}: ${issue}`));
      for (const tagId of allowedTags.keys()) unassigned.add(tagId);
      continue;
    }
    const validated = validateCandidateResponse(step.data as CandidateResponse, { allowedTags, existingTitles });
    issues.push(...validated.issues);
    for (const tagId of validated.unassigned) unassigned.add(tagId);
    for (const candidate of validated.candidates) {
      const key = normalizeTitle(candidate.title);
      const tagIds = candidate.tagIds.filter(
        (tagId) => allowedTags.has(tagId) && !unassigned.has(tagId),
      );
      if (tagIds.length < 2) continue;
      const existing = byTitle.get(key);
      if (existing) {
        existing.tagIds = [...new Set([...existing.tagIds, ...tagIds])];
        existing.issues = [...new Set([...existing.issues, ...candidate.issues])];
        existing.status = existing.issues.length > 0 ? "needs_review" : "candidate";
      } else {
        const tagObjects = tagIds
          .map((tagId) => allowedTags.get(tagId))
          .filter((tag): tag is TagRecord => tag !== undefined);
        byTitle.set(key, {
          id: hashId("candidate", key),
          slug: slugify(candidate.title, "candidate"),
          title: candidate.title,
          ...(candidate.titleEn ? { titleEn: candidate.titleEn } : {}),
          aliases: candidate.aliases,
          definition: candidate.definition,
          scopeHint: candidate.scopeHint,
          tagIds,
          professionIds: uniqueBy(
            tagObjects.flatMap((tag) => tag.professionIds),
            (id) => id,
          ),
          rationale: candidate.definition,
          status: candidate.issues.length > 0 ? "needs_review" : "candidate",
          llmMeta: step.meta,
          issues: candidate.issues,
        });
        existingTitles.push(candidate.title);
      }
    }
  }

  for (const tag of eligible) {
    if (![...byTitle.values()].some((candidate) => candidate.tagIds.includes(tag.id))) {
      unassigned.add(tag.id);
    }
  }

  return {
    candidates: [...byTitle.values()].sort((a, b) => a.title.localeCompare(b.title)),
    unassignedTagIds: [...unassigned].sort(),
    issues,
    runs,
  };
}
