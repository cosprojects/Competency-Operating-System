export interface ContentItem {
  id: string;
  title: string;
  definition?: string;
}

export interface ContentSource {
  id: string;
  title: string;
  kind: string;
  access: string;
  languages: string[];
  authority: string;
  summary: string;
  url: string;
  lastChecked: string;
  rationale?: string;
  /** Оценка методолога-LLM (0..1) — из пайплайна; до неё null. */
  confidence?: number;
  /** Релевантность материала компетенции (0..1). */
  relevance?: number;
  /** Короткое «почему полезно» из Pass E. */
  whyUseful?: string;
  /** Базовый статус подтверждения из пайплайна; комментарий — COS-REL-009. */
  reviewStatus?: "auto_accepted" | "needs_confirmation" | "confirmed" | "disputed" | "blocked";
}

export interface ContentCompetency {
  id: string;
  title: string;
  titleEn?: string;
  definition: string;
  tier: "foundation" | "core" | "optional";
  order: number;
  prerequisites: string[];
  knowledge: ContentItem[];
  skills: ContentItem[];
  sources: ContentSource[];
}

export interface ContentSection {
  id: string;
  title: string;
  definition?: string;
  competencies: ContentCompetency[];
}

export interface ContentProfession {
  id: string;
  slug: string;
  title: string;
  titleEn?: string;
  description: string;
  coverage: {
    published: number;
    total: number;
    excluded: number;
    percent: number;
  };
  sections: ContentSection[];
}

export interface ExcludedCompetency {
  professionId: string;
  competencyId: string;
  reason: string;
}

export interface PublicContent {
  releaseId: string;
  title: string;
  status: "draft" | "ready";
  generatedAt: string;
  qualityBarVersion: string;
  stats: {
    professions: number;
    publishedCompetencies: number;
    publishedLinks: number;
    sources: number;
  };
  professions: ContentProfession[];
  excluded: ExcludedCompetency[];
}

export interface CompetencyWithProfession {
  profession: ContentProfession;
  section: ContentSection;
  competency: ContentCompetency;
}
