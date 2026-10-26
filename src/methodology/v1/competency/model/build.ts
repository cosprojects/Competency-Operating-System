import type { CanonicalMap } from "../canonical/types.ts";
import type { PriorityFile } from "../priority/types.ts";
import type { SourceRegistry, TargetFile } from "../types.ts";
import type {
  CompetenciesFile,
  GlobalCompetency,
  ProfessionCompetencyFile,
  ProfessionModelRecord,
  ProfessionsFile,
  ProfessionSourceFile,
  SphereRecord,
  SpheresFile,
  SphereSourceFile,
} from "./types.ts";

export interface LearningSourceLink {
  competencyId: string;
  sourceIds: string[];
  rationale?: string;
}

export interface LearningSourceLinksFile {
  linksVersion: "1.0.0";
  updatedAt: string;
  description?: string;
  links: LearningSourceLink[];
}

/**
 * Мержит ручной слой «компетенция → учебные источники» в единый массив.
 * Ссылки из canonical/extra сохраняются, дубли убираются; неизвестные компетенции — ошибка,
 * чтобы опечатка в link-файле не терялась молча.
 */
export function applyLearningSourceLinks(
  file: CompetenciesFile,
  links: LearningSourceLink[],
): { competencies: CompetenciesFile; errors: string[] } {
  const errors: string[] = [];
  const byId = new Map(file.competencies.map((item) => [item.id, { ...item }]));
  for (const link of links) {
    const competency = byId.get(link.competencyId);
    if (!competency) {
      errors.push(`learning-source-links: неизвестная компетенция «${link.competencyId}»`);
      continue;
    }
    const merged = [...new Set([...(competency.learningSourceIds ?? []), ...link.sourceIds])];
    if (merged.length > 0) competency.learningSourceIds = merged;
  }
  return {
    competencies: { ...file, competencies: [...byId.values()] },
    errors,
  };
}

export function buildCompetencies(map: CanonicalMap): CompetenciesFile {
  const competencies: GlobalCompetency[] = [];
  for (const branch of map.branches) {
    for (const section of branch.sections) {
      for (const competency of section.competencies) {
        competencies.push({
          id: competency.id,
          branchId: branch.id,
          branchTitle: branch.title,
          sectionId: section.id,
          sectionTitle: section.title,
          title: competency.title,
          ...(competency.titleEn ? { titleEn: competency.titleEn } : {}),
          definition: competency.definition,
          priorityHint: competency.priorityHint,
          ...(competency.sourceEvidence ? { sourceEvidence: competency.sourceEvidence } : {}),
        });
      }
    }
  }
  return { modelVersion: "1.0.0", competencies };
}

export function buildProfessionCompetencies(map: CanonicalMap, professionId: string): ProfessionCompetencyFile {
  const competencies = [];
  let order = 0;
  for (const branch of map.branches) {
    for (const section of branch.sections) {
      let previous: string | undefined;
      for (const competency of section.competencies) {
        order += 1;
        competencies.push({
          competencyId: competency.id,
          tier: competency.priorityHint,
          order,
          prerequisites: previous ? [previous] : [],
        });
        previous = competency.id;
      }
    }
  }
  return { professionId, sphereId: map.domain === "it" ? "it" : map.domain, competencies };
}

export function buildSphere(): SpheresFile {
  const sphere: SphereRecord = {
    id: "it",
    title: "IT и цифровые продукты",
    description: "Профессии, связанные с цифровыми продуктами, интерфейсами, данными и разработкой.",
    professionIds: ["it.uxui"],
  };
  return { modelVersion: "1.0.0", spheres: [sphere] };
}

export function buildProfessionRecord(
  target: TargetFile["professions"][number],
  professionId: string,
): ProfessionModelRecord {
  const slug = professionId.split(".").pop() ?? professionId;
  return {
    id: professionId,
    sphereId: "it",
    title: target.title,
    ...(target.titleEn ? { titleEn: target.titleEn } : {}),
    canonicalMapFile: `canonical/${slug}.json`,
    catalogFile: `catalog/it.json`,
    priorityFile: `priority/${slug}.json`,
    sourcesFile: `sources/professions/${professionId}.json`,
  };
}

export function buildSourceFiles(input: {
  target: TargetFile["professions"][number];
  professionId: string;
  registry: SourceRegistry;
}): { sphere: SphereSourceFile; profession: ProfessionSourceFile } {
  const materialSources = input.registry.sources
    .filter((source) => source.kind === "materials" && source.status === "active")
    .map((source) => source.id);
  const blocked = input.registry.sources.filter((source) => source.status === "blocked").map((source) => source.id);
  const occupationSources: ProfessionSourceFile["occupationSources"] = [];
  if (input.target.esco) occupationSources.push({ sourceId: "esco", query: input.target.esco.search });
  if (input.target.onet) {
    occupationSources.push({
      sourceId: "onet",
      query: [...(input.target.onet.socCodes ?? []), ...(input.target.onet.titleIncludes ?? [])].join(", "),
    });
  }
  if (input.target.practicum?.slug) {
    occupationSources.push({ sourceId: "practicum", query: input.target.practicum.slug });
  }
  const sphere: SphereSourceFile = {
    sphereId: "it",
    languagePriority: ["ru", "en"],
    sources: input.registry.sources.map((source) => ({
      sourceId: source.id,
      role:
        source.kind === "classification"
          ? "occupations"
          : source.kind === "materials"
            ? "materials"
            : source.kind === "standard"
              ? "standards"
              : "skills",
      status: source.status,
    })),
  };
  return {
    sphere,
    profession: {
      professionId: input.professionId,
      sphereId: "it",
      occupationSources,
      materialSourceIds: materialSources,
      blockedSourceIds: blocked,
    },
  };
}

export function buildPriorityProjection(_priority: PriorityFile, map: CanonicalMap): ProfessionCompetencyFile {
  return buildProfessionCompetencies(map, map.professionId);
}
