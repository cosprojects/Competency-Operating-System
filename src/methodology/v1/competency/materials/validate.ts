import type { CompetencyBlock, Material, MaterialKind } from "../types.ts";

export interface MaterialCoverageResult {
  competencyId: string;
  title: string;
  materials: number;
  kinds: Partial<Record<MaterialKind, number>>;
  hasFree: boolean;
  hasPaid: boolean;
}

export interface MaterialValidationResult {
  errors: string[];
  coverage: MaterialCoverageResult[];
}

export function validateMaterials(
  materials: Material[],
  blocks: CompetencyBlock[],
  options: { requireAccepted?: boolean } = {},
): MaterialValidationResult {
  const errors: string[] = [];
  const ids = new Set<string>();
  const canonical = new Set<string>();
  const blocksById = new Map(blocks.map((block) => [block.id, block]));

  for (const material of materials) {
    if (!material.id || !material.title || !material.url) errors.push("material: нет id/title/url");
    if (ids.has(material.id)) errors.push(`material: повтор id «${material.id}»`);
    ids.add(material.id);
    if (!/^https?:\/\//.test(material.url)) errors.push(`material «${material.id}»: плохой url`);
    if (!material.canonicalUrl) errors.push(`material «${material.id}»: нет canonicalUrl`);
    if (canonical.has(material.canonicalUrl)) {
      errors.push(`material «${material.id}»: дубль canonicalUrl`);
    }
    canonical.add(material.canonicalUrl);
    if (options.requireAccepted && material.status !== "accepted") {
      errors.push(`material «${material.id}»: в каталоге только accepted`);
    }
    if (material.access === "paid" && !material.price?.observedAt) {
      errors.push(`material «${material.id}»: платный без даты наблюдения цены`);
    }
    for (const link of material.links) {
      const block = blocksById.get(link.competencyId);
      if (!block) {
        errors.push(`material «${material.id}»: компетенции «${link.competencyId}» нет`);
        continue;
      }
      if (link.componentId && !block.components.some((component) => component.id === link.componentId)) {
        errors.push(`material «${material.id}»: компонента «${link.componentId}» нет`);
      }
      if (link.tagId && !block.tags.some((tag) => tag.id === link.tagId)) {
        errors.push(`material «${material.id}»: тега «${link.tagId}» нет`);
      }
      if (link.relevance < 0 || link.relevance > 1) {
        errors.push(`material «${material.id}»: relevance вне 0..1`);
      }
    }
  }

  const coverage: MaterialCoverageResult[] = blocks.map((block) => {
    const linked = materials.filter((material) =>
      material.links.some((link) => link.competencyId === block.id),
    );
    const kinds: Partial<Record<MaterialKind, number>> = {};
    for (const material of linked) kinds[material.kind] = (kinds[material.kind] ?? 0) + 1;
    return {
      competencyId: block.id,
      title: block.title,
      materials: linked.length,
      kinds,
      hasFree: linked.some((material) => material.access !== "paid"),
      hasPaid: linked.some((material) => material.access === "paid"),
    };
  });

  return { errors, coverage };
}
