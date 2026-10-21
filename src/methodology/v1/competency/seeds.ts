import type { CompetencyCandidate, TagRecord } from "./types.ts";
import { hashId, normalizeTitle, slugify } from "./sources/common.ts";

export interface CompetencySeed {
  id: string;
  title: string;
  titleEn?: string;
  aliases?: string[];
  definition: string;
  professionIds: string[];
  tagHints: string[];
  excludeHints?: string[];
  maxTags?: number;
}

export interface SeedFile {
  version: string;
  domain: string;
  description?: string;
  seeds: CompetencySeed[];
}

export interface SeedMaterialization {
  candidate: CompetencyCandidate;
  matchedTagIds: string[];
  missing: boolean;
}

export function materializeSeed(
  seed: CompetencySeed,
  tags: TagRecord[],
  generatedOn: string,
): SeedMaterialization {
  const hints = seed.tagHints.map((hint) => normalizeTitle(hint)).filter(Boolean);
  const excludes = (seed.excludeHints ?? []).map((hint) => normalizeTitle(hint)).filter(Boolean);
  const matchText = (tag: TagRecord): string =>
    normalizeTitle(`${tag.title} ${tag.definition}`);

  const matched = tags
    .filter((tag) => tag.kind === "knowledge" || tag.kind === "skill")
    .filter((tag) => (seed.professionIds.length === 0 ? true : tag.professionIds.some((id) => seed.professionIds.includes(id))))
    .filter((tag) => {
      const text = matchText(tag);
      if (excludes.some((hint) => text.includes(hint))) return false;
      return hints.some((hint) => text.includes(hint));
    })
    .slice(0, seed.maxTags ?? 30);

  const tagIds = matched.map((tag) => tag.id);
  const candidate: CompetencyCandidate = {
    id: hashId("candidate", normalizeTitle(seed.title)),
    slug: slugify(seed.title, "seed"),
    title: seed.title,
    ...(seed.titleEn ? { titleEn: seed.titleEn } : {}),
    aliases: seed.aliases ?? [],
    definition: seed.definition,
    scopeHint: "universal",
    tagIds,
    professionIds: seed.professionIds,
    rationale: `Top-down seed «${seed.id}» от ${generatedOn}; теги подобраны по подсказкам, не LLM.`,
    status: tagIds.length >= 2 ? "candidate" : "needs_review",
    llmMeta: { promptVersion: "seed-v1", model: "human-seed", inputHash: hashId("seed", seed.id), costUsd: 0 },
    issues: tagIds.length >= 2 ? [] : ["seed: меньше 2 тегов"],
  };
  return { candidate, matchedTagIds: tagIds, missing: tagIds.length < 2 };
}
