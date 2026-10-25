import type { FetchLike } from "../candidate-parser/types.ts";
import type { CatalogFile, CompetencyBlock, Material } from "../competency/types.ts";
import type { LlmBudget } from "../competency/llm/policy.ts";
import { BudgetExceededError } from "../competency/llm/policy.ts";
import type { CacheOptions } from "../profile/cache.ts";
import type { MaterialAgentDeps } from "./types.ts";

export interface MaterialQueueItem {
  id: string;
  professionId: string;
  competencyId: string;
  title: string;
}

export interface MaterialQueueItemResult {
  item: MaterialQueueItem;
  status: "completed" | "failed";
  attempts: number;
  materials: Material[];
  discoveryCoverage?: { materials: number; kinds: Record<string, number> };
  linked: number;
  errors: string[];
}

export interface MaterialQueueJournal {
  agentVersion: "1.0.0";
  agentMode: "worker";
  journalVersion: "1.0.0";
  domain: string;
  professionId: string;
  generatedOn: string;
  writesToGraph: false;
  status: "completed" | "partial";
  queue: MaterialQueueItem[];
  items: MaterialQueueItemResult[];
  materials: Material[];
  totals: { items: number; completed: number; failed: number; discovered: number; linked: number; calls: number; costUsd: number };
  notes: string[];
}

export function buildMaterialQueue(
  catalog: CatalogFile,
  professionId: string,
  options: { competencyIds?: string[] } = {},
): MaterialQueueItem[] {
  const accepted = catalog.blocks.filter((block) => block.status === "accepted");
  const byCompetency = new Map<string, CompetencyBlock[]>();
  for (const block of accepted) {
    for (const canonicalId of block.canonicalIds ?? []) {
      const list = byCompetency.get(canonicalId) ?? [];
      if (!list.some((item) => item.id === block.id)) list.push(block);
      byCompetency.set(canonicalId, list);
    }
  }
  const ordered: CompetencyBlock[] = [];
  const seen = new Set<string>();
  const add = (block: CompetencyBlock): void => {
    if (seen.has(block.id)) return;
    seen.add(block.id);
    ordered.push(block);
  };
  if (options.competencyIds && options.competencyIds.length > 0) {
    // Очередь идёт по графу профессии: каждая компетенция получает свой блок,
    // в том числе переиспользованный из другой профессии (canonicalIds).
    for (const competencyId of options.competencyIds) {
      for (const block of byCompetency.get(competencyId) ?? []) add(block);
    }
    // Accepted-блоки, объявленные за профессией, но не входящие в view, не теряем.
    for (const block of accepted.filter((item) => item.professionIds.includes(professionId))) add(block);
  } else {
    for (const block of accepted.filter((item) => item.professionIds.includes(professionId)).sort((a, b) => a.title.localeCompare(b.title))) {
      add(block);
    }
  }
  return ordered.map((block) => ({ id: `${professionId}:${block.id}`, professionId, competencyId: block.id, title: block.title }));
}

export interface MaterialQueueInput {
  domain: string;
  professionId: string;
  catalog: CatalogFile;
  fetchImpl: FetchLike;
  retrievedOn: string;
  sourceIds?: string[];
  limit?: number;
  limitPerCompetency?: number;
  /** Компетенции профессии в порядке view; очередь покрывает их covering-блоки. */
  competencyIds?: string[];
  classify?: boolean;
  concurrency?: number;
  maxAttempts?: number;
  transport?: import("../competency/llm/transport.ts").LlmTransport;
  policy?: import("../competency/llm/policy.ts").LlmPolicy;
  budget?: LlmBudget;
  cache?: CacheOptions;
}

async function processItem(input: MaterialQueueInput, block: CompetencyBlock, deps: MaterialAgentDeps): Promise<MaterialQueueItemResult> {
  const item = { id: `${input.professionId}:${block.id}`, professionId: input.professionId, competencyId: block.id, title: block.title };
  let lastError = "unknown";
  for (let attempt = 1; attempt <= (input.maxAttempts ?? 2); attempt += 1) {
    try {
      const collected = await deps.collect({
        competencies: [block],
        fetchImpl: input.fetchImpl,
        retrievedOn: input.retrievedOn,
        ...(input.sourceIds ? { sourceIds: input.sourceIds } : {}),
        ...(input.limitPerCompetency ? { limitPerCompetency: input.limitPerCompetency } : {}),
      });
      let materials = collected.materials;
      if (input.classify) {
        if (!input.transport || !input.policy || !input.budget) throw new Error("classify требует transport/policy/budget");
        const classified = await deps.classify({ materials, blocks: [block], transport: input.transport, policy: input.policy, budget: input.budget, ...(input.cache ? { cache: input.cache } : {}) });
        materials = classified.materials;
      }
      const validation = deps.validate(materials, [block]);
      return {
        item,
        status: validation.errors.length > 0 ? "failed" : "completed",
        attempts: attempt,
        materials,
        discoveryCoverage: {
          materials: collected.coverage[0]?.materials ?? materials.length,
          kinds: collected.coverage[0]?.kinds ?? {},
        },
        linked: materials.filter((material) => material.links.length > 0).length,
        errors: validation.errors,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "unknown";
      if (error instanceof BudgetExceededError) break;
    }
  }
  return {
    item,
    status: "failed",
    attempts: input.maxAttempts ?? 2,
    materials: [],
    linked: 0,
    errors: [lastError],
  };
}

export async function runMaterialQueue(
  input: MaterialQueueInput,
  deps: MaterialAgentDeps,
): Promise<MaterialQueueJournal> {
  const queue = buildMaterialQueue(input.catalog, input.professionId, {
    ...(input.competencyIds ? { competencyIds: input.competencyIds } : {}),
  }).slice(0, input.limit ?? undefined);
  if (queue.length === 0) throw new Error(`Очередь пуста для ${input.professionId}`);
  const blocks = new Map(input.catalog.blocks.map((block) => [block.id, block]));
  const results: MaterialQueueItemResult[] = [];
  let cursor = 0;
  const workers = Math.min(Math.max(input.concurrency ?? 2, 1), queue.length);
  async function worker(): Promise<void> {
    while (cursor < queue.length) {
      const index = cursor;
      cursor += 1;
      const queueItem = queue[index];
      if (!queueItem) return;
      const block = blocks.get(queueItem.competencyId);
      if (!block) {
        results.push({ item: queueItem, status: "failed", attempts: 0, materials: [], linked: 0, errors: ["блок не найден"] });
        continue;
      }
      results.push(await processItem(input, block, deps));
    }
  }
  await Promise.all(Array.from({ length: workers }, () => worker()));
  const materials = results.flatMap((item) => item.materials);
  const notes: string[] = [];
  for (const result of results.filter((item) => item.status === "failed")) {
    notes.push(`${result.item.title}: ${result.errors.join("; ")}`);
  }
  return {
    agentVersion: "1.0.0",
    agentMode: "worker",
    journalVersion: "1.0.0",
    domain: input.domain,
    professionId: input.professionId,
    generatedOn: input.retrievedOn,
    writesToGraph: false,
    status: results.some((item) => item.status === "failed") ? "partial" : "completed",
    queue,
    items: results.sort((a, b) => a.item.title.localeCompare(b.item.title)),
    materials,
    totals: {
      items: results.length,
      completed: results.filter((item) => item.status === "completed").length,
      failed: results.filter((item) => item.status === "failed").length,
      discovered: materials.length,
      linked: materials.filter((material) => material.links.length > 0).length,
      calls: input.budget?.calls ?? 0,
      costUsd: input.budget?.costUsd ?? 0,
    },
    notes,
  };
}
