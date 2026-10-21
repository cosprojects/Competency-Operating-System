import type { CompetencyBlock } from "../types.ts";

export type CanonicalStatus = "covered" | "partial" | "gap";
export type CanonicalPriorityHint = "foundation" | "core" | "optional";

export interface CanonicalSourceEvidence {
  taxonomyLeaves?: string[];
  graphNodeIds?: string[];
  blockIds?: string[];
}

export interface CanonicalCompetency {
  id: string;
  order: number;
  title: string;
  titleEn?: string;
  definition: string;
  priorityHint: CanonicalPriorityHint;
  status: CanonicalStatus;
  coveredBy: string[];
  sourceEvidence?: CanonicalSourceEvidence;
  note?: string;
}

export interface CanonicalSection {
  id: string;
  order: number;
  title: string;
  definition: string;
  competencies: CanonicalCompetency[];
}

export interface CanonicalBranch {
  id: "ux" | "ui";
  order: number;
  title: string;
  definition: string;
  sections: CanonicalSection[];
}

export interface CanonicalExcludedBlock {
  blockId: string;
  reason: string;
}

export interface CanonicalMap {
  canonicalVersion: "0.1.0";
  domain: string;
  professionId: string;
  updatedOn: string;
  status: "draft" | "accepted";
  principles: string[];
  branches: CanonicalBranch[];
  excludedBlocks: CanonicalExcludedBlock[];
}

export interface CanonicalCoverage {
  total: number;
  covered: number;
  partial: number;
  gap: number;
  byBranch: Record<string, { total: number; covered: number; partial: number; gap: number }>;
  bySection: Record<string, { total: number; covered: number; partial: number; gap: number }>;
}

export interface CanonicalValidationResult {
  errors: string[];
  warnings: string[];
  coverage: CanonicalCoverage;
  mappedBlockIds: string[];
  unmappedBlockIds: string[];
}

export interface CanonicalValidationInput {
  blocks: CompetencyBlock[];
  requireUxUiBranches?: boolean;
}
