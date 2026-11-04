/**
 * COS-ARCH-170 — адаптеры: существующие JSON-файлы методологии → контракт онтологии.
 *
 * Задача адаптеров — не «привести данные в порядок», а доказать, что контракт
 * ложится на текущую модель без миграции. Всё, что не ложится, попадает в warnings.
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import { normalizeTitle } from "../dedupe/resources.ts";
import {
  CONTRACT_VERSION,
  checkNodeQuality,
  normalizeNodeState,
  ontologySnapshotSchema,
  type OntologyEdge,
  type OntologyNode,
  type OntologySnapshot,
  type SourceRef,
} from "./ontology.ts";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const registryFileSchema = z.object({
  registryVersion: z.string(),
  updatedAt: z.string().optional(),
  sources: z.array(
    z.object({
      id: z.string(),
      title: z.string().optional(),
      url: z.string().optional(),
      status: z.string().optional(),
      lastChecked: dateOnly.optional(),
      license: z.string().optional(),
    }),
  ),
});

export const professionsFileSchema = z.object({
  modelVersion: z.string(),
  professions: z.array(
    z.object({
      id: z.string(),
      sphereId: z.string(),
      title: z.string(),
      titleEn: z.string().optional(),
    }),
  ),
});

export const descriptionsFileSchema = z.object({ descriptions: z.record(z.string()) });

export const competenciesFileSchema = z.object({
  modelVersion: z.string(),
  competencies: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      titleEn: z.string().optional(),
      definition: z.string(),
      priorityHint: z.string().optional(),
      learningSourceIds: z.array(z.string()).optional(),
    }),
  ),
});

export const catalogFileSchema = z.object({
  catalogVersion: z.string().optional(),
  updatedOn: z.string().optional(),
  blocks: z.array(
    z.object({
      id: z.string(),
      slug: z.string().optional(),
      title: z.string(),
      titleEn: z.string().optional(),
      definition: z.string(),
      scope: z.string().optional(),
      canonicalIds: z.array(z.string()).optional(),
      professionIds: z.array(z.string()).optional(),
      status: z.string().optional(),
      evidenceState: z.string().optional(),
      sourceRefs: z.array(z.unknown()).optional(),
    }),
  ),
  materials: z
    .array(
      z
        .object({
          id: z.string(),
          kind: z.string().optional(),
          title: z.string(),
          url: z.string().optional(),
          provider: z.string().optional(),
          access: z.string().optional(),
          language: z.string().optional(),
          links: z.array(z.object({ competencyId: z.string() }).passthrough()).optional(),
        })
        .passthrough(),
    )
    .default([]),
  tags: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      definition: z.string(),
      aliases: z.array(z.string()).optional(),
      kind: z.enum(["knowledge", "skill"]),
      professionIds: z.array(z.string()).optional(),
      sourceRefs: z.array(z.unknown()).optional(),
      evidenceState: z.string().optional(),
      needsReview: z.boolean().optional(),
      competencyLinks: z.array(z.object({ competencyId: z.string() })).optional(),
    }),
  ),
});

export const professionCompetenciesFileSchema = z.object({
  professionId: z.string(),
  sphereId: z.string().optional(),
  competencies: z.array(
    z.object({
      competencyId: z.string(),
      tier: z.string(),
      order: z.number(),
      prerequisites: z.array(z.string()).optional(),
      sectionId: z.string().optional(),
      sectionTitle: z.string().optional(),
    }),
  ),
});

export type BuildInput = {
  professions: z.infer<typeof professionsFileSchema>;
  descriptions?: z.infer<typeof descriptionsFileSchema>;
  competencies: z.infer<typeof competenciesFileSchema>;
  catalog: z.infer<typeof catalogFileSchema>;
  registry: z.infer<typeof registryFileSchema>;
  professionCompetencies: Array<z.infer<typeof professionCompetenciesFileSchema>>;
  releaseId?: string;
  generatedAt?: string;
};

export type BuildResult = {
  snapshot: OntologySnapshot;
  warnings: string[];
  qualityDebt: Array<{ nodeId: string; type: string; issues: string[] }>;
};

function hash(value: string): string {
  return createHash("sha1").update(value).digest("hex").slice(0, 12);
}

function asSourceRefs(raw: unknown[] | undefined): SourceRef[] {
  if (!raw) return [];
  const refs: SourceRef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const sourceId = typeof record.sourceId === "string" ? record.sourceId : undefined;
    if (!sourceId) continue;
    refs.push({
      sourceId,
      ...(typeof record.url === "string" ? { url: record.url } : {}),
      ...(typeof record.externalId === "string" ? { externalId: record.externalId } : {}),
      ...(typeof record.retrievedAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(record.retrievedAt)
        ? { retrievedAt: record.retrievedAt }
        : {}),
      ...(typeof record.license === "string" ? { license: record.license } : {}),
    });
  }
  return refs;
}

export function buildSnapshot(input: BuildInput): BuildResult {
  const warnings: string[] = [];
  const provenance = {
    agent: "methodology-adapter",
    contractVersion: CONTRACT_VERSION,
    at: input.generatedAt ?? new Date().toISOString(),
  } as const;

  const sourceById = new Map(input.registry.sources.map((source) => [source.id, source]));

  const evidenceFromSourceIds = (ids: string[] | undefined): SourceRef[] => {
    const refs: SourceRef[] = [];
    for (const id of ids ?? []) {
      const source = sourceById.get(id);
      if (!source) {
        warnings.push(`неизвестный sourceId: ${id}`);
        continue;
      }
      refs.push({
        sourceId: id,
        ...(source.url ? { url: source.url } : {}),
        ...(source.lastChecked ? { retrievedAt: source.lastChecked } : {}),
        ...(source.license ? { license: source.license } : {}),
      });
    }
    return refs;
  };

  const nodes: OntologyNode[] = [];
  const edgeMap = new Map<string, OntologyEdge>();
  const nodeIds = new Set<string>();
  let duplicateEdges = 0;

  const pushEdge = (edge: OntologyEdge): void => {
    if (edgeMap.has(edge.id)) {
      duplicateEdges += 1;
      return;
    }
    edgeMap.set(edge.id, edge);
  };

  const pushNode = (node: OntologyNode): void => {
    if (nodeIds.has(node.id)) {
      warnings.push(`дубль узла: ${node.id}`);
      return;
    }
    nodeIds.add(node.id);
    nodes.push(node);
  };

  // 1. Профессии
  const descriptions = input.descriptions?.descriptions ?? {};
  for (const profession of input.professions.professions) {
    const definition = descriptions[profession.id]?.trim() ?? "";
    const state = normalizeNodeState({ status: "accepted" });
    pushNode({
      id: profession.id,
      type: "profession",
      title: profession.title,
      ...(profession.titleEn ? { titleEn: profession.titleEn } : {}),
      definition: definition || profession.title,
      aliases: [],
      professionIds: [],
      lifecycle: state.lifecycle,
      evidenceState: "missing",
      reviewState: state.reviewState,
      version: 1,
      evidence: [],
      provenance,
      ...(definition ? {} : { extra: { definitionSource: "title" } }),
    });
    if (!definition) warnings.push(`профессия ${profession.id}: нет описания в descriptions.json`);
  }

  // 2. Компетенции модели
  for (const competency of input.competencies.competencies) {
    const evidence = evidenceFromSourceIds(competency.learningSourceIds);
    const state = normalizeNodeState({ status: "accepted" });
    pushNode({
      id: competency.id,
      type: "competency",
      title: competency.title,
      ...(competency.titleEn ? { titleEn: competency.titleEn } : {}),
      definition: competency.definition,
      aliases: [],
      professionIds: [],
      ...(competency.priorityHint === "foundation" ||
      competency.priorityHint === "core" ||
      competency.priorityHint === "optional"
        ? { priorityHint: competency.priorityHint }
        : {}),
      lifecycle: state.lifecycle,
      evidenceState: evidence.length > 0 ? "supported" : "missing",
      reviewState: state.reviewState,
      version: 1,
      evidence,
      provenance,
    });
  }

  // 3. Блоки каталога: 1:1 сливаются с компетенцией модели, спорные — отдельные узлы
  const blockById = new Map(input.catalog.blocks.map((block) => [block.id, block]));
  const ambiguousBlocks = new Set<string>();
  for (const block of input.catalog.blocks) {
    const canonical = block.canonicalIds ?? [];
    if (canonical.length === 1) continue;
    ambiguousBlocks.add(block.id);
    const state = normalizeNodeState({
      status: block.status,
      evidenceState: block.evidenceState,
    });
    pushNode({
      id: block.id,
      type: "competency",
      title: block.title,
      ...(block.titleEn ? { titleEn: block.titleEn } : {}),
      definition: block.definition,
      aliases: [],
      professionIds: (block.professionIds ?? []).filter((id) => nodeIds.has(id)),
      lifecycle: state.lifecycle,
      evidenceState: state.evidenceState,
      reviewState: state.reviewState,
      version: 1,
      evidence: asSourceRefs(block.sourceRefs),
      provenance,
      extra: { ambiguousCanonicalIds: canonical },
    });
    for (const canonicalId of canonical) {
      if (!nodeIds.has(canonicalId)) {
        warnings.push(`блок ${block.id}: canonicalId отсутствует в модели: ${canonicalId}`);
        continue;
      }
      pushEdge({
        id: `edge_${hash(`covers|${block.id}|${canonicalId}`)}`,
        type: "covers",
        from: block.id,
        to: canonicalId,
        evidence: [],
        provenance,
      });
    }
  }
  if (ambiguousBlocks.size > 0) {
    warnings.push(`блоков с неоднозначным canonicalIds: ${ambiguousBlocks.size} (созданы как отдельные узлы)`);
  }

  // 4. Знания и навыки: узел глобальный, членство — рёбра part_of.
  //    Один и тот же термин используется в нескольких компетенциях; копии
  //    с совпадающим определением сливаются в один узел.
  const resolveCompetency = (blockId: string): string | undefined => {
    const block = blockById.get(blockId);
    if (!block) return undefined;
    const canonical = block.canonicalIds ?? [];
    if (canonical.length === 1 && canonical[0] && nodeIds.has(canonical[0])) return canonical[0];
    if (nodeIds.has(blockId)) return blockId;
    return undefined;
  };

  const resolvedLinks = new Map<string, string[]>();
  for (const tag of input.catalog.tags) {
    const links: string[] = [];
    for (const link of tag.competencyLinks ?? []) {
      const competencyId = resolveCompetency(link.competencyId);
      if (!competencyId) {
        warnings.push(`тег ${tag.id}: неизвестная компетенция ${link.competencyId}`);
        continue;
      }
      links.push(competencyId);
    }
    if (links.length > 0) resolvedLinks.set(tag.id, [...new Set(links)]);
  }

  const tagGroups = new Map<string, typeof input.catalog.tags>();
  for (const tag of input.catalog.tags) {
    if (!resolvedLinks.has(tag.id)) continue;
    const key = `${tag.kind}|${normalizeTitle(tag.title)}|${normalizeTitle(tag.definition)}`;
    const group = tagGroups.get(key) ?? [];
    group.push(tag);
    tagGroups.set(key, group);
  }

  let mergedTags = 0;
  const tagIdToCanonical = new Map<string, string>();

  for (const group of tagGroups.values()) {
    const sorted = [...group].sort(
      (a, b) =>
        (resolvedLinks.get(b.id)?.length ?? 0) - (resolvedLinks.get(a.id)?.length ?? 0) ||
        a.id.localeCompare(b.id),
    );
    const canonical = sorted[0];
    if (!canonical) continue;
    const mergedFrom = sorted.slice(1).map((tag) => tag.id);
    mergedTags += mergedFrom.length;
    for (const tag of group) tagIdToCanonical.set(tag.id, canonical.id);

    const evidence = [
      ...new Map(
        sorted.flatMap((tag) => asSourceRefs(tag.sourceRefs)).map((ref) => [ref.sourceId, ref]),
      ).values(),
    ];
    const states = sorted.map((tag) =>
      normalizeNodeState({ status: "accepted", evidenceState: tag.evidenceState, needsReview: tag.needsReview }),
    );
    const reviewState = states.some((state) => state.reviewState === "pending")
      ? "pending"
      : (states[0]?.reviewState ?? "confirmed");
    const evidenceState =
      evidence.length === 0
        ? "missing"
        : states.some((state) => state.evidenceState === "supported")
          ? "supported"
          : "partial";
    const professionIds = [
      ...new Set(sorted.flatMap((tag) => tag.professionIds ?? []).filter((id) => nodeIds.has(id))),
    ];
    const aliases = [...new Set(sorted.flatMap((tag) => tag.aliases ?? []))];

    pushNode({
      id: canonical.id,
      type: canonical.kind,
      title: canonical.title,
      definition: canonical.definition,
      aliases,
      professionIds,
      lifecycle: "accepted",
      evidenceState,
      reviewState,
      version: 1,
      evidence,
      provenance,
      ...(mergedFrom.length > 0 ? { extra: { mergedFrom } } : {}),
    });
  }

  for (const [tagId, competencyIds] of resolvedLinks) {
    const canonicalId = tagIdToCanonical.get(tagId);
    if (!canonicalId) continue;
    for (const competencyId of competencyIds) {
      pushEdge({
        id: `edge_${hash(`part_of|${canonicalId}|${competencyId}`)}`,
        type: "part_of",
        from: canonicalId,
        to: competencyId,
        evidence: [],
        provenance,
      });
    }
  }
  if (mergedTags > 0) {
    warnings.push(`дублей знаний/навыков слито: ${mergedTags} (совпали тип, название и определение)`);
  }

  // 5. Рёбра: профессия → компетенция, компетенция → пререквизит
  for (const file of input.professionCompetencies) {
    if (!nodeIds.has(file.professionId)) {
      warnings.push(`связи: неизвестная профессия ${file.professionId}`);
      continue;
    }
    for (const link of file.competencies) {
      if (!nodeIds.has(link.competencyId)) {
        warnings.push(`связи: неизвестная компетенция ${link.competencyId}`);
        continue;
      }
      pushEdge({
        id: `edge_${hash(`covers|${file.professionId}|${link.competencyId}`)}`,
        type: "covers",
        from: file.professionId,
        to: link.competencyId,
        ...(link.tier === "core" ? { strength: 0.8 } : {}),
        evidence: [],
        provenance,
      });
      for (const prerequisite of link.prerequisites ?? []) {
        if (!nodeIds.has(prerequisite)) {
          warnings.push(`связи: неизвестный пререквизит ${prerequisite} у ${link.competencyId}`);
          continue;
        }
        pushEdge({
          id: `edge_${hash(`prerequisite|${link.competencyId}|${prerequisite}`)}`,
          type: "prerequisite",
          from: link.competencyId,
          to: prerequisite,
          evidence: [],
          provenance,
        });
      }
    }
  }

  if (duplicateEdges > 0) {
    warnings.push(`рёбер-дублей схлопнуто: ${duplicateEdges} (пререквизиты приходят из нескольких профессий)`);
  }

  const edges = [...edgeMap.values()];

  const qualityDebt = nodes
    .map((node) => ({ nodeId: node.id, type: node.type, issues: checkNodeQuality(node) }))
    .filter((item) => item.issues.length > 0);

  const snapshot = ontologySnapshotSchema.parse({
    contractVersion: CONTRACT_VERSION,
    modelVersion: input.competencies.modelVersion,
    ...(input.releaseId ? { releaseId: input.releaseId } : {}),
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    nodes,
    edges,
  });

  return { snapshot, warnings, qualityDebt };
}
