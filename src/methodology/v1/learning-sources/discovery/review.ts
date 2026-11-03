import type { LlmMeta } from "../../competency/types.ts";
import type { CacheOptions } from "../../profile/cache.ts";
import { materialReviewSchema } from "../../competency/llm/schemas.ts";
import { buildSourceReviewPrompt } from "../../competency/llm/prompts.ts";
import { runStructuredStep } from "../../competency/llm/run.ts";
import { BudgetExceededError, type LlmBudget, type LlmPolicy } from "../../competency/llm/policy.ts";
import type { LlmTransport } from "../../competency/llm/transport.ts";
import type { CompetencyContext, SourceCandidate } from "./types.ts";

export interface SourceReviewResult {
  candidates: SourceCandidate[];
  issues: string[];
  runs: LlmMeta[];
}

/**
 * LLM-ревью кандидатов в ресурсную базу (Pass E для источников).
 * Решает, учит ли сайт/канал теме компетенции; сомнительное — confirm, а не accept.
 */
export async function reviewSourceCandidates(input: {
  candidates: SourceCandidate[];
  contexts: Map<string, CompetencyContext>;
  transport: LlmTransport;
  policy: LlmPolicy;
  budget: LlmBudget;
  cache?: CacheOptions;
  limit?: number;
}): Promise<SourceReviewResult> {
  const reviewed: SourceCandidate[] = [];
  const issues: string[] = [];
  const runs: LlmMeta[] = [];
  const selected = input.limit ? input.candidates.slice(0, input.limit) : input.candidates;
  for (let index = 0; index < selected.length; index += 1) {
    const candidate = selected[index]!;
    const context = input.contexts.get(candidate.competencyId);
    if (!context) {
      reviewed.push(candidate);
      continue;
    }
    const prompt = buildSourceReviewPrompt({
      competency: {
        title: context.title,
        definition: context.definition,
        components: context.components,
      },
      candidate: {
        url: candidate.url,
        domain: candidate.domain,
        title: candidate.title,
        ...(candidate.snippet ? { snippet: candidate.snippet } : {}),
        query: candidate.query,
        kind: candidate.kind,
        languages: candidate.languages,
        score: candidate.score,
      },
    });
    try {
      const step = await runStructuredStep({
        transport: input.transport,
        prompt,
        schema: materialReviewSchema,
        policy: input.policy,
        budget: input.budget,
        ...(input.cache ? { cache: input.cache } : {}),
      });
      runs.push(step.meta);
      const data = step.data;
      if (!data) {
        issues.push(`${candidate.domain}: ${step.issues.join("; ") || "нет валидного вердикта"}`);
        reviewed.push({
          ...candidate,
          review: {
            verdict: "confirm",
            confidence: 0,
            usefulness: 0,
            whyUseful: "Не проверено автоматически",
            reason: step.issues.join("; ") || "invalid_response",
            flags: ["invalid_response"],
          },
        });
        continue;
      }
      reviewed.push({
        ...candidate,
        review: {
          verdict: data.verdict,
          confidence: data.confidence,
          usefulness: data.usefulness,
          whyUseful: data.whyUseful,
          reason: data.reason,
          flags: data.flags ?? [],
        },
      });
    } catch (error) {
      if (error instanceof BudgetExceededError) {
        issues.push(error.message);
        for (const rest of selected.slice(index)) {
          reviewed.push({
            ...rest,
            review: {
              verdict: "confirm",
              confidence: 0,
              usefulness: 0,
              whyUseful: "Бюджет LLM исчерпан",
              reason: error.message,
              flags: ["budget"],
            },
          });
        }
        break;
      }
      throw error;
    }
  }
  return { candidates: reviewed, issues, runs };
}
