/** Журнал поиска требований. Компетенции здесь не создаются и в граф не пишутся. */

export type SourceType = "directory" | "vacancy" | "program" | "industry" | "unknown";

export type SourceStatus = "candidate" | "accepted";

export type ObtainedBy = "url" | "query";

export interface SearchQuery {
  id: string;
  language: "ru" | "en";
  text: string;
}

export interface PageExcerpt {
  fragment: string;
  /** Путь в JSON или заголовок раздела HTML. */
  place: string;
  /** Запись источника. Переводы одной записи делят один идентификатор. */
  recordId: string;
  /** Почему фрагмент можно читать как требование. Пусто — в сопоставление не идёт. */
  basis: string | null;
}

export interface PageInput {
  url: string;
  title: string;
  text: string;
  obtainedBy: ObtainedBy;
  queryId?: string;
  excerpts: PageExcerpt[];
}

export interface SourceWitness {
  url: string;
  host: string;
  sourceType: SourceType;
  status: SourceStatus;
  obtainedBy: ObtainedBy;
  queryId?: string;
  place: string;
  recordId: string;
  basis: string | null;
}

export interface CollectedStatement {
  /** Профессия + дословный фрагмент. Повтор страницы новую запись не создаёт. */
  id: string;
  professionId: string;
  fragment: string;
  /** В сопоставление идут только фрагменты с принятого источника. */
  entersMatching: boolean;
  independentCount: number;
  witnesses: SourceWitness[];
}

export interface RequirementJournal {
  journalVersion: "1.0.0";
  writesToGraph: false;
  professionId: string;
  retrievedOn: string;
  queries: SearchQuery[];
  statements: CollectedStatement[];
  note?: string;
}
