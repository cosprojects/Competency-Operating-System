import type { FetchLike } from "../candidate-parser/types.ts";
import type { CacheOptions } from "../profile/cache.ts";
import type { CatalogFile, CompetencyBlock, Material } from "../competency/types.ts";
import type { LlmBudget, LlmPolicy } from "../competency/llm/policy.ts";
import type { LlmTransport } from "../competency/llm/transport.ts";

export interface MaterialAgentInput {
  domain: string;
  professionId: string;
  catalog: CatalogFile;
  fetchImpl: FetchLike;
  retrievedOn: string;
  sourceIds?: string[];
  limitCompetencies?: number;
  limitPerCompetency?: number;
  youtubeApiKey?: string;
  classify?: boolean;
  transport?: LlmTransport;
  policy?: LlmPolicy;
  budget?: LlmBudget;
  cache?: CacheOptions;
}

export interface MaterialAgentDiscoveryCoverage {
  competencyId: string;
  title: string;
  materials: number;
  kinds: Record<string, number>;
  noMaterialState?: string;
}

export interface MaterialAgentJournal {
  agentVersion: "1.0.0";
  journalVersion: "1.0.0";
  domain: string;
  professionId: string;
  generatedOn: string;
  writesToGraph: false;
  status: "completed" | "partial";
  stages: {
    discovery: { competencies: number; materials: number; notes: string[] };
    classification?: { materials: number; linked: number; issues: string[]; calls: number; costUsd: number };
    validation: { errors: string[]; coverage: Array<{ title: string; materials: number; kinds: Record<string, number> }> };
  };
  discoveryCoverage: MaterialAgentDiscoveryCoverage[];
  materials: Material[];
  notes: string[];
}

export interface MaterialAgentDeps {
  collect: (input: {
    competencies: CompetencyBlock[];
    fetchImpl: FetchLike;
    retrievedOn: string;
    sourceIds?: string[];
    limitPerCompetency?: number;
    youtubeApiKey?: string;
  }) => Promise<{
    materials: Material[];
    coverage: Array<{ competencyId: string; title: string; materials: number; kinds: Record<string, number>; noMaterialState?: string }>;
    notes: string[];
  }>;
  classify: (input: {
    materials: Material[];
    blocks: CompetencyBlock[];
    transport: LlmTransport;
    policy: LlmPolicy;
    budget: LlmBudget;
    cache?: CacheOptions;
  }) => Promise<{ materials: Material[]; issues: string[]; runs: Array<{ costUsd: number }> }>;
  validate: (materials: Material[], blocks: CompetencyBlock[]) => {
    errors: string[];
    coverage: Array<{ title: string; materials: number; kinds: Record<string, number> }>;
  };
}
