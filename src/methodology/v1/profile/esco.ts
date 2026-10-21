import type { FetchLike } from "../candidate-parser/types.ts";
import type { EscoOccupationData, EscoSkillData, EscoSkillLink } from "./types.ts";

const ESCO_ORIGIN = "https://ec.europa.eu/esco/api";
const ESCO_VERSION = "v1.2.0";

interface RawLink {
  uri?: string;
  title?: string;
  skillType?: string;
}

interface RawOccupation {
  title?: string;
  _links?: {
    hasEssentialSkill?: RawLink | RawLink[];
    hasOptionalSkill?: RawLink | RawLink[];
  };
}

interface RawDescription {
  literal?: string;
}

interface RawSkill {
  title?: string;
  description?: string | Record<string, RawDescription | string>;
}

function asList(value: RawLink | RawLink[] | undefined): RawLink[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function skillTypeTail(value: string | undefined): string {
  if (!value) return "unknown";
  const tail = value.split("/").pop();
  return tail && tail.length > 0 ? tail : "unknown";
}

function toSkillLink(link: RawLink): EscoSkillLink | undefined {
  const uri = link.uri?.trim();
  const title = link.title?.trim();
  if (!uri || !title) return undefined;
  return { uri, title, skillType: skillTypeTail(link.skillType) };
}

async function readJson<T>(fetchImpl: FetchLike, url: string): Promise<T> {
  const response = await fetchImpl(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`ESCO ответил ${response.status} на ${url}`);
  }
  return (await response.json()) as T;
}

export async function readOccupation(
  fetchImpl: FetchLike,
  uri: string,
): Promise<EscoOccupationData> {
  const params = new URLSearchParams({ uri, language: "en", selectedVersion: ESCO_VERSION });
  const body = await readJson<RawOccupation>(fetchImpl, `${ESCO_ORIGIN}/resource/occupation?${params}`);
  const essential = asList(body._links?.hasEssentialSkill)
    .map(toSkillLink)
    .filter((item): item is EscoSkillLink => item !== undefined);
  const optional = asList(body._links?.hasOptionalSkill)
    .map(toSkillLink)
    .filter((item): item is EscoSkillLink => item !== undefined);
  return {
    uri,
    title: body.title?.trim() ?? uri,
    essential,
    optional,
  };
}

function readDescription(raw: RawSkill["description"]): { text: string; language: string } {
  if (typeof raw === "string") return { text: raw.trim(), language: "unknown" };
  if (!raw) return { text: "", language: "unknown" };
  const english = raw.en;
  const englishText =
    typeof english === "string" ? english : (english?.literal ?? "").trim();
  if (englishText) return { text: englishText, language: "en" };
  for (const [language, value] of Object.entries(raw)) {
    const text = typeof value === "string" ? value.trim() : (value.literal ?? "").trim();
    if (text) return { text, language };
  }
  return { text: "", language: "unknown" };
}

export async function readSkill(fetchImpl: FetchLike, uri: string): Promise<EscoSkillData> {
  const params = new URLSearchParams({ uri, language: "en", selectedVersion: ESCO_VERSION });
  const body = await readJson<RawSkill>(fetchImpl, `${ESCO_ORIGIN}/resource/skill?${params}`);
  const description = readDescription(body.description);
  return {
    uri,
    title: body.title?.trim() ?? uri,
    description: description.text,
    language: description.language,
  };
}
