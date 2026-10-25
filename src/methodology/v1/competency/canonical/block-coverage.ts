import type { CompetencyBlock } from "../types.ts";
import type { CanonicalMap } from "./types.ts";

/**
 * Обратное отображение canonical map: blockId → id компетенций, которые этот блок покрывает.
 *
 * canonical map хранит покрытие как `competency.coveredBy`, а каталог — как `block.canonicalIds`.
 * Это две проекции одного и того же факта. Функция собирает вторую проекцию из первой, чтобы
 * accepted-блоки, принятые до появления `canonicalIds`, не выпадали из графов и не выглядели
 * «узлами без блока».
 */
export function canonicalIdsByBlock(map: CanonicalMap): Map<string, string[]> {
  const byBlock = new Map<string, string[]>();
  for (const branch of map.branches) {
    for (const section of branch.sections) {
      for (const competency of section.competencies) {
        for (const blockId of competency.coveredBy) {
          const list = byBlock.get(blockId) ?? [];
          if (!list.includes(competency.id)) list.push(competency.id);
          byBlock.set(blockId, list);
        }
      }
    }
  }
  return byBlock;
}

/**
 * Добавляет к блоку выведенные canonicalIds, не теряя уже объявленные.
 * `knownCanonicalIds` ограничивает результат только компетенциями, которые существуют
 * в canonical map или в едином массиве, чтобы каталог не накапливал висячие ссылки.
 */
export function withDerivedCanonicalIds(
  block: CompetencyBlock,
  derived: Map<string, string[]>,
  knownCanonicalIds: Set<string>,
): CompetencyBlock {
  const merged = [...new Set([...(block.canonicalIds ?? []), ...(derived.get(block.id) ?? [])])]
    .filter((id) => knownCanonicalIds.has(id))
    .sort((a, b) => a.localeCompare(b));
  if (merged.length === 0) {
    const withoutCanonicalIds = { ...block };
    delete withoutCanonicalIds.canonicalIds;
    return withoutCanonicalIds;
  }
  return { ...block, canonicalIds: merged };
}

/** Компетенции, для которых нет ни одного accepted-блока с этим canonicalId. */
export function competenciesWithoutBlocks(
  competencyIds: string[],
  blocks: CompetencyBlock[],
): string[] {
  const covered = new Set<string>();
  for (const block of blocks) {
    if (block.status !== "accepted") continue;
    for (const canonicalId of block.canonicalIds ?? []) covered.add(canonicalId);
  }
  return competencyIds.filter((id) => !covered.has(id));
}
