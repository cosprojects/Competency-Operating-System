import { createHash } from "node:crypto";
import type { CollectedStatement, RequirementJournal, SourceWitness } from "./types.ts";

export type IdentityOutcome = "new_identity" | "same_record" | "unresolved";

export interface IdentityDecision {
  statementId: string;
  fragment: string;
  outcome: IdentityOutcome;
  identityId?: string;
  reason: string;
  url: string;
  place: string;
  recordId: string;
  basis: string | null;
}

export interface CollectedIdentity {
  id: string;
  recordId: string;
  subject: string;
  result: string;
  quote: string;
  statementIds: string[];
}

export interface IdentityJournal {
  journalVersion: "1.0.0";
  writesToGraph: false;
  professionId: string;
  sourceJournal: string;
  identities: CollectedIdentity[];
  decisions: IdentityDecision[];
}

function admittedWitness(statement: CollectedStatement): SourceWitness | undefined {
  return statement.witnesses.find((witness) => witness.status === "accepted" && witness.basis);
}

function identityId(professionId: string, recordId: string): string {
  return createHash("sha256").update(`${professionId}\n${recordId}\ndescription`).digest("hex").slice(0, 16);
}

function descriptionLanguage(place: string): string | undefined {
  return place.match(/^description\.([^.]+)\.literal$/)?.[1];
}

/** Сопоставление только допущенных фрагментов. Порог сходства не используется. В граф не пишет. */
export function matchIdentities(journal: RequirementJournal, sourceJournal: string): IdentityJournal {
  const admitted = journal.statements.filter((statement) => statement.entersMatching && admittedWitness(statement));
  const described = new Map<string, CollectedStatement[]>();
  for (const statement of admitted) {
    const witness = admittedWitness(statement);
    if (!witness || !descriptionLanguage(witness.place)) continue;
    const group = described.get(witness.recordId) ?? [];
    group.push(statement);
    described.set(witness.recordId, group);
  }

  const identities: CollectedIdentity[] = [];
  const decisions: IdentityDecision[] = [];
  const opened = new Set<string>();

  for (const [recordId, group] of described) {
    const english = group.find((statement) => descriptionLanguage(admittedWitness(statement)?.place ?? "") === "en");
    const quote = english?.fragment;
    const subject = quote?.includes("graphic material") ? "graphic material" : undefined;
    const result = quote?.includes("communicate concepts and ideas") ? "communicate concepts and ideas" : undefined;
    if (!quote || !subject || !result) {
      for (const statement of group) {
        const witness = admittedWitness(statement)!;
        decisions.push(decision(statement, witness, "unresolved", "В описании записи не найдены предмет работы и вид результата."));
      }
      continue;
    }
    const id = identityId(journal.professionId, recordId);
    opened.add(recordId);
    identities.push({
      id,
      recordId,
      subject,
      result,
      quote,
      statementIds: group.map((statement) => statement.id),
    });
    for (const statement of group) {
      const witness = admittedWitness(statement)!;
      const sameField = descriptionLanguage(witness.place) !== "en";
      decisions.push(
        decision(
          statement,
          witness,
          sameField ? "same_record" : "new_identity",
          sameField
            ? "Тот же идентификатор записи и то же поле description. Языковая версия не создаёт вторую область."
            : `Предмет «${subject}» и результат «${result}» взяты из этого фрагмента.`,
          id,
        ),
      );
    }
  }

  for (const statement of admitted) {
    const witness = admittedWitness(statement)!;
    if (descriptionLanguage(witness.place)) continue;
    if (witness.basis?.startsWith("название") && opened.has(witness.recordId)) {
      decisions.push(
        decision(
          statement,
          witness,
          "same_record",
          "Название той же записи ESCO, у которой описание уже задало предмет и результат. Сходство слов не использовалось.",
          identityId(journal.professionId, witness.recordId),
        ),
      );
      continue;
    }
    decisions.push(
      decision(
        statement,
        witness,
        "unresolved",
        witness.basis?.startsWith("название")
          ? "Фрагмент — только название записи. Предмет работы и вид результата в нём не заданы."
          : "Фрагмент не задаёт один предмет и один результат либо не называет область, к которой относится приём.",
      ),
    );
  }

  return {
    journalVersion: "1.0.0",
    writesToGraph: false,
    professionId: journal.professionId,
    sourceJournal,
    identities,
    decisions,
  };
}

function decision(
  statement: CollectedStatement,
  witness: SourceWitness,
  outcome: IdentityOutcome,
  reason: string,
  identityIdValue?: string,
): IdentityDecision {
  return {
    statementId: statement.id,
    fragment: statement.fragment,
    outcome,
    ...(identityIdValue ? { identityId: identityIdValue } : {}),
    reason,
    url: witness.url,
    place: witness.place,
    recordId: witness.recordId,
    basis: witness.basis,
  };
}
