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
import { cachedJson, cachedText, fetchText, type CacheOptions } from "./cache.ts";
import { readOccupation, readSkill } from "./esco.ts";
import { guidanceTextFromResponse, pageContainsQuote } from "./guidance.ts";
import {
  indexMapping,
  normalizeQuote,
  normalizeTitle,
  outOfScopeReasonFor,
  ruleFor,
  validateMapping,
} from "./mapping.ts";
import { parseCsv, type OnetSoftwareRow } from "./onet.ts";
import { parsePracticumProfessionPage } from "./practicum.ts";
import { indexTaxonomy, validateTaxonomy, type TaxonomyIndex, type TaxonomyTarget } from "./taxonomy.ts";
import type {
  EscoSkillLink,
  EvidenceLayer,
  LeafStatus,
  MappingFile,
  OccupationEvidence,
  OccupationRef,
  ProfileEntry,
  ProfileGap,
  ProfileGroupState,
  ProfileJournal,
  ProfileLeafState,
  ProfileKind,
  ProfileOutOfScope,
  ProfileUnmapped,
  SkillRelation,
  SourceOccupationReport,
  TaxonomyFile,
  WatchlistRule,
} from "./types.ts";

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

/** Общая форма правила для сборки: цель, вид, необходимость проверки, основание. */
interface PlannedRule {
  targetId: string;
  additionalTargetIds?: string[];
  kind?: ProfileKind;
  needsReview?: boolean;
  basis: string;
}

interface PlannedEntry {
  recordId: string;
  title: string;
  skillType: string;
  rule: PlannedRule;
  targetIds: string[];
  targets: TaxonomyTarget[];
  occupations: OccupationEvidence[];
  evidence: EvidenceLayer;
  /** Для O*NET/guidance/model/program описание известно заранее; для ESCO — читается из API. */
  description?: string;
  sourceUrl: string;
  sourceLicense?: string;
  sourceNote?: string;
}

interface LoadedPlanned extends PlannedEntry {
  description: string;
}

interface UniversalLink {
  link: EscoSkillLink;
  occupations: OccupationEvidence[];
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

/** Все цели правила; области (scope) обязаны совпадать. */
function resolveTargets(
  taxonomy: TaxonomyIndex,
  rule: PlannedRule,
): { targetIds: string[]; targets: TaxonomyTarget[] } {
  const targetIds = [rule.targetId, ...(rule.additionalTargetIds ?? [])];
  const targets = targetIds.map((id) => targetOrThrow(taxonomy, id));
  const scopes = new Set(targets.map((target) => target.scope));
  if (scopes.size > 1) {
    throw new Error(`Правило «${rule.targetId}»: цели разных областей (profession/universal)`);
  }
  return { targetIds, targets };
}

function titleForTarget(taxonomy: TaxonomyIndex, targetId: string): string {
  const target = targetOrThrow(taxonomy, targetId);
  if (target.leafId) return taxonomy.leaves.get(target.leafId)?.title ?? targetId;
  if (target.groupId) return taxonomy.groups.get(target.groupId)?.title ?? targetId;
  return taxonomy.branches.get(target.branchId)?.title ?? targetId;
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
      source: entry.evidence === "onet" ? "onet" : "esco",
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

function onetSummaryUrl(socCode: string): string {
  return `https://www.onetonline.org/link/summary/${socCode}`;
}

function onetRowDescription(row: OnetSoftwareRow, databaseVersion: string): string {
  const flags = [
    row.hotTechnology ? "Hot Technology" : undefined,
    row.inDemand ? "In Demand" : undefined,
  ].filter((item): item is string => item !== undefined);
  const suffix = flags.length > 0 ? ` · ${flags.join(" · ")}` : "";
  return `O*NET ${databaseVersion} Software Skills, ${row.socCode} ${row.occupationTitle}: «${row.workplaceExample}»${suffix}`;
}

function nodeFields(node: MethodologistGraph["nodes"][number]): string[] {
  return [
    node.title,
    node.shortTitle,
    node.description ?? "",
    node.aiEvolutionNote ?? "",
    ...Object.values(node.behavioralAnchors ?? {}),
  ];
}

function csvRowsToOnet(text: string): OnetSoftwareRow[] {
  const rows = parseCsv(text);
  const header = rows[0] ?? [];
  const columns = new Map(header.map((name, index) => [name.trim(), index]));
  const codeIndex = columns.get("O*NET-SOC Code");
  const titleIndex = columns.get("Title");
  const exampleIndex = columns.get("Workplace Example");
  const hotIndex = columns.get("Hot Technology");
  const demandIndex = columns.get("In Demand");
  if (codeIndex === undefined || titleIndex === undefined || exampleIndex === undefined) {
    throw new Error("O*NET CSV: нет обязательных колонок");
  }
  return rows.slice(1).flatMap((row) => {
    const workplaceExample = (row[exampleIndex] ?? "").trim();
    if (!workplaceExample) return [];
    return [
      {
        socCode: (row[codeIndex] ?? "").trim(),
        occupationTitle: (row[titleIndex] ?? "").trim(),
        workplaceExample,
        hotTechnology: hotIndex !== undefined && (row[hotIndex] ?? "").trim().toUpperCase() === "Y",
        inDemand: demandIndex !== undefined && (row[demandIndex] ?? "").trim().toUpperCase() === "Y",
      },
    ];
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
  const universalOccupations = await mapLimited(
    input.mapping.universalOccupations ?? [],
    2,
    async (ref) => {
      const data = await cachedJson(input.cache, `occupation-${ref.id}`, () =>
        readOccupation(input.fetchImpl, ref.uri),
      );
      return { ref, data };
    },
  );

  const sourceOccupations: SourceOccupationReport[] = [...occupations, ...universalOccupations].map(
    ({ ref, data }) => ({
      id: ref.id,
      title: data.title || ref.title,
      uri: ref.uri,
      role: ref.role,
      essentialCount: data.essential.length,
      optionalCount: data.optional.length,
    }),
  );

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
  const planned: PlannedEntry[] = [];
  const outOfScopeMap = new Map<string, { title: string; reason: string; occupations: Set<string> }>();
  const unmapped: ProfileUnmapped[] = [];

  for (const skill of skills) {
    const rule = ruleFor(mapping, skill.title);
    if (rule) {
      const { targetIds, targets } = resolveTargets(taxonomy, rule);
      planned.push({
        recordId: skill.uri,
        title: skill.title,
        skillType: skill.skillType,
        rule,
        targetIds,
        targets,
        occupations: skill.occupations,
        evidence: "occupation",
        sourceUrl: skill.uri,
      });
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
        outOfScopeMap.set(key, { title: skill.title, reason, occupations: new Set(occupationNames) });
      }
      continue;
    }
    unmapped.push({
      title: skill.title,
      kind: skill.skillType,
      occupations: [...new Set(skill.occupations.map((item) => item.title))],
    });
  }

  // Универсальная база: записи, которые относятся ко всем дизайнерам.
  const universalLinks = new Map<string, UniversalLink>();
  for (const { ref, data } of universalOccupations) {
    const add = (link: EscoSkillLink, relation: SkillRelation): void => {
      const existing = universalLinks.get(normalizeTitle(link.title));
      if (existing) {
        existing.occupations.push({ uri: ref.uri, title: ref.title, role: ref.role, relation });
        return;
      }
      universalLinks.set(normalizeTitle(link.title), {
        link,
        occupations: [{ uri: ref.uri, title: ref.title, role: ref.role, relation }],
      });
    };
    for (const link of data.essential) add(link, "essential");
    for (const link of data.optional) add(link, "optional");
  }

  const universalMissing: ProfileJournal["universalMissing"] = [];
  const plannedRecordIds = new Set(planned.map((item) => item.recordId));
  const universalSeen = new Set<string>();

  for (const rule of input.mapping.universalSkills ?? []) {
    const { targetIds, targets } = resolveTargets(taxonomy, rule);
    let record:
      | { recordId: string; title: string; skillType: string; occupations: OccupationEvidence[] }
      | undefined;
    if (rule.escoUri) {
      record = {
        recordId: rule.escoUri,
        title: rule.escoTitle ?? "",
        skillType: rule.kind ?? "unknown",
        occupations: [],
      };
    } else if (rule.escoTitle) {
      const link = universalLinks.get(normalizeTitle(rule.escoTitle));
      if (link) {
        record = {
          recordId: link.link.uri,
          title: link.link.title,
          skillType: link.link.skillType,
          occupations: link.occupations,
        };
      }
    }
    if (!record) {
      universalMissing.push({
        title: rule.escoTitle ?? rule.escoUri ?? "неизвестная запись",
        targetId: rule.targetId,
      });
      continue;
    }
    if (plannedRecordIds.has(record.recordId) || universalSeen.has(record.recordId)) continue;
    universalSeen.add(record.recordId);
    planned.push({
      recordId: record.recordId,
      title: record.title,
      skillType: record.skillType,
      rule,
      targetIds,
      targets,
      occupations: record.occupations,
      evidence: "universal",
      sourceUrl: record.recordId,
    });
  }

  // O*NET Software Skills: официальная база инструментов, CC BY 4.0.
  const onetMissing: ProfileJournal["onetMissing"] = [];
  const onetConfig = input.mapping.onet;
  if (onetConfig) {
    const csv = await cachedText(
      input.cache,
      `onet-software-skills-${onetConfig.databaseVersion}`,
      "csv",
      () => fetchText(input.fetchImpl, onetConfig.csvUrl, "text/csv"),
    );
    const onetRows = csvRowsToOnet(csv);
    for (const occupation of onetConfig.occupations) {
      const rows = onetRows.filter((row) => row.socCode === occupation.socCode);
      for (const tool of onetConfig.tools) {
        const row = rows.find(
          (item) => normalizeTitle(item.workplaceExample) === normalizeTitle(tool.workplaceExample),
        );
        if (!row) {
          onetMissing.push({
            socCode: occupation.socCode,
            workplaceExample: tool.workplaceExample,
          });
          continue;
        }
        const { targetIds, targets } = resolveTargets(taxonomy, tool);
        planned.push({
          recordId: `onet:${occupation.socCode}:${normalizeTitle(tool.workplaceExample)}`,
          title: row.workplaceExample,
          skillType: "tool",
          rule: tool,
          targetIds,
          targets,
          occupations: [
            {
              uri: onetSummaryUrl(occupation.socCode),
              title: `${occupation.socCode} ${occupation.title}`,
              role: occupation.role,
              relation: "optional",
            },
          ],
          evidence: "onet",
          description: onetRowDescription(row, onetConfig.databaseVersion),
          sourceUrl: onetSummaryUrl(occupation.socCode),
          sourceLicense: onetConfig.license,
          sourceNote: `O*NET-SOC ${occupation.socCode}; Workplace Example «${row.workplaceExample}»`,
        });
      }
    }
  }

  // Guidance: публичные руководства с открытой лицензией. Цитата обязана найтись на странице.
  const guidanceMissing: ProfileJournal["guidanceMissing"] = [];
  const guidanceUsed = new Map<string, number>();
  if (input.mapping.guidanceSources && input.mapping.guidanceSkills) {
    const sources = input.mapping.guidanceSources;
    const pages = new Map<string, string | undefined>();
    for (const source of sources) {
      try {
        const html = await cachedText(input.cache, `guidance-${source.id}`, "html", () =>
          fetchText(input.fetchImpl, source.fetchUrl ?? source.url, "text/html,application/json"),
        );
        pages.set(source.id, html);
      } catch {
        pages.set(source.id, undefined);
      }
    }
    for (const rule of input.mapping.guidanceSkills) {
      const source = sources.find((item) => item.id === rule.sourceId);
      if (!source) {
        guidanceMissing.push({
          sourceId: rule.sourceId,
          targetId: rule.targetId,
          reason: "источник не описан в guidanceSources",
        });
        continue;
      }
      const html = pages.get(source.id);
      if (!html) {
        guidanceMissing.push({
          sourceId: source.id,
          targetId: rule.targetId,
          reason: "страница не получена",
        });
        continue;
      }
      if (!pageContainsQuote(guidanceTextFromResponse(html), rule.quote)) {
        guidanceMissing.push({
          sourceId: source.id,
          targetId: rule.targetId,
          reason: "цитата не найдена на странице",
        });
        continue;
      }
      const { targetIds, targets } = resolveTargets(taxonomy, rule);
      planned.push({
        recordId: `guidance:${source.id}:${normalizeTitle(rule.targetId)}`,
        title: titleForTarget(taxonomy, rule.targetId),
        skillType: "knowledge",
        rule,
        targetIds,
        targets,
        occupations: [],
        evidence: "guidance",
        description: rule.quote,
        sourceUrl: source.url,
        sourceLicense: source.license,
        sourceNote: source.title,
      });
      guidanceUsed.set(source.id, (guidanceUsed.get(source.id) ?? 0) + 1);
    }
  }

  // Модель COS: узел графа и дословная цитата якоря.
  const modelMissing: ProfileJournal["modelMissing"] = [];
  for (const rule of input.mapping.modelSkills ?? []) {
    const node = input.graph.nodes.find((item) => item.id === rule.nodeId);
    if (!node) {
      modelMissing.push({ leafId: rule.leafId, nodeId: rule.nodeId, reason: "узла нет в графе" });
      continue;
    }
    if (!normalizeQuote(nodeFields(node).join(" ")).includes(normalizeQuote(rule.quote))) {
      modelMissing.push({
        leafId: rule.leafId,
        nodeId: rule.nodeId,
        reason: "цитаты нет в полях узла",
      });
      continue;
    }
    const plannedRule: PlannedRule = {
      targetId: rule.leafId,
      basis: rule.basis,
      ...(rule.needsReview !== undefined ? { needsReview: rule.needsReview } : {}),
    };
    const { targetIds, targets } = resolveTargets(taxonomy, plannedRule);
    planned.push({
      recordId: `cos-graph:${rule.nodeId}`,
      title: titleForTarget(taxonomy, rule.leafId),
      skillType: "knowledge",
      rule: plannedRule,
      targetIds,
      targets,
      occupations: [],
      evidence: "model",
      description: rule.quote,
      sourceUrl: `src/methodology/v1/design-competency-graph.json#${rule.nodeId}`,
      sourceNote: `узел ${rule.nodeId}`,
    });
  }

  // Программа: страница профессии Яндекс Практикума. Навык обязан найтись в инструментах или темах.
  const programMissing: ProfileJournal["programMissing"] = [];
  const programUsed = new Map<string, number>();
  if (input.mapping.program) {
    const program = input.mapping.program;
    const pages = new Map<string, { name: string; url: string; items: string[] }>();
    for (const profession of program.professions) {
      try {
        const html = await cachedText(
          input.cache,
          `practicum-${profession.slug}`,
          "html",
          () =>
            fetchText(
              input.fetchImpl,
              `https://practicum.yandex.ru/${profession.slug}/`,
              "text/html",
            ),
        );
        const page = parsePracticumProfessionPage(html, profession.slug);
        pages.set(profession.slug, {
          name: profession.name,
          url: page.url,
          items: page.skills,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "страница не получена";
        programMissing.push({
          professionSlug: profession.slug,
          skill: "*",
          targetId: "*",
          reason: message,
        });
      }
    }
    for (const rule of program.skills) {
      const page = pages.get(rule.professionSlug);
      if (!page) {
        programMissing.push({
          professionSlug: rule.professionSlug,
          skill: rule.skill,
          targetId: rule.targetId,
          reason: "страница профессии не получена",
        });
        continue;
      }
      const found = page.items.find((item) =>
        normalizeQuote(item).includes(normalizeQuote(rule.skill)),
      );
      if (!found) {
        programMissing.push({
          professionSlug: rule.professionSlug,
          skill: rule.skill,
          targetId: rule.targetId,
          reason: "навык не найден на странице профессии",
        });
        continue;
      }
      const { targetIds, targets } = resolveTargets(taxonomy, rule);
      planned.push({
        recordId: `program:${program.sourceId}:${rule.professionSlug}:${normalizeTitle(rule.skill)}`,
        title: rule.skill,
        skillType: "knowledge",
        rule,
        targetIds,
        targets,
        occupations: [],
        evidence: "program",
        description: found,
        sourceUrl: page.url,
        sourceLicense: "© Яндекс Практикум",
        sourceNote: `Яндекс Практикум — ${page.name}`,
      });
      programUsed.set(rule.professionSlug, (programUsed.get(rule.professionSlug) ?? 0) + 1);
    }
  }

  const loaded = await mapLimited(planned, 4, async (item): Promise<LoadedPlanned> => {
    if (item.description !== undefined) return { ...item, description: item.description };
    try {
      const data = await cachedJson(input.cache, `skill-${fileKey(item.recordId)}`, () =>
        readSkill(input.fetchImpl, item.recordId),
      );
      return { ...item, title: item.title || data.title, description: data.description };
    } catch (error) {
      const message = error instanceof Error ? error.message : "неизвестная ошибка";
      const note = `${item.sourceNote ?? ""}${item.sourceNote ? "; " : ""}ошибка: ${message}`;
      return { ...item, description: "", sourceNote: note };
    }
  });

  const entries: ProfileEntry[] = loaded.map((item) => {
    const primary = item.targets[0];
    if (!primary) throw new Error(`Правило «${item.rule.targetId}» не дало цели`);
    const leaf = primary.leafId ? taxonomy.leaves.get(primary.leafId) : undefined;
    const group = primary.groupId ? taxonomy.groups.get(primary.groupId) : undefined;
    const fallbackKind = leaf?.kind ?? group?.kind ?? "knowledge";
    const kind = item.rule.kind ?? kindFromSkillType(item.skillType) ?? fallbackKind;
    const entry: ProfileEntry = {
      id: candidateId(input.professionId, item.recordId, item.title),
      title: item.title,
      kind,
      scope: primary.scope,
      evidence: item.evidence,
      description: item.description,
      branchId: primary.branchId,
      groupId: primary.groupId ?? "",
      targetId: item.targetIds[0] ?? item.rule.targetId,
      targetIds: item.targetIds,
      mappingBasis: item.rule.basis,
      needsReview:
        (item.rule.needsReview ?? (item.evidence === "guidance" || item.evidence === "model" || item.evidence === "program"))
        || item.description.length === 0,
      recordId: item.recordId,
      sourceUrl: item.sourceUrl,
      occupations: item.occupations
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title) || a.relation.localeCompare(b.relation)),
    };
    if (primary.leafId) entry.leafId = primary.leafId;
    if (item.sourceLicense) entry.sourceLicense = item.sourceLicense;
    if (item.sourceNote) entry.sourceNote = item.sourceNote;
    return entry;
  });
  entries.sort((a, b) => a.targetId.localeCompare(b.targetId) || a.title.localeCompare(b.title));

  const queue: CandidateQueue = {
    queueVersion: "1.0.0",
    retrievedOn: input.generatedOn,
    writesToGraph: false,
    professionIds: [input.professionId],
    sources: [
      { id: "esco", status: "ok", candidateCount: entries.length } satisfies SourceRunReport,
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

  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const byTarget = new Map<string, string[]>();
  for (const entry of entries) {
    for (const targetId of entry.targetIds) {
      const list = byTarget.get(targetId) ?? [];
      list.push(entry.id);
      byTarget.set(targetId, list);
    }
  }

  const externalLayers: ReadonlySet<EvidenceLayer> = new Set([
    "occupation",
    "universal",
    "onet",
    "guidance",
    "program",
  ]);
  const hasExternalEvidence = (entryIds: string[]): boolean =>
    entryIds.some((id) => {
      const entry = entryById.get(id);
      return entry !== undefined && externalLayers.has(entry.evidence) && entry.description.length > 0;
    });
  const hasModelEvidence = (entryIds: string[]): boolean =>
    entryIds.some((id) => {
      const entry = entryById.get(id);
      return entry !== undefined && entry.evidence === "model" && entry.description.length > 0;
    });

  const watchlist = new Map<string, WatchlistRule>(
    (input.mapping.watchlist ?? []).map((rule) => [rule.leafId, rule]),
  );

  const branches = input.taxonomy.branches.map((branch) => {
    const groups: ProfileGroupState[] = branch.groups.map((group) => ({
      id: group.id,
      title: group.title,
      ...(group.titleRu ? { titleRu: group.titleRu } : {}),
      kind: group.kind,
      generalEntryIds: byTarget.get(group.id) ?? [],
      leaves: group.leaves.map((leaf): ProfileLeafState => {
        const entryIds = byTarget.get(leaf.id) ?? [];
        const watch = watchlist.get(leaf.id);
        const status: LeafStatus = hasExternalEvidence(entryIds)
          ? "supported"
          : hasModelEvidence(entryIds)
            ? "model_only"
            : watch
              ? "watchlist"
              : "no_evidence";
        const state: ProfileLeafState = {
          id: leaf.id,
          title: leaf.title,
          ...(leaf.titleRu ? { titleRu: leaf.titleRu } : {}),
          kind: leaf.kind,
          scope: leaf.scope ?? "profession",
          status,
          entryIds,
        };
        if (status === "watchlist" && watch) state.note = watch.reason;
        return state;
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
      const entryIds = byTarget.get(leaf.id) ?? [];
      if (hasExternalEvidence(entryIds) || hasModelEvidence(entryIds) || watchlist.has(leaf.id)) {
        continue;
      }
      gaps.push({
        leafId: leaf.id,
        title: leaf.title,
        ...(leaf.titleRu ? { titleRu: leaf.titleRu } : {}),
        kind: leaf.kind,
        scope: leaf.scope ?? "profession",
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

  const externalSources: ProfileJournal["externalSources"] = [];
  if (onetConfig) {
    externalSources.push({
      id: "onet",
      kind: "onet",
      title: `O*NET ${onetConfig.databaseVersion} Software Skills`,
      url: onetConfig.csvUrl,
      license: onetConfig.license,
      usedCount: entries.filter((entry) => entry.evidence === "onet").length,
    });
  }
  for (const source of input.mapping.guidanceSources ?? []) {
    externalSources.push({
      id: source.id,
      kind: "guidance",
      title: source.title,
      url: source.url,
      license: source.license,
      usedCount: guidanceUsed.get(source.id) ?? 0,
    });
  }
  if (input.mapping.program) {
    externalSources.push({
      id: input.mapping.program.sourceId,
      kind: "program",
      title: "Яндекс Практикум — профессии дизайна",
      url: input.mapping.program.catalogUrl,
      license: input.mapping.program.license,
      usedCount: entries.filter((entry) => entry.evidence === "program").length,
    });
  }

  const leafStatuses = new Map<string, LeafStatus>();
  for (const branch of branches) {
    for (const group of branch.groups) {
      for (const leaf of group.leaves) leafStatuses.set(leaf.id, leaf.status);
    }
  }
  const leavesTotal = taxonomy.leavesInOrder.length;
  const universalLeaves = taxonomy.leavesInOrder.filter((leaf) => (leaf.scope ?? "profession") === "universal");
  const professionLeaves = taxonomy.leavesInOrder.filter((leaf) => (leaf.scope ?? "profession") === "profession");
  const countStatus = (status: LeafStatus, leaves: typeof taxonomy.leavesInOrder): number =>
    leaves.filter((leaf) => leafStatuses.get(leaf.id) === status).length;
  const leavesSupported = countStatus("supported", taxonomy.leavesInOrder);
  const universalLeavesSupported = countStatus("supported", universalLeaves);
  const professionLeavesSupported = countStatus("supported", professionLeaves);
  const modelOnlyLeaves = countStatus("model_only", taxonomy.leavesInOrder);
  const watchlistLeaves = countStatus("watchlist", taxonomy.leavesInOrder);
  const groupsSupported = taxonomy.groupsInOrder.filter((group) => {
    const general = (byTarget.get(group.id)?.length ?? 0) > 0;
    const inLeaves = group.leaves.some((leaf) => {
      const status = leafStatuses.get(leaf.id);
      return status === "supported" || status === "model_only";
    });
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
    universalMissing,
    modelMissing,
    guidanceMissing,
    onetMissing,
    programMissing,
    externalSources,
    graphFit: {
      counts,
      note: "Диагностика сопоставления с текущим графом COS. Исходы methodologist не являются записью требований. Инструменты из сопоставления исключены: они не требования.",
    },
    stats: {
      sourceOccupations: sourceOccupations.length,
      universalOccupations: universalOccupations.length,
      skillsSeen,
      uniqueSkills: skills.length,
      mapped: entries.length,
      universalSkills: entries.filter((entry) => entry.evidence === "universal").length,
      onetSkills: entries.filter((entry) => entry.evidence === "onet").length,
      guidanceSkills: entries.filter((entry) => entry.evidence === "guidance").length,
      modelSkills: entries.filter((entry) => entry.evidence === "model").length,
      programSkills: entries.filter((entry) => entry.evidence === "program").length,
      outOfScope: outOfScope.length,
      unmapped: unmapped.length,
      leavesSupported,
      leavesTotal,
      universalLeavesSupported,
      universalLeavesTotal: universalLeaves.length,
      professionLeavesSupported,
      professionLeavesTotal: professionLeaves.length,
      groupsSupported,
      groupsTotal: taxonomy.groupsInOrder.length,
      modelOnlyLeaves,
      watchlistLeaves,
      entriesWithoutDescription: entries.filter((entry) => entry.description.length === 0).length,
    },
  };
}
