/**
 * COS-ARCH-170 — контракт рантайма: прогон (run), шаг (step), артефакт, human-review.
 *
 * Сценарий продукта: инициация поиска ресурсной базы → сбор → методолог принимает
 * материалы → райтер правит формулировки → material-agent наполняет базу знаний →
 * публикация релиза. Агенты не общаются напрямую: только через артефакты и события.
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import { nodeIdSchema, ontologySnapshotSchema } from "./ontology.ts";

/** Версия контракта рантайма. Версия контракта онтологии — в ontology.ts. */
export const RUNTIME_CONTRACT_VERSION = "1.0.0" as const;

export const runStatusSchema = z.enum([
  "created",
  "running",
  "awaiting_review",
  "succeeded",
  "partially_succeeded",
  "failed",
  "cancelled",
]);
export type RunStatus = z.infer<typeof runStatusSchema>;

export const stepStatusSchema = z.enum([
  "pending",
  "running",
  "awaiting_review",
  "succeeded",
  "failed",
  "skipped",
  "blocked",
]);
export type StepStatus = z.infer<typeof stepStatusSchema>;

/** Стадии. Ключ — контракт стадии: вход, выход и агент фиксированы. */
export const stageSchema = z.enum([
  "research.plan",
  "research.collect",
  "review.materials",
  "rewrite.formulations",
  "materials.attach",
  "release.publish",
  "analysis.market",
]);
export type Stage = z.infer<typeof stageSchema>;

export const agentSchema = z.enum([
  "orchestrator-v1",
  "collector-v1",
  "methodologist-v1",
  "writer-v1",
  "material-agent-v1",
  "publisher-v1",
  "business-analyst-v1",
]);
export type AgentId = z.infer<typeof agentSchema>;

export const artifactRefSchema = z.object({
  id: z.string().min(3),
  kind: z.enum(["json", "text", "csv", "pdf", "html", "image", "directory"]),
  uri: z.string().min(3),
  sha256: z.string().regex(/^[a-f0-9]{64}$/, "sha256: 64 hex-символа"),
  bytes: z.number().int().nonnegative(),
  contentType: z.string().optional(),
  createdAt: z.string().min(10),
});
export type ArtifactRef = z.infer<typeof artifactRefSchema>;

export const stepSchema = z
  .object({
    id: z.string().min(3),
    runId: z.string().min(3),
    stage: stageSchema,
    agent: agentSchema,
    status: stepStatusSchema,
    attempt: z.number().int().positive().default(1),
    /** Позиция стадии в пайплайне: порядок выполнения и сортировка в отчётах. */
    position: z.number().int().nonnegative(),
    idempotencyKey: z.string().min(8),
    inputRef: artifactRefSchema.optional(),
    outputRef: artifactRefSchema.optional(),
    contractVersion: z.string().min(1),
    startedAt: z.string().optional(),
    finishedAt: z.string().optional(),
    metrics: z
      .object({
        tokens: z.number().int().nonnegative().optional(),
        costUsd: z.number().nonnegative().optional(),
        latencyMs: z.number().int().nonnegative().optional(),
      })
      .optional(),
    error: z
      .object({
        code: z.string().min(1),
        message: z.string().min(1),
        retryable: z.boolean(),
      })
      .optional(),
  })
  .superRefine((step, ctx) => {
    if (step.status === "failed" && !step.error) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["error"], message: "failed шаг обязан иметь error" });
    }
    if (step.status === "succeeded" && !step.outputRef) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["outputRef"],
        message: "succeeded шаг обязан иметь outputRef",
      });
    }
  });
export type Step = z.infer<typeof stepSchema>;

export const TERMINAL_RUN_STATUSES: RunStatus[] = [
  "succeeded",
  "partially_succeeded",
  "failed",
  "cancelled",
];

export const runSchema = z
  .object({
    id: z.string().min(3),
    pipelineId: z.string().min(3),
    pipelineVersion: z.string().min(1),
    status: runStatusSchema,
    params: z.record(z.unknown()).default({}),
    budget: z
      .object({
        maxCostUsd: z.number().nonnegative().optional(),
        spentUsd: z.number().nonnegative().default(0),
      })
      .default({ spentUsd: 0 }),
    createdAt: z.string().min(10),
    startedAt: z.string().optional(),
    finishedAt: z.string().optional(),
    steps: z.array(stepSchema).default([]),
  })
  .superRefine((run, ctx) => {
    if (TERMINAL_RUN_STATUSES.includes(run.status) && !run.finishedAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["finishedAt"],
        message: "терминальный run обязан иметь finishedAt",
      });
    }
    if (run.budget.maxCostUsd !== undefined && run.budget.spentUsd > run.budget.maxCostUsd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["budget", "spentUsd"],
        message: "бюджет прогона превышен — нужен новый run с увеличенным лимитом",
      });
    }
    const seen = new Set<Stage>();
    for (const step of run.steps) {
      if (step.runId !== run.id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `шаг ${step.id} относится к другому run: ${step.runId}`,
        });
      }
      if (seen.has(step.stage) && step.attempt === 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `стадия ${step.stage} повторяется в одном run — нужен attempt > 1`,
        });
      }
      seen.add(step.stage);
    }
  });
export type Run = z.infer<typeof runSchema>;

/** Запрос человеку на ревью — штатный шаг, а не «ошибка процесса». */
export const humanReviewRequestSchema = z.object({
  id: z.string().min(3),
  runId: z.string().min(3),
  stepId: z.string().min(3),
  assigneeRole: z.enum(["methodologist", "founder", "business-analyst"]),
  status: z.enum(["open", "in_progress", "done"]),
  items: z
    .array(
      z.object({
        entityId: z.string().min(1),
        decision: z.enum(["accepted", "needs_confirmation", "rejected"]).optional(),
        reason: z.string().optional(),
      }),
    )
    .min(1),
  createdAt: z.string().min(10),
  resolvedAt: z.string().optional(),
});
export type HumanReviewRequest = z.infer<typeof humanReviewRequestSchema>;

/** Стадия пайплайна: кто выполняет, нужен ли человек, пишет ли она в граф. */
export const pipelineStageSchema = z.object({
  stage: stageSchema,
  agent: agentSchema,
  requiresReview: z.boolean().default(false),
  writesToGraph: z.boolean().default(false),
});
export type PipelineStage = z.infer<typeof pipelineStageSchema>;

export const pipelineSchema = z.object({
  id: z.string().min(3),
  version: z.string().min(1),
  stages: z.array(pipelineStageSchema).min(1),
});
export type Pipeline = z.infer<typeof pipelineSchema>;

/** Пайплайн производства онтологии. Единственное место, где задан порядок стадий. */
export const ONTOLOGY_PIPELINE: Pipeline = pipelineSchema.parse({
  id: "ontology.production",
  version: "1.0.0",
  stages: [
    { stage: "research.plan", agent: "orchestrator-v1" },
    { stage: "research.collect", agent: "collector-v1" },
    { stage: "review.materials", agent: "methodologist-v1", requiresReview: true },
    { stage: "rewrite.formulations", agent: "writer-v1" },
    { stage: "materials.attach", agent: "material-agent-v1", writesToGraph: true },
    { stage: "release.publish", agent: "publisher-v1", requiresReview: true, writesToGraph: true },
  ],
});

/** Пайплайн бизнес-анализа: отдельная ветка, не связана с публикацией онтологии. */
export const ANALYSIS_PIPELINE: Pipeline = pipelineSchema.parse({
  id: "business.analysis",
  version: "1.0.0",
  stages: [{ stage: "analysis.market", agent: "business-analyst-v1", requiresReview: true }],
});

/** Контракты входов/выходов стадий. Единственный способ связать агентов. */
export const stageInputSchema = z.object({
  "research.plan": z.object({
    professionIds: z.array(nodeIdSchema).min(1),
    sphereId: z.string().optional(),
  }),
  "research.collect": z.object({
    professionId: nodeIdSchema,
    queries: z.array(z.string().min(3)).min(1),
  }),
  "review.materials": z.object({
    professionId: nodeIdSchema,
    items: z
      .array(
        z.object({
          materialId: z.string().min(3),
          title: z.string().min(3),
          snippet: z.string().optional(),
          sourceId: z.string().optional(),
          competencyId: z.string().optional(),
          confidence: z.number().min(0).max(1).optional(),
          relevance: z.number().min(0).max(1).optional(),
          verdict: z.enum(["accept", "confirm", "reject"]).optional(),
          flags: z.array(z.string()).optional(),
          access: z.enum(["free", "freemium", "paid", "unknown"]).optional(),
          language: z.enum(["ru", "en", "other"]).optional(),
          provider: z.string().optional(),
          kind: z.string().optional(),
          domain: z.string().optional(),
        }),
      )
      .min(1),
  }),
  "rewrite.formulations": z.object({
    professionId: nodeIdSchema,
    nodeIds: z.array(nodeIdSchema).min(1),
  }),
  "materials.attach": z.object({
    professionId: nodeIdSchema,
    decisions: z
      .array(
        z.object({
          materialId: z.string().min(3),
          nodeId: nodeIdSchema,
          status: z.enum(["accepted", "needs_confirmation", "rejected"]),
          title: z.string().optional(),
        }),
      )
      .min(1),
  }),
  "release.publish": z.object({ releaseId: z.string().min(1) }),
  "analysis.market": z.object({ markets: z.array(z.string().min(2)).min(1) }),
});

export const stageOutputSchema = z.object({
  "research.plan": z.object({ queries: z.array(z.string().min(3)).min(1) }),
  "research.collect": z.object({
    materials: z
      .array(
        z.object({
          externalId: z.string().min(1),
          title: z.string().min(3),
          url: z.string().url().optional(),
          competencyId: z.string().optional(),
          competencyTitle: z.string().optional(),
          confidence: z.number().min(0).max(1).optional(),
          provider: z.string().optional(),
          kind: z.string().optional(),
          relevance: z.number().min(0).max(1).optional(),
          verdict: z.enum(["accept", "confirm", "reject"]).optional(),
          flags: z.array(z.string()).optional(),
          access: z.enum(["free", "freemium", "paid", "unknown"]).optional(),
          language: z.enum(["ru", "en", "other"]).optional(),
        }),
      )
      .min(1),
    source: z
      .object({ mode: z.enum(["journal", "live"]), journal: z.string().optional() })
      .optional(),
  }),
  "review.materials": z.object({
    decisions: z
      .array(
        z.object({
          materialId: z.string().min(3),
          decision: z.enum(["accepted", "needs_confirmation", "rejected"]),
          reason: z.string().min(3),
          competencyId: z.string().optional(),
          nodeId: z.string().optional(),
          title: z.string().optional(),
        }),
      )
      .min(1),
  }),
  "rewrite.formulations": z.object({
    descriptions: z
      .array(
        z.object({
          nodeId: nodeIdSchema,
          definition: z.string().min(1),
          source: z.enum(["model", "catalog", "missing"]),
          meetsPolicy: z.boolean(),
        }),
      )
      .min(1),
    missing: z.array(nodeIdSchema).default([]),
  }),
  "materials.attach": z.object({
    linked: z
      .array(
        z.object({
          materialId: z.string().min(3),
          nodeId: nodeIdSchema,
          newMaterial: z.boolean().default(false),
          reused: z.boolean().default(false),
        }),
      )
      .default([]),
    duplicates: z
      .array(
        z.object({
          materialId: z.string(),
          matchId: z.string(),
          kind: z.string(),
          score: z.number().min(0).max(1),
        }),
      )
      .default([]),
    stats: z.object({
      input: z.number().int().nonnegative(),
      accepted: z.number().int().nonnegative(),
      linked: z.number().int().nonnegative(),
      newMaterials: z.number().int().nonnegative(),
      duplicates: z.number().int().nonnegative(),
    }),
  }),
  "release.publish": z.object({
    releaseId: z.string().min(1),
    snapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
    policyVersion: z.string().min(1),
    stats: z.object({
      nodes: z.number().int().nonnegative(),
      edges: z.number().int().nonnegative(),
      materials: z.number().int().nonnegative(),
      nodeDuplicates: z.number().int().nonnegative(),
      nodeDuplicatesStrong: z.number().int().nonnegative().default(0),
      nodeDuplicatesWeak: z.number().int().nonnegative().default(0),
    }),
    snapshot: ontologySnapshotSchema,
    publication: z
      .object({
        releaseId: z.string().min(1),
        snapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
        path: z.string().min(1),
        currentPath: z.string().min(1),
        created: z.boolean(),
      })
      .optional(),
  }),
  "analysis.market": z.object({ reportRef: artifactRefSchema }),
});

/** Детерминированный ключ идемпотентности: повтор того же входа не должен создавать дубль. */
export function idempotencyKey(
  pipelineId: string,
  pipelineVersion: string,
  stage: Stage,
  input: unknown,
): string {
  const canonical = JSON.stringify(input, Object.keys(input as object).sort());
  return createHash("sha256")
    .update(`${pipelineId}:${pipelineVersion}:${stage}:${canonical}`)
    .digest("hex");
}
