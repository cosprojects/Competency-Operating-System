/**
 * COS-ARCH-170 — контракт онтологии (узлы и рёбра).
 *
 * Источник истины для:
 *  - обмена между агентами (collector → methodologist → writer → material-agent);
 *  - payload событий из COS-ARCH-140 («Competency Update», «Evidence Publication»);
 *  - воспроизводимого артефакта релиза (OntologySnapshot).
 *
 * Правило: контракт описывает данные, а не процесс. Процесс — в workflow.ts.
 */
import { z } from "zod";

export const CONTRACT_VERSION = "1.0.0" as const;

/** Идентификатор узла. Совместим с текущими id: `ux-design-thinking`, `it.uxui`, `tag_06aed3851a3b`. */
export const nodeIdSchema = z
  .string()
  .regex(
    /^[a-z0-9][a-z0-9._-]{2,63}$/,
    "id: только [a-z0-9._-], 3–64 символа, начинается с буквы или цифры",
  );

export const nodeTypeSchema = z.enum(["profession", "role", "competency", "skill", "knowledge"]);
export type NodeType = z.infer<typeof nodeTypeSchema>;

/**
 * Три ортогональные оси состояния вместо одного «статуса»:
 *  - lifecycle   — стадия жизни узла (публикация);
 *  - evidenceState — чем узел подтверждён;
 *  - reviewState — прошёл ли проверку человеком.
 * Узел может быть published, но с evidenceState=needs_review — это нормально и должно быть видно.
 */
export const lifecycleSchema = z.enum([
  "candidate",
  "review",
  "accepted",
  "published",
  "deprecated",
  "rejected",
]);
export type Lifecycle = z.infer<typeof lifecycleSchema>;

export const evidenceStateSchema = z.enum(["missing", "partial", "supported", "needs_review"]);
export type EvidenceState = z.infer<typeof evidenceStateSchema>;

export const reviewStateSchema = z.enum(["not_required", "pending", "confirmed"]);
export type ReviewState = z.infer<typeof reviewStateSchema>;

export const priorityHintSchema = z.enum(["foundation", "core", "optional"]);
export const scopeSchema = z.enum(["universal", "profession"]);

export const sourceStatusSchema = z.enum(["active", "planned", "blocked", "degraded", "duplicate"]);

/** Ссылка на источник. Источник — не узел: это доказательство существования узла. */
export const sourceRefSchema = z
  .object({
    sourceId: z.string().min(1),
    url: z.string().url().optional(),
    externalId: z.string().optional(),
    retrievedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "дата в формате YYYY-MM-DD").optional(),
    license: z.string().optional(),
    status: sourceStatusSchema.optional(),
    span: z
      .object({
        start: z.number().int().nonnegative(),
        end: z.number().int().nonnegative(),
      })
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.span && value.span.end <= value.span.start) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "span.end должен быть больше span.start" });
    }
  });
export type SourceRef = z.infer<typeof sourceRefSchema>;

/** Происхождение: кто и чем произвёл запись. Без этого артефакт нельзя воспроизвести. */
export const provenanceSchema = z.object({
  agent: z.string().min(1),
  contractVersion: z.string().min(1),
  runId: z.string().optional(),
  stepId: z.string().optional(),
  model: z.string().optional(),
  promptVersion: z.string().optional(),
  at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}(T[\d:.+-]+Z?)?$/, "дата или ISO-датавремя"),
});
export type Provenance = z.infer<typeof provenanceSchema>;

/**
 * Контракт проверяет структуру (жёсткие инварианты). Требования к качеству
 * текста — отдельная политика (как `qualityBar` в релизном манифесте),
 * иначе контракт начнёт падать на легаси-данных и его отключат.
 */
export const MIN_DEFINITION_LENGTH = 15;

/** Политика качества: длины описаний из AGENTS-description-writer. Сообщается как долг, не как ошибка. */
export const QUALITY_RULES: Record<NodeType, { minDefinition: number }> = {
  profession: { minDefinition: 90 },
  role: { minDefinition: 60 },
  competency: { minDefinition: 80 },
  skill: { minDefinition: 60 },
  knowledge: { minDefinition: 60 },
};

export function checkNodeQuality(node: OntologyNode): string[] {
  const issues: string[] = [];
  const rule = QUALITY_RULES[node.type];
  if (node.definition.trim().length < rule.minDefinition) {
    issues.push(
      `definition ${node.definition.trim().length} < ${rule.minDefinition} (${node.type})`,
    );
  }
  if ((node.type === "skill" || node.type === "knowledge") && node.evidence.length === 0) {
    issues.push("нет ни одного источника (evidence)");
  }
  return issues;
}

export const ontologyNodeSchema = z
  .object({
    id: nodeIdSchema,
    type: nodeTypeSchema,
    title: z.string().min(3).max(200),
    titleEn: z.string().min(3).max(200).optional(),
    definition: z.string().min(MIN_DEFINITION_LENGTH).max(2000),
    aliases: z.array(z.string().min(2)).default([]),
    /**
     * Устаревшее поле одиночного родителя. Знание принадлежит компетенциям через
     * рёбра `part_of`: один узел может использоваться в нескольких компетенциях.
     * @deprecated будет удалено в контракте 2.0
     */
    parentId: nodeIdSchema.optional(),
    professionIds: z.array(nodeIdSchema).default([]),
    priorityHint: priorityHintSchema.optional(),
    scope: scopeSchema.optional(),
    lifecycle: lifecycleSchema,
    evidenceState: evidenceStateSchema,
    reviewState: reviewStateSchema,
    version: z.number().int().positive().default(1),
    evidence: z.array(sourceRefSchema).default([]),
    provenance: provenanceSchema,
    /** Явно помеченные временные поля. Удаляются в контракте 2.0. */
    extra: z.record(z.unknown()).optional(),
  })
  .superRefine((node, ctx) => {
    if (node.definition.trim().length < MIN_DEFINITION_LENGTH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["definition"],
        message: `definition: минимум ${MIN_DEFINITION_LENGTH} символов`,
      });
    }
    if (node.lifecycle === "published") {
      if (node.evidence.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["evidence"],
          message: "published узел обязан иметь хотя бы один источник",
        });
      }
      if (node.reviewState !== "confirmed") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reviewState"],
          message: "published узел обязан быть подтверждён человеком",
        });
      }
    }
    if (node.evidenceState === "supported" && node.evidence.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["evidenceState"],
        message: "evidenceState=supported требует минимум один источник",
      });
    }
    if (node.type === "skill" || node.type === "knowledge") {
      // Членство проверяется на уровне снимка: у узла должно быть ≥ 1 ребро part_of.
      // Одиночный parentId больше не требуется — знания глобальны.
    }
  });
export type OntologyNode = z.infer<typeof ontologyNodeSchema>;

export const edgeTypeSchema = z.enum(["covers", "prerequisite", "part_of", "related", "primary_for"]);
export type EdgeType = z.infer<typeof edgeTypeSchema>;

export const ontologyEdgeSchema = z
  .object({
    id: z.string().min(3),
    type: edgeTypeSchema,
    from: nodeIdSchema,
    to: nodeIdSchema,
    strength: z.number().min(0).max(1).optional(),
    evidence: z.array(sourceRefSchema).default([]),
    provenance: provenanceSchema,
  })
  .superRefine((edge, ctx) => {
    if (edge.from === edge.to) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "ребро не может соединять узел с самим собой" });
    }
  });
export type OntologyEdge = z.infer<typeof ontologyEdgeSchema>;

/** Иммутабельный артефакт релиза: то, что реально публикуется и версионируется. */
export const ontologySnapshotSchema = z
  .object({
    contractVersion: z.literal(CONTRACT_VERSION),
    modelVersion: z.string().min(1),
    releaseId: z.string().min(1).optional(),
    generatedAt: z.string().min(1),
    nodes: z.array(ontologyNodeSchema),
    edges: z.array(ontologyEdgeSchema),
  })
  .superRefine((snapshot, ctx) => {
    const ids = new Set<string>();
    for (const node of snapshot.nodes) {
      if (ids.has(node.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `повторяющийся id узла: ${node.id}` });
      }
      ids.add(node.id);
    }
    const memberships = new Map<string, number>();
    const edgeIds = new Set<string>();
    for (const edge of snapshot.edges) {
      if (edgeIds.has(edge.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `повторяющийся id ребра: ${edge.id}` });
      }
      edgeIds.add(edge.id);
      if (edge.type === "part_of") {
        memberships.set(edge.from, (memberships.get(edge.from) ?? 0) + 1);
      }
      for (const endpoint of [edge.from, edge.to]) {
        if (!ids.has(endpoint)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `ребро ${edge.id} ссылается на несуществующий узел: ${endpoint}`,
          });
        }
      }
    }
    for (const node of snapshot.nodes) {
      if (node.type !== "skill" && node.type !== "knowledge") continue;
      if ((memberships.get(node.id) ?? 0) === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["edges"],
          message: `${node.type} ${node.id} не принадлежит ни одной компетенции (нет ребра part_of)`,
        });
      }
    }
  });
export type OntologySnapshot = z.infer<typeof ontologySnapshotSchema>;

/** Разрешённые переходы жизненного цикла. Всё остальное — ошибка, а не «ручная правка». */
export const LIFECYCLE_TRANSITIONS: Record<Lifecycle, Lifecycle[]> = {
  candidate: ["review", "accepted", "rejected"],
  review: ["accepted", "rejected"],
  accepted: ["published", "deprecated"],
  published: ["deprecated"],
  deprecated: [],
  rejected: ["candidate"],
};

export function canTransition(from: Lifecycle, to: Lifecycle): boolean {
  return LIFECYCLE_TRANSITIONS[from].includes(to);
}

/** Маппинг старых словарей в три оси. Нужен для чтения текущих данных без миграции. */
export function normalizeNodeState(input: {
  status?: string;
  evidenceState?: string;
  needsReview?: boolean;
}): { lifecycle: Lifecycle; evidenceState: EvidenceState; reviewState: ReviewState } {
  const status = input.status;
  const lifecycle: Lifecycle =
    status === "rejected"
      ? "rejected"
      : status === "deprecated"
        ? "deprecated"
        : status === "published"
          ? "published"
          : status === "candidate"
            ? "candidate"
            : status === "needs_review"
              ? "review"
              : "accepted";

  const rawEvidence = input.evidenceState;
  const evidenceState: EvidenceState =
    rawEvidence === "supported" || rawEvidence === "partial" || rawEvidence === "missing" || rawEvidence === "needs_review"
      ? rawEvidence
      : "partial";

  const reviewState: ReviewState =
    input.needsReview === true || lifecycle === "review"
      ? "pending"
      : lifecycle === "candidate"
        ? "not_required"
        : "confirmed";

  return { lifecycle, evidenceState, reviewState };
}
