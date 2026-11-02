import type { ContentItem, ContentSource } from "@/lib/content-types";

export type Tier = "foundation" | "core" | "optional";

export type StudyStatus = "NOT_STARTED" | "LEARNING" | "LEARNED";

export interface CanvasSection {
  id: string;
  title: string;
  competencyIds: string[];
}

export interface CompetencyOccurrence {
  professionSlug: string;
  professionTitle: string;
  sectionTitle: string;
}

export interface CanvasCompetency {
  id: string;
  title: string;
  titleEn?: string;
  definition: string;
  tier: Tier;
  order: number;
  sectionId: string;
  sectionTitle: string;
  prerequisites: string[];
  knowledge: ContentItem[];
  skills: ContentItem[];
  sources: ContentSource[];
  occurrences: CompetencyOccurrence[];
}

export interface CanvasProfession {
  slug: string;
  title: string;
  titleEn?: string;
  description: string;
  published: number;
  total: number;
  percent: number;
  sections: CanvasSection[];
}

export interface CompetencyState {
  saved: boolean;
  status: StudyStatus;
}

export interface CanvasViewer {
  email: string;
}

export type CompetencyStates = Record<string, CompetencyState>;

export interface ProfessionCanvasProps {
  profession: CanvasProfession;
  competencies: CanvasCompetency[];
  states: CompetencyStates;
  viewer: CanvasViewer | null;
  initialCompetencyId?: string;
}
