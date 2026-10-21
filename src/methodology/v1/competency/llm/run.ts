import type { z } from "zod";
import type { CacheOptions } from "../../profile/cache.ts";
import { cachedJson } from "../../profile/cache.ts";
import type { LlmMeta } from "../types.ts";
import { estimateCost, type LlmBudget, type LlmPolicy } from "./policy.ts";
import type { BuiltPrompt } from "./prompts.ts";
import type { ChatResponse, LlmTransport } from "./transport.ts";

export interface StructuredStepInput<T> {
  transport: LlmTransport;
  prompt: BuiltPrompt;
  schema: z.ZodType<T>;
  policy: LlmPolicy;
  budget: LlmBudget;
  cache?: CacheOptions;
  allowRepair?: boolean;
}

export interface StructuredStepResult<T> {
  data: T | null;
  meta: LlmMeta;
  issues: string[];
  cached: boolean;
}

interface CachedLlmResponse {
  content: string;
  model: string;
}

function parseJson(content: string): unknown {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("В ответе нет JSON-объекта");
  return JSON.parse(content.slice(start, end + 1)) as unknown;
}

function zodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`);
}

function metaFor(
  prompt: BuiltPrompt,
  model: string,
  costUsd: number,
  cached: boolean,
  response?: ChatResponse,
): LlmMeta {
  const usage = response?.usage;
  return {
    promptVersion: prompt.version,
    model,
    inputHash: prompt.inputHash,
    costUsd: cached ? 0 : costUsd,
    ...(usage
      ? {
          tokens: {
            cacheHitTokens: usage.cacheHitTokens,
            cacheMissTokens: usage.cacheMissTokens,
            outputTokens: usage.outputTokens,
          },
        }
      : {}),
  };
}

async function callOnce<T>(params: {
  transport: LlmTransport;
  prompt: BuiltPrompt;
  schema: z.ZodType<T>;
  policy: LlmPolicy;
  budget: LlmBudget;
  repairIssues?: string[];
}): Promise<{ data: T | null; issues: string[]; response: ChatResponse; costUsd: number }> {
  params.budget.assertCanCall();
  const user = params.repairIssues
    ? [
        params.prompt.user,
        "",
        "<validation_errors>",
        params.repairIssues.join("\n"),
        "</validation_errors>",
        "Исправь ответ так, чтобы он проходил схему и ограничения. Верни только JSON.",
      ].join("\n")
    : params.prompt.user;
  const response = await params.transport.chat({
    system: params.prompt.system,
    user,
    maxTokens: params.policy.maxOutputTokens,
    temperature: params.policy.temperature,
  });
  params.budget.record(response.usage);
  const costUsd = response.usage ? estimateCost(response.usage) : 0;
  let parsed: unknown;
  try {
    parsed = parseJson(response.content);
  } catch (error) {
    return {
      data: null,
      issues: [error instanceof Error ? error.message : "не удалось разобрать JSON"],
      response,
      costUsd,
    };
  }
  const validated = params.schema.safeParse(parsed);
  if (!validated.success) {
    return { data: null, issues: zodIssues(validated.error), response, costUsd };
  }
  return { data: validated.data, issues: [], response, costUsd };
}

export async function runStructuredStep<T>(
  input: StructuredStepInput<T>,
): Promise<StructuredStepResult<T>> {
  const key = `llm-${input.prompt.inputHash}`;
  const cached = await cachedJson<CachedLlmResponse | undefined>(input.cache, key, async () => undefined);
  if (cached) {
    const parsed = input.schema.safeParse(parseJson(cached.content));
    if (parsed.success) {
      return {
        data: parsed.data,
        meta: metaFor(input.prompt, cached.model, 0, true),
        issues: [],
        cached: true,
      };
    }
  }

  const first = await callOnce({
    transport: input.transport,
    prompt: input.prompt,
    schema: input.schema,
    policy: input.policy,
    budget: input.budget,
  });
  if (first.data !== null) {
    await cachedJson<CachedLlmResponse>(input.cache, key, async () => ({
      content: first.response.content,
      model: first.response.model,
    }));
    return {
      data: first.data,
      meta: metaFor(input.prompt, first.response.model, first.costUsd, false, first.response),
      issues: [],
      cached: false,
    };
  }

  if (input.allowRepair !== false && input.budget.canCall()) {
    const repaired = await callOnce({
      transport: input.transport,
      prompt: input.prompt,
      schema: input.schema,
      policy: input.policy,
      budget: input.budget,
      repairIssues: first.issues,
    });
    if (repaired.data !== null) {
      await cachedJson<CachedLlmResponse>(input.cache, key, async () => ({
        content: repaired.response.content,
        model: repaired.response.model,
      }));
      return {
        data: repaired.data,
        meta: metaFor(input.prompt, repaired.response.model, first.costUsd + repaired.costUsd, false, repaired.response),
        issues: [],
        cached: false,
      };
    }
    return {
      data: null,
      meta: metaFor(input.prompt, repaired.response.model, first.costUsd + repaired.costUsd, false, repaired.response),
      issues: [...first.issues, ...repaired.issues],
      cached: false,
    };
  }

  return {
    data: null,
    meta: metaFor(input.prompt, first.response.model, first.costUsd, false, first.response),
    issues: first.issues,
    cached: false,
  };
}
