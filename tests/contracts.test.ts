import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canTransition,
  edgeTypeSchema,
  normalizeNodeState,
  ontologyEdgeSchema,
  ontologyNodeSchema,
  ontologySnapshotSchema,
} from "../src/methodology/v1/contracts/ontology.ts";
import {
  ANALYSIS_PIPELINE,
  ONTOLOGY_PIPELINE,
  humanReviewRequestSchema,
  idempotencyKey,
  runSchema,
  stepSchema,
  stageInputSchema,
} from "../src/methodology/v1/contracts/workflow.ts";
import { buildSnapshot } from "../src/methodology/v1/contracts/adapters.ts";

const provenance = { agent: "methodologist-v1", contractVersion: "1.0.0", at: "2026-11-04" };
const sha = "a".repeat(64);
const artifact = { id: "art_1", kind: "json", uri: "s3://bucket/a.json", sha256: sha, bytes: 10, createdAt: "2026-11-04T10:00:00Z" };

function node(overrides: Record<string, unknown> = {}) {
  return {
    id: "ux-design-thinking",
    type: "competency",
    title: "Дизайн-мышление",
    definition: "Специалист системно разбирается в пользователе и задаче.",
    lifecycle: "accepted",
    evidenceState: "supported",
    reviewState: "confirmed",
    evidence: [{ sourceId: "coursera-uxui" }],
    provenance,
    ...overrides,
  };
}

describe("онтология: узел", () => {
  it("валидный узел проходит и заполняет дефолты", () => {
    const parsed = ontologyNodeSchema.parse(node());
    assert.equal(parsed.version, 1);
    assert.deepEqual(parsed.aliases, []);
    assert.deepEqual(parsed.professionIds, []);
  });

  it("published без источника отклоняется", () => {
    const result = ontologyNodeSchema.safeParse(node({ lifecycle: "published", evidenceState: "missing", evidence: [] }));
    assert.equal(result.success, false);
    assert.match(JSON.stringify(result.error?.issues), /обязан иметь хотя бы один источник/);
  });

  it("published без подтверждения человеком отклоняется", () => {
    const result = ontologyNodeSchema.safeParse(node({ lifecycle: "published", reviewState: "pending" }));
    assert.equal(result.success, false);
    assert.match(JSON.stringify(result.error?.issues), /подтверждён человеком/);
  });

  it("навык без member-ребра отклоняется уже на уровне снимка", () => {
    // Членство — это ребро part_of, а не поле узла: знание глобально и может
    // использоваться в нескольких компетенциях.
    const skill = {
      id: "tag_abc123",
      type: "skill",
      title: "Вертикальный ритм",
      definition: "Настраивает сетку и вертикальный ритм.",
      lifecycle: "accepted",
      evidenceState: "missing",
      reviewState: "confirmed",
      evidence: [],
      provenance,
    };
    assert.equal(ontologyNodeSchema.safeParse(skill).success, true);
    const result = ontologySnapshotSchema.safeParse({
      contractVersion: "1.0.0",
      modelVersion: "1.0.0",
      generatedAt: "2026-11-04",
      nodes: [skill],
      edges: [],
    });
    assert.equal(result.success, false);
    assert.match(JSON.stringify(result.error?.issues), /не принадлежит ни одной компетенции/);
  });

  it("слишком короткое определение отклоняется структурно", () => {
    assert.equal(ontologyNodeSchema.safeParse(node({ definition: "коротко" })).success, false);
  });

  it("evidenceState=supported без источников отклоняется", () => {
    assert.equal(ontologyNodeSchema.safeParse(node({ evidence: [] })).success, false);
  });
});

describe("онтология: ребро и снимок", () => {
  const edge = { id: "edge_1", type: "prerequisite", from: "ui-color", to: "ux-design-thinking", provenance };

  it("ребро валидно", () => {
    assert.equal(ontologyEdgeSchema.safeParse(edge).success, true);
    assert.equal(edgeTypeSchema.options.length, 5);
  });

  it("петля отклоняется", () => {
    assert.equal(ontologyEdgeSchema.safeParse({ ...edge, to: "ui-color" }).success, false);
  });

  it("снимок ловит висячую ссылку и дубль id", () => {
    const snapshot = {
      contractVersion: "1.0.0",
      modelVersion: "1.0.0",
      generatedAt: "2026-11-04",
      nodes: [node(), node()],
      edges: [{ ...edge, to: "нет-такого-узла" }],
    };
    const result = ontologySnapshotSchema.safeParse(snapshot);
    assert.equal(result.success, false);
    const text = JSON.stringify(result.error?.issues);
    assert.match(text, /повторяющийся id узла/);
    assert.match(text, /несуществующий узел/);
  });
});

describe("онтология: состояния", () => {
  it("старые словари сводятся в три оси", () => {
    assert.deepEqual(normalizeNodeState({ status: "needs_review" }), {
      lifecycle: "review", evidenceState: "partial", reviewState: "pending",
    });
    assert.deepEqual(normalizeNodeState({ status: "accepted", evidenceState: "supported", needsReview: false }), {
      lifecycle: "accepted", evidenceState: "supported", reviewState: "confirmed",
    });
    assert.equal(normalizeNodeState({ status: "rejected" }).lifecycle, "rejected");
  });

  it("переходы жизненного цикла ограничены", () => {
    assert.equal(canTransition("candidate", "review"), true);
    assert.equal(canTransition("accepted", "published"), true);
    assert.equal(canTransition("rejected", "accepted"), false);
    assert.equal(canTransition("published", "accepted"), false);
  });
});

describe("рантайм: шаг и прогон", () => {
  const step = {
    id: "step_1", runId: "run_1", stage: "research.plan", agent: "orchestrator-v1",
    status: "succeeded", attempt: 1, position: 0,
    idempotencyKey: "abc12345", contractVersion: "1.0.0", outputRef: artifact,
  };

  it("успешный шаг требует outputRef", () => {
    const { outputRef, ...withoutOutput } = step;
    assert.equal(stepSchema.safeParse(withoutOutput).success, false);
    assert.equal(stepSchema.safeParse(step).success, true);
  });

  it("failed шаг требует error", () => {
    assert.equal(stepSchema.safeParse({ ...step, status: "failed", outputRef: undefined }).success, false);
  });

  it("терминальный run требует finishedAt", () => {
    const base = { id: "run_1", pipelineId: "ontology.production", pipelineVersion: "1.0.0", status: "succeeded", createdAt: "2026-11-04T10:00:00Z", steps: [step] };
    assert.equal(runSchema.safeParse(base).success, false);
    assert.equal(runSchema.safeParse({ ...base, finishedAt: "2026-11-04T10:05:00Z" }).success, true);
  });

  it("превышение бюджета блокируется", () => {
    const result = runSchema.safeParse({
      id: "run_1", pipelineId: "ontology.production", pipelineVersion: "1.0.0",
      status: "running", createdAt: "2026-11-04T10:00:00Z",
      budget: { maxCostUsd: 1, spentUsd: 2 }, steps: [],
    });
    assert.equal(result.success, false);
  });

  it("шаг чужого прогона отклоняется", () => {
    const result = runSchema.safeParse({
      id: "run_1", pipelineId: "ontology.production", pipelineVersion: "1.0.0",
      status: "running", createdAt: "2026-11-04T10:00:00Z", steps: [{ ...step, runId: "run_2" }],
    });
    assert.equal(result.success, false);
  });
});

describe("рантайм: пайплайн и идемпотентность", () => {
  it("порядок стадий соответствует сценарию продукта", () => {
    assert.deepEqual(
      ONTOLOGY_PIPELINE.stages.map((stage) => stage.stage),
      ["research.plan", "research.collect", "review.materials", "rewrite.formulations", "materials.attach", "release.publish"],
    );
    assert.equal(ONTOLOGY_PIPELINE.stages.find((s) => s.stage === "review.materials")?.requiresReview, true);
    assert.equal(ONTOLOGY_PIPELINE.stages.find((s) => s.stage === "materials.attach")?.writesToGraph, true);
    assert.deepEqual(ANALYSIS_PIPELINE.stages.map((s) => s.stage), ["analysis.market"]);
  });

  it("ключ идемпотентности стабилен и зависит от входа", () => {
    const a = idempotencyKey("ontology.production", "1.0.0", "research.collect", { professionId: "it.uxui", queries: ["q"] });
    const b = idempotencyKey("ontology.production", "1.0.0", "research.collect", { professionId: "it.uxui", queries: ["q"] });
    const c = idempotencyKey("ontology.production", "1.0.0", "research.collect", { professionId: "it.motion", queries: ["q"] });
    assert.equal(a, b);
    assert.notEqual(a, c);
    assert.match(a, /^[a-f0-9]{64}$/);
  });

  it("контракты стадий проверяют вход", () => {
    assert.equal(stageInputSchema.shape["research.plan"].safeParse({ professionIds: ["it.uxui"] }).success, true);
    assert.equal(stageInputSchema.shape["research.plan"].safeParse({ professionIds: [] }).success, false);
    assert.equal(stageInputSchema.shape["review.materials"].safeParse({ professionId: "it.uxui", items: [] }).success, false);
  });

  it("запрос на ревью требует хотя бы один элемент", () => {
    const review = { id: "rev_1", runId: "run_1", stepId: "step_1", assigneeRole: "methodologist", status: "open", items: [{ entityId: "материал-1" }], createdAt: "2026-11-04T10:00:00Z" };
    assert.equal(humanReviewRequestSchema.safeParse(review).success, true);
    assert.equal(humanReviewRequestSchema.safeParse({ ...review, items: [] }).success, false);
  });
});

describe("адаптеры: реальная модель → снимок", () => {
  const fixture = {
    professions: { modelVersion: "1.0.0", professions: [{ id: "it.uxui", sphereId: "it", title: "UX/UI-дизайнер" }] },
    descriptions: { descriptions: { "it.uxui": "Проектирует опыт и интерфейс продукта: исследует аудиторию и проверяет прототипы." } },
    competencies: {
      modelVersion: "1.0.0",
      competencies: [
        { id: "ux-design-thinking", title: "Дизайн-мышление", definition: "Специалист системно разбирается в пользователе и задаче.", learningSourceIds: ["src-1"] },
        { id: "ui-color", title: "Цвет", definition: "Работает с цветом системно и осознанно.", learningSourceIds: [] },
      ],
    },
    catalog: {
      blocks: [
        { id: "comp_a", title: "Дизайн-мышление", definition: "Блок про мышление.", canonicalIds: ["ux-design-thinking"], status: "accepted", evidenceState: "supported" },
        { id: "comp_b", title: "Группа", definition: "Блок про две компетенции сразу.", canonicalIds: ["ux-design-thinking", "ui-color"], status: "accepted", evidenceState: "needs_review" },
      ],
      tags: [
        { id: "tag_1", title: "Карта пути", definition: "Схема пути пользователя.", kind: "skill", competencyLinks: [{ competencyId: "comp_a" }], sourceRefs: [{ sourceId: "src-1" }], evidenceState: "supported" },
        { id: "tag_2", title: "Цветовые модели", definition: "Модели представления цвета.", kind: "knowledge", competencyLinks: [{ competencyId: "comp_b" }], sourceRefs: [] },
      ],
    },
    registry: { registryVersion: "1.0.0", sources: [{ id: "src-1", url: "https://example.com", status: "active", lastChecked: "2026-10-28" }] },
    professionCompetencies: [{ professionId: "it.uxui", competencies: [{ competencyId: "ux-design-thinking", tier: "foundation", order: 1 }, { competencyId: "ui-color", tier: "core", order: 2, prerequisites: ["ux-design-thinking"] }] }],
    generatedAt: "2026-11-04T10:00:00Z",
  };

  it("строит валидный снимок и схлопывает дубли рёбер", () => {
    const first = buildSnapshot(fixture as never);
    assert.equal(first.snapshot.nodes.length, 6); // 1 профессия + 2 компетенции + 1 спорный блок + 2 тега
    // 2 covers профессии + 2 covers спорного блока + 1 prerequisite + 2 part_of (знания → компетенции)
    assert.equal(first.snapshot.edges.length, 7);
    assert.ok(first.warnings.some((w) => w.includes("неоднозначным")));
    // тот же снимок строится повторно без изменений — значит детерминирован
    const second = buildSnapshot(fixture as never);
    assert.deepEqual(second.snapshot.edges.map((e) => e.id).sort(), first.snapshot.edges.map((e) => e.id).sort());
  });

  it("спорный блок связывается с обеими компетенциями", () => {
    const { snapshot } = buildSnapshot(fixture as never);
    const fromBlock = snapshot.edges.filter((edge) => edge.from === "comp_b" && edge.type === "covers");
    assert.equal(fromBlock.length, 2);
  });

  it("тег принадлежит компетенции через ребро part_of", () => {
    const { snapshot } = buildSnapshot(fixture as never);
    const memberships = snapshot.edges.filter(
      (edge) => edge.type === "part_of" && edge.from === "tag_1",
    );
    assert.equal(memberships.length, 1);
    assert.equal(memberships[0]?.to, "ux-design-thinking");
  });
});
