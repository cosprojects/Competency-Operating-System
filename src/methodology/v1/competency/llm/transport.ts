import type { TokenUsage } from "../../ai-guardrails.ts";
import type { LlmPolicy } from "./policy.ts";

export interface ChatRequest {
  system: string;
  user: string;
  maxTokens: number;
  temperature: number;
}

export interface ChatResponse {
  content: string;
  model: string;
  usage?: TokenUsage;
}

export interface LlmTransport {
  chat(request: ChatRequest): Promise<ChatResponse>;
}

interface DeepSeekResponse {
  model?: string;
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_cache_hit_tokens?: number;
    prompt_cache_miss_tokens?: number;
    completion_tokens?: number;
  };
}

export class DeepSeekTransport implements LlmTransport {
  private readonly options: {
    apiKey: string;
    policy: LlmPolicy;
    fetchImpl: (
      input: string,
      init?: {
        method?: string;
        headers?: Record<string, string>;
        body?: string;
        signal?: AbortSignal;
      },
    ) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
  };

  constructor(options: {
    apiKey: string;
    policy: LlmPolicy;
    fetchImpl: (
      input: string,
      init?: {
        method?: string;
        headers?: Record<string, string>;
        body?: string;
        signal?: AbortSignal;
      },
    ) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
  }) {
    this.options = options;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const response = await this.options.fetchImpl(`${this.options.policy.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.options.policy.model,
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.user },
        ],
        max_tokens: request.maxTokens,
        temperature: request.temperature,
      }),
      signal: AbortSignal.timeout(this.options.policy.timeoutMs),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      throw new Error(
        `DeepSeek ответил ${response.status}${body.error?.message ? `: ${body.error.message}` : ""}`,
      );
    }
    const body = (await response.json()) as unknown as DeepSeekResponse;
    const content = body.choices?.[0]?.message?.content ?? "";
    return {
      content,
      model: body.model ?? this.options.policy.model,
      ...(body.usage
        ? {
            usage: {
              cacheHitTokens: body.usage.prompt_cache_hit_tokens ?? 0,
              cacheMissTokens: body.usage.prompt_cache_miss_tokens ?? 0,
              outputTokens: body.usage.completion_tokens ?? 0,
            },
          }
        : {}),
    };
  }
}

/** Детерминированный транспорт для тестов и прогонов без сети. */
export class FixtureTransport implements LlmTransport {
  calls: ChatRequest[] = [];
  private readonly responses: string[];

  constructor(responses: string[]) {
    this.responses = responses;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    this.calls.push(request);
    const content = this.responses.shift();
    if (content === undefined) throw new Error("FixtureTransport: закончились ответы");
    return { content, model: "fixture", usage: { cacheHitTokens: 0, cacheMissTokens: 0, outputTokens: 0 } };
  }
}
