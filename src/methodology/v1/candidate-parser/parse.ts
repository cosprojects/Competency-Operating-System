import { createHash } from "node:crypto";
import { collectEscoCandidates } from "./esco.ts";
import { collectOnetCandidates } from "./onet.ts";
import { queryForProfession } from "./queries.ts";
import type {
  CandidateQueue,
  CompetencyCandidate,
  FetchLike,
  ProfessionCard,
  ProfessionCatalogFile,
  SourceRunReport,
} from "./types.ts";

export function openProfessions(catalog: ProfessionCatalogFile): ProfessionCard[] {
  return catalog.professions.filter((profession) => profession.status === "open_for_assessment");
}

export function candidateId(professionId: string, sourceRecordId: string, phrase: string): string {
  const normalized = phrase.trim().toLowerCase().replace(/\s+/g, " ");
  return createHash("sha256")
    .update(`${professionId}\n${sourceRecordId}\n${normalized}`)
    .digest("hex")
    .slice(0, 16);
}

function dedupe(candidates: CompetencyCandidate[]): CompetencyCandidate[] {
  const seen = new Set<string>();
  const unique: CompetencyCandidate[] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    unique.push(candidate);
  }
  return unique;
}

function report(
  id: SourceRunReport["id"],
  status: SourceRunReport["status"],
  candidateCount: number,
  notes: string[],
): SourceRunReport {
  const note = notes.filter(Boolean).join(" ");
  if (note.length === 0) return { id, status, candidateCount };
  return { id, status, candidateCount, note };
}

export async function parseCompetencyCandidates(input: {
  catalog: ProfessionCatalogFile;
  fetchImpl: FetchLike;
  retrievedOn: string;
  onetApiKey?: string;
  professionIds?: string[];
}): Promise<CandidateQueue> {
  const open = openProfessions(input.catalog);
  const selected = input.professionIds
    ? open.filter((profession) => input.professionIds?.includes(profession.id))
    : open;

  const unknown = (input.professionIds ?? []).filter(
    (id) => !open.some((profession) => profession.id === id),
  );
  const withoutQuery = selected.filter((profession) => !queryForProfession(profession.id));

  const esco = await collectEscoCandidates({
    fetchImpl: input.fetchImpl,
    professions: selected,
    retrievedOn: input.retrievedOn,
    candidateId,
  });
  const onet = await collectOnetCandidates({
    fetchImpl: input.fetchImpl,
    professions: selected,
    retrievedOn: input.retrievedOn,
    apiKey: input.onetApiKey,
    candidateId,
  });

  const escoNotes = [
    ...unknown.map((id) => `${id}: нет среди профессий со статусом open_for_assessment`),
    ...withoutQuery.map((profession) => `${profession.id}: нет строки в queries, внешний поиск не запускался`),
    ...esco.notes,
  ];
  const escoStatus = escoNotes.length > 0 ? "partial" : "ok";

  return {
    queueVersion: "1.0.0",
    retrievedOn: input.retrievedOn,
    writesToGraph: false,
    professionIds: selected.map((profession) => profession.id),
    sources: [
      report("esco", escoStatus, esco.candidates.length, escoNotes),
      report(
        "onet",
        onet.skipped ? "skipped" : onet.notes.length > 0 ? "partial" : "ok",
        onet.candidates.length,
        onet.notes,
      ),
    ],
    candidates: dedupe([...esco.candidates, ...onet.candidates]),
  };
}
