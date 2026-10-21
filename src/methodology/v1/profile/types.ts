/**
 * Профиль профессии: целевое дерево компетенций + свидетельства источника.
 *
 * Здесь нет записи в граф и нет оценки уровня. Сборка только показывает, какие листья
 * целевого дерева подтверждены источником, какие остались пробелом и какие навыки
 * источника не вошли в дерево. Решение о переносе в граф принимает человек.
 */

export type ProfileKind = "skill" | "knowledge" | "tool";
export type ProfileScope = "profession" | "universal";
export type LeafStatus = "supported" | "model_only" | "watchlist" | "no_evidence";
export type OccupationRole = "core" | "supporting" | "universal";
export type SkillRelation = "essential" | "optional";
export type EvidenceLayer = "occupation" | "universal" | "onet" | "guidance" | "model" | "program";

export interface TaxonomyLeaf {
  id: string;
  title: string;
  titleRu?: string;
  kind: ProfileKind;
  /** universal — база для всех дизайнеров, а не только для этой профессии. */
  scope?: ProfileScope;
}

export interface TaxonomyGroup {
  id: string;
  title: string;
  titleRu?: string;
  kind: ProfileKind;
  leaves: TaxonomyLeaf[];
}

export interface TaxonomyBranch {
  id: string;
  title: string;
  titleRu?: string;
  groups: TaxonomyGroup[];
}

export interface TaxonomyFile {
  taxonomyVersion: string;
  professionId: string;
  title: string;
  titleRu?: string;
  note?: string;
  branches: TaxonomyBranch[];
}

export interface OccupationRef {
  id: string;
  title: string;
  uri: string;
  role: OccupationRole;
}

export interface MappingRule {
  escoTitle: string;
  /** id ветки, группы или листа из таксономии. */
  targetId: string;
  /** Дополнительные листья, которые покрывает то же описание записи. */
  additionalTargetIds?: string[];
  kind?: ProfileKind;
  needsReview?: boolean;
  /** Почему это сопоставление допустимо. Доказательство — запись ESCO. */
  basis: string;
}

/**
 * Универсальная база: запись ESCO, которая относится ко всем дизайнерам, а не к одной
 * профессии. Источник задаётся либо ссылкой на запись, либо названием в универсальном занятии.
 */
export interface UniversalSkillRule {
  escoUri?: string;
  escoTitle?: string;
  targetId: string;
  additionalTargetIds?: string[];
  kind?: ProfileKind;
  needsReview?: boolean;
  basis: string;
}

/** O*NET Software Skills: официальная база, CC BY 4.0. */
export interface OnetOccupationRef {
  socCode: string;
  title: string;
  role: "core" | "supporting";
}

export interface OnetToolRule {
  workplaceExample: string;
  targetId: string;
  kind?: ProfileKind;
  needsReview?: boolean;
  basis: string;
}

export interface OnetConfig {
  databaseVersion: string;
  csvUrl: string;
  license: string;
  occupations: OnetOccupationRef[];
  tools: OnetToolRule[];
}

/** Внутренняя модель COS: узел графа и дословная цитата его якоря. */
export interface ModelSkillRule {
  leafId: string;
  nodeId: string;
  quote: string;
  basis: string;
  needsReview?: boolean;
}

/** Публичное руководство с открытой лицензией (например, GOV.UK Service Manual, OGL). */
export interface GuidanceSource {
  id: string;
  title: string;
  /** Страница для человека. */
  url: string;
  /** Машиночитаемый адрес, если он отличается (например, GOV.UK Content API). */
  fetchUrl?: string;
  license: string;
}

export interface GuidanceSkillRule {
  sourceId: string;
  targetId: string;
  quote: string;
  basis: string;
  needsReview?: boolean;
}

/** Лист, для которого официальной записи нет; инструмент отслеживается отдельно. */
export interface WatchlistRule {
  leafId: string;
  reason: string;
  sourceHint?: string;
}

/** Образовательная программа с открытой страницей и списком тем/инструментов. */
export interface ProgramProfessionRef {
  slug: string;
  name: string;
}

export interface ProgramSkillRule {
  professionSlug: string;
  /** Название навыка или темы на странице программы. */
  skill: string;
  targetId: string;
  basis: string;
  needsReview?: boolean;
}

export interface ProgramConfig {
  sourceId: string;
  catalogUrl: string;
  license: string;
  professions: ProgramProfessionRef[];
  skills: ProgramSkillRule[];
}

export interface OutOfScopeRule {
  title?: string;
  regex?: string;
  /** machine-код причины: programming_language, project_management и т.п. */
  reason: string;
}

export interface MappingFile {
  mappingVersion: string;
  professionId: string;
  taxonomyVersion: string;
  note?: string;
  sourceOccupations: OccupationRef[];
  /** Занятия, которые нужны только для универсальной базы. */
  universalOccupations?: OccupationRef[];
  rules: MappingRule[];
  universalSkills?: UniversalSkillRule[];
  onet?: OnetConfig;
  modelSkills?: ModelSkillRule[];
  guidanceSources?: GuidanceSource[];
  guidanceSkills?: GuidanceSkillRule[];
  program?: ProgramConfig;
  watchlist?: WatchlistRule[];
  outOfScope: OutOfScopeRule[];
}

export interface EscoSkillLink {
  uri: string;
  title: string;
  /** skill или knowledge в хвосте ESCO skill-type URI. */
  skillType: string;
}

export interface EscoOccupationData {
  uri: string;
  title: string;
  essential: EscoSkillLink[];
  optional: EscoSkillLink[];
}

export interface EscoSkillData {
  uri: string;
  title: string;
  description: string;
  language: string;
}

export interface SourceOccupationReport {
  id: string;
  title: string;
  uri: string;
  role: OccupationRole;
  essentialCount: number;
  optionalCount: number;
}

export interface OccupationEvidence {
  uri: string;
  title: string;
  role: OccupationRole;
  relation: SkillRelation;
}

export interface ProfileEntry {
  /** Стабильный ключ: профессия + запись ESCO + название. */
  id: string;
  title: string;
  kind: ProfileKind;
  /** universal — свидетельство универсальной базы, а не требования профессии. */
  scope: ProfileScope;
  evidence: EvidenceLayer;
  /** Дословное описание записи ESCO. Пусто, если источник не дал описания. */
  description: string;
  branchId: string;
  groupId: string;
  leafId?: string;
  /** Первая цель в таксономии. */
  targetId: string;
  /** Все цели, которые покрывает свидетельство. */
  targetIds: string[];
  mappingBasis: string;
  needsReview: boolean;
  recordId: string;
  sourceUrl: string;
  sourceLicense?: string;
  sourceNote?: string;
  sourceError?: string;
  occupations: OccupationEvidence[];
  /** Диагностика соответствия текущему графу COS, не запись в граф. */
  nodeMatch?: {
    outcome: string;
    nodeId?: string;
  };
}

export interface ProfileLeafState {
  id: string;
  title: string;
  titleRu?: string;
  kind: ProfileKind;
  scope: ProfileScope;
  status: LeafStatus;
  entryIds: string[];
  note?: string;
}

export interface ProfileGroupState {
  id: string;
  title: string;
  titleRu?: string;
  kind: ProfileKind;
  generalEntryIds: string[];
  leaves: ProfileLeafState[];
}

export interface ProfileBranchState {
  id: string;
  title: string;
  titleRu?: string;
  generalEntryIds: string[];
  groups: ProfileGroupState[];
}

export interface ProfileOutOfScope {
  title: string;
  reason: string;
  occupations: string[];
}

export interface ProfileUnmapped {
  title: string;
  kind: string;
  occupations: string[];
}

export interface ProfileGap {
  leafId: string;
  title: string;
  titleRu?: string;
  kind: ProfileKind;
  scope: ProfileScope;
}

export interface ProfileJournal {
  profileVersion: "1.0.0";
  writesToGraph: false;
  professionId: string;
  professionTitle: string;
  professionTitleRu?: string;
  generatedOn: string;
  taxonomyVersion: string;
  mappingVersion: string;
  sourceOccupations: SourceOccupationReport[];
  branches: ProfileBranchState[];
  entries: ProfileEntry[];
  outOfScope: ProfileOutOfScope[];
  unmapped: ProfileUnmapped[];
  gaps: ProfileGap[];
  mappingMissing: Array<{ escoTitle: string; targetId: string }>;
  universalMissing: Array<{ title: string; targetId: string }>;
  modelMissing: Array<{ leafId: string; nodeId: string; reason: string }>;
  guidanceMissing: Array<{ sourceId: string; targetId: string; reason: string }>;
  onetMissing: Array<{ socCode: string; workplaceExample: string }>;
  programMissing: Array<{ professionSlug: string; skill: string; targetId: string; reason: string }>;
  externalSources: Array<{
    id: string;
    kind: "onet" | "guidance" | "program";
    title: string;
    url: string;
    license: string;
    usedCount: number;
  }>;
  graphFit: {
    counts: Record<string, number>;
    note: string;
  };
  stats: {
    sourceOccupations: number;
    universalOccupations: number;
    skillsSeen: number;
    uniqueSkills: number;
    mapped: number;
    universalSkills: number;
    onetSkills: number;
    guidanceSkills: number;
    modelSkills: number;
    programSkills: number;
    outOfScope: number;
    unmapped: number;
    leavesSupported: number;
    leavesTotal: number;
    universalLeavesSupported: number;
    universalLeavesTotal: number;
    professionLeavesSupported: number;
    professionLeavesTotal: number;
    groupsSupported: number;
    groupsTotal: number;
    modelOnlyLeaves: number;
    watchlistLeaves: number;
    entriesWithoutDescription: number;
  };
}

export interface ProfileReviewFile {
  reviewVersion: "1.0.0";
  writesToGraph: false;
  professionId: string;
  generatedOn: string;
  note: string;
  entries: ProfileEntry[];
  unmapped: ProfileUnmapped[];
  gaps: ProfileGap[];
  mappingMissing: Array<{ escoTitle: string; targetId: string }>;
  universalMissing: Array<{ title: string; targetId: string }>;
  modelMissing: Array<{ leafId: string; nodeId: string; reason: string }>;
  guidanceMissing: Array<{ sourceId: string; targetId: string; reason: string }>;
  onetMissing: Array<{ socCode: string; workplaceExample: string }>;
  programMissing: Array<{ professionSlug: string; skill: string; targetId: string; reason: string }>;
  externalSources: Array<{
    id: string;
    kind: "onet" | "guidance" | "program";
    title: string;
    url: string;
    license: string;
    usedCount: number;
  }>;
}
