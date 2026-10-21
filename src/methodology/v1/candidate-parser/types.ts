/** Очередь сырых формулировок. Это не узлы графа и не каталог профессий. */

export type CandidateSourceId = "esco" | "onet";

export type SourceRunStatus = "ok" | "skipped" | "partial";

export interface CompetencyCandidate {
  /** Стабильный ключ: профессия + источник + формулировка. Повторный прогон не плодит дубли. */
  id: string;
  professionId: string;
  phrase: string;
  source: CandidateSourceId;
  sourceRecordId: string;
  sourceOccupationTitle: string;
  relation: "essential" | "optional" | "listed";
  /** Как источник сам назвал тип: skill, knowledge, technology или unknown. */
  kind: string;
  /** Цитата источника, на которой основано утверждение. Не повтор названия. */
  fragment: string;
  /**
   * Русский текст только для сопоставления с узлами.
   * Не заменяет fragment и sourceUrl: это по-прежнему доказательство источника.
   */
  matchText?: string;
  /** Адрес страницы или записи источника. */
  sourceUrl?: string;
  retrievedOn: string;
}

export interface SourceRunReport {
  id: CandidateSourceId;
  status: SourceRunStatus;
  candidateCount: number;
  note?: string;
}

export interface CandidateQueue {
  queueVersion: "1.0.0";
  retrievedOn: string;
  /** Напоминание читающему агенту: очередь не пишется в каталог и в граф. */
  writesToGraph: false;
  professionIds: string[];
  sources: SourceRunReport[];
  candidates: CompetencyCandidate[];
}

export interface ProfessionCard {
  id: string;
  title: string;
  status: string;
}

export interface ProfessionCatalogFile {
  professions: ProfessionCard[];
}

export interface FetchResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

export type FetchLike = (
  input: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<FetchResponse>;
