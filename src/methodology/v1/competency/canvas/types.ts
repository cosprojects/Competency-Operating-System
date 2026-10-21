import type { CompetencyBlock } from "../types.ts";
import type { StudyPriorityMark, StudyPriorityTier } from "../priority/types.ts";

export type CanvasEmphasis = "primary" | "secondary" | "tertiary";

export interface CanvasNodePlacement {
  competencyId: string;
  title: string;
  tier: StudyPriorityTier;
  order: number;
  ring: number;
  angle: number;
  x: number;
  y: number;
  width: number;
  height: number;
  emphasis: CanvasEmphasis;
  opacity: number;
  nodeVariant: "core_root" | "standard";
}

export interface CanvasEdgePlacement {
  fromCompetencyId: string;
  toCompetencyId: string;
  kind: "prerequisite";
}

export interface CanvasLayout {
  layoutVersion: "1.0.0";
  domain: string;
  professionId: string;
  viewport: { width: number; height: number };
  nodes: CanvasNodePlacement[];
  edges: CanvasEdgePlacement[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  diagnostics: string[];
  writesToGraph: false;
}

export interface CanvasLayoutInput {
  domain: string;
  professionId: string;
  blocks: CompetencyBlock[];
  marks: StudyPriorityMark[];
  viewport?: { width: number; height: number };
  allowPartial?: boolean;
}
