/** In-memory реализация порта — для тестов раннера без БД. */
import type { ArtifactRef, Run, Step } from "../contracts/workflow.ts";
import type { WorkflowStore } from "./store.ts";

export class InMemoryWorkflowStore implements WorkflowStore {
  private runs = new Map<string, Run>();
  private steps = new Map<string, Step>();
  private artifacts = new Map<string, ArtifactRef>();

  async createRun(run: Run): Promise<void> {
    this.runs.set(run.id, structuredClone(run));
    for (const step of run.steps) this.steps.set(step.id, structuredClone(step));
  }

  async getRun(runId: string): Promise<Run | undefined> {
    const run = this.runs.get(runId);
    if (!run) return undefined;
    const steps = [...this.steps.values()]
      .filter((step) => step.runId === runId)
      .sort((a, b) => a.position - b.position || a.attempt - b.attempt);
    return structuredClone({ ...run, steps });
  }

  async saveRun(run: Run): Promise<void> {
    this.runs.set(run.id, structuredClone({ ...run, steps: [] }));
  }

  async listRuns(limit: number): Promise<Run[]> {
    return [...this.runs.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((run) => structuredClone(run));
  }

  async saveStep(step: Step): Promise<void> {
    this.steps.set(step.id, structuredClone(step));
  }

  async findSucceededStepByIdempotencyKey(key: string): Promise<Step | undefined> {
    for (const step of this.steps.values()) {
      if (step.idempotencyKey === key && step.status === "succeeded") return structuredClone(step);
    }
    return undefined;
  }

  async saveArtifact(artifact: ArtifactRef): Promise<void> {
    this.artifacts.set(artifact.sha256, structuredClone(artifact));
  }

  async findArtifactBySha(sha256: string): Promise<ArtifactRef | undefined> {
    const artifact = this.artifacts.get(sha256);
    return artifact ? structuredClone(artifact) : undefined;
  }
}
