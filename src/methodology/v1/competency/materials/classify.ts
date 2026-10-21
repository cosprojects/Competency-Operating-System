import type { CacheOptions } from "../../profile/cache.ts";
import type { CompetencyBlock, Material, MaterialLink } from "../types.ts";
import type { MaterialResponse } from "../llm/schemas.ts";
import { materialResponseSchema } from "../llm/schemas.ts";
import { buildMaterialPrompt } from "../llm/prompts.ts";
import { runStructuredStep } from "../llm/run.ts";
import type { LlmPolicy } from "../llm/policy.ts";
import { BudgetExceededError, type LlmBudget } from "../llm/policy.ts";
import type { LlmTransport } from "../llm/transport.ts";
import type { LlmMeta } from "../types.ts";

export interface ValidatedMaterial {
  links: MaterialLink[];
  rejected: string[];
  issues: string[];
}

export function validateMaterialResponse(
  response: MaterialResponse,
  input: { material: Material; blocks: CompetencyBlock[] },
): ValidatedMaterial {
  const issues: string[] = [];
  const links: MaterialLink[] = [];
  const blocksById = new Map(input.blocks.map((block) => [block.id, block]));
  const discovered = new Set(input.material.discoveredFor);
  const seen = new Set<string>();

  for (const link of response.links) {
    const block = blocksById.get(link.competencyId);
    if (!block || !discovered.has(link.competencyId)) {
      issues.push(`компетенция «${link.competencyId}» не относится к материалу`);
      continue;
    }
    if (link.componentId && !block.components.some((component) => component.id === link.componentId)) {
      issues.push(`компонент «${link.componentId}» не найден в компетенции`);
      continue;
    }
    if (link.tagId && !block.tags.some((tag) => tag.id === link.tagId)) {
      issues.push(`тег «${link.tagId}» не найден в компетенции`);
      continue;
    }
    const key = `${link.competencyId}|${link.componentId ?? ""}|${link.tagId ?? ""}`;
    if (seen.has(key)) {
      issues.push(`дубль связи «${key}»`);
      continue;
    }
    seen.add(key);
    const modelProposal = link.modelProposal || !input.material.snippet;
    if (!link.modelProposal && !input.material.snippet) {
      issues.push(`связь «${key}» без snippet должна быть modelProposal`);
    }
    links.push({ ...link, modelProposal });
  }

  if (links.length === 0) issues.push("материал не получил ни одной связи");
  const rejected = response.rejected.map((item) =>
    typeof item === "string" ? item : JSON.stringify(item),
  );
  return { links, rejected, issues };
}

export interface MaterialClassifyInput {
  materials: Material[];
  blocks: CompetencyBlock[];
  transport: LlmTransport;
  policy: LlmPolicy;
  budget: LlmBudget;
  cache?: CacheOptions;
  limit?: number;
  allowRepair?: boolean;
}

export interface MaterialClassifyResult {
  materials: Material[];
  issues: string[];
  runs: LlmMeta[];
}

export async function classifyMaterials(input: MaterialClassifyInput): Promise<MaterialClassifyResult> {
  const blocksById = new Map(input.blocks.map((block) => [block.id, block]));
  const materials: Material[] = [];
  const issues: string[] = [];
  const runs: LlmMeta[] = [];
  const selected = input.limit ? input.materials.slice(0, input.limit) : input.materials;

  for (const material of selected) {
    const blocks = material.discoveredFor
      .map((id) => blocksById.get(id))
      .filter((block): block is CompetencyBlock => block !== undefined);
    if (blocks.length === 0) {
      materials.push({ ...material, status: "needs_review", issues: ["нет компетенции для сопоставления"] });
      continue;
    }
    const block = blocks[0]!;
    const prompt = buildMaterialPrompt({
      competency: { id: block.id, title: block.title, definition: block.definition },
      components: block.components,
      tags: block.tags,
      materials: [material],
    });
    let step;
    try {
      step = await runStructuredStep({
        transport: input.transport,
        prompt,
        schema: materialResponseSchema,
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
      issues.push(...step.issues.map((issue) => `${material.title}: ${issue}`));
      materials.push({ ...material, status: "needs_review", issues: step.issues });
      continue;
    }
    const validated = validateMaterialResponse(step.data as MaterialResponse, {
      material,
      blocks,
    });
    issues.push(...validated.issues.map((issue) => `${material.title}: ${issue}`));
    materials.push({
      ...material,
      links: validated.links,
      status: "needs_review",
      issues: validated.issues,
    });
  }

  return { materials, issues, runs };
}
