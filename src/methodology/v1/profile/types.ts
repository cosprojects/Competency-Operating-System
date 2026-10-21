/**
 * Профиль профессии: целевое дерево компетенций + свидетельства источника.
 *
 * Здесь нет записи в граф и нет оценки уровня. Сборка только показывает, какие листья
 * целевого дерева подтверждены источником, какие остались пробелом и какие навыки
 * источника не вошли в дерево. Решение о переносе в граф принимает человек.
 */

export type ProfileKind = "skill" | "knowledge" | "tool";
export type ProfileScope = "profession" | "universal";
export type LeafStatus = "supported" | "no_evidence";
export type OccupationRole = "core" | "supporting" | "universal";
export type SkillRelation = "essential" | "optional";
export type EvidenceLayer = "occupation" | "universal";

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
  kind?: ProfileKind;
  needsReview?: boolean;
  basis: string;
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
  /** id цели в таксономии: ветка, группа или лист. */
  targetId: string;
  mappingBasis: string;
  needsReview: boolean;
  recordId: string;
  sourceUrl: string;
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
}
