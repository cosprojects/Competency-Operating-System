import type { CacheOptions } from "../profile/cache.ts";
import type { CompetencyCandidate, LlmMeta } from "./types.ts";
import { hashId, normalizeTitle, slugify, uniqueBy } from "./sources/common.ts";
import type { ReconcileResponse } from "./llm/schemas.ts";
import { reconcileResponseSchema } from "./llm/schemas.ts";
import { buildReconcilePrompt } from "./llm/prompts.ts";
import { runStructuredStep } from "./llm/run.ts";
import type { LlmPolicy } from "./llm/policy.ts";
import { BudgetExceededError, type LlmBudget } from "./llm/policy.ts";
import type { LlmTransport } from "./llm/transport.ts";

export interface ReconcileInput {
  candidates: CompetencyCandidate[];
  transport: LlmTransport;
  policy: LlmPolicy;
  budget: LlmBudget;
  cache?: CacheOptions;
  existingCatalogTitles?: string[];
  allowRepair?: boolean;
  chunkSize?: number;
}

export interface ReconcileResult {
  candidates: CompetencyCandidate[];
  issues: string[];
  runs: LlmMeta[];
  unassignedCandidateIds: string[];
}

export function validateReconcileResponse(
  response: ReconcileResponse,
  input: { candidates: CompetencyCandidate[]; existingCatalogTitles: string[] },
): { candidates: CompetencyCandidate[]; issues: string[]; unassignedCandidateIds: string[] } {
  const byId = new Map(input.candidates.map((candidate) => [candidate.id, candidate]));
  const issues: string[] = [];
  const used = new Set<string>();
  const titles = new Set(input.existingCatalogTitles.map((title) => normalizeTitle(title)));
  const merged: CompetencyCandidate[] = [];

  for (const group of response.groups) {
    const memberIds = uniqueBy(group.memberCandidateIds, (id) => id);
    const members: CompetencyCandidate[] = [];
    for (const id of memberIds) {
      const candidate = byId.get(id);
      if (!candidate) {
        issues.push(`reconcile: неизвестный id «${id}»`);
        continue;
      }
      if (used.has(id)) {
        issues.push(`reconcile: кандидат «${id}» использован дважды`);
        continue;
      }
      used.add(id);
      members.push(candidate);
    }
    if (members.length === 0) continue;
    const normalizedTitle = normalizeTitle(group.title);
    if (!normalizedTitle) {
      issues.push("reconcile: пустое название группы");
      continue;
    }
    if (titles.has(normalizedTitle)) {
      issues.push(`reconcile: дубль названия «${group.title}»`);
    }
    titles.add(normalizedTitle);
    const tagIds = uniqueBy(members.flatMap((member) => member.tagIds), (id) => id);
    const professionIds = uniqueBy(members.flatMap((member) => member.professionIds), (id) => id);
    const definition = members
      .map((member) => member.definition)
      .join(" ")
      .slice(0, 1200);
    merged.push({
      id: hashId("candidate", normalizedTitle),
      slug: slugify(group.title, "candidate"),
      title: group.title,
      ...(group.titleEn ? { titleEn: group.titleEn } : {}),
      aliases: uniqueBy(members.flatMap((member) => member.aliases), (alias) => normalizeTitle(alias)),
      definition,
      scopeHint: members.some((member) => member.scopeHint === "universal") ? "universal" : "profession",
      tagIds,
      professionIds,
      rationale: members.map((member) => member.rationale).join(" "),
      status: "candidate",
      llmMeta: members[0]!.llmMeta,
      issues: [],
    });
  }

  const unassignedCandidateIds: string[] = [];
  for (const candidate of input.candidates) {
    if (!used.has(candidate.id)) unassignedCandidateIds.push(candidate.id);
  }
  for (const id of response.unassignedCandidateIds) {
    if (!byId.has(id)) issues.push(`reconcile: неизвестный unassigned id «${id}»`);
    else if (!unassignedCandidateIds.includes(id)) unassignedCandidateIds.push(id);
  }
  for (const candidate of input.candidates) {
    if (!used.has(candidate.id) && !unassignedCandidateIds.includes(candidate.id)) {
      unassignedCandidateIds.push(candidate.id);
    }
  }
  for (const id of unassignedCandidateIds) {
    const candidate = byId.get(id);
    if (candidate) merged.push({ ...candidate, status: "needs_review" });
  }

  return { candidates: merged, issues, unassignedCandidateIds };
}

export async function reconcileCandidates(input: ReconcileInput): Promise<ReconcileResult> {
  const chunkSize = input.chunkSize ?? 40;
  const chunks: CompetencyCandidate[][] = [];
  for (let offset = 0; offset < input.candidates.length; offset += chunkSize) {
    chunks.push(input.candidates.slice(offset, offset + chunkSize));
  }
  const groups: ReconcileResponse["groups"] = [];
  const unassignedCandidateIds: string[] = [];
  const issues: string[] = [];
  const runs: LlmMeta[] = [];

  for (const chunk of chunks) {
    const prompt = buildReconcilePrompt({
      candidates: chunk.map((candidate) => ({
        id: candidate.id,
        title: candidate.title,
        definition: candidate.definition,
        tagCount: candidate.tagIds.length,
        scopeHint: candidate.scopeHint,
      })),
      existingCatalogTitles: input.existingCatalogTitles ?? [],
    });
    let step;
    try {
      step = await runStructuredStep({
        transport: input.transport,
        prompt,
        schema: reconcileResponseSchema,
        policy: input.policy,
        budget: input.budget,
        ...(input.cache ? { cache: input.cache } : {}),
        ...(input.allowRepair === false ? { allowRepair: false } : {}),
      });
    } catch (error) {
      if (error instanceof BudgetExceededError) {
        issues.push(error.message);
        break;
      }
      throw error;
    }
    runs.push(step.meta);
    if (!step.data) {
      issues.push(...step.issues);
      continue;
    }
    const response = step.data as ReconcileResponse;
    groups.push(...response.groups);
    unassignedCandidateIds.push(...response.unassignedCandidateIds);
  }

  if (groups.length === 0) {
    return {
      candidates: input.candidates.map((candidate) => ({ ...candidate, status: "needs_review" })),
      issues,
      runs,
      unassignedCandidateIds,
    };
  }
  const validated = validateReconcileResponse(
    { groups, unassignedCandidateIds },
    {
      candidates: input.candidates,
      existingCatalogTitles: input.existingCatalogTitles ?? [],
    },
  );
  return {
    candidates: validated.candidates.sort((a, b) => a.title.localeCompare(b.title)),
    issues: [...issues, ...validated.issues],
    runs,
    unassignedCandidateIds: validated.unassignedCandidateIds,
  };
}
