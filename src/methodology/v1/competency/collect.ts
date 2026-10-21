import type { FetchLike } from "../candidate-parser/types.ts";
import type { CacheOptions } from "../profile/cache.ts";
import type {
  ProfessionRecord,
  ProfessionTarget,
  SourceRef,
  TagKind,
  TagRecord,
} from "./types.ts";
import { cleanText, hashId, normalizeTitle, slugify, uniqueBy } from "./sources/common.ts";
import { collectEscoTags, searchEscoOccupations } from "./sources/esco.ts";
import { collectOnetTags, searchOnetOccupations } from "./sources/onet.ts";
import { collectPracticumTags } from "./sources/practicum.ts";

export interface CollectProfessionsInput {
  domain: string;
  targets: ProfessionTarget[];
  fetchImpl: FetchLike;
  cache?: CacheOptions;
  retrievedOn: string;
}

export interface SearchTrace {
  professionId: string;
  sourceId: string;
  query: string;
  found: number;
  chosen?: string;
  note?: string;
}

export interface CollectProfessionsResult {
  professions: ProfessionRecord[];
  searches: SearchTrace[];
}

const LICENSES: Record<string, string> = {
  esco: "EUPL 1.2",
  onet: "CC BY 4.0",
  practicum: "© Яндекс Практикум; названия навыков и короткие цитаты",
};

export async function collectProfessions(
  input: CollectProfessionsInput,
): Promise<CollectProfessionsResult> {
  const professions: ProfessionRecord[] = [];
  const searches: SearchTrace[] = [];

  for (const target of input.targets) {
    const sources: SourceRef[] = [];
    const classification: Record<string, string> = {};
    const notes: string[] = [];

    if (target.esco) {
      const hits = await searchEscoOccupations(input.fetchImpl, target.esco.search);
      const accepted = hits.find((hit) => {
        if (!target.esco?.titleIncludes || target.esco.titleIncludes.length === 0) return true;
        const title = normalizeTitle(hit.title);
        return target.esco.titleIncludes.some((part) => title.includes(normalizeTitle(part)));
      });
      searches.push({
        professionId: target.id,
        sourceId: "esco",
        query: target.esco.search,
        found: hits.length,
        ...(accepted ? { chosen: accepted.uri } : {}),
        ...(accepted ? {} : { note: "нет занятия с заголовком из titleIncludes" }),
      });
      if (accepted) {
        classification.escoOccupation = accepted.uri;
        sources.push({
          sourceId: "esco",
          externalId: accepted.uri,
          url: accepted.url,
          retrievedAt: input.retrievedOn,
          license: LICENSES.esco ?? "EUPL 1.2",
        });
      } else {
        notes.push("ESCO: занятие не найдено");
      }
    }

    if (target.onet) {
      const hits = await searchOnetOccupations(input.fetchImpl, input.cache, target.onet);
      const accepted = hits[0];
      searches.push({
        professionId: target.id,
        sourceId: "onet",
        query: [
          ...(target.onet.socCodes ?? []),
          ...(target.onet.titleIncludes ?? []),
        ].join(", "),
        found: hits.length,
        ...(accepted ? { chosen: accepted.socCode } : {}),
        ...(accepted ? {} : { note: "нет O*NET-занятия по фильтру" }),
      });
      if (accepted) {
        classification.onetSoc = accepted.socCode;
        sources.push({
          sourceId: "onet",
          externalId: accepted.socCode,
          url: accepted.url,
          retrievedAt: input.retrievedOn,
          license: LICENSES.onet ?? "CC BY 4.0",
        });
      } else {
        notes.push("O*NET: занятие не найдено");
      }
    }

    if (target.practicum?.slug) {
      classification.practicumSlug = target.practicum.slug;
      sources.push({
        sourceId: "practicum",
        externalId: target.practicum.slug,
        url: `https://practicum.yandex.ru/${target.practicum.slug}/`,
        retrievedAt: input.retrievedOn,
        license: LICENSES.practicum ?? "© Яндекс Практикум",
      });
    }

    professions.push({
      id: `${input.domain}.${target.id}`,
      slug: target.id,
      title: target.title,
      ...(target.titleEn ? { titleEn: target.titleEn } : {}),
      aliases: target.aliases,
      domain: input.domain,
      classification,
      sources: uniqueBy(sources, (source) => `${source.sourceId}|${source.externalId}`),
      status: "candidate",
      ...(notes.length > 0 ? { notes } : {}),
    });
  }

  return {
    professions: professions.sort((a, b) => a.slug.localeCompare(b.slug)),
    searches,
  };
}

export interface CollectTagsInput {
  professions: ProfessionRecord[];
  fetchImpl: FetchLike;
  cache?: CacheOptions;
  retrievedOn: string;
}

export interface CollectTagsResult {
  tags: TagRecord[];
  byProfession: Record<string, string[]>;
  stats: {
    professions: number;
    tags: number;
    byKind: Record<string, number>;
    withoutDefinition: number;
    sourceRefs: number;
  };
}

interface RawTag {
  sourceRef: SourceRef;
  title: string;
  definition: string;
  kind: TagKind;
}

async function tagsForProfession(
  input: CollectTagsInput,
  profession: ProfessionRecord,
): Promise<RawTag[]> {
  const out: RawTag[] = [];
  for (const source of profession.sources) {
    if (source.sourceId === "esco") {
      const tags = await collectEscoTags(
        input.fetchImpl,
        input.cache,
        source.externalId,
        input.retrievedOn,
      );
      out.push(...tags.map((tag) => ({
        sourceRef: tag.sourceRef,
        title: tag.title,
        definition: tag.definition,
        kind: tag.kind,
      })));
    } else if (source.sourceId === "onet") {
      const tags = await collectOnetTags(
        input.fetchImpl,
        input.cache,
        source.externalId,
        input.retrievedOn,
      );
      out.push(...tags.map((tag) => ({
        sourceRef: tag.sourceRef,
        title: tag.title,
        definition: tag.definition,
        kind: tag.kind,
      })));
    } else if (source.sourceId === "practicum") {
      const tags = await collectPracticumTags(
        input.fetchImpl,
        input.cache,
        source.externalId,
        input.retrievedOn,
      );
      out.push(...tags.map((tag) => ({
        sourceRef: tag.sourceRef,
        title: tag.title,
        definition: tag.definition,
        kind: tag.kind,
      })));
    }
  }
  return out;
}

export async function collectTags(input: CollectTagsInput): Promise<CollectTagsResult> {
  const byKey = new Map<string, TagRecord>();

  for (const profession of input.professions) {
    const rawTags = await tagsForProfession(input, profession);
    for (const raw of rawTags) {
      const title = cleanText(raw.title);
      const definition = cleanText(raw.definition);
      const normalized = normalizeTitle(title);
      if (!normalized) continue;
      const key = `${normalized}|${raw.kind}`;
      const manifest: TagRecord = byKey.get(key) ?? {
        id: hashId("tag", `${normalized}|${raw.kind}`),
        slug: slugify(title, "tag"),
        title,
        aliases: [],
        kind: raw.kind,
        definition,
        professionIds: [],
        sourceRefs: [],
        evidenceState: definition ? "supported" : "needs_review",
        competencyLinks: [],
        materialIds: [],
        needsReview: definition.length === 0,
      };
      if (!manifest.professionIds.includes(profession.id)) {
        manifest.professionIds.push(profession.id);
      }
      if (!manifest.definition && definition) manifest.definition = definition;
      const sourceKey = `${raw.sourceRef.sourceId}|${raw.sourceRef.externalId}`;
      if (!manifest.sourceRefs.some((ref) => `${ref.sourceId}|${ref.externalId}` === sourceKey)) {
        manifest.sourceRefs.push(raw.sourceRef);
      }
      if (!definition) manifest.needsReview = true;
      manifest.evidenceState = manifest.definition ? "supported" : "needs_review";
      byKey.set(key, manifest);
    }
  }

  const tags = [...byKey.values()].sort((a, b) => a.title.localeCompare(b.title));
  const byProfession: Record<string, string[]> = {};
  for (const profession of input.professions) byProfession[profession.id] = [];
  for (const tag of tags) {
    for (const professionId of tag.professionIds) {
      (byProfession[professionId] ??= []).push(tag.id);
    }
  }
  const byKind: Record<string, number> = {};
  for (const tag of tags) byKind[tag.kind] = (byKind[tag.kind] ?? 0) + 1;

  return {
    tags,
    byProfession,
    stats: {
      professions: input.professions.length,
      tags: tags.length,
      byKind,
      withoutDefinition: tags.filter((tag) => tag.definition.length === 0).length,
      sourceRefs: tags.reduce((sum, tag) => sum + tag.sourceRefs.length, 0),
    },
  };
}
