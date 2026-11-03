import type { LearningSourceKind } from "../types.ts";

/** Кандидат в реестр учебных источников, найденный автоматически. */
export interface SourceCandidate {
  url: string;
  canonicalUrl: string;
  domain: string;
  title: string;
  snippet?: string;
  provider: "wikipedia-extlinks" | "google-cse" | "github-awesome" | "youtube-channel" | "brave-search";
  competencyId: string;
  competencyTitle: string;
  query: string;
  kind: LearningSourceKind;
  languages: string[];
  score: number;
  reason: string;
  /** Если домен уже в реестре — id существующего источника, чтобы связать без дубля. */
  existingSourceId?: string;
  /** Вердикт методолога-LLM (Pass E для источников); появляется с --classify. */
  review?: {
    verdict: "accept" | "confirm" | "reject";
    confidence: number;
    usefulness: number;
    whyUseful: string;
    reason: string;
    flags: string[];
  };
}

export interface CompetencyContext {
  competencyId: string;
  professionId: string;
  title: string;
  titleEn?: string;
  definition: string;
  components: string[];
  tier: "foundation" | "core" | "optional";
}

export interface SourceIntent {
  id: "course" | "video" | "article" | "reference";
  suffixRu: string;
  suffixEn: string;
}

export const SOURCE_INTENTS: SourceIntent[] = [
  { id: "course", suffixRu: "курс", suffixEn: "course" },
  { id: "video", suffixRu: "видео", suffixEn: "tutorial" },
  { id: "article", suffixRu: "статья", suffixEn: "guide" },
  { id: "reference", suffixRu: "документация", suffixEn: "documentation" },
];
