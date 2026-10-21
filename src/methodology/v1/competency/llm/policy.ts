import { DEEPSEEK_PRICING_USD_PER_MTOKENS, type TokenUsage } from "../../ai-guardrails.ts";

export interface LlmPolicy {
  model: string;
  baseUrl: string;
  temperature: number;
  maxCallsPerRun: number;
  maxCostUsd: number;
  maxOutputTokens: number;
  timeoutMs: number;
}

export const DEFAULT_LLM_POLICY: LlmPolicy = {
  model: process.env.DEEPSEEK_MODEL_ID ?? "deepseek-v4-flash",
  baseUrl: "https://api.deepseek.com/v1",
  temperature: 0.1,
  maxCallsPerRun: 60,
  maxCostUsd: 1.0,
  maxOutputTokens: 2500,
  timeoutMs: 120_000,
};

export function estimateCost(usage: TokenUsage): number {
  const pricing = DEEPSEEK_PRICING_USD_PER_MTOKENS;
  return (
    usage.cacheHitTokens * pricing.cacheHit +
    usage.cacheMissTokens * pricing.cacheMiss +
    usage.outputTokens * pricing.output
  ) / 1_000_000;
}

export class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BudgetExceededError";
  }
}

export class LlmBudget {
  calls = 0;
  costUsd = 0;
  private readonly policy: LlmPolicy;

  constructor(policy: LlmPolicy) {
    this.policy = policy;
  }

  canCall(): boolean {
    return this.calls < this.policy.maxCallsPerRun && this.costUsd < this.policy.maxCostUsd;
  }

  record(usage: TokenUsage | undefined): void {
    this.calls += 1;
    if (usage) this.costUsd += estimateCost(usage);
  }

  assertCanCall(): void {
    if (!this.canCall()) {
      throw new BudgetExceededError(
        `Бюджет LLM исчерпан: вызовов ${this.calls}/${this.policy.maxCallsPerRun}, стоимость $${this.costUsd.toFixed(4)}/$${this.policy.maxCostUsd}`,
      );
    }
  }
}
