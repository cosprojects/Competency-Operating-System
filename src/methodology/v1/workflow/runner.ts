/**
 * COS-ARCH-170 · шаг 2 — раннер прогонов.
 *
 * Отвечает за: порядок шагов, идемпотентный повтор, ретраи с новым attempt,
 * бюджет, запись артефактов и валидацию состояния контрактом перед сохранением.
 * Не знает, как выполняются стадии: это делают handlers.
 */
import { randomUUID } from "node:crypto";
import {
  RUNTIME_CONTRACT_VERSION,
  TERMINAL_RUN_STATUSES,
  idempotencyKey,
  runSchema,
  stepSchema,
  type ArtifactRef,
  type Pipeline,
  type Run,
  type RunStatus,
  type Stage,
  type Step,
} from "../contracts/workflow.ts";
import type { ArtifactSink } from "./artifacts.ts";
import { StageError } from "./errors.ts";
import { collectOutputs, resolveStageInput, type StageOutputs } from "./stage-input.ts";
import type { WorkflowStore } from "./store.ts";

export { StageError } from "./errors.ts";

export type StageHandlerResult = {
  output: unknown;
  metrics?: { tokens?: number; costUsd?: number; latencyMs?: number };
};

export type StageHandler = (ctx: {
  run: Run;
  step: Step;
  input: Record<string, unknown>;
}) => Promise<StageHandlerResult>;

export type RunnerDeps = {
  store: WorkflowStore;
  sink: ArtifactSink;
  handlers: Partial<Record<Stage, StageHandler>>;
  maxAttempts?: number;
  now?: () => Date;
};

const stageSuffix = (stage: Stage): string => stage.replace(/\./g, "_");

function stepIdFor(runId: string, stage: Stage, attempt: number): string {
  return `${runId}_${stageSuffix(stage)}_a${attempt}`;
}

function latestSteps(run: Run): Step[] {
  const latest = new Map<string, Step>();
  for (const step of run.steps) {
    const current = latest.get(step.stage);
    if (!current || step.attempt > current.attempt) latest.set(step.stage, step);
  }
  return [...latest.values()].sort((a, b) => a.position - b.position);
}

export function computeRunStatus(run: Run): RunStatus {
  const steps = latestSteps(run);
  if (steps.length === 0) return "created";
  if (steps.some((step) => step.status === "failed")) return "failed";
  if (steps.some((step) => step.status === "blocked")) {
    return steps.some((step) => step.status === "succeeded" || step.status === "skipped")
      ? "partially_succeeded"
      : "failed";
  }
  if (steps.some((step) => step.status === "awaiting_review")) return "awaiting_review";
  if (steps.some((step) => step.status === "pending" || step.status === "running")) return "running";
  return "succeeded";
}

export async function createWorkflowRun(
  deps: RunnerDeps,
  opts: { pipeline: Pipeline; params: Record<string, unknown>; maxCostUsd?: number; id?: string },
): Promise<Run> {
  const now = deps.now?.() ?? new Date();
  const at = now.toISOString();
  const runId = opts.id ?? `run_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
  const steps: Step[] = opts.pipeline.stages.map((stage, index) => ({
    id: stepIdFor(runId, stage.stage, 1),
    runId,
    stage: stage.stage,
    agent: stage.agent,
    status: "pending",
    attempt: 1,
    position: index,
    idempotencyKey: idempotencyKey(opts.pipeline.id, opts.pipeline.version, stage.stage, opts.params),
    contractVersion: RUNTIME_CONTRACT_VERSION,
  }));
  const run = runSchema.parse({
    id: runId,
    pipelineId: opts.pipeline.id,
    pipelineVersion: opts.pipeline.version,
    status: "created",
    params: opts.params,
    budget: { ...(opts.maxCostUsd !== undefined ? { maxCostUsd: opts.maxCostUsd } : {}), spentUsd: 0 },
    createdAt: at,
    steps,
  });
  await deps.store.createRun(run);
  return run;
}

async function persistArtifact(
  deps: RunnerDeps,
  content: unknown,
  now: () => Date,
): Promise<ArtifactRef> {
  const body = JSON.stringify(content, null, 2);
  const stored = await deps.sink.put(body, { kind: "json", contentType: "application/json" });
  const existing = await deps.store.findArtifactBySha(stored.sha256);
  if (existing) return existing;
  const artifact: ArtifactRef = {
    id: `art_${stored.sha256.slice(0, 12)}`,
    kind: stored.kind,
    uri: stored.uri,
    sha256: stored.sha256,
    bytes: stored.bytes,
    ...(stored.contentType ? { contentType: stored.contentType } : {}),
    createdAt: now().toISOString(),
  };
  await deps.store.saveArtifact(artifact);
  return artifact;
}

async function saveStep(deps: RunnerDeps, step: Step): Promise<Step> {
  // Контракт проверяется перед каждой записью: невалидное состояние не попадает в БД.
  const valid = stepSchema.parse(step);
  await deps.store.saveStep(valid);
  return valid;
}

async function failStep(
  deps: RunnerDeps,
  run: Run,
  step: Step,
  error: StageError,
  now: () => Date,
): Promise<void> {
  step.status = "failed";
  step.finishedAt = now().toISOString();
  step.error = { code: error.code, message: error.message, retryable: error.retryable };
  const valid = await saveStep(deps, step);
  const index = run.steps.findIndex((item) => item.id === valid.id);
  if (index >= 0) run.steps[index] = valid;
}

export async function advanceWorkflowRun(
  deps: RunnerDeps,
  runId: string,
  opts: { maxSteps?: number } = {},
): Promise<Run> {
  const now = deps.now ?? (() => new Date());
  const maxAttempts = deps.maxAttempts ?? 3;
  const maxSteps = opts.maxSteps ?? 50;

  let run = await deps.store.getRun(runId);
  if (!run) throw new Error(`прогон не найден: ${runId}`);
  if (TERMINAL_RUN_STATUSES.includes(run.status)) return run;

  if (!run.startedAt) run.startedAt = now().toISOString();
  run.status = "running";
  await deps.store.saveRun(run);

  // Выходы предыдущих стадий: читаем из артефактов, чтобы прогон можно было
  // продолжить другим вызовом (или после ретрая) без повторного выполнения.
  const resolved = new Map<string, unknown>();
  const loadOutput = async (step: { outputRef?: { sha256: string } }): Promise<void> => {
    const sha = step.outputRef?.sha256;
    if (!sha || resolved.has(sha)) return;
    const body = await deps.sink.get(sha);
    if (body === undefined) return;
    try {
      resolved.set(sha, JSON.parse(body));
    } catch {
      /* битый артефакт: стадия ниже сообщит input_unavailable */
    }
  };
  for (const step of run.steps) {
    if (step.status === "succeeded" || step.status === "skipped") await loadOutput(step);
  }

  for (let executed = 0; executed < maxSteps; executed += 1) {
    const pending = run.steps.find((step) => step.status === "pending");
    if (!pending) break;

    const maxCost = run.budget.maxCostUsd;
    if (maxCost !== undefined && run.budget.spentUsd >= maxCost) {
      await failStep(deps, run, pending, new StageError("бюджет прогона исчерпан", "budget_exceeded", false), now);
      run.status = "failed";
      run.finishedAt = now().toISOString();
      await deps.store.saveRun(run);
      return run;
    }

    const duplicate = await deps.store.findSucceededStepByIdempotencyKey(pending.idempotencyKey);
    if (duplicate && duplicate.id !== pending.id) {
      pending.status = "skipped";
      if (duplicate.outputRef) {
        pending.outputRef = duplicate.outputRef;
        await loadOutput(duplicate);
      }
      pending.finishedAt = now().toISOString();
      const valid = await saveStep(deps, pending);
      const index = run.steps.findIndex((item) => item.id === valid.id);
      if (index >= 0) run.steps[index] = valid;
      continue;
    }

    const handler = deps.handlers[pending.stage];
    if (!handler) {
      pending.status = "blocked";
      pending.finishedAt = now().toISOString();
      pending.error = {
        code: "stage_not_wired",
        message: `стадия ${pending.stage} ещё не подключена к рантайму`,
        retryable: false,
      };
      const valid = await saveStep(deps, pending);
      const index = run.steps.findIndex((item) => item.id === valid.id);
      if (index >= 0) run.steps[index] = valid;
      break;
    }

    pending.inputRef = await persistArtifact(
      deps,
      { stage: pending.stage, attempt: pending.attempt, input: run.params },
      now,
    );
    pending.status = "running";
    pending.startedAt = now().toISOString();
    await saveStep(deps, pending);

    const startedAtMs = Date.now();
    try {
      const outputs: StageOutputs = collectOutputs(run.steps, resolved);
      const stageInput = resolveStageInput(pending.stage, run, outputs);
      const result = await handler({
        run,
        step: pending,
        input: stageInput as Record<string, unknown>,
      });
      pending.outputRef = await persistArtifact(deps, result.output, now);
      if (pending.outputRef) resolved.set(pending.outputRef.sha256, result.output);
      pending.status = "succeeded";
      pending.finishedAt = now().toISOString();
      pending.metrics = { latencyMs: Date.now() - startedAtMs, ...(result.metrics ?? {}) };
      if (result.metrics?.costUsd) run.budget.spentUsd += result.metrics.costUsd;
      const valid = await saveStep(deps, pending);
      const index = run.steps.findIndex((item) => item.id === valid.id);
      if (index >= 0) run.steps[index] = valid;
    } catch (error) {
      const stageError =
        error instanceof StageError
          ? error
          : new StageError(
              error instanceof Error ? error.message : String(error),
              "stage_failed",
            );
      await failStep(deps, run, pending, stageError, now);

      if (stageError.retryable && pending.attempt < maxAttempts) {
        const nextAttempt = pending.attempt + 1;
        await saveStep(deps, {
          id: stepIdFor(run.id, pending.stage, nextAttempt),
          runId: run.id,
          stage: pending.stage,
          agent: pending.agent,
          status: "pending",
          attempt: nextAttempt,
          position: pending.position,
          idempotencyKey: pending.idempotencyKey,
          contractVersion: RUNTIME_CONTRACT_VERSION,
        });
        const fresh = await deps.store.getRun(runId);
        if (fresh) run = fresh;
        continue;
      }

      run.status = "failed";
      run.finishedAt = now().toISOString();
      await deps.store.saveRun(run);
      return run;
    }
  }

  run.status = computeRunStatus(run);
  if (TERMINAL_RUN_STATUSES.includes(run.status)) run.finishedAt = now().toISOString();
  await deps.store.saveRun(run);
  return run;
}

export async function retryWorkflowStep(
  deps: RunnerDeps,
  runId: string,
  stepId: string,
): Promise<Run> {
  const run = await deps.store.getRun(runId);
  if (!run) throw new Error(`прогон не найден: ${runId}`);
  const step = run.steps.find((item) => item.id === stepId);
  if (!step) throw new Error(`шаг не найден: ${stepId}`);
  if (step.status !== "failed" && step.status !== "blocked") {
    throw new Error(`повторить можно только failed/blocked шаг, текущий статус: ${step.status}`);
  }
  const maxAttempts = deps.maxAttempts ?? 3;
  const maxAttempt = Math.max(
    ...run.steps.filter((item) => item.stage === step.stage).map((item) => item.attempt),
  );
  if (maxAttempt >= maxAttempts) {
    throw new Error(`лимит попыток для ${step.stage} исчерпан: ${maxAttempt}/${maxAttempts}`);
  }
  const attempt = maxAttempt + 1;
  await saveStep(deps, {
    id: stepIdFor(run.id, step.stage, attempt),
    runId: run.id,
    stage: step.stage,
    agent: step.agent,
    status: "pending",
    attempt,
    position: step.position,
    idempotencyKey: step.idempotencyKey,
    contractVersion: RUNTIME_CONTRACT_VERSION,
  });
  run.status = "running";
  run.finishedAt = undefined;
  await deps.store.saveRun(run);
  const fresh = await deps.store.getRun(runId);
  return fresh ?? run;
}
