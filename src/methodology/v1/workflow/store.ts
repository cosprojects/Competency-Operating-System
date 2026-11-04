/**
 * COS-ARCH-170 · шаг 2 — порт хранилища прогонов.
 *
 * Рантайм зависит от интерфейса, а не от Prisma: тесты работают на памяти,
 * CLI — на PostgreSQL/SQLite. Это позволяет менять СУБД без переписывания раннера.
 */
import type { ArtifactRef, Run, Step } from "../contracts/workflow.ts";

export interface WorkflowStore {
  createRun(run: Run): Promise<void>;
  getRun(runId: string): Promise<Run | undefined>;
  saveRun(run: Run): Promise<void>;
  listRuns(limit: number): Promise<Run[]>;

  saveStep(step: Step): Promise<void>;
  findSucceededStepByIdempotencyKey(key: string): Promise<Step | undefined>;

  saveArtifact(artifact: ArtifactRef): Promise<void>;
  findArtifactBySha(sha256: string): Promise<ArtifactRef | undefined>;
}
