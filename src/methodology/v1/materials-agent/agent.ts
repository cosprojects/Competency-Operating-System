import type { CompetencyBlock } from "../competency/types.ts";
import { collectMaterials } from "../competency/materials/collect.ts";
import { classifyMaterials } from "../competency/materials/classify.ts";
import { validateMaterials } from "../competency/materials/validate.ts";
import type { MaterialAgentDeps, MaterialAgentInput, MaterialAgentJournal } from "./types.ts";

const DEFAULT_DEPS: MaterialAgentDeps = {
  collect: collectMaterials,
  classify: classifyMaterials,
  validate: validateMaterials,
};

export async function runMaterialAgent(
  input: MaterialAgentInput,
  deps: MaterialAgentDeps = DEFAULT_DEPS,
): Promise<MaterialAgentJournal> {
  const blocks = input.catalog.blocks
    .filter((block) => block.professionIds.includes(input.professionId))
    .slice(0, input.limitCompetencies ?? undefined);
  if (blocks.length === 0) throw new Error(`В каталоге нет accepted-блоков для ${input.professionId}`);

  const discovered = await deps.collect({
    competencies: blocks,
    fetchImpl: input.fetchImpl,
    retrievedOn: input.retrievedOn,
    ...(input.sourceIds ? { sourceIds: input.sourceIds } : {}),
    ...(input.limitPerCompetency ? { limitPerCompetency: input.limitPerCompetency } : {}),
    ...(input.youtubeApiKey ? { youtubeApiKey: input.youtubeApiKey } : {}),
  });

  let materials = discovered.materials;
  let classification: MaterialAgentJournal["stages"]["classification"];
  if (input.classify) {
    if (!input.transport || !input.policy || !input.budget) {
      throw new Error("Для classify нужны transport, policy и budget");
    }
    const classified = await deps.classify({
      materials,
      blocks,
      transport: input.transport,
      policy: input.policy,
      budget: input.budget,
      ...(input.cache ? { cache: input.cache } : {}),
    });
    materials = classified.materials;
    classification = {
      materials: materials.length,
      linked: materials.filter((material) => material.links.length > 0).length,
      issues: classified.issues,
      calls: input.budget.calls,
      costUsd: input.budget.costUsd,
    };
  }

  const validation = deps.validate(materials, blocks);
  const notes = [...discovered.notes];
  if (classification && classification.issues.length > 0) notes.push(...classification.issues);
  const hasErrors = validation.errors.length > 0 || (!input.classify && validation.errors.length > 0);

  const journal: MaterialAgentJournal = {
    agentVersion: "1.0.0",
    journalVersion: "1.0.0",
    domain: input.domain,
    professionId: input.professionId,
    generatedOn: input.retrievedOn,
    writesToGraph: false,
    status: hasErrors ? "partial" : "completed",
    stages: {
      discovery: {
        competencies: blocks.length,
        materials: discovered.materials.length,
        notes: discovered.notes,
      },
      ...(classification ? { classification } : {}),
      validation: { errors: validation.errors, coverage: validation.coverage },
    },
    discoveryCoverage: discovered.coverage.map((item) => ({
      competencyId: item.competencyId,
      title: item.title,
      materials: item.materials,
      kinds: item.kinds,
      ...(item.noMaterialState ? { noMaterialState: item.noMaterialState } : {}),
    })),
    materials,
    notes,
  };
  return journal;
}

export function describeAgentReadiness(journal: MaterialAgentJournal): string {
  const linked = journal.stages.classification?.linked ?? 0;
  const total = journal.stages.classification?.materials ?? journal.stages.discovery.materials;
  return `competencies=${journal.stages.discovery.competencies}; discovered=${journal.stages.discovery.materials}; linked=${linked}/${total}; errors=${journal.stages.validation.errors.length}`;
}

/** Для тестов: позволяет подменить сеть/LLM, не меняя production-путь. */
export function createMaterialAgentDeps(partial: Partial<MaterialAgentDeps>): MaterialAgentDeps {
  return { ...DEFAULT_DEPS, ...partial };
}

export type { CompetencyBlock };
