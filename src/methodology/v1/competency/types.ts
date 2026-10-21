/**
 * Каталог компетенций: домен → профессия → компетенция → компонент → тег → материал.
 *
 * Модуль пишет только журналы и принятый каталог. Граф и БД он не меняет.
 */

export type DomainId = string;

export type TagKind = "knowledge" | "skill" | "tool" | "transversal";

export type EvidenceState =
  | "supported"
  | "qualified"
  | "contradicted"
  | "refuted"
  | "incomplete"
  | "no_evidence"
  | "unread"
  | "unavailable"
  | "needs_review";

export type MaterialKind = "article" | "course" | "video" | "docs" | "book" | "exercise" | "podcast";

export type AccessType = "free" | "paid" | "freemium" | "unknown";

export type CandidateStatus = "candidate" | "needs_review" | "accepted" | "rejected";

export interface SourceRef {
  sourceId: string;
  externalId: string;
  url: string;
  retrievedAt: string;
  license: string;
}

export interface ProfessionRecord {
  id: string;
  slug: string;
  title: string;
  titleEn?: string;
  aliases: string[];
  domain: DomainId;
  classification: Record<string, string>;
  sources: SourceRef[];
  status: "candidate" | "accepted";
  notes?: string[];
}

export interface TagRecord {
  id: string;
  slug: string;
  title: string;
  titleEn?: string;
  aliases: string[];
  kind: TagKind;
  definition: string;
  professionIds: string[];
  sourceRefs: SourceRef[];
  evidenceState: EvidenceState;
  competencyLinks: Array<{
    competencyId: string;
    componentId: string;
    role: "primary" | "related";
  }>;
  materialIds: string[];
  needsReview: boolean;
}

export interface CompetencyCandidate {
  id: string;
  slug: string;
  title: string;
  titleEn?: string;
  aliases: string[];
  definition: string;
  scopeHint: "universal" | "profession";
  tagIds: string[];
  professionIds: string[];
  rationale: string;
  status: CandidateStatus;
  llmMeta: LlmMeta;
  issues: string[];
}

export interface CompetencyComponent {
  id: string;
  slug: string;
  title: string;
  definition: string;
  order: number;
  tagIds: string[];
}

export interface CompetencyBlock {
  id: string;
  slug: string;
  title: string;
  titleEn?: string;
  aliases: string[];
  definition: string;
  scope: "universal" | "profession";
  professionIds: string[];
  components: CompetencyComponent[];
  tags: TagRecord[];
  sourceRefs: SourceRef[];
  evidenceState: EvidenceState;
  status: CandidateStatus;
  llmMeta: LlmMeta;
  issues: string[];
  previousSlugs?: string[];
  methodologyVersion: string;
}

export interface Material {
  id: string;
  slug: string;
  kind: MaterialKind;
  title: string;
  titleEn?: string;
  provider: string;
  url: string;
  canonicalUrl: string;
  language: "ru" | "en" | "other";
  access: AccessType;
  price?: {
    amount?: number;
    currency?: string;
    note?: string;
    observedAt: string;
  };
  description: string;
  snippet?: string;
  license: string;
  sourceRef: SourceRef;
  publishedAt?: string;
  retrievedAt: string;
  links: MaterialLink[];
  discoveredFor: string[];
  status: CandidateStatus;
  issues: string[];
  noMaterialState?: "no_material" | "source_unavailable" | "blocked";
}

export interface MaterialLink {
  competencyId: string;
  componentId?: string;
  tagId?: string;
  relevance: number;
  reason: string;
  modelProposal: boolean;
}

export interface LlmMeta {
  promptVersion: string;
  model: string;
  inputHash: string;
  costUsd: number;
  tokens?: {
    cacheHitTokens: number;
    cacheMissTokens: number;
    outputTokens: number;
  };
}

export interface CatalogFile {
  catalogVersion: string;
  domain: DomainId;
  updatedOn: string;
  blocks: CompetencyBlock[];
  tags: TagRecord[];
  materials: Material[];
}

export interface ProfessionProfile {
  profileVersion: "1.0.0";
  writesToGraph: false;
  domain: DomainId;
  profession: ProfessionRecord;
  competencies: Array<{
    competencyId: string;
    title: string;
    definition: string;
    scope: "universal" | "profession";
    components: Array<{
      componentId: string;
      title: string;
      tags: Array<{
        tagId: string;
        title: string;
        kind: TagKind;
        definition: string;
        evidenceState: EvidenceState;
      }>;
    }>;
    materials: Array<{
      materialId: string;
      title: string;
      kind: MaterialKind;
      access: AccessType;
      url: string;
    }>;
  }>;
  stats: {
    competencies: number;
    components: number;
    tags: number;
    materials: number;
    tagsWithoutDefinition: number;
  };
}

export interface SourceDefinition {
  id: string;
  title: string;
  kind: "classification" | "standard" | "framework" | "program" | "market" | "materials";
  license: string;
  access: "api" | "csv" | "html" | "manual";
  baseUrl: string;
  capabilities: string[];
  status: "active" | "planned" | "degraded" | "blocked";
  adapter?: string;
  notes?: string;
  requiresEnv?: string[];
}

export interface SourceRegistry {
  registryVersion: string;
  sources: SourceDefinition[];
}

export interface SourceSearchResult {
  sourceId: string;
  title: string;
  externalId: string;
  url: string;
  license: string;
  retrievedAt: string;
  note?: string;
}

export interface ProfessionTarget {
  id: string;
  title: string;
  titleEn: string;
  aliases: string[];
  esco?: { search: string; titleIncludes?: string[] };
  onet?: { socCodes?: string[]; titleIncludes?: string[] };
  practicum?: { slug?: string };
}

export interface TargetFile {
  domain: DomainId;
  version: string;
  professions: ProfessionTarget[];
}
