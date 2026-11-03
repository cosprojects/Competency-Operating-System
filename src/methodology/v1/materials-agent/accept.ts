import type { CatalogFile, Material } from "../competency/types.ts";
import { acceptanceOf } from "./limits.ts";

export interface MaterialAcceptOptions {
  minRelevance: number;
  allowedAccess?: string[];
  /** Источники, заблокированные пользователями (`reviews:export`). */
  blockedSourceIds?: Set<string>;
}

export interface MaterialAcceptResult {
  accepted: Material[];
  skipped: Array<{ id: string; reason: string }>;
}

/**
 * Приёмка материалов в каталог (COS-REL-009).
 *
 * Если у материала есть вердикт Pass E (`review`), решает он: `accept` с высокой
 * уверенностью и relevance — без бейджа; сомнительное — с пометкой `needs_confirmation`;
 * `reject` — в отказ. Старые кандидаты без вердикта принимаются по прежнему порогу
 * relevance, чтобы пайплайн не ломался на старых журналах.
 */
export function acceptMaterials(
  catalog: CatalogFile,
  candidates: Material[],
  options: MaterialAcceptOptions,
): MaterialAcceptResult {
  const blockIds = new Set(catalog.blocks.filter((block) => block.status === "accepted").map((block) => block.id));
  const existingUrls = new Set(catalog.materials.map((material) => material.canonicalUrl));
  const allowedAccess = new Set(options.allowedAccess ?? ["free", "freemium"]);
  const accepted: Material[] = [];
  const skipped: Array<{ id: string; reason: string }> = [];
  const blocked = options.blockedSourceIds;
  for (const material of candidates) {
    if (blocked?.has(material.id)) {
      skipped.push({ id: material.id, reason: "заблокирован пользователями (reviews:export)" });
      continue;
    }
    if (!allowedAccess.has(material.access)) {
      skipped.push({ id: material.id, reason: `access=${material.access}` });
      continue;
    }
    const review = material.review;
    const relevance = material.links.reduce((max, link) => Math.max(max, link.relevance), 0);
    const acceptance = review ? acceptanceOf(review, relevance) : undefined;
    if (acceptance === "rejected") {
      skipped.push({ id: material.id, reason: `вердикт LLM: reject (${review?.reason ?? "без причины"})` });
      continue;
    }
    const linkMin =
      acceptance === "needs_confirmation" ? 0.5 : options.minRelevance;
    const links = material.links.filter(
      (link) => link.relevance >= linkMin && blockIds.has(link.competencyId),
    );
    if (links.length === 0) {
      skipped.push({
        id: material.id,
        reason: `нет ссылки relevance >= ${linkMin} на accepted-блок`,
      });
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
      ...(review ? { review: { ...review, status: acceptance ?? review.status } } : {}),
      issues: material.issues.filter((issue) => !/needs_review|review/i.test(issue)),
    });
  }
  return { accepted, skipped };
}
