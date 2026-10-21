import { queryForProfession } from "./queries.ts";
import type { CompetencyCandidate, FetchLike, ProfessionCard } from "./types.ts";

const ONET_ORIGIN = "https://api-v2.onetcenter.org";
const PAGE_END = 20;

interface OnetElement {
  id?: string;
  name?: string;
  description?: string;
}

interface OnetListBody {
  element?: OnetElement[];
}

export interface OnetCollectResult {
  candidates: CompetencyCandidate[];
  notes: string[];
  skipped: boolean;
}

async function readList(
  fetchImpl: FetchLike,
  url: string,
  apiKey: string,
): Promise<OnetElement[] | { missing: true; status: number }> {
  const response = await fetchImpl(url, {
    headers: {
      Accept: "application/json",
      "X-API-Key": apiKey,
    },
  });
  if (response.status === 404) return { missing: true, status: 404 };
  if (!response.ok) {
    throw new Error(`O*NET ответил ${response.status} на ${url}`);
  }
  const body = (await response.json()) as OnetListBody;
  return body.element ?? [];
}

export async function collectOnetCandidates(input: {
  fetchImpl: FetchLike;
  professions: ProfessionCard[];
  retrievedOn: string;
  apiKey: string | undefined;
  candidateId: (professionId: string, sourceRecordId: string, phrase: string) => string;
}): Promise<OnetCollectResult> {
  if (!input.apiKey) {
    return {
      candidates: [],
      skipped: true,
      notes: ["O*NET пропущен: нет ONET_API_KEY. Ключ бесплатный, его выдают на services.onetcenter.org."],
    };
  }

  const candidates: CompetencyCandidate[] = [];
  const seen = new Set<string>();
  const notes: string[] = [];
  const lists = [
    { kind: "skill", path: "summary/skills" },
    { kind: "knowledge", path: "summary/knowledge" },
  ] as const;

  for (const profession of input.professions) {
    const query = queryForProfession(profession.id);
    if (!query?.onetCode) {
      notes.push(`${profession.id}: код O*NET-SOC не задан, источник для неё не вызывался`);
      continue;
    }
    for (const list of lists) {
      const url = `${ONET_ORIGIN}/online/occupations/${query.onetCode}/${list.path}?start=1&end=${PAGE_END}`;
      const elements = await readList(input.fetchImpl, url, input.apiKey);
      if ("missing" in elements) {
        notes.push(`${profession.id}: у O*NET нет ${list.path} для ${query.onetCode}`);
        continue;
      }
      for (const element of elements) {
        const phrase = element.name?.trim();
        const recordId = element.id?.trim();
        if (!phrase || !recordId) continue;
        const id = input.candidateId(profession.id, `${query.onetCode}:${recordId}`, phrase);
        if (seen.has(id)) continue;
        seen.add(id);
        const description = element.description?.trim();
        candidates.push({
          id,
          professionId: profession.id,
          phrase,
          source: "onet",
          sourceRecordId: `${query.onetCode}:${recordId}`,
          sourceOccupationTitle: query.onetCode,
          relation: "listed",
          kind: list.kind,
          fragment: description
            ? `${query.onetCode} ${list.kind}: ${phrase}. ${description}`
            : `${query.onetCode} ${list.kind}: ${phrase}`,
          retrievedOn: input.retrievedOn,
        });
      }
    }
  }

  return { candidates, notes, skipped: false };
}
