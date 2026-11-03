import type {
  CompetencyBlock,
  LlmMeta,
  Material,
  MaterialReview,
  MaterialReviewFlag,
} from "../competency/types.ts";
import type { CacheOptions } from "../profile/cache.ts";
import type { MaterialReviewResponse } from "../competency/llm/schemas.ts";
import { materialReviewSchema } from "../competency/llm/schemas.ts";
import { buildMaterialReviewPrompt } from "../competency/llm/prompts.ts";
import { runStructuredStep } from "../competency/llm/run.ts";
import { BudgetExceededError, type LlmBudget, type LlmPolicy } from "../competency/llm/policy.ts";
import type { LlmTransport } from "../competency/llm/transport.ts";
import { acceptanceOf, formatOf } from "./limits.ts";

/**
 * Pass E — ревью и приёмка материала методологом-LLM (COS-REL-009 §7.2).
 * Агент выносит вердикт и сохраняет его в `material.review`; решение о публикации
 * принимает `accept.ts` по вердикту, а не по одному порогу relevance.
 */

export type MaterialAcceptanceStatus = "accepted" | "needs_confirmation" | "rejected";
function isFlag(value: string): value is MaterialReviewFlag {
  return (
    value === "generic" ||
    value === "no_practice" ||
    value === "marketing" ||
    value === "paywall" ||
    value === "outdated" ||
    value === "no_snippet" ||
    value === "wrong_language" ||
    value === "duplicate" ||
    value === "off_topic" ||
    value === "invalid_response" ||
    value === "budget"
  );
}

export interface MaterialReviewResponseInput {
  verdict: MaterialReviewResponse["verdict"];
  confidence: number;
  usefulness: number;
  whyUseful: string;
  reason: string;
  flags?: MaterialReviewFlag[];
}

export function buildMaterialReview(input: {
  response: MaterialReviewResponseInput;
  relevance: number;
  reviewedAt: string;
}): MaterialReview {
  const status = acceptanceOf(input.response, input.relevance);
  return {
    verdict: input.response.verdict,
    confidence: input.response.confidence,
    usefulness: input.response.usefulness,
    whyUseful: input.response.whyUseful.trim(),
    reason: input.response.reason.trim(),
    flags: (input.response.flags ?? []).filter(isFlag),
    reviewedAt: input.reviewedAt,
    reviewer: "methodologist-v1",
    status,
  };
}

export interface MaterialReviewInput {
  materials: Material[];
  blocks: CompetencyBlock[];
  transport: LlmTransport;
  policy: LlmPolicy;
  budget: LlmBudget;
  retrievedOn: string;
  cache?: CacheOptions;
  limit?: number;
  allowRepair?: boolean;
  /** Сколько материалов формата уже принято по компетенции — контекст для LLM. */
  acceptedByFormat?: Map<string, number>;
  targetByFormat?: number;
  /** Тир компетенции: влияет на цель в контексте промпта. */
  tierByCompetency?: Map<string, "foundation" | "core" | "optional">;
}

export interface MaterialReviewResult {
  materials: Material[];
  issues: string[];
  runs: LlmMeta[];
}

function fallbackReview(reason: string, flag: MaterialReviewFlag, reviewedAt: string): MaterialReview {
  return {
    verdict: "confirm",
    confidence: 0,
    usefulness: 0,
    whyUseful: "Кандидат не проверен автоматически",
    reason,
    flags: [flag],
    reviewedAt,
    reviewer: "methodologist-v1",
    status: "needs_confirmation",
  };
}

export async function reviewMaterials(input: MaterialReviewInput): Promise<MaterialReviewResult> {
  const blocksById = new Map(input.blocks.map((block) => [block.id, block]));
  const materials: Material[] = [];
  const issues: string[] = [];
  const runs: LlmMeta[] = [];
  const selected = input.limit ? input.materials.slice(0, input.limit) : input.materials;

  for (let index = 0; index < selected.length; index += 1) {
    const material = selected[index]!;
    const block = material.discoveredFor
      .map((id) => blocksById.get(id))
      .find((candidate): candidate is CompetencyBlock => candidate !== undefined);
    if (!block) {
      issues.push(`${material.title}: нет accepted-блока для ревью`);
      materials.push(material);
      continue;
    }
    const format = formatOf(material.kind);
    const tier = input.tierByCompetency?.get(block.id);
    const acceptedInFormat = input.acceptedByFormat?.get(`${block.id}|${format}`) ?? 0;
    const target = input.targetByFormat ?? (tier === "foundation" ? 5 : tier === "optional" ? 2 : 3);
    const relevance = material.links
      .filter((link) => link.competencyId === block.id)
      .reduce((max, link) => Math.max(max, link.relevance), 0);
    const prompt = buildMaterialReviewPrompt({
      competency: { id: block.id, title: block.title, definition: block.definition },
      components: block.components,
      tags: block.tags,
      material,
      format,
      acceptedInFormat,
      target,
    });

    try {
      const step = await runStructuredStep({
        transport: input.transport,
        prompt,
        schema: materialReviewSchema,
        policy: input.policy,
        budget: input.budget,
        ...(input.cache ? { cache: input.cache } : {}),
        ...(input.allowRepair === false ? { allowRepair: false } : {}),
      });
      runs.push(step.meta);
      if (!step.data) {
        const reason = step.issues.join("; ") || "LLM не вернула валидный вердикт";
        issues.push(`${material.title}: ${reason}`);
        materials.push({ ...material, review: fallbackReview(reason, "invalid_response", input.retrievedOn) });
        continue;
      }
      materials.push({
        ...material,
        review: buildMaterialReview({
          response: step.data,
          relevance,
          reviewedAt: input.retrievedOn,
        }),
      });
    } catch (error) {
      if (error instanceof BudgetExceededError) {
        // Бюджет кончился: не выбрасываем кандидатов, а помечаем как непроверенные.
        issues.push(error.message);
        for (const rest of selected.slice(index)) {
          materials.push({ ...rest, review: fallbackReview(error.message, "budget", input.retrievedOn) });
        }
        break;
      }
      throw error;
    }
  }

  return { materials, issues, runs };
}
