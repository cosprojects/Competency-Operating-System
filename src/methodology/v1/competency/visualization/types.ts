import type { StudyPriorityTier } from "../priority/types.ts";
import type { EvidenceState } from "../types.ts";

export interface VisualizationNodeConfig {
  competencyId: string;
  tier: StudyPriorityTier;
  order: number;
  prerequisites: string[];
  shortDescription: string;
}

export interface VisualizationConfig {
  visualizationVersion: "0.1.0";
  domain: string;
  professionId: string;
  status: "draft";
  note: string;
  nodes: VisualizationNodeConfig[];
}

export interface VisualizationPageNode {
  id: string;
  title: string;
  tier: StudyPriorityTier;
  tierLabel: string;
  order: number;
  description: string;
  fullDescription: string;
  components: string[];
  tags: string[];
  evidenceState: EvidenceState;
  x: number;
  y: number;
  width: number;
  height: number;
  ring: number;
  emphasis: "primary" | "secondary" | "tertiary";
  opacity: number;
}

export interface VisualizationPageData {
  title: string;
  subtitle: string;
  note: string;
  generatedOn: string;
  nodes: VisualizationPageNode[];
  edges: Array<{ from: string; to: string }>;
  stage: { width: number; height: number; offsetX: number; offsetY: number };
  counts: { foundation: number; core: number; optional: number };
}
