export type DescriptionKind = "profession" | "competency" | "knowledge" | "skill";

export interface DescriptionValidationInput {
  kind: DescriptionKind;
  title: string;
}

export interface DescriptionIssue {
  code: string;
  message: string;
}

export interface DescriptionSuggestion {
  entity: "profession" | "competency" | "tag";
  id: string;
  title: string;
  before: string;
  after: string;
  promptVersion: string;
  model: string;
  generatedAt: string;
  validation: DescriptionIssue[];
  applied: boolean;
}

export interface DescriptionFailure {
  entity: "profession" | "competency" | "tag";
  id: string;
  reason: string;
}

export interface DescriptionReport {
  generatedAt: string;
  scope: string[];
  mode: "dry-run" | "write";
  suggestions: DescriptionSuggestion[];
  failures: DescriptionFailure[];
  budget: { calls: number; costUsd: number };
}

export const DESCRIPTION_LIMITS: Record<DescriptionKind, { min: number; max: number }> = {
  profession: { min: 90, max: 320 },
  competency: { min: 80, max: 400 },
  knowledge: { min: 60, max: 260 },
  skill: { min: 60, max: 260 },
};
