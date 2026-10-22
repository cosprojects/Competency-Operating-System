import type { FetchLike } from "../../candidate-parser/types.ts";
import { cachedJson, type CacheOptions } from "../../profile/cache.ts";
import { readOccupation, readSkill } from "../../profile/esco.ts";
import type { EscoSkillLink } from "../../profile/types.ts";
import type { SourceRef, TagKind } from "../types.ts";
import { cleanText, mapLimited, normalizeTitle } from "./common.ts";

const ESCO_ORIGIN = "https://ec.europa.eu/esco/api";
const ESCO_VERSION = "v1.2.0";
const ESCO_LICENSE = "EUPL 1.2";

interface SearchResult {
  uri?: string;
  title?: string;
}

interface SearchBody {
  _embedded?: { results?: SearchResult[] };
}

export interface EscoProfessionHit {
  uri: string;
  title: string;
  url: string;
}

export interface EscoTagHit {
  sourceRef: SourceRef;
  title: string;
  definition: string;
  kind: TagKind;
  relation: "essential" | "optional";
}

export async function searchEscoOccupations(
  fetchImpl: FetchLike,
  text: string,
  limit = 8,
): Promise<EscoProfessionHit[]> {
  const params = new URLSearchParams({
    text,
    type: "occupation",
    language: "en",
    limit: String(limit),
    selectedVersion: ESCO_VERSION,
  });
  const response = await fetchImpl(`${ESCO_ORIGIN}/search?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "CosCompetencyResearch/0.1 (+https://github.com/cosprojects/Competency-Operating-System)",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`ESCO search ответил ${response.status}`);
  const body = (await response.json()) as SearchBody;
  return (body._embedded?.results ?? [])
    .filter((item): item is { uri: string; title: string } => Boolean(item.uri && item.title))
    .map((item) => ({
      uri: item.uri,
      title: item.title,
      url: item.uri,
    }));
}

function kindOf(link: EscoSkillLink): TagKind {
  if (link.skillType === "skill") return "skill";
  if (link.skillType === "knowledge") return "knowledge";
  return "knowledge";
}

function sourceRef(uri: string, retrievedOn: string): SourceRef {
  return {
    sourceId: "esco",
    externalId: uri,
    url: uri,
    retrievedAt: retrievedOn,
    license: ESCO_LICENSE,
  };
}

export async function collectEscoTags(
  fetchImpl: FetchLike,
  cache: CacheOptions | undefined,
  occupationUri: string,
  retrievedOn: string,
): Promise<EscoTagHit[]> {
  const occupation = await cachedJson(cache, `esco-occ-${encodeURIComponent(occupationUri).slice(-80)}`, () =>
    readOccupation(fetchImpl, occupationUri),
  );
  const links = [
    ...occupation.essential.map((link) => ({ link, relation: "essential" as const })),
    ...occupation.optional.map((link) => ({ link, relation: "optional" as const })),
  ];
  const hits = await mapLimited(links, 4, async ({ link, relation }) => {
    let definition = "";
    try {
      const skill = await cachedJson(
        cache,
        `esco-skill-${encodeURIComponent(link.uri).slice(-80)}`,
        () => readSkill(fetchImpl, link.uri),
      );
      definition = cleanText(skill.description);
    } catch {
      // описание не получено: тег остаётся, но помечается на проверку ниже
    }
    const hit: EscoTagHit = {
      sourceRef: sourceRef(link.uri, retrievedOn),
      title: cleanText(link.title),
      definition,
      kind: kindOf(link),
      relation,
    };
    return hit;
  });
  const seen = new Set<string>();
  return hits.filter((hit) => {
    const key = `${normalizeTitle(hit.title)}|${hit.kind}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
