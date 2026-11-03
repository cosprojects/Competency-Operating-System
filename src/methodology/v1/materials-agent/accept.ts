import type { CatalogFile, Material } from "../competency/types.ts";

export interface MaterialAcceptOptions {
  minRelevance: number;
  allowedAccess?: string[];
}

export interface MaterialAcceptResult {
  accepted: Material[];
  skipped: Array<{ id: string; reason: string }>;
}

/** Принимает только материалы с открытым доступом и доказанной связью с accepted-блоком. */
export function acceptMaterials(catalog: CatalogFile, candidates: Material[], options: MaterialAcceptOptions): MaterialAcceptResult {
  const blockIds = new Set(catalog.blocks.filter((block) => block.status === "accepted").map((block) => block.id));
  const existingUrls = new Set(catalog.materials.map((material) => material.canonicalUrl));
  const allowedAccess = new Set(options.allowedAccess ?? ["free", "freemium"]);
  const accepted: Material[] = [];
  const skipped: Array<{ id: string; reason: string }> = [];
  for (const material of candidates) {
    if (!allowedAccess.has(material.access)) {
      skipped.push({ id: material.id, reason: `access=${material.access}` });
      continue;
    }
    const links = material.links.filter((link) => link.relevance >= options.minRelevance && blockIds.has(link.competencyId));
    if (links.length === 0) {
      skipped.push({ id: material.id, reason: `нет ссылки relevance >= ${options.minRelevance} на accepted-блок` });
      continue;
    }
    if (existingUrls.has(material.canonicalUrl)) {
      skipped.push({ id: material.id, reason: "дубль canonicalUrl в каталоге" });
      continue;
    }
    if (catalog.materials.some((item) => item.id === material.id)) {
      skipped.push({ id: material.id, reason: "материал уже в каталоге" });
      continue;
    }
    existingUrls.add(material.canonicalUrl);
    accepted.push({
      ...material,
      links,
      status: "accepted",
      issues: material.issues.filter((issue) => !/needs_review|review/i.test(issue)),
    });
  }
  return { accepted, skipped };
}
