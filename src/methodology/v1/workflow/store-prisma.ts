/** Prisma-реализация порта WorkflowStore (PostgreSQL в проде, SQLite локально). */
import {
  PrismaClient,
  WorkflowRunStatus as PrismaRunStatus,
  WorkflowStepStatus as PrismaStepStatus,
} from "@prisma/client";
import type { ArtifactRef, Run, RunStatus, Step, StepStatus } from "../contracts/workflow.ts";
import type { WorkflowStore } from "./store.ts";

function toRunStatus(status: string): RunStatus {
  return status.toLowerCase() as RunStatus;
}

function toStepStatus(status: string): StepStatus {
  return status.toLowerCase() as StepStatus;
}

function toPrismaRunStatus(status: RunStatus): PrismaRunStatus {
  return status.toUpperCase() as PrismaRunStatus;
}

function toPrismaStepStatus(status: StepStatus): PrismaStepStatus {
  return status.toUpperCase() as PrismaStepStatus;
}

type StepRow = {
  id: string;
  runId: string;
  stage: string;
  agent: string;
  status: string;
  attempt: number;
  position: number;
  idempotencyKey: string;
  contractVersion: string;
  startedAt: Date | null;
  finishedAt: Date | null;
  tokens: number | null;
  costUsd: number | null;
  latencyMs: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  errorRetryable: boolean | null;
  inputRef: { id: string; kind: string; uri: string; sha256: string; bytes: number; contentType: string | null; createdAt: Date } | null;
  outputRef: { id: string; kind: string; uri: string; sha256: string; bytes: number; contentType: string | null; createdAt: Date } | null;
};

type ArtifactRow = {
  id: string;
  kind: string;
  uri: string;
  sha256: string;
  bytes: number;
  contentType: string | null;
  createdAt: Date;
};

function artifactToRef(row: ArtifactRow): ArtifactRef {
  return {
    id: row.id,
    kind: row.kind as ArtifactRef["kind"],
    uri: row.uri,
    sha256: row.sha256,
    bytes: row.bytes,
    ...(row.contentType ? { contentType: row.contentType } : {}),
    createdAt: row.createdAt.toISOString(),
  };
}

function stepToModel(row: StepRow): Step {
  return {
    id: row.id,
    runId: row.runId,
    stage: row.stage as Step["stage"],
    agent: row.agent as Step["agent"],
    status: toStepStatus(row.status),
    attempt: row.attempt,
    position: row.position,
    idempotencyKey: row.idempotencyKey,
    contractVersion: row.contractVersion,
    ...(row.inputRef ? { inputRef: artifactToRef(row.inputRef) } : {}),
    ...(row.outputRef ? { outputRef: artifactToRef(row.outputRef) } : {}),
    ...(row.startedAt ? { startedAt: row.startedAt.toISOString() } : {}),
    ...(row.finishedAt ? { finishedAt: row.finishedAt.toISOString() } : {}),
    ...(row.tokens !== null || row.costUsd !== null || row.latencyMs !== null
      ? {
          metrics: {
            ...(row.tokens !== null ? { tokens: row.tokens } : {}),
            ...(row.costUsd !== null ? { costUsd: row.costUsd } : {}),
            ...(row.latencyMs !== null ? { latencyMs: row.latencyMs } : {}),
          },
        }
      : {}),
    ...(row.errorCode
      ? {
          error: {
            code: row.errorCode,
            message: row.errorMessage ?? row.errorCode,
            retryable: row.errorRetryable ?? false,
          },
        }
      : {}),
  };
}

const stepInclude = { inputRef: true, outputRef: true } as const;

export class PrismaWorkflowStore implements WorkflowStore {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient = new PrismaClient()) {
    this.prisma = prisma;
  }

  async createRun(run: Run): Promise<void> {
    await this.prisma.workflowRun.create({
      data: {
        id: run.id,
        pipelineId: run.pipelineId,
        pipelineVersion: run.pipelineVersion,
        status: toPrismaRunStatus(run.status),
        paramsJson: JSON.stringify(run.params),
        maxCostUsd: run.budget.maxCostUsd ?? null,
        spentUsd: run.budget.spentUsd,
        createdAt: new Date(run.createdAt),
        startedAt: run.startedAt ? new Date(run.startedAt) : null,
        finishedAt: run.finishedAt ? new Date(run.finishedAt) : null,
      },
    });
    for (const step of run.steps) await this.saveStep(step);
  }

  async getRun(runId: string): Promise<Run | undefined> {
    const row = await this.prisma.workflowRun.findUnique({
      where: { id: runId },
      include: { steps: { include: stepInclude, orderBy: [{ position: "asc" }, { attempt: "asc" }] } },
    });
    if (!row) return undefined;
    return {
      id: row.id,
      pipelineId: row.pipelineId,
      pipelineVersion: row.pipelineVersion,
      status: toRunStatus(row.status),
      params: JSON.parse(row.paramsJson) as Record<string, unknown>,
      budget: {
        ...(row.maxCostUsd !== null ? { maxCostUsd: row.maxCostUsd } : {}),
        spentUsd: row.spentUsd,
      },
      createdAt: row.createdAt.toISOString(),
      ...(row.startedAt ? { startedAt: row.startedAt.toISOString() } : {}),
      ...(row.finishedAt ? { finishedAt: row.finishedAt.toISOString() } : {}),
      steps: row.steps.map((step) => stepToModel(step as unknown as StepRow)),
    };
  }

  async saveRun(run: Run): Promise<void> {
    await this.prisma.workflowRun.update({
      where: { id: run.id },
      data: {
        status: toPrismaRunStatus(run.status),
        spentUsd: run.budget.spentUsd,
        startedAt: run.startedAt ? new Date(run.startedAt) : null,
        finishedAt: run.finishedAt ? new Date(run.finishedAt) : null,
      },
    });
  }

  async listRuns(limit: number): Promise<Run[]> {
    const rows = await this.prisma.workflowRun.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { steps: { include: stepInclude, orderBy: [{ position: "asc" }, { attempt: "asc" }] } },
    });
    return rows.map((row) => ({
      id: row.id,
      pipelineId: row.pipelineId,
      pipelineVersion: row.pipelineVersion,
      status: toRunStatus(row.status),
      params: JSON.parse(row.paramsJson) as Record<string, unknown>,
      budget: {
        ...(row.maxCostUsd !== null ? { maxCostUsd: row.maxCostUsd } : {}),
        spentUsd: row.spentUsd,
      },
      createdAt: row.createdAt.toISOString(),
      ...(row.startedAt ? { startedAt: row.startedAt.toISOString() } : {}),
      ...(row.finishedAt ? { finishedAt: row.finishedAt.toISOString() } : {}),
      steps: row.steps.map((step) => stepToModel(step as unknown as StepRow)),
    }));
  }

  async saveStep(step: Step): Promise<void> {
    const data = {
      runId: step.runId,
      stage: step.stage,
      agent: step.agent,
      status: toPrismaStepStatus(step.status),
      attempt: step.attempt,
      position: step.position,
      idempotencyKey: step.idempotencyKey,
      contractVersion: step.contractVersion,
      inputRefId: step.inputRef?.id ?? null,
      outputRefId: step.outputRef?.id ?? null,
      startedAt: step.startedAt ? new Date(step.startedAt) : null,
      finishedAt: step.finishedAt ? new Date(step.finishedAt) : null,
      tokens: step.metrics?.tokens ?? null,
      costUsd: step.metrics?.costUsd ?? null,
      latencyMs: step.metrics?.latencyMs ?? null,
      errorCode: step.error?.code ?? null,
      errorMessage: step.error?.message ?? null,
      errorRetryable: step.error?.retryable ?? null,
    };
    await this.prisma.workflowStep.upsert({
      where: { id: step.id },
      create: { id: step.id, ...data },
      update: data,
    });
  }

  async findSucceededStepByIdempotencyKey(key: string): Promise<Step | undefined> {
    const row = await this.prisma.workflowStep.findFirst({
      where: { idempotencyKey: key, status: "SUCCEEDED" },
      include: stepInclude,
    });
    return row ? stepToModel(row as unknown as StepRow) : undefined;
  }

  async saveArtifact(artifact: ArtifactRef): Promise<void> {
    await this.prisma.workflowArtifact.upsert({
      where: { sha256: artifact.sha256 },
      create: {
        id: artifact.id,
        kind: artifact.kind,
        uri: artifact.uri,
        sha256: artifact.sha256,
        bytes: artifact.bytes,
        contentType: artifact.contentType ?? null,
        createdAt: new Date(artifact.createdAt),
      },
      update: { uri: artifact.uri },
    });
  }

  async findArtifactBySha(sha256: string): Promise<ArtifactRef | undefined> {
    const row = await this.prisma.workflowArtifact.findUnique({ where: { sha256 } });
    return row ? artifactToRef(row) : undefined;
  }
}
