import { statementId, classifySource, copyKey, hostOf } from "./text.ts";
import { buildQueries } from "./templates.ts";
import type {
  CollectedStatement,
  PageInput,
  RequirementJournal,
  SourceStatus,
  SourceWitness,
} from "./types.ts";

function statusFor(type: SourceWitness["sourceType"]): SourceStatus {
  return type === "unknown" ? "candidate" : "accepted";
}

/** Одна запись ESCO — один ключ. Страницы без записи считаются по сайту, повтор на нём не добавляет свидетельство. */
function independenceKey(witness: SourceWitness): string {
  if (witness.recordId.includes("/esco/")) return witness.recordId;
  return witness.host || witness.recordId;
}

function recount(statement: CollectedStatement): CollectedStatement {
  const eligible = statement.witnesses.filter(
    (witness) => witness.status === "accepted" && witness.basis && independenceKey(witness),
  );
  return {
    ...statement,
    entersMatching: eligible.length > 0,
    independentCount: new Set(eligible.map(independenceKey)).size,
  };
}

export function collectRequirementJournal(input: {
  professionId: string;
  professionTitle: string;
  englishLabel?: string;
  pages: PageInput[];
  retrievedOn: string;
}): RequirementJournal {
  const byKey = new Map<string, CollectedStatement>();

  for (const page of input.pages) {
    const sourceType = classifySource(page);
    const status = statusFor(sourceType);
    const host = hostOf(page.url);
    for (const excerpt of page.excerpts) {
      const key = copyKey(excerpt.fragment);
      const witness: SourceWitness = {
        url: page.url,
        host,
        sourceType,
        status,
        obtainedBy: page.obtainedBy,
        place: excerpt.place,
        recordId: excerpt.recordId,
        basis: excerpt.basis,
      };
      if (page.obtainedBy === "query" && page.queryId) witness.queryId = page.queryId;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, {
          id: statementId(input.professionId, excerpt.fragment),
          professionId: input.professionId,
          fragment: excerpt.fragment,
          entersMatching: false,
          independentCount: 0,
          witnesses: [witness],
        });
        continue;
      }
      if (!existing.witnesses.some((item) => item.url === witness.url)) {
        existing.witnesses.push(witness);
      }
    }
  }

  const statements = [...byKey.values()].map(recount);
  const journal: RequirementJournal = {
    journalVersion: "1.0.0",
    writesToGraph: false,
    professionId: input.professionId,
    retrievedOn: input.retrievedOn,
    queries: buildQueries(input.professionTitle, input.englishLabel),
    statements,
  };
  if (input.pages.length === 0) {
    journal.note = "Страницы не переданы. Запросы собраны, источники не подставлены.";
  }
  return journal;
}

/** Повторный проход добавляет свидетельства к тем же фрагментам и не заводит вторую запись. */
export function mergeJournals(previous: RequirementJournal, next: RequirementJournal): RequirementJournal {
  if (previous.professionId !== next.professionId) {
    throw new Error("Журналы разных профессий не сливаются");
  }
  const byId = new Map<string, CollectedStatement>();
  for (const statement of [...previous.statements, ...next.statements]) {
    const existing = byId.get(statement.id);
    if (!existing) {
      byId.set(statement.id, { ...statement, witnesses: [...statement.witnesses] });
      continue;
    }
    for (const witness of statement.witnesses) {
      if (!existing.witnesses.some((item) => item.url === witness.url)) {
        existing.witnesses.push(witness);
      }
    }
  }
  return {
    journalVersion: "1.0.0",
    writesToGraph: false,
    professionId: previous.professionId,
    retrievedOn: next.retrievedOn,
    queries: next.queries.length > 0 ? next.queries : previous.queries,
    statements: [...byId.values()].map(recount),
    note: next.note ?? previous.note,
  };
}
