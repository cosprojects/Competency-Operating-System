import { queryForProfession } from "./queries.ts";
import type { CompetencyCandidate, FetchLike, ProfessionCard } from "./types.ts";

const ESCO_ORIGIN = "https://ec.europa.eu/esco/api";
const ESCO_VERSION = "v1.2.0";

interface EscoLink {
  uri?: string;
  title?: string;
  skillType?: string;
}

interface EscoOccupation {
  uri?: string;
  title?: string;
  _links?: {
    hasEssentialSkill?: EscoLink | EscoLink[];
    hasOptionalSkill?: EscoLink | EscoLink[];
  };
}

interface EscoSearchBody {
  _embedded?: {
    results?: Array<{ uri?: string; title?: string }>;
  };
}

interface EscoSkillBody {
  description?: string | { en?: { literal?: string } | string };
}

export interface EscoCollectResult {
  candidates: CompetencyCandidate[];
  notes: string[];
}

async function mapLimited<T, R>(items: T[], limit: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const item = items[index];
      if (item === undefined) return;
      results[index] = await run(item);
    }
  }
  const workers = Math.min(limit, items.length);
  if (workers > 0) await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

function asList(value: EscoLink | EscoLink[] | undefined): EscoLink[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function skillKind(skillType: string | undefined): string {
  if (!skillType) return "unknown";
  const tail = skillType.split("/").pop();
  return tail && tail.length > 0 ? tail : "unknown";
}

function skillUrl(uri: string): string {
  const params = new URLSearchParams({
    uri,
    language: "en",
    selectedVersion: ESCO_VERSION,
  });
  return `${ESCO_ORIGIN}/resource/skill?${params.toString()}`;
}

function skillDescription(body: EscoSkillBody): string | undefined {
  const description = body.description;
  if (typeof description === "string") {
    const text = description.trim();
    return text.length > 0 ? text : undefined;
  }
  const english = description?.en;
  if (typeof english === "string") {
    const text = english.trim();
    return text.length > 0 ? text : undefined;
  }
  const literal = english?.literal?.trim();
  return literal && literal.length > 0 ? literal : undefined;
}

function occupationUrl(uri: string): string {
  const params = new URLSearchParams({
    uri,
    language: "en",
    selectedVersion: ESCO_VERSION,
  });
  return `${ESCO_ORIGIN}/resource/occupation?${params.toString()}`;
}

async function readJson<T>(fetchImpl: FetchLike, url: string): Promise<T> {
  const response = await fetchImpl(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`ESCO ответил ${response.status} на ${url}`);
  }
  return (await response.json()) as T;
}

async function resolveOccupationUri(
  fetchImpl: FetchLike,
  professionId: string,
): Promise<{ uri: string; note?: string } | { uri: null; note: string }> {
  const query = queryForProfession(professionId);
  if (!query) {
    return { uri: null, note: `${professionId}: в queries нет строки, поиск не запускался` };
  }
  if (query.escoOccupationUri) {
    return { uri: query.escoOccupationUri };
  }
  if (!query.escoSearchText) {
    return { uri: null, note: `${professionId}: для ESCO не заданы ни URI, ни текст поиска` };
  }

  const params = new URLSearchParams({
    text: query.escoSearchText,
    type: "occupation",
    language: "en",
    limit: "8",
    selectedVersion: ESCO_VERSION,
  });
  const body = await readJson<EscoSearchBody>(fetchImpl, `${ESCO_ORIGIN}/search?${params.toString()}`);
  const results = body._embedded?.results ?? [];
  const accepted = results.find((item) => {
    const title = (item.title ?? "").toLowerCase();
    return (query.escoTitleIncludes ?? []).some((part) => title.includes(part.toLowerCase()));
  });
  if (!accepted?.uri) {
    const seen = results.map((item) => item.title).filter(Boolean).join(", ");
    return {
      uri: null,
      note: `${professionId}: ESCO не дал занятие с заголовком из [${(query.escoTitleIncludes ?? []).join(", ")}]. Первые ответы: ${seen || "пусто"}`,
    };
  }
  return { uri: accepted.uri };
}

export async function collectEscoCandidates(input: {
  fetchImpl: FetchLike;
  professions: ProfessionCard[];
  retrievedOn: string;
  candidateId: (professionId: string, sourceRecordId: string, phrase: string) => string;
}): Promise<EscoCollectResult> {
  const candidates: CompetencyCandidate[] = [];
  const notes: string[] = [];

  for (const profession of input.professions) {
    const resolved = await resolveOccupationUri(input.fetchImpl, profession.id);
    if (resolved.uri === null) {
      notes.push(resolved.note);
      continue;
    }
    const occupation = await readJson<EscoOccupation>(input.fetchImpl, occupationUrl(resolved.uri));
    const occupationTitle = occupation.title ?? profession.title;
    const jobs = [
      { relation: "essential" as const, links: asList(occupation._links?.hasEssentialSkill) },
      { relation: "optional" as const, links: asList(occupation._links?.hasOptionalSkill) },
    ].flatMap((group) =>
      group.links.flatMap((link) => {
        const phrase = link.title?.trim();
        const recordId = link.uri?.trim();
        if (!phrase || !recordId) return [];
        return [{ relation: group.relation, phrase, recordId, kind: skillKind(link.skillType) }];
      }),
    );
    const loaded = await mapLimited(jobs, 8, async (job) => {
      let fragment = `${occupationTitle}: ${job.relation} ${job.kind} «${job.phrase}»`;
      let note: string | undefined;
      try {
        const skill = await readJson<EscoSkillBody>(input.fetchImpl, skillUrl(job.recordId));
        const description = skillDescription(skill);
        if (description) fragment = description;
        else note = `${profession.id}: у навыка «${job.phrase}» нет текстового описания`;
      } catch (error) {
        const message = error instanceof Error ? error.message : "неизвестная ошибка";
        note = `${profession.id}: описание «${job.phrase}» не прочитано (${message})`;
      }
      const candidate: CompetencyCandidate = {
        id: input.candidateId(profession.id, job.recordId, job.phrase),
        professionId: profession.id,
        phrase: job.phrase,
        source: "esco",
        sourceRecordId: job.recordId,
        sourceOccupationTitle: occupationTitle,
        relation: job.relation,
        kind: job.kind,
        fragment,
        sourceUrl: job.recordId,
        retrievedOn: input.retrievedOn,
      };
      return { candidate, note };
    });
    for (const item of loaded) {
      if (item.note) notes.push(item.note);
      candidates.push(item.candidate);
    }
  }

  return { candidates, notes };
}
