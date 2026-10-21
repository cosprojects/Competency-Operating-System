import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { FetchLike } from "../../candidate-parser/types.ts";
import { DEFAULT_LLM_POLICY, type LlmPolicy } from "../llm/policy.ts";
import { DeepSeekTransport, FixtureTransport, type LlmTransport } from "../llm/transport.ts";

export function flagValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

export async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

export async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function policyFromArgv(argv: string[]): LlmPolicy {
  const budget = flagValue(argv, "--budget-usd");
  const policy: LlmPolicy = {
    ...DEFAULT_LLM_POLICY,
    ...(process.env.DEEPSEEK_MODEL_ID ? { model: process.env.DEEPSEEK_MODEL_ID } : {}),
  };
  if (budget) {
    const value = Number(budget);
    if (Number.isFinite(value) && value > 0) policy.maxCostUsd = value;
  }
  const maxTokens = flagValue(argv, "--max-tokens");
  if (maxTokens) {
    const value = Number(maxTokens);
    if (Number.isFinite(value) && value > 0) policy.maxOutputTokens = Math.floor(value);
  }
  const maxCalls = flagValue(argv, "--max-calls");
  if (maxCalls) {
    const value = Number(maxCalls);
    if (Number.isFinite(value) && value > 0) policy.maxCallsPerRun = Math.floor(value);
  }
  return policy;
}

export async function makeTransport(
  argv: string[],
  policy: LlmPolicy,
): Promise<{ transport: LlmTransport; kind: "live" | "fixture" }> {
  const fixture = flagValue(argv, "--fixture");
  if (fixture) {
    const file = path.resolve(fixture);
    const raw = JSON.parse(await readFile(file, "utf8")) as unknown;
    const list = Array.isArray(raw) ? raw : [raw];
    const responses = list.map((item) => (typeof item === "string" ? item : JSON.stringify(item)));
    return { transport: new FixtureTransport(responses), kind: "fixture" };
  }
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("Нет DEEPSEEK_API_KEY. Для прогона без сети используйте --fixture <file.json>");
  }
  const fetchImpl = (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal }) =>
    fetch(input, init);
  return {
    transport: new DeepSeekTransport({ apiKey, policy, fetchImpl }),
    kind: "live",
  };
}

export const cacheDir = (root: string): string => path.join(root, "data/competency/cache");
export const dataDir = (root: string): string => path.join(root, "data/competency");
