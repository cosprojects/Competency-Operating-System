import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  ONTOLOGY_PIPELINE,
  runSchema,
  stepSchema,
  type Run,
  type Stage,
} from "../src/methodology/v1/contracts/workflow.ts";
import { InMemoryArtifactSink } from "../src/methodology/v1/workflow/artifacts.ts";
import { researchCollectHandler, researchPlanHandler } from "../src/methodology/v1/workflow/handlers.ts";
import {
  advanceWorkflowRun,
  createWorkflowRun,
  retryWorkflowStep,
  StageError,
  type RunnerDeps,
  type StageHandler,
} from "../src/methodology/v1/workflow/runner.ts";
import { resolveStageInput } from "../src/methodology/v1/workflow/stage-input.ts";
import { InMemoryWorkflowStore } from "../src/methodology/v1/workflow/store-memory.ts";

const ALL_STAGES: Stage[] = ONTOLOGY_PIPELINE.stages.map((stage) => stage.stage);

const STAGE_OUTPUT: Record<Stage, unknown> = {
  "research.plan": { queries: ["UX/UI-дизайнер: компетенции"] },
  "research.collect": {
    materials: [{ externalId: "https://example.com/m1", title: "Материал 1", url: "https://example.com/m1" }],
  },
  "review.materials": { decisions: [{ materialId: "mat_001", decision: "accepted", reason: "подходит", competencyId: "ux-design-thinking" }] },
  "rewrite.formulations": {
    descriptions: [
      {
        nodeId: "ux-design-thinking",
        definition: "Достаточно длинное определение для прохождения схемы выхода, минимум шестьдесят символов.",
      },
    ],
  },
  "materials.attach": { linked: [{ materialId: "mat_001", nodeId: "ux-design-thinking" }] },
  "release.publish": {
    snapshotRef: {
      id: "art_rel",
      kind: "json",
      uri: "data/workflow/artifacts/rel.json",
      sha256: "a".repeat(64),
      bytes: 10,
      createdAt: "2026-11-04T10:00:00Z",
    },
  },
  "analysis.market": {
    reportRef: {
      id: "art_rep",
      kind: "json",
      uri: "data/workflow/artifacts/rep.json",
      sha256: "b".repeat(64),
      bytes: 10,
      createdAt: "2026-11-04T10:00:00Z",
    },
  },
};

function ok(output: unknown): StageHandler {
  return async () => ({ output, metrics: { latencyMs: 5 } });
}

function makeDeps(handlers: Partial<Record<Stage, StageHandler>>, maxAttempts = 3) {
  const store = new InMemoryWorkflowStore();
  const sink = new InMemoryArtifactSink();
  let tick = Date.parse("2026-11-04T10:00:00Z");
  const deps: RunnerDeps = { store, sink, handlers, maxAttempts, now: () => new Date((tick += 1000)) };
  return { deps, store, sink };
}

const allHandlers = Object.fromEntries(
  ALL_STAGES.map((stage) => [stage, ok(STAGE_OUTPUT[stage])]),
) as Partial<Record<Stage, StageHandler>>;

async function create(deps: RunnerDeps, params: Record<string, unknown> = { professionIds: ["it.uxui"] }): Promise<Run> {
  return createWorkflowRun(deps, { pipeline: ONTOLOGY_PIPELINE, params });
}

describe("рантайм: создание прогона", () => {
  it("планирует все стадии пайплайна с позициями и агентами", async () => {
    const { deps } = makeDeps(allHandlers);
    const run = await create(deps);
    assert.equal(run.status, "created");
    assert.equal(run.steps.length, 6);
    assert.deepEqual(run.steps.map((step) => step.position), [0, 1, 2, 3, 4, 5]);
    assert.deepEqual(run.steps.map((step) => step.stage), ALL_STAGES);
    assert.equal(run.steps[2]?.agent, "methodologist-v1");
    assert.equal(new Set(run.steps.map((step) => step.idempotencyKey)).size, 6);
    assert.equal(runSchema.safeParse(run).success, true);
  });

  it("одинаковые параметры дают одинаковые ключи идемпотентности", async () => {
    const { deps } = makeDeps(allHandlers);
    const first = await create(deps);
    const second = await create(deps);
    assert.equal(first.steps[0]?.idempotencyKey, second.steps[0]?.idempotencyKey);
    const other = await create(deps, { professionIds: ["it.motion"] });
    assert.notEqual(first.steps[0]?.idempotencyKey, other.steps[0]?.idempotencyKey);
  });
});

describe("рантайм: выполнение", () => {
  it("проходит весь пайплайн и пишет артефакты", async () => {
    const { deps, sink } = makeDeps(allHandlers);
    const run = await create(deps);
    const result = await advanceWorkflowRun(deps, run.id);
    assert.equal(result.status, "succeeded");
    assert.ok(result.finishedAt);
    assert.equal(sink.contents.size, 12);
    for (const step of result.steps) {
      assert.equal(step.status, "succeeded");
      assert.ok(step.inputRef?.sha256);
      assert.ok(step.outputRef?.sha256);
      assert.equal(stepSchema.safeParse(step).success, true);
    }
  });

  it("повторный прогон с теми же параметрами не выполняет стадии заново", async () => {
    const calls: Stage[] = [];
    const counting = Object.fromEntries(
      ALL_STAGES.map((stage) => [
        stage,
        (async () => {
          calls.push(stage);
          return { output: STAGE_OUTPUT[stage] };
        }) as StageHandler,
      ]),
    ) as Partial<Record<Stage, StageHandler>>;
    const { deps } = makeDeps(counting);
    const first = await create(deps);
    await advanceWorkflowRun(deps, first.id);
    const afterFirst = calls.length;

    const second = await create(deps);
    const replay = await advanceWorkflowRun(deps, second.id);
    assert.equal(calls.length, afterFirst);
    assert.equal(replay.status, "succeeded");
    assert.ok(replay.steps.every((step) => step.status === "skipped" && step.outputRef));
  });

  it("ретраит retryable-ошибку новым attempt", async () => {
    let attempts = 0;
    const flaky: StageHandler = async () => {
      attempts += 1;
      if (attempts === 1) throw new StageError("временный сбой сети", "network", true);
      return { output: STAGE_OUTPUT["research.collect"] };
    };
    const { deps } = makeDeps({ ...allHandlers, "research.collect": flaky });
    const run = await create(deps);
    const result = await advanceWorkflowRun(deps, run.id);
    assert.equal(result.status, "succeeded");
    const collectSteps = result.steps.filter((step) => step.stage === "research.collect");
    assert.equal(collectSteps.length, 2);
    assert.equal(collectSteps[1]?.attempt, 2);
  });

  it("неретраибельная ошибка останавливает прогон", async () => {
    const failing: StageHandler = async () => {
      throw new StageError("источник недоступен", "source_unavailable", false);
    };
    const { deps } = makeDeps({ ...allHandlers, "research.collect": failing });
    const run = await create(deps);
    const result = await advanceWorkflowRun(deps, run.id);
    assert.equal(result.status, "failed");
    const failed = result.steps.find((step) => step.status === "failed");
    assert.equal(failed?.error?.code, "source_unavailable");
    assert.equal(failed?.error?.retryable, false);
  });

  it("неподключённая стадия помечается blocked", async () => {
    const { deps } = makeDeps({ "research.plan": ok(STAGE_OUTPUT["research.plan"]) });
    const run = await create(deps);
    const result = await advanceWorkflowRun(deps, run.id);
    assert.equal(result.status, "partially_succeeded");
    const blocked = result.steps.find((step) => step.stage === "research.collect");
    assert.equal(blocked?.status, "blocked");
    assert.equal(blocked?.error?.code, "stage_not_wired");
  });

  it("бюджет останавливает прогон до вызова стадии", async () => {
    const { deps } = makeDeps(allHandlers);
    const run = await createWorkflowRun(deps, {
      pipeline: ONTOLOGY_PIPELINE,
      params: { professionIds: ["it.uxui"] },
      maxCostUsd: 0,
    });
    const result = await advanceWorkflowRun(deps, run.id);
    assert.equal(result.status, "failed");
    assert.equal(result.steps[0]?.error?.code, "budget_exceeded");
  });

  it("ручной ретрай failed-шага создаёт новую попытку", async () => {
    let failing = true;
    const once: StageHandler = async () => {
      if (failing) throw new StageError("разовый сбой", "once", false);
      return { output: STAGE_OUTPUT["research.collect"] };
    };
    const { deps } = makeDeps({ ...allHandlers, "research.collect": once }, 2);
    const run = await create(deps);
    const failedRun = await advanceWorkflowRun(deps, run.id);
    assert.equal(failedRun.status, "failed");
    const failedStep = failedRun.steps.find((step) => step.status === "failed");
    assert.ok(failedStep);

    failing = false;
    const afterRetry = await retryWorkflowStep(deps, run.id, failedStep.id);
    assert.equal(afterRetry.status, "running");
    const result = await advanceWorkflowRun(deps, run.id);
    assert.equal(result.status, "succeeded");
  });
});

describe("рантайм: связывание стадий", () => {
  it("сбор получает запросы из выхода планирования", async () => {
    let received: unknown;
    const collect: StageHandler = async ({ input }) => {
      received = input;
      return { output: STAGE_OUTPUT["research.collect"] };
    };
    const { deps } = makeDeps({
      "research.plan": ok(STAGE_OUTPUT["research.plan"]),
      "research.collect": collect,
    });
    const run = await create(deps);
    await advanceWorkflowRun(deps, run.id);
    assert.deepEqual(received, {
      professionId: "it.uxui",
      queries: ["UX/UI-дизайнер: компетенции"],
    });
  });

  it("без выхода предыдущей стадии вход не собирается", async () => {
    const { deps } = makeDeps(allHandlers);
    const run = await create(deps);
    assert.throws(
      () => resolveStageInput("research.collect", run, {}),
      (error: unknown) => error instanceof StageError && error.code === "input_unavailable",
    );
  });
});

describe("research.plan: реальные данные", () => {
  it("строит по три запроса на профессию", async () => {
    const handler = researchPlanHandler(process.cwd());
    const result = await handler({ run: {} as Run, step: {} as never, input: { professionIds: ["it.uxui"] } });
    const output = result.output as { queries: string[] };
    assert.equal(output.queries.length, 3);
    assert.ok(output.queries[0]?.includes("UX/UI-дизайнер"));
  });

  it("неизвестная профессия — неретраибельная ошибка", async () => {
    const handler = researchPlanHandler(process.cwd());
    await assert.rejects(
      () => handler({ run: {} as Run, step: {} as never, input: { professionIds: ["it.nope"] } }),
      (error: unknown) =>
        error instanceof StageError && error.code === "unknown_profession" && !error.retryable,
    );
  });
});

describe("research.collect: журнал расширения", () => {
  const candidate = (verdict: string, confidence: number) => ({
    canonicalUrl: "https://example.com/course",
    title: "Курс по дизайну",
    provider: "brave-search",
    competencyId: "ux-design-thinking",
    review: { verdict, confidence },
  });

  async function journalRoot(candidates: unknown[], professionId = "it.uxui"): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), "cos-journal-"));
    await mkdir(join(dir, "data/learning-sources"), { recursive: true });
    await writeFile(
      join(dir, "data/learning-sources", "expansion-uxui-2026-11-01.json"),
      JSON.stringify({ generatedOn: "2026-11-01", professionId, candidates }),
      "utf8",
    );
    return dir;
  }

  it("берёт только accept с confidence ≥ 0.75", async () => {
    const root = await journalRoot([
      candidate("accept", 0.9),
      candidate("confirm", 0.95),
      candidate("accept", 0.5),
    ]);
    const handler = researchCollectHandler(root);
    const result = await handler({
      run: {} as Run,
      step: {} as never,
      input: { professionId: "it.uxui", queries: ["курс по дизайну"] },
    });
    const output = result.output as { materials: Array<{ confidence?: number }>; source: { mode: string } };
    assert.equal(output.materials.length, 1);
    assert.equal(output.materials[0]?.confidence, 0.9);
    assert.equal(output.source.mode, "journal");
  });

  it("без журнала — journal_missing без ретраев", async () => {
    const handler = researchCollectHandler(await mkdtemp(join(tmpdir(), "cos-empty-")));
    await assert.rejects(
      () => handler({ run: {} as Run, step: {} as never, input: { professionId: "it.uxui", queries: ["курс по дизайну"] } }),
      (error: unknown) => error instanceof StageError && error.code === "journal_missing" && !error.retryable,
    );
  });

  it("журнал другой профессии не подставляется", async () => {
    const root = await journalRoot([candidate("accept", 0.9)], "it.motion");
    const handler = researchCollectHandler(root);
    await assert.rejects(
      () => handler({ run: {} as Run, step: {} as never, input: { professionId: "it.uxui", queries: ["курс по дизайну"] } }),
      (error: unknown) => error instanceof StageError && error.code === "journal_mismatch",
    );
  });

  it("пустой список принятых — no_materials", async () => {
    const root = await journalRoot([candidate("reject", 0.9)]);
    const handler = researchCollectHandler(root);
    await assert.rejects(
      () => handler({ run: {} as Run, step: {} as never, input: { professionId: "it.uxui", queries: ["курс по дизайну"] } }),
      (error: unknown) => error instanceof StageError && error.code === "no_materials",
    );
  });
});
