import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  CompetenciesFile,
  GlobalCompetency,
  ProfessionCompetency,
  ProfessionCompetencyFile,
  ProfessionsFile,
} from "../../src/methodology/v1/competency/model/types.ts";
import type { ProfessionView } from "../../src/methodology/v1/competency/model/profession-view.ts";
import type { CatalogFile, CompetencyBlock, TagRecord } from "../../src/methodology/v1/competency/types.ts";
import type { LearningSourceRecord, LearningSourceRegistry } from "../../src/methodology/v1/learning-sources/types.ts";

export interface QualityBar {
  minKnowledge: number;
  minSkills: number;
  minActiveSources: number;
  requirePrimarySource: boolean;
  requireSourceSummary: boolean;
  maxSourceAgeDays: number;
  requireHumanReview: boolean;
}

export interface ReleaseManifest {
  releaseVersion: string;
  releaseId: string;
  title: string;
  status: "draft" | "ready" | "archived";
  domain: string;
  professionIds: string[];
  excludedProfessionIds?: string[];
  excludedCompetencyPrefixes?: string[];
  excludedCompetencies?: Array<{ professionId: string; competencyId: string; reason: string }>;
  qualityBar: QualityBar;
  sourceReviewFile: string;
  publication?: {
    allowPartialProfessions?: boolean;
    showCoverage?: boolean;
    language?: string;
  };
  notes?: string[];
}

export interface SourceReviewDecision {
  /** Если не указан или "*", решение действует для всех профессий. */
  professionId?: string;
  competencyId: string;
  sourceId: string;
  decision: "accepted" | "replaced" | "excluded";
  reason?: string;
  replacementSourceId?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface SourceReviewFile {
  reviewVersion: string;
  releaseId: string;
  updatedAt: string;
  reviewedBy: string | null;
  decisions: SourceReviewDecision[];
  notes?: string[];
}

interface LearningSourceLink {
  competencyId: string;
  sourceIds: string[];
  rationale?: string;
}

interface LearningSourceLinksFile {
  links: LearningSourceLink[];
}

export interface ReleaseInputs {
  root: string;
  manifestPath: string;
  manifest: ReleaseManifest;
  professions: ProfessionsFile;
  competencies: CompetenciesFile;
  catalog: CatalogFile;
  registry: LearningSourceRegistry;
  sourceReview: SourceReviewFile;
  sourceReviewFileFound: boolean;
  professionFiles: Map<string, ProfessionCompetencyFile>;
  views: Map<string, ProfessionView | null>;
  linksByCompetency: Map<string, LearningSourceLink>;
}

export type GapType =
  | "profession_missing"
  | "profession_file_missing"
  | "competency_missing"
  | "no_block"
  | "composition"
  | "no_source"
  | "source_missing"
  | "source_not_primary_active"
  | "source_summary_missing"
  | "source_stale"
  | "source_date_invalid"
  | "source_review_missing"
  | "source_review_incomplete"
  | "prerequisite_missing"
  | "prerequisite_order";

export interface ReleaseGap {
  professionId: string;
  competencyId: string;
  type: GapType;
  detail: string;
  sourceId?: string;
  blocking: boolean;
}

export interface ResolvedSource {
  sourceId: string;
  source: LearningSourceRecord;
  decision?: SourceReviewDecision;
  rationale?: string;
}

export interface CompetencyEvaluation {
  professionId: string;
  competency: GlobalCompetency;
  professionCompetency: ProfessionCompetency;
  included: true;
  blocks: CompetencyBlock[];
  knowledge: TagRecord[];
  skills: TagRecord[];
  sources: ResolvedSource[];
  gaps: ReleaseGap[];
  passed: boolean;
}

export interface ExcludedCompetency {
  professionId: string;
  competencyId: string;
  reason: string;
}

export interface ProfessionEvaluation {
  id: string;
  title: string;
  totalLinks: number;
  includedLinks: number;
  excludedLinks: number;
  publishedLinks: number;
  rows: CompetencyEvaluation[];
  gaps: ReleaseGap[];
  passed: boolean;
}

export interface ReleaseEvaluation {
  releaseId: string;
  title: string;
  status: ReleaseManifest["status"];
  asOf: string;
  strictSourceReview: boolean;
  professions: ProfessionEvaluation[];
  excluded: ExcludedCompetency[];
  gaps: ReleaseGap[];
  totals: {
    professions: number;
    totalLinks: number;
    includedLinks: number;
    excludedLinks: number;
    publishedLinks: number;
    uniqueCompetencies: number;
    uniquePublishedCompetencies: number;
    uniqueSources: number;
    gaps: number;
    blockingGaps: number;
    passed: boolean;
  };
}

function slugOf(professionId: string): string {
  return professionId.split(".").at(-1) ?? professionId;
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function readOptionalJson<T>(file: string): Promise<T | null> {
  try {
    return await readJson<T>(file);
  } catch {
    return null;
  }
}

function sourceReviewKey(professionId: string, competencyId: string, sourceId: string): string {
  return `${professionId}|${competencyId}|${sourceId}`;
}

function findSourceDecision(
  reviewByKey: Map<string, SourceReviewDecision>,
  professionId: string,
  competencyId: string,
  sourceId: string,
): SourceReviewDecision | undefined {
  return (
    reviewByKey.get(sourceReviewKey(professionId, competencyId, sourceId)) ??
    reviewByKey.get(sourceReviewKey("*", competencyId, sourceId))
  );
}

export async function loadReleaseInputs(root: string, manifestPath: string): Promise<ReleaseInputs> {
  const absoluteManifestPath = path.isAbsolute(manifestPath) ? manifestPath : path.join(root, manifestPath);
  const manifest = await readJson<ReleaseManifest>(absoluteManifestPath);
  const modelDir = path.join(root, "src/methodology/v1/competency/model");
  const professions = await readJson<ProfessionsFile>(path.join(modelDir, "professions.json"));
  const competencies = await readJson<CompetenciesFile>(path.join(modelDir, "competencies.json"));
  const catalog = await readJson<CatalogFile>(path.join(root, "src/methodology/v1/competency/catalog/it.json"));
  const registry = await readJson<LearningSourceRegistry>(
    path.join(root, "src/methodology/v1/learning-sources/registry.json"),
  );
  const sourceReviewPath = path.join(root, manifest.sourceReviewFile);
  const sourceReview = (await readOptionalJson<SourceReviewFile>(sourceReviewPath)) ?? {
    reviewVersion: "1.0.0",
    releaseId: manifest.releaseId,
    updatedAt: "",
    reviewedBy: null,
    decisions: [],
  };
  const linksFile = await readOptionalJson<LearningSourceLinksFile>(
    path.join(modelDir, "learning-source-links.json"),
  );
  const linksByCompetency = new Map<string, LearningSourceLink>();
  for (const link of linksFile?.links ?? []) linksByCompetency.set(link.competencyId, link);

  const professionFiles = new Map<string, ProfessionCompetencyFile>();
  const views = new Map<string, ProfessionView | null>();
  for (const professionId of manifest.professionIds) {
    const slug = slugOf(professionId);
    professionFiles.set(
      professionId,
      await readJson<ProfessionCompetencyFile>(
        path.join(modelDir, "profession-competencies", `${slug}.json`),
      ),
    );
    views.set(
      professionId,
      await readOptionalJson<ProfessionView>(path.join(modelDir, "professions/views", `${slug}.json`)),
    );
  }

  return {
    root,
    manifestPath: absoluteManifestPath,
    manifest,
    professions,
    competencies,
    catalog,
    registry,
    sourceReview,
    sourceReviewFileFound: Boolean(await readOptionalJson(sourceReviewPath)),
    professionFiles,
    views,
    linksByCompetency,
  };
}

export function evaluateRelease(
  inputs: ReleaseInputs,
  options: { strictSourceReview?: boolean; asOf?: Date } = {},
): ReleaseEvaluation {
  const strictSourceReview = options.strictSourceReview ?? true;
  const asOf = options.asOf ?? new Date();
  const competencyById = new Map(inputs.competencies.competencies.map((item) => [item.id, item]));
  const blocksByCanonicalId = new Map<string, CompetencyBlock[]>();
  for (const block of inputs.catalog.blocks) {
    if (block.status !== "accepted") continue;
    for (const canonicalId of block.canonicalIds ?? []) {
      const list = blocksByCanonicalId.get(canonicalId) ?? [];
      list.push(block);
      blocksByCanonicalId.set(canonicalId, list);
    }
  }
  const sourceById = new Map(inputs.registry.sources.map((source) => [source.id, source]));
  const reviewByKey = new Map(
    inputs.sourceReview.decisions.map((decision) => [
      sourceReviewKey(decision.professionId ?? "*", decision.competencyId, decision.sourceId),
      decision,
    ]),
  );
  const excluded: ExcludedCompetency[] = [];
  const professions: ProfessionEvaluation[] = [];

  const isExcluded = (professionId: string, competencyId: string): string | null => {
    const prefix = (inputs.manifest.excludedCompetencyPrefixes ?? []).find((item) =>
      competencyId.startsWith(item),
    );
    if (prefix) return `excluded-prefix:${prefix}`;
    const explicit = (inputs.manifest.excludedCompetencies ?? []).find(
      (item) => item.professionId === professionId && item.competencyId === competencyId,
    );
    return explicit ? explicit.reason : null;
  };

  for (const professionId of inputs.manifest.professionIds) {
    const professionRecord = inputs.professions.professions.find((item) => item.id === professionId);
    const professionFile = inputs.professionFiles.get(professionId);
    const gaps: ReleaseGap[] = [];
    if (!professionRecord) {
      gaps.push({
        professionId,
        competencyId: "*",
        type: "profession_missing",
        detail: `Профессия ${professionId} не найдена в professions.json`,
        blocking: true,
      });
    }
    if (!professionFile) {
      gaps.push({
        professionId,
        competencyId: "*",
        type: "profession_file_missing",
        detail: `Нет profession-competencies для ${professionId}`,
        blocking: true,
      });
      professions.push({
        id: professionId,
        title: professionRecord?.title ?? professionId,
        totalLinks: 0,
        includedLinks: 0,
        excludedLinks: 0,
        publishedLinks: 0,
        rows: [],
        gaps,
        passed: false,
      });
      continue;
    }

    const allLinks = professionFile.competencies;
    const includedLinks: ProfessionCompetency[] = [];
    for (const link of allLinks) {
      const reason = isExcluded(professionId, link.competencyId);
      if (reason) {
        excluded.push({ professionId, competencyId: link.competencyId, reason });
      } else {
        includedLinks.push(link);
      }
    }
    const includedById = new Map(includedLinks.map((item) => [item.competencyId, item]));
    const rows: CompetencyEvaluation[] = [];

    for (const professionCompetency of includedLinks) {
      const competency = competencyById.get(professionCompetency.competencyId);
      const rowGaps: ReleaseGap[] = [];
      if (!competency) {
        rowGaps.push({
          professionId,
          competencyId: professionCompetency.competencyId,
          type: "competency_missing",
          detail: `Компетенция ${professionCompetency.competencyId} отсутствует в competencies.json`,
          blocking: true,
        });
        // Заглушка, чтобы отчёт не терял связь.
        const placeholder: GlobalCompetency = {
          id: professionCompetency.competencyId,
          branchId: "",
          branchTitle: "",
          sectionId: "",
          sectionTitle: "",
          title: professionCompetency.competencyId,
          definition: "",
          priorityHint: professionCompetency.tier,
        };
        rows.push({
          professionId,
          competency: placeholder,
          professionCompetency,
          included: true,
          blocks: [],
          knowledge: [],
          skills: [],
          sources: [],
          gaps: rowGaps,
          passed: false,
        });
        continue;
      }

      const blocks = blocksByCanonicalId.get(competency.id) ?? [];
      const tagsById = new Map<string, TagRecord>();
      for (const block of blocks) {
        for (const tag of block.tags ?? []) {
          if (tag.evidenceState === "supported") tagsById.set(tag.id, tag);
        }
      }
      const knowledge = [...tagsById.values()].filter((tag) => tag.kind === "knowledge");
      const skills = [...tagsById.values()].filter((tag) => tag.kind === "skill");

      if (blocks.length === 0) {
        rowGaps.push({
          professionId,
          competencyId: competency.id,
          type: "no_block",
          detail: "Нет accepted-блока с canonicalId компетенции",
          blocking: true,
        });
      }
      if (
        knowledge.length < inputs.manifest.qualityBar.minKnowledge ||
        skills.length < inputs.manifest.qualityBar.minSkills
      ) {
        rowGaps.push({
          professionId,
          competencyId: competency.id,
          type: "composition",
          detail: `knowledge ${knowledge.length}/${inputs.manifest.qualityBar.minKnowledge}, skills ${skills.length}/${inputs.manifest.qualityBar.minSkills}`,
          blocking: true,
        });
      }

      const sources: ResolvedSource[] = [];
      const sourceIds = [...new Set(competency.learningSourceIds ?? [])];
      const seenEffective = new Set<string>();
      for (const originalId of sourceIds) {
        const decision = findSourceDecision(reviewByKey, professionId, competency.id, originalId);
        let effectiveId = originalId;
        if (decision?.decision === "excluded") {
          continue;
        }
        if (decision?.decision === "replaced") {
          if (!decision.replacementSourceId) {
            rowGaps.push({
              professionId,
              competencyId: competency.id,
              type: "source_missing",
              detail: `replaced без replacementSourceId для ${originalId}`,
              sourceId: originalId,
              blocking: true,
            });
            continue;
          }
          effectiveId = decision.replacementSourceId;
        }
        if (seenEffective.has(effectiveId)) continue;
        seenEffective.add(effectiveId);
        const source = sourceById.get(effectiveId);
        if (!source) {
          rowGaps.push({
            professionId,
            competencyId: competency.id,
            type: "source_missing",
            detail: `Источник ${effectiveId} не найден в реестре`,
            sourceId: effectiveId,
            blocking: true,
          });
          continue;
        }

        // Публикуем только активные первичные источники. Вторичные и blocked
        // не считаются доказательством и не создают отдельный пробел: они просто
        // не попадают в публичный набор, а minActivePrimarySources проверяется ниже.
        const usable =
          source.status === "active" &&
          source.authority !== "aggregator" &&
          source.discoveryOnly !== true;
        if (!usable) continue;

        if (!decision) {
          rowGaps.push({
            professionId,
            competencyId: competency.id,
            type: "source_review_missing",
            detail: `Нет решения по связи ${competency.id} → ${effectiveId}`,
            sourceId: effectiveId,
            blocking: strictSourceReview,
          });
        } else if (
          decision.decision === "accepted" &&
          (!decision.reviewedBy || !decision.reviewedAt)
        ) {
          rowGaps.push({
            professionId,
            competencyId: competency.id,
            type: "source_review_incomplete",
            detail: `accepted без reviewedBy/reviewedAt для ${effectiveId}`,
            sourceId: effectiveId,
            blocking: strictSourceReview,
          });
        }

        const summary = source.summary?.trim() || "";
        if (inputs.manifest.qualityBar.requireSourceSummary && !summary) {
          rowGaps.push({
            professionId,
            competencyId: competency.id,
            type: "source_summary_missing",
            detail: `Нет summary для источника ${effectiveId}`,
            sourceId: effectiveId,
            blocking: strictSourceReview,
          });
        }

        const checked = new Date(source.lastChecked);
        if (Number.isNaN(checked.getTime())) {
          rowGaps.push({
            professionId,
            competencyId: competency.id,
            type: "source_date_invalid",
            detail: `Некорректный lastChecked у ${effectiveId}: ${source.lastChecked}`,
            sourceId: effectiveId,
            blocking: true,
          });
        } else {
          const ageDays = Math.floor((asOf.getTime() - checked.getTime()) / 86_400_000);
          if (ageDays > inputs.manifest.qualityBar.maxSourceAgeDays) {
            rowGaps.push({
              professionId,
              competencyId: competency.id,
              type: "source_stale",
              detail: `Источник ${effectiveId} проверен ${ageDays} дн. назад (лимит ${inputs.manifest.qualityBar.maxSourceAgeDays})`,
              sourceId: effectiveId,
              blocking: true,
            });
          }
        }

        const link = inputs.linksByCompetency.get(competency.id);
        const rationale =
          link?.sourceIds.includes(effectiveId) || link?.sourceIds.includes(originalId)
            ? link?.rationale
            : undefined;
        sources.push({
          sourceId: effectiveId,
          source,
          ...(decision ? { decision } : {}),
          ...(rationale ? { rationale } : {}),
        });
      }

      const primarySources = sources.filter((item) => item.source.authority === "primary");
      if (
        sources.length < inputs.manifest.qualityBar.minActiveSources ||
        (inputs.manifest.qualityBar.requirePrimarySource &&
          primarySources.length < inputs.manifest.qualityBar.minActiveSources)
      ) {
        rowGaps.push({
          professionId,
          competencyId: competency.id,
          type: "no_source",
          detail: `Нет активного не-агрегатор источника (нужно ${inputs.manifest.qualityBar.minActiveSources}; primary ${primarySources.length})`,
          blocking: true,
        });
      }

      rows.push({
        professionId,
        competency,
        professionCompetency,
        included: true,
        blocks,
        knowledge,
        skills,
        sources,
        gaps: rowGaps,
        passed: !rowGaps.some((gap) => gap.blocking),
      });
    }

    const rowById = new Map(rows.map((row) => [row.competency.id, row]));
    for (const row of rows) {
      for (const prerequisite of row.professionCompetency.prerequisites ?? []) {
        if (!includedById.has(prerequisite)) {
          row.gaps.push({
            professionId,
            competencyId: row.competency.id,
            type: "prerequisite_missing",
            detail: `Prerequisite ${prerequisite} не входит в публикуемую часть профессии`,
            blocking: true,
          });
          continue;
        }
        const prerequisiteRow = rowById.get(prerequisite);
        if (prerequisiteRow && prerequisiteRow.professionCompetency.order >= row.professionCompetency.order) {
          row.gaps.push({
            professionId,
            competencyId: row.competency.id,
            type: "prerequisite_order",
            detail: `Prerequisite ${prerequisite} не раньше по order`,
            blocking: true,
          });
        }
      }
      row.passed = !row.gaps.some((gap) => gap.blocking);
    }

    const professionGaps = gaps.concat(rows.flatMap((row) => row.gaps));
    const publishedLinks = rows.filter((row) => row.passed).length;
    professions.push({
      id: professionId,
      title: professionRecord?.title ?? professionId,
      totalLinks: allLinks.length,
      includedLinks: includedLinks.length,
      excludedLinks: allLinks.length - includedLinks.length,
      publishedLinks,
      rows,
      gaps: professionGaps,
      passed: professionGaps.every((gap) => !gap.blocking),
    });
  }

  const allGaps = professions.flatMap((profession) => profession.gaps);
  const includedRows = professions.flatMap((profession) => profession.rows);
  const publishedRows = includedRows.filter((row) => row.passed);
  const uniqueCompetencies = new Set(includedRows.map((row) => row.competency.id));
  const uniquePublishedCompetencies = new Set(publishedRows.map((row) => row.competency.id));
  const uniqueSources = new Set(includedRows.flatMap((row) => row.sources.map((item) => item.sourceId)));
  const blockingGaps = allGaps.filter((gap) => gap.blocking);

  return {
    releaseId: inputs.manifest.releaseId,
    title: inputs.manifest.title,
    status: inputs.manifest.status,
    asOf: asOf.toISOString().slice(0, 10),
    strictSourceReview,
    professions,
    excluded,
    gaps: allGaps,
    totals: {
      professions: professions.length,
      totalLinks: professions.reduce((sum, item) => sum + item.totalLinks, 0),
      includedLinks: professions.reduce((sum, item) => sum + item.includedLinks, 0),
      excludedLinks: professions.reduce((sum, item) => sum + item.excludedLinks, 0),
      publishedLinks: publishedRows.length,
      uniqueCompetencies: uniqueCompetencies.size,
      uniquePublishedCompetencies: uniquePublishedCompetencies.size,
      uniqueSources: uniqueSources.size,
      gaps: allGaps.length,
      blockingGaps: blockingGaps.length,
      passed: blockingGaps.length === 0,
    },
  };
}

export interface PublicContentItem {
  id: string;
  title: string;
  definition?: string;
}

export interface PublicSource {
  id: string;
  title: string;
  kind: string;
  access: string;
  languages: string[];
  authority: string;
  summary: string;
  url: string;
  lastChecked: string;
  rationale?: string;
}

export interface PublicCompetency {
  id: string;
  title: string;
  titleEn?: string;
  definition: string;
  tier: "foundation" | "core" | "optional";
  order: number;
  prerequisites: string[];
  knowledge: PublicContentItem[];
  skills: PublicContentItem[];
  sources: PublicSource[];
}

export interface PublicSection {
  id: string;
  title: string;
  definition?: string;
  competencies: PublicCompetency[];
}

export interface PublicProfession {
  id: string;
  slug: string;
  title: string;
  titleEn?: string;
  description: string;
  coverage: {
    published: number;
    total: number;
    excluded: number;
    percent: number;
  };
  sections: PublicSection[];
}

export interface PublicContent {
  releaseId: string;
  title: string;
  status: "draft" | "ready";
  generatedAt: string;
  qualityBarVersion: string;
  stats: {
    professions: number;
    publishedCompetencies: number;
    publishedLinks: number;
    sources: number;
  };
  professions: PublicProfession[];
  excluded: ExcludedCompetency[];
}

function toPublicItem(tag: TagRecord): PublicContentItem {
  return {
    id: tag.id,
    title: tag.title,
    ...(tag.definition ? { definition: tag.definition } : {}),
  };
}

function toPublicSource(resolved: ResolvedSource): PublicSource {
  const source = resolved.source;
  return {
    id: source.id,
    title: source.title,
    kind: source.kind,
    access: source.access,
    languages: source.languages,
    authority: source.authority,
    summary: source.summary?.trim() || source.notes?.trim() || source.topics.join(", "),
    url: source.url,
    lastChecked: source.lastChecked,
    ...(resolved.rationale ? { rationale: resolved.rationale } : {}),
  };
}

function buildSections(
  inputs: ReleaseInputs,
  professionId: string,
  rows: CompetencyEvaluation[],
  publishedIds: Set<string>,
): PublicSection[] {
  const view = inputs.views.get(professionId) ?? null;
  const sections: PublicSection[] = [];
  if (view) {
    for (const section of view.sections) {
      const competencies = rows
        .filter((row) => row.passed && row.professionCompetency.sectionId === section.id)
        .sort((a, b) => a.professionCompetency.order - b.professionCompetency.order)
        .map((row) => toPublicCompetency(row, publishedIds));
      if (competencies.length === 0) continue;
      sections.push({
        id: section.id,
        title: section.title,
        ...(section.definition ? { definition: section.definition } : {}),
        competencies,
      });
    }
    return sections;
  }

  const groups = new Map<string, { title: string; rows: CompetencyEvaluation[] }>();
  for (const row of rows) {
    if (!row.passed) continue;
    const id = row.competency.sectionId || row.competency.branchId;
    const title = row.competency.sectionTitle || row.competency.branchTitle;
    const group = groups.get(id) ?? { title, rows: [] };
    group.rows.push(row);
    groups.set(id, group);
  }
  for (const [id, group] of groups) {
    sections.push({
      id,
      title: group.title,
      competencies: group.rows
        .sort((a, b) => a.professionCompetency.order - b.professionCompetency.order)
        .map((row) => toPublicCompetency(row, publishedIds)),
    });
  }
  return sections;
}

function toPublicCompetency(row: CompetencyEvaluation, publishedIds: Set<string>): PublicCompetency {
  const knowledge = [...new Map(row.knowledge.map((tag) => [tag.id, tag])).values()]
    .map(toPublicItem)
    .sort((a, b) => a.title.localeCompare(b.title, "ru"));
  const skills = [...new Map(row.skills.map((tag) => [tag.id, tag])).values()]
    .map(toPublicItem)
    .sort((a, b) => a.title.localeCompare(b.title, "ru"));
  const sources = [...new Map(row.sources.map((item) => [item.sourceId, item])).values()]
    .map(toPublicSource)
    .sort((a, b) => a.title.localeCompare(b.title, "ru"));
  return {
    id: row.competency.id,
    title: row.competency.title,
    ...(row.competency.titleEn ? { titleEn: row.competency.titleEn } : {}),
    definition: row.competency.definition,
    tier: row.professionCompetency.tier,
    order: row.professionCompetency.order,
    prerequisites: (row.professionCompetency.prerequisites ?? []).filter((id) => publishedIds.has(id)),
    knowledge,
    skills,
    sources,
  };
}

export function buildPublicContent(
  inputs: ReleaseInputs,
  evaluation: ReleaseEvaluation,
): PublicContent {
  const publishedRows = evaluation.professions.flatMap((profession) =>
    profession.rows.filter((row) => row.passed),
  );
  const publishedIds = new Set(publishedRows.map((row) => row.competency.id));
  const professions: PublicProfession[] = evaluation.professions.map((profession) => {
    const sections = buildSections(inputs, profession.id, profession.rows, publishedIds);
    const published = profession.rows.filter((row) => row.passed).length;
    const total = profession.includedLinks;
    const percent = total > 0 ? Math.round((published / total) * 100) : 0;
    const view = inputs.views.get(profession.id) ?? null;
    return {
      id: profession.id,
      slug: profession.id.split(".").at(-1) ?? profession.id,
      title: view?.title ?? profession.title,
      ...(view?.titleEn ? { titleEn: view.titleEn } : {}),
      description: `${view?.title ?? profession.title}: структура компетенций, знания, навыки и учебные материалы.`,
      coverage: {
        published,
        total,
        excluded: profession.excludedLinks,
        percent,
      },
      sections,
    };
  });
  const uniquePublished = new Set(publishedRows.map((row) => row.competency.id));
  const sources = new Set(publishedRows.flatMap((row) => row.sources.map((item) => item.sourceId)));
  return {
    releaseId: evaluation.releaseId,
    title: evaluation.title,
    status: evaluation.strictSourceReview && evaluation.totals.passed ? "ready" : "draft",
    generatedAt: new Date().toISOString(),
    qualityBarVersion: inputs.manifest.releaseVersion,
    stats: {
      professions: professions.length,
      publishedCompetencies: uniquePublished.size,
      publishedLinks: publishedRows.length,
      sources: sources.size,
    },
    professions,
    excluded: evaluation.excluded,
  };
}

export function renderGapReport(evaluation: ReleaseEvaluation): string {
  const lines: string[] = [];
  lines.push(`# Beta 1 — gap report`);
  lines.push("");
  lines.push(`- Release: \`${evaluation.releaseId}\``);
  lines.push(`- Manifest status: \`${evaluation.status}\``);
  lines.push(`- As of: ${evaluation.asOf}`);
  lines.push(`- Source review: ${evaluation.strictSourceReview ? "strict" : "draft (review/summary gaps не блокируют)"}`);
  lines.push("");
  lines.push("## Totals");
  lines.push("");
  lines.push("| Показатель | Значение |");
  lines.push("|---|---:|");
  lines.push(`| Профессий | ${evaluation.totals.professions} |`);
  lines.push(`| Связей всего | ${evaluation.totals.totalLinks} |`);
  lines.push(`| Связей в публикуемой части | ${evaluation.totals.includedLinks} |`);
  lines.push(`| Исключено связей | ${evaluation.totals.excludedLinks} |`);
  lines.push(`| Опубликовано связей | ${evaluation.totals.publishedLinks} |`);
  lines.push(`| Уникальных компетенций | ${evaluation.totals.uniqueCompetencies} |`);
  lines.push(`| Уникальных опубликованных | ${evaluation.totals.uniquePublishedCompetencies} |`);
  lines.push(`| Уникальных источников | ${evaluation.totals.uniqueSources} |`);
  lines.push(`| Пробелов | ${evaluation.totals.gaps} |`);
  lines.push(`| Блокирующих пробелов | ${evaluation.totals.blockingGaps} |`);
  lines.push(`| Gate | ${evaluation.totals.passed ? "PASS" : "FAIL"} |`);
  lines.push("");
  lines.push("## По профессиям");
  lines.push("");
  lines.push("| Профессия | Связей | В публикации | Исключено | Опубликовано | Блокирующих пробелов |");
  lines.push("|---|---:|---:|---:|---:|---:|");
  for (const profession of evaluation.professions) {
    lines.push(
      `| ${profession.title} | ${profession.totalLinks} | ${profession.includedLinks} | ${profession.excludedLinks} | ${profession.publishedLinks} | ${profession.gaps.filter((gap) => gap.blocking).length} |`,
    );
  }
  lines.push("");
  lines.push("## Пробелы по типам");
  lines.push("");
  const byType = new Map<GapType, number>();
  for (const gap of evaluation.gaps) byType.set(gap.type, (byType.get(gap.type) ?? 0) + 1);
  lines.push("| Тип | Количество |");
  lines.push("|---|---:|");
  for (const [type, count] of [...byType.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`| \`${type}\` | ${count} |`);
  }
  lines.push("");
  lines.push("## Компетенции, требующие работы");
  lines.push("");
  for (const profession of evaluation.professions) {
    const failing = profession.rows.filter((row) => !row.passed);
    if (failing.length === 0) continue;
    lines.push(`### ${profession.title}`);
    lines.push("");
    for (const row of failing) {
      const types = [...new Set(row.gaps.map((gap) => gap.type))].join(", ");
      lines.push(`- \`${row.competency.id}\` — ${row.competency.title} (${types})`);
    }
    lines.push("");
  }
  lines.push("## Исключено");
  lines.push("");
  if (evaluation.excluded.length === 0) {
    lines.push("Нет исключённых компетенций.");
  } else {
    const byReason = new Map<string, number>();
    for (const item of evaluation.excluded) {
      byReason.set(item.reason, (byReason.get(item.reason) ?? 0) + 1);
    }
    for (const [reason, count] of byReason) lines.push(`- \`${reason}\`: ${count}`);
  }
  lines.push("");
  lines.push("## Что делать");
  lines.push("");
  lines.push("1. Закрыть \`no_block\` и \`composition\` по батчам из `COS-REL-002`.");
  lines.push("2. Добавить/заменить источники и заполнить \`summary\`.");
  lines.push("3. Принять решения в \`release/beta-1-source-review.json\`.");
  lines.push("4. Повторить \`release:validate -- --release beta-1\`.");
  return `${lines.join("\n")}\n`;
}

export async function writeGapReport(
  root: string,
  evaluation: ReleaseEvaluation,
): Promise<{ markdownPath: string; jsonPath: string }> {
  const dir = path.join(root, "docs/12-release/reports");
  await mkdir(dir, { recursive: true });
  const base = `${evaluation.releaseId}-gap-report`;
  const markdownPath = path.join(dir, `${base}.md`);
  const jsonPath = path.join(dir, `${base}.json`);
  await writeFile(markdownPath, renderGapReport(evaluation), "utf8");
  const compact = {
    releaseId: evaluation.releaseId,
    title: evaluation.title,
    status: evaluation.status,
    asOf: evaluation.asOf,
    strictSourceReview: evaluation.strictSourceReview,
    totals: evaluation.totals,
    professions: evaluation.professions.map((profession) => ({
      id: profession.id,
      title: profession.title,
      totalLinks: profession.totalLinks,
      includedLinks: profession.includedLinks,
      excludedLinks: profession.excludedLinks,
      publishedLinks: profession.publishedLinks,
      passed: profession.passed,
      gaps: profession.gaps,
    })),
    excluded: evaluation.excluded,
    gaps: evaluation.gaps,
  };
  await writeFile(jsonPath, `${JSON.stringify(compact, null, 2)}\n`, "utf8");
  return { markdownPath, jsonPath };
}

export async function writePublicContent(root: string, content: PublicContent): Promise<string> {
  const file = path.join(root, "apps/web/src/content/generated/beta-1.json");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(content, null, 2)}\n`, "utf8");
  return file;
}
