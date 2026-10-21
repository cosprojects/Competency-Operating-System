import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { candidateId } from "../candidate-parser/parse.ts";
import type {
  CandidateQueue,
  CompetencyCandidate,
  FetchLike,
  SourceRunReport,
} from "../candidate-parser/types.ts";
import {
  buildMethodologistPatch,
  type MethodologistGraph,
  type MethodologistProfession,
} from "../methodologist/decide.ts";
import { readOccupation, readSkill } from "./esco.ts";
import {
  indexMapping,
  normalizeTitle,
  outOfScopeReasonFor,
  ruleFor,
  validateMapping,
} from "./mapping.ts";
import { indexTaxonomy, validateTaxonomy, type TaxonomyIndex, type TaxonomyTarget } from "./taxonomy.ts";
import type {
  EscoSkillLink,
  LeafStatus,
  MappingFile,
  MappingRule,
  OccupationEvidence,
  OccupationRef,
  ProfileEntry,
  ProfileGap,
  ProfileGroupState,
  ProfileJournal,
  ProfileKind,
  ProfileOutOfScope,
  ProfileUnmapped,
  SkillRelation,
  SourceOccupationReport,
  TaxonomyFile,
} from "./types.ts";

export interface CacheOptions {
  /** Каталог кеша ответов ESCO. Без него каждый прогон идёт в сеть. */
  dir?: string;
  refresh?: boolean;
}

export interface BuildProfileInput {
  professionId: string;
  taxonomy: TaxonomyFile;
  mapping: MappingFile;
  graph: MethodologistGraph;
  professions: MethodologistProfession[];
  fetchImpl: FetchLike;
  generatedOn: string;
  cache?: CacheOptions;
}

interface SeenSkill {
  uri: string;
  title: string;
  skillType: string;
  occupations: OccupationEvidence[];
}

interface LoadedMapped {
  skill: SeenSkill;
  rule: MappingRule;
  target: TaxonomyTarget;
  description: string;
  language: string;
  error?: string;
}

async function mapLimited<T, R>(
  items: readonly T[],
  limit: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const item = items[index];
      if (item === undefined) return;
      results[index] = await run(item);
    }
  }
  const workers = Math.min(Math.max(limit, 1), items.length);
  if (workers > 0) await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

function fileKey(uri: string): string {
  const tail = uri.split("/").filter(Boolean).pop() ?? uri;
  return tail.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

async function cachedJson<T>(
  cache: CacheOptions | undefined,
  key: string,
  loader: () => Promise<T>,
): Promise<T> {
  if (!cache?.dir) return loader();
  const file = path.join(cache.dir, `${key}.json`);
  if (!cache.refresh) {
    try {
      return JSON.parse(await readFile(file, "utf8")) as T;
    } catch {
      // кеша нет или он повреждён — идём в сеть
    }
  }
  const value = await loader();
  await mkdir(cache.dir, { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return value;
}

function kindFromSkillType(skillType: string): ProfileKind | undefined {
  if (skillType === "skill") return "skill";
  if (skillType === "knowledge") return "knowledge";
  return undefined;
}

function targetOrThrow(taxonomy: TaxonomyIndex, targetId: string): TaxonomyTarget {
  const target = taxonomy.targets.get(targetId);
  if (!target) throw new Error(`Цели «${targetId}» нет в таксономии`);
  return target;
}

function buildCandidates(
  entries: ProfileEntry[],
  professionId: string,
  generatedOn: string,
): CompetencyCandidate[] {
  return entries.map((entry) => {
    const relation: SkillRelation = entry.occupations.some((item) => item.relation === "essential")
      ? "essential"
      : "optional";
    return {
      id: entry.id,
      professionId,
      phrase: entry.title,
      source: "esco",
      sourceRecordId: entry.recordId,
      sourceOccupationTitle: entry.occupations[0]?.title ?? "",
      relation,
      kind: entry.kind,
      fragment: entry.description,
      sourceUrl: entry.sourceUrl,
      retrievedOn: generatedOn,
    };
  });
}

export async function buildProfile(input: BuildProfileInput): Promise<ProfileJournal> {
  const taxonomyErrors = validateTaxonomy(input.taxonomy);
  if (taxonomyErrors.length > 0) {
    throw new Error(`Таксономия некорректна: ${taxonomyErrors.join("; ")}`);
  }
  const taxonomy = indexTaxonomy(input.taxonomy);

  const mappingErrors = validateMapping(input.mapping, taxonomy);
  if (mappingErrors.length > 0) {
    throw new Error(`Маппинг некорректен: ${mappingErrors.join("; ")}`);
  }
  if (input.mapping.professionId !== input.professionId) {
    throw new Error(
      `Профессия сборки «${input.professionId}» не совпадает с профессией маппинга «${input.mapping.professionId}»`,
    );
  }
  if (input.mapping.taxonomyVersion !== input.taxonomy.taxonomyVersion) {
    throw new Error(
      `Версия таксономии маппинга «${input.mapping.taxonomyVersion}» не совпадает с «${input.taxonomy.taxonomyVersion}»`,
    );
  }
  const mapping = indexMapping(input.mapping);

  const occupations = await mapLimited(input.mapping.sourceOccupations, 2, async (ref) => {
    const data = await cachedJson(input.cache, `occupation-${ref.id}`, () =>
      readOccupation(input.fetchImpl, ref.uri),
    );
    return { ref, data };
  });

  const sourceOccupations: SourceOccupationReport[] = occupations.map(({ ref, data }) => ({
    id: ref.id,
    title: data.title || ref.title,
    uri: ref.uri,
    role: ref.role,
    essentialCount: data.essential.length,
    optionalCount: data.optional.length,
  }));

  const seen = new Map<string, SeenSkill>();
  const register = (link: EscoSkillLink, occupation: OccupationRef, relation: SkillRelation): void => {
    const existing = seen.get(link.uri);
    if (existing) {
      const already = existing.occupations.some(
        (item) => item.uri === occupation.uri && item.relation === relation,
      );
      if (!already) {
        existing.occupations.push({
          uri: occupation.uri,
          title: occupation.title,
          role: occupation.role,
          relation,
        });
      }
      if (existing.skillType === "unknown") existing.skillType = link.skillType;
      return;
    }
    seen.set(link.uri, {
      uri: link.uri,
      title: link.title,
      skillType: link.skillType,
      occupations: [
        { uri: occupation.uri, title: occupation.title, role: occupation.role, relation },
      ],
    });
  };

  let skillsSeen = 0;
  for (const { ref, data } of occupations) {
    for (const link of data.essential) {
      register(link, ref, "essential");
      skillsSeen += 1;
    }
    for (const link of data.optional) {
      register(link, ref, "optional");
      skillsSeen += 1;
    }
  }

  const skills = [...seen.values()].sort((a, b) => a.title.localeCompare(b.title));
  const mappedSkills: Array<{ skill: SeenSkill; rule: MappingRule; target: TaxonomyTarget }> = [];
  const outOfScopeMap = new Map<string, { title: string; reason: string; occupations: Set<string> }>();
  const unmapped: ProfileUnmapped[] = [];

  for (const skill of skills) {
    const rule = ruleFor(mapping, skill.title);
    if (rule) {
      mappedSkills.push({ skill, rule, target: targetOrThrow(taxonomy, rule.targetId) });
      continue;
    }
    const reason = outOfScopeReasonFor(mapping, skill.title);
    if (reason) {
      const key = `${skill.title}\u0000${reason}`;
      const existing = outOfScopeMap.get(key);
      const occupationNames = skill.occupations.map((item) => item.title);
      if (existing) {
        for (const name of occupationNames) existing.occupations.add(name);
      } else {
        outOfScopeMap.set(key, {
          title: skill.title,
          reason,
          occupations: new Set(occupationNames),
        });
      }
      continue;
    }
    unmapped.push({
      title: skill.title,
      kind: skill.skillType,
      occupations: [...new Set(skill.occupations.map((item) => item.title))],
    });
  }

  const loaded = await mapLimited(mappedSkills, 4, async (item): Promise<LoadedMapped> => {
    try {
      const data = await cachedJson(input.cache, `skill-${fileKey(item.skill.uri)}`, () =>
        readSkill(input.fetchImpl, item.skill.uri),
      );
      return { ...item, description: data.description, language: data.language };
    } catch (error) {
      const message = error instanceof Error ? error.message : "неизвестная ошибка";
      return { ...item, description: "", language: "unknown", error: message };
    }
  });

  const entries: ProfileEntry[] = loaded.map((item) => {
    const { skill, rule, target } = item;
    const leaf = target.leafId ? taxonomy.leaves.get(target.leafId) : undefined;
    const group = target.groupId ? taxonomy.groups.get(target.groupId) : undefined;
    const fallbackKind = leaf?.kind ?? group?.kind ?? "knowledge";
    const kind = rule.kind ?? kindFromSkillType(skill.skillType) ?? fallbackKind;
    const entry: ProfileEntry = {
      id: candidateId(input.professionId, skill.uri, skill.title),
      title: skill.title,
      kind,
      description: item.description,
      branchId: target.branchId,
      groupId: target.groupId ?? "",
      targetId: rule.targetId,
      mappingBasis: rule.basis,
      needsReview: (rule.needsReview ?? false) || item.description.length === 0,
      recordId: skill.uri,
      sourceUrl: skill.uri,
      occupations: skill.occupations
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title) || a.relation.localeCompare(b.relation)),
    };
    if (target.leafId) entry.leafId = target.leafId;
    if (item.error) entry.sourceError = item.error;
    return entry;
  });
  entries.sort((a, b) => a.targetId.localeCompare(b.targetId) || a.title.localeCompare(b.title));

  const queue: CandidateQueue = {
    queueVersion: "1.0.0",
    retrievedOn: input.generatedOn,
    writesToGraph: false,
    professionIds: [input.professionId],
    sources: [
      {
        id: "esco",
        status: "ok",
        candidateCount: entries.length,
      } satisfies SourceRunReport,
    ],
    candidates: buildCandidates(entries, input.professionId, input.generatedOn),
  };
  const patch = buildMethodologistPatch({
    queue,
    graph: input.graph,
    professions: input.professions,
  });
  const decisionById = new Map(patch.decisions.map((decision) => [decision.candidateId, decision]));
  for (const entry of entries) {
    const decision = decisionById.get(entry.id);
    if (!decision) continue;
    // Инструмент не является требованием, даже если совпал с текстом узла.
    if (entry.kind === "tool") {
      entry.nodeMatch = { outcome: "reject_tool" };
      continue;
    }
    entry.nodeMatch = decision.nodeId
      ? { outcome: decision.outcome, nodeId: decision.nodeId }
      : { outcome: decision.outcome };
  }

  const byTarget = new Map<string, string[]>();
  for (const entry of entries) {
    const list = byTarget.get(entry.targetId) ?? [];
    list.push(entry.id);
    byTarget.set(entry.targetId, list);
  }

  const branches = input.taxonomy.branches.map((branch) => {
    const groups: ProfileGroupState[] = branch.groups.map((group) => ({
      id: group.id,
      title: group.title,
      ...(group.titleRu ? { titleRu: group.titleRu } : {}),
      kind: group.kind,
      generalEntryIds: byTarget.get(group.id) ?? [],
      leaves: group.leaves.map((leaf) => {
        const entryIds = byTarget.get(leaf.id) ?? [];
        const status: LeafStatus = entryIds.length > 0 ? "supported" : "no_evidence";
        return {
          id: leaf.id,
          title: leaf.title,
          ...(leaf.titleRu ? { titleRu: leaf.titleRu } : {}),
          kind: leaf.kind,
          status,
          entryIds,
        };
      }),
    }));
    return {
      id: branch.id,
      title: branch.title,
      ...(branch.titleRu ? { titleRu: branch.titleRu } : {}),
      generalEntryIds: byTarget.get(branch.id) ?? [],
      groups,
    };
  });

  const gaps: ProfileGap[] = [];
  for (const group of taxonomy.groupsInOrder) {
    for (const leaf of group.leaves) {
      if ((byTarget.get(leaf.id)?.length ?? 0) > 0) continue;
      gaps.push({
        leafId: leaf.id,
        title: leaf.title,
        ...(leaf.titleRu ? { titleRu: leaf.titleRu } : {}),
        kind: leaf.kind,
      });
    }
  }

  const seenTitles = new Set(skills.map((skill) => normalizeTitle(skill.title)));
  const mappingMissing = input.mapping.rules
    .filter((rule) => !seenTitles.has(normalizeTitle(rule.escoTitle)))
    .map((rule) => ({ escoTitle: rule.escoTitle, targetId: rule.targetId }));

  const outOfScope: ProfileOutOfScope[] = [...outOfScopeMap.values()]
    .map((item) => ({
      title: item.title,
      reason: item.reason,
      occupations: [...item.occupations].sort(),
    }))
    .sort((a, b) => a.reason.localeCompare(b.reason) || a.title.localeCompare(b.title));

  unmapped.sort((a, b) => a.title.localeCompare(b.title));

  const leavesTotal = taxonomy.leavesInOrder.length;
  const leavesSupported = leavesTotal - gaps.length;
  const groupsSupported = taxonomy.groupsInOrder.filter((group) => {
    const general = (byTarget.get(group.id)?.length ?? 0) > 0;
    const inLeaves = group.leaves.some((leaf) => (byTarget.get(leaf.id)?.length ?? 0) > 0);
    return general || inLeaves;
  }).length;

  const counts: Record<string, number> = {};
  for (const key of Object.keys(patch.counts)) counts[key] = 0;
  for (const entry of entries) {
    const outcome = entry.nodeMatch?.outcome ?? "unknown";
    counts[outcome] = (counts[outcome] ?? 0) + 1;
  }

  return {
    profileVersion: "1.0.0",
    writesToGraph: false,
    professionId: input.professionId,
    professionTitle: input.taxonomy.title,
    ...(input.taxonomy.titleRu ? { professionTitleRu: input.taxonomy.titleRu } : {}),
    generatedOn: input.generatedOn,
    taxonomyVersion: input.taxonomy.taxonomyVersion,
    mappingVersion: input.mapping.mappingVersion,
    sourceOccupations,
    branches,
    entries,
    outOfScope,
    unmapped,
    gaps,
    mappingMissing,
    graphFit: {
      counts,
      note: "Диагностика сопоставления с текущим графом COS. Исходы methodologist не являются записью требований. Инструменты из сопоставления исключены: они не требования.",
    },
    stats: {
      sourceOccupations: sourceOccupations.length,
      skillsSeen,
      uniqueSkills: skills.length,
      mapped: entries.length,
      outOfScope: outOfScope.length,
      unmapped: unmapped.length,
      leavesSupported,
      leavesTotal,
      groupsSupported,
      groupsTotal: taxonomy.groupsInOrder.length,
      entriesWithoutDescription: entries.filter((entry) => entry.description.length === 0).length,
    },
  };
}
