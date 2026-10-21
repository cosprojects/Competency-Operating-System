import type { CompetencyBlock } from "../types.ts";
import { normalizeTitle } from "../sources/common.ts";
import type {
  PriorityFile,
  PriorityValidationOptions,
  PriorityValidationResult,
  StudyPriorityMark,
  StudyPriorityTier,
} from "./types.ts";
import { TIER_ORDER } from "./types.ts";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_TIERS = new Set<StudyPriorityTier>(["foundation", "core", "optional"]);

function isDate(value: string): boolean {
  return DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function cycleDetected(marks: StudyPriorityMark[], byCompetency: Map<string, StudyPriorityMark>): string[] {
  const errors: string[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (id: string, path: string[]): void => {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      errors.push(`priority: цикл зависимостей: ${[...path, id].join(" → ")}`);
      return;
    }
    visiting.add(id);
    const mark = byCompetency.get(id);
    for (const prerequisite of mark?.prerequisites ?? []) {
      if (byCompetency.has(prerequisite)) visit(prerequisite, [...path, id]);
    }
    visiting.delete(id);
    visited.add(id);
  };

  for (const mark of marks) visit(mark.competencyId, []);
  return [...new Set(errors)];
}

export function validatePriorityFile(
  file: PriorityFile,
  options: PriorityValidationOptions,
): PriorityValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const blocksById = new Map(options.blocks.map((block) => [block.id, block]));
  const professionId = file.professionId;
  const relevantBlocks = options.blocks.filter((block) => block.professionIds.includes(professionId));
  const relevantIds = new Set(relevantBlocks.map((block) => block.id));
  const byCompetency = new Map<string, StudyPriorityMark>();
  const orders = new Map<number, string>();

  if (!file.priorityVersion) errors.push("priority: не задан priorityVersion");
  if (!file.domain) errors.push("priority: не задан domain");
  if (!file.professionId) errors.push("priority: не задан professionId");
  if (!isDate(file.updatedOn)) errors.push("priority: updatedOn должен быть YYYY-MM-DD");
  if (file.status !== "draft" && file.status !== "accepted") {
    errors.push("priority: status должен быть draft или accepted");
  }
  if (!Array.isArray(file.marks)) errors.push("priority: marks не массив");

  for (const mark of file.marks ?? []) {
    const prefix = mark.competencyId || "mark";
    if (!mark.competencyId) {
      errors.push("priority: mark без competencyId");
      continue;
    }
    if (!byCompetency.has(mark.competencyId)) {
      byCompetency.set(mark.competencyId, mark);
    } else {
      errors.push(`priority «${prefix}»: повтор mark`);
    }
    if (!relevantIds.has(mark.competencyId)) {
      const block = blocksById.get(mark.competencyId);
      errors.push(
        block
          ? `priority «${prefix}»: блок не относится к профессии ${professionId}`
          : `priority «${prefix}»: неизвестный competencyId`,
      );
    }
    if (!VALID_TIERS.has(mark.tier)) errors.push(`priority «${prefix}»: недопустимый tier`);
    if (!Number.isInteger(mark.order) || mark.order <= 0) {
      errors.push(`priority «${prefix}»: order должен быть положительным целым`);
    } else if (orders.has(mark.order)) {
      errors.push(`priority «${prefix}»: order ${mark.order} уже занят «${orders.get(mark.order)}»`);
    } else {
      orders.set(mark.order, mark.competencyId);
    }
    if (!mark.rationale || mark.rationale.trim().length < 20) {
      errors.push(`priority «${prefix}»: rationale короче 20 символов`);
    }
    if (!["high", "medium", "low"].includes(mark.confidence)) {
      errors.push(`priority «${prefix}»: недопустимая confidence`);
    }
    if (!mark.reviewer || mark.reviewer.trim().length < 2) {
      errors.push(`priority «${prefix}»: не задан reviewer`);
    }
    if (!isDate(mark.reviewedAt)) {
      errors.push(`priority «${prefix}»: reviewedAt должен быть YYYY-MM-DD`);
    }
    if (!Array.isArray(mark.prerequisites)) {
      errors.push(`priority «${prefix}»: prerequisites не массив`);
    }
    for (const prerequisite of mark.prerequisites ?? []) {
      if (prerequisite === mark.competencyId) {
        errors.push(`priority «${prefix}»: prerequisite совпадает с самой компетенцией`);
        continue;
      }
      if (!byCompetency.has(prerequisite)) {
        // Проверяем существование в блоках, а не только в marks.
        if (!relevantIds.has(prerequisite)) {
          errors.push(`priority «${prefix}»: неизвестный prerequisite «${prerequisite}»`);
        }
      }
    }
  }

  for (const [id, mark] of byCompetency) {
    for (const prerequisite of mark.prerequisites ?? []) {
      const prerequisiteMark = byCompetency.get(prerequisite);
      if (!prerequisiteMark) continue;
      const currentRank = TIER_ORDER[mark.tier];
      const prerequisiteRank = TIER_ORDER[prerequisiteMark.tier];
      if (prerequisiteRank > currentRank) {
        errors.push(
          `priority «${id}»: prerequisite «${prerequisite}» имеет более поздний tier`,
        );
      }
      if (prerequisiteRank === currentRank && prerequisiteMark.order >= mark.order) {
        errors.push(
          `priority «${id}»: prerequisite «${prerequisite}» должен иметь меньший order`,
        );
      }
    }
  }

  errors.push(...cycleDetected([...byCompetency.values()], byCompetency));

  const missing = relevantBlocks
    .filter((block) => !byCompetency.has(block.id))
    .map((block) => block.id);
  if (options.requireComplete && missing.length > 0) {
    errors.push(`priority: не отмечены компетенции: ${missing.join(", ")}`);
  } else if (!options.requireComplete && missing.length > 0) {
    warnings.push(`priority: без метки остались ${missing.length} компетенций`);
  }

  if (options.requireAccepted) {
    if (file.status !== "accepted") errors.push("priority: файл должен иметь status=accepted");
    for (const mark of byCompetency.values()) {
      if (!isDate(mark.reviewedAt)) errors.push(`priority «${mark.competencyId}»: нет reviewedAt`);
    }
  }

  if (options.requireComplete) {
    const tiers = new Set([...byCompetency.values()].map((mark) => mark.tier));
    if (!tiers.has("foundation")) errors.push("priority: нет ни одной foundation-компетенции");
    if (!tiers.has("core")) errors.push("priority: нет ни одной core-компетенции");
  }

  const optionalCount = [...byCompetency.values()].filter((mark) => mark.tier === "optional").length;
  if (byCompetency.size > 0 && optionalCount / byCompetency.size > 0.5) {
    warnings.push(`priority: optional занимает ${Math.round((optionalCount / byCompetency.size) * 100)}% (>50%)`);
  }

  const titleSeen = new Map<string, string>();
  for (const block of relevantBlocks) {
    const key = normalizeTitle(block.title);
    const previous = titleSeen.get(key);
    if (previous && previous !== block.id) {
      warnings.push(`priority: похожие названия блоков «${block.title}» (${previous}, ${block.id})`);
    }
    titleSeen.set(key, block.id);
    if (block.status !== "accepted") {
      warnings.push(`priority: блок «${block.title}» в статусе ${block.status}, не accepted`);
    }
  }

  return { errors, warnings, marksByCompetency: byCompetency, missingCompetencyIds: missing };
}
