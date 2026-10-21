import type { CompetencyBlock } from "../types.ts";
import type {
  CanonicalCoverage,
  CanonicalMap,
  CanonicalStatus,
  CanonicalValidationInput,
  CanonicalValidationResult,
} from "./types.ts";

const STATUSES = new Set<CanonicalStatus>(["covered", "partial", "gap"]);
const HINTS = new Set(["foundation", "core", "optional"]);

function emptyCoverage(): CanonicalCoverage {
  return { total: 0, covered: 0, partial: 0, gap: 0, byBranch: {}, bySection: {} };
}

export function validateCanonicalMap(
  map: CanonicalMap,
  input: CanonicalValidationInput,
): CanonicalValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const coverage = emptyCoverage();
  const blocksById = new Map(input.blocks.map((block) => [block.id, block]));
  const professionBlocks = input.blocks.filter((block) => block.professionIds.includes(map.professionId));
  const mapped = new Set<string>();
  const competencyIds = new Set<string>();
  const sectionIds = new Set<string>();
  const branchIds = new Set<string>();

  if (map.canonicalVersion !== "0.1.0") errors.push("canonical: неверная canonicalVersion");
  if (!map.domain) errors.push("canonical: не задан domain");
  if (!map.professionId) errors.push("canonical: не задан professionId");
  if (map.status !== "draft" && map.status !== "accepted") errors.push("canonical: status должен быть draft/accepted");
  if (!Array.isArray(map.branches) || map.branches.length === 0) errors.push("canonical: нет branches");

  const expectedBranches = ["ux", "ui"];
  if (input.requireUxUiBranches) {
    for (const id of expectedBranches) {
      if (!map.branches.some((branch) => branch.id === id)) errors.push(`canonical: нет верхнего блока ${id}`);
    }
    if (map.branches.length !== 2) errors.push("canonical: для UX/UI должно быть ровно два верхних блока");
  }

  for (const branch of map.branches) {
    if (branchIds.has(branch.id)) errors.push(`canonical: повтор branch «${branch.id}»`);
    branchIds.add(branch.id);
    if (!branch.title || !branch.definition) errors.push(`canonical: branch «${branch.id}» без title/definition`);
    if (!Array.isArray(branch.sections) || branch.sections.length === 0) {
      errors.push(`canonical: branch «${branch.id}» без sections`);
      continue;
    }
    coverage.byBranch[branch.id] = { total: 0, covered: 0, partial: 0, gap: 0 };
    const sectionOrders = new Set<number>();

    for (const section of branch.sections) {
      if (sectionIds.has(section.id)) errors.push(`canonical: повтор section «${section.id}»`);
      sectionIds.add(section.id);
      if (sectionOrders.has(section.order)) errors.push(`canonical: branch «${branch.id}»: повтор order секции ${section.order}`);
      sectionOrders.add(section.order);
      if (!section.title || !section.definition) errors.push(`canonical: section «${section.id}» без title/definition`);
      if (!Array.isArray(section.competencies) || section.competencies.length === 0) {
        warnings.push(`canonical: section «${section.id}» без компетенций`);
        continue;
      }
      coverage.bySection[section.id] = { total: 0, covered: 0, partial: 0, gap: 0 };
      const competencyOrders = new Set<number>();

      for (const competency of section.competencies) {
        if (competencyIds.has(competency.id)) errors.push(`canonical: повтор competency «${competency.id}»`);
        competencyIds.add(competency.id);
        if (competencyOrders.has(competency.order)) {
          errors.push(`canonical: section «${section.id}»: повтор order компетенции ${competency.order}`);
        }
        competencyOrders.add(competency.order);
        if (!competency.title || competency.definition.length < 10) {
          errors.push(`canonical: competency «${competency.id}» без title/короткого definition`);
        }
        if (!STATUSES.has(competency.status)) errors.push(`canonical: competency «${competency.id}»: неверный status`);
        if (!HINTS.has(competency.priorityHint)) {
          errors.push(`canonical: competency «${competency.id}»: неверный priorityHint`);
        }
        if (!Array.isArray(competency.coveredBy)) {
          errors.push(`canonical: competency «${competency.id}»: coveredBy не массив`);
        } else if (competency.status === "gap" && competency.coveredBy.length > 0) {
          errors.push(`canonical: competency «${competency.id}»: gap не может иметь coveredBy`);
        } else if (competency.status !== "gap" && competency.coveredBy.length === 0) {
          errors.push(`canonical: competency «${competency.id}»: ${competency.status} требует coveredBy`);
        }

        for (const blockId of competency.coveredBy) {
          const block = blocksById.get(blockId);
          if (!block) {
            errors.push(`canonical: competency «${competency.id}»: неизвестный блок «${blockId}»`);
            continue;
          }
          if (!block.professionIds.includes(map.professionId)) {
            errors.push(`canonical: competency «${competency.id}»: блок «${blockId}» не относится к профессии`);
          }
          mapped.add(blockId);
        }

        coverage.total += 1;
        coverage.byBranch[branch.id]!.total += 1;
        coverage.bySection[section.id]!.total += 1;
        if (competency.status === "covered") {
          coverage.covered += 1;
          coverage.byBranch[branch.id]!.covered += 1;
          coverage.bySection[section.id]!.covered += 1;
        } else if (competency.status === "partial") {
          coverage.partial += 1;
          coverage.byBranch[branch.id]!.partial += 1;
          coverage.bySection[section.id]!.partial += 1;
        } else {
          coverage.gap += 1;
          coverage.byBranch[branch.id]!.gap += 1;
          coverage.bySection[section.id]!.gap += 1;
        }
      }
    }
  }

  const excluded = new Set<string>();
  for (const item of map.excludedBlocks ?? []) {
    if (excluded.has(item.blockId)) errors.push(`canonical: повтор excludedBlocks «${item.blockId}»`);
    excluded.add(item.blockId);
    if (!blocksById.has(item.blockId)) {
      errors.push(`canonical: excludedBlocks: неизвестный блок «${item.blockId}»`);
    }
    if (!item.reason || item.reason.length < 10) {
      errors.push(`canonical: excludedBlocks «${item.blockId}»: нет причины`);
    }
    if (mapped.has(item.blockId)) {
      errors.push(`canonical: блок «${item.blockId}» одновременно mapped и excluded`);
    }
  }

  const unmapped = professionBlocks
    .map((block) => block.id)
    .filter((id) => !mapped.has(id) && !excluded.has(id));
  if (unmapped.length > 0) {
    errors.push(`canonical: не классифицированы блоки: ${unmapped.join(", ")}`);
  }

  return {
    errors,
    warnings,
    coverage,
    mappedBlockIds: [...mapped],
    unmappedBlockIds: unmapped,
  };
}
