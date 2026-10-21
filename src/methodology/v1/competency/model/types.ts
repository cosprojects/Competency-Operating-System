export interface SphereRecord {
  id: string;
  title: string;
  description: string;
  professionIds: string[];
}

export interface ProfessionModelRecord {
  id: string;
  sphereId: string;
  title: string;
  titleEn?: string;
  canonicalMapFile: string;
  viewFile?: string;
  catalogFile: string;
  priorityFile: string;
  sourcesFile: string;
}

export interface GlobalCompetency {
  id: string;
  branchId: string;
  branchTitle: string;
  sectionId: string;
  sectionTitle: string;
  title: string;
  titleEn?: string;
  definition: string;
  priorityHint: "foundation" | "core" | "optional";
  sourceEvidence?: {
    taxonomyLeaves?: string[];
    graphNodeIds?: string[];
  };
}

export interface ProfessionCompetency {
  competencyId: string;
  tier: "foundation" | "core" | "optional";
  order: number;
  prerequisites: string[];
  sectionId?: string;
  sectionTitle?: string;
}

export interface ProfessionCompetencyFile {
  professionId: string;
  sphereId: string;
  competencies: ProfessionCompetency[];
}

export interface SphereSourceFile {
  sphereId: string;
  languagePriority: Array<"ru" | "en">;
  sources: Array<{
    sourceId: string;
    role: "occupations" | "skills" | "materials" | "standards";
    status: string;
  }>;
}

export interface ProfessionSourceFile {
  professionId: string;
  sphereId: string;
  occupationSources: Array<{
    sourceId: string;
    query: string;
    note?: string;
  }>;
  materialSourceIds: string[];
  blockedSourceIds: string[];
}

export interface CompetenciesFile {
  modelVersion: "1.0.0";
  competencies: GlobalCompetency[];
}

export interface SpheresFile {
  modelVersion: "1.0.0";
  spheres: SphereRecord[];
}

export interface ProfessionsFile {
  modelVersion: "1.0.0";
  professions: ProfessionModelRecord[];
}
