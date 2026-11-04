/**
 * Операторский CLI рантайма:
 *
 *   npm run run:cli -- create --profession it.uxui
 *   npm run run:cli -- advance run_xxx
 *   npm run run:cli -- status run_xxx
 *   npm run run:cli -- list
 *   npm run run:cli -- retry run_xxx step_xxx
 *
 * Все команды принимают --json для машинного вывода (CI, агент).
 */
import { PrismaClient } from "@prisma/client";
import {
  ANALYSIS_PIPELINE,
  ONTOLOGY_PIPELINE,
  TERMINAL_RUN_STATUSES,
  type Pipeline,
  type Run,
} from "../../contracts/workflow.ts";
import { PrismaMaterialsStore } from "../../materials/store-prisma.ts";
import { FsPublicationStore } from "../../release/publication.ts";
import { FileArtifactSink } from "../artifacts.ts";
import { createStageHandlers } from "../handlers.ts";
import { advanceWorkflowRun, createWorkflowRun, retryWorkflowStep, type RunnerDeps } from "../runner.ts";
import { PrismaWorkflowStore } from "../store-prisma.ts";

type Flags = Record<string, string | boolean>;

function parseArgs(argv: string[]): { command: string; positional: string[]; flags: Flags } {
  const command = argv[0] ?? "help";
  const positional: string[] = [];
  const flags: Flags = {};
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index] as string;
    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }
    const body = token.slice(2);
    const eq = body.indexOf("=");
    if (eq >= 0) {
      flags[body.slice(0, eq)] = body.slice(eq + 1);
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      flags[body] = next;
      index += 1;
    } else {
      flags[body] = true;
    }
  }
  return { command, positional, flags };
}

const asJson = process.argv.includes("--json");

function pipelineFromFlag(value: string | boolean | undefined): Pipeline {
  if (value === "business.analysis") return ANALYSIS_PIPELINE;
  return ONTOLOGY_PIPELINE;
}

function buildParams(pipeline: Pipeline, flags: Flags): Record<string, unknown> {
  if (pipeline.id === ANALYSIS_PIPELINE.id) {
    const markets = String(flags.market ?? "").split(",").map((item) => item.trim()).filter(Boolean);
    if (markets.length === 0) throw new Error("укажи --market \"профессии дизайна\"");
    return { markets };
  }
  const raw = String(flags.profession ?? "");
  const professionIds = raw === "all"
    ? ["it.uxui", "it.product", "it.motion", "it.graphic", "it.3ddesigner", "it.interior", "it.webdesigner", "it.presentation", "it.uxresearch", "it.artdir", "it.appdesign", "it.aidesigner"]
    : raw.split(",").map((item) => item.trim()).filter(Boolean);
  if (professionIds.length === 0) throw new Error("укажи --profession it.uxui[,it.motion] или --profession all");
  return {
    professionIds,
    ...(flags.release !== undefined ? { releaseId: String(flags.release) } : {}),
  };
}

const icon = (status: string): string =>
  ({ succeeded: "✓", failed: "✗", blocked: "■", skipped: "·", running: "▸", pending: "·", awaiting_review: "?" })[status] ?? "·";

function printRun(run: Run): void {
  console.log(`\nпрогон ${run.id} · ${run.pipelineId}@${run.pipelineVersion} · ${run.status}`);
  console.log(`создан ${run.createdAt}${run.finishedAt ? ` · завершён ${run.finishedAt}` : ""}`);
  const spent = run.budget.maxCostUsd !== undefined
    ? `$${run.budget.spentUsd.toFixed(2)} / $${run.budget.maxCostUsd.toFixed(2)}`
    : `$${run.budget.spentUsd.toFixed(2)}`;
  console.log(`бюджет ${spent}`);
  console.log("\nшаги:");
  const steps = [...run.steps].sort((a, b) => a.position - b.position || a.attempt - b.attempt);
  for (const step of steps) {
    const attempt = step.attempt > 1 ? ` (попытка ${step.attempt})` : "";
    const metric = step.metrics?.latencyMs !== undefined ? `${step.metrics.latencyMs} мс` : "—";
    const note = step.error ? `${step.error.code}: ${step.error.message}` : step.outputRef ? step.outputRef.uri : "";
    console.log(
      `  ${icon(step.status)} ${step.position + 1}. ${step.stage.padEnd(22)} ${step.status.padEnd(16)} ${step.agent.padEnd(18)} ${metric.padEnd(7)}${attempt}`,
    );
    if (note) console.log(`      ${note}`);
  }
  if (TERMINAL_RUN_STATUSES.includes(run.status)) console.log(`\nRESULT: ${run.status.toUpperCase()}`);
}

async function main(): Promise<void> {
  const { command, positional, flags } = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();
  const store = new PrismaWorkflowStore(prisma);
  const deps: RunnerDeps = {
    store,
    sink: new FileArtifactSink(process.cwd()),
    handlers: createStageHandlers(process.cwd(), {
      store: new PrismaMaterialsStore(prisma),
      publications: new FsPublicationStore(process.cwd()),
    }),
  };

  try {
    switch (command) {
      case "create": {
        const pipeline = pipelineFromFlag(flags.pipeline);
        const params = buildParams(pipeline, flags);
        const maxCostUsd = flags.budget !== undefined ? Number(flags.budget) : undefined;
        const run = await createWorkflowRun(deps, {
          pipeline,
          params,
          ...(maxCostUsd !== undefined && Number.isFinite(maxCostUsd) ? { maxCostUsd } : {}),
        });
        if (asJson) console.log(JSON.stringify(run, null, 2));
        else {
          printRun(run);
          console.log(`\nдальше: npm run run:cli -- advance ${run.id}`);
        }
        break;
      }
      case "advance": {
        const runId = positional[0];
        if (!runId) throw new Error("укажи runId: advance <runId>");
        const maxSteps = flags["max-steps"] !== undefined ? Number(flags["max-steps"]) : 50;
        const run = await advanceWorkflowRun(deps, runId, { maxSteps });
        if (asJson) console.log(JSON.stringify(run, null, 2));
        else printRun(run);
        break;
      }
      case "status": {
        const runId = positional[0];
        if (!runId) throw new Error("укажи runId: status <runId>");
        const run = await store.getRun(runId);
        if (!run) throw new Error(`прогон не найден: ${runId}`);
        if (asJson) console.log(JSON.stringify(run, null, 2));
        else printRun(run);
        break;
      }
      case "list": {
        const limit = flags.limit !== undefined ? Number(flags.limit) : 10;
        const runs = await store.listRuns(limit);
        if (asJson) console.log(JSON.stringify(runs, null, 2));
        else {
          if (runs.length === 0) console.log("прогонов пока нет");
          for (const run of runs) {
            console.log(`${run.id}  ${run.status.padEnd(18)}  ${run.pipelineId}@${run.pipelineVersion}  ${run.createdAt}`);
          }
        }
        break;
      }
      case "retry": {
        const [runId, stepId] = positional;
        if (!runId || !stepId) throw new Error("укажи runId и stepId: retry <runId> <stepId>");
        const run = await retryWorkflowStep(deps, runId, stepId);
        const advanced = await advanceWorkflowRun(deps, run.id);
        if (asJson) console.log(JSON.stringify(advanced, null, 2));
        else printRun(advanced);
        break;
      }
      default:
        console.log(
          [
            "COS-ARCH-170 · рантайм онтологии",
            "",
            "  create  --profession it.uxui[,it.motion] | --profession all  [--budget 0.5]",
            "  advance <runId> [--max-steps N]",
            "  status  <runId>",
            "  list    [--limit N]",
            "  retry   <runId> <stepId>",
            "",
            "флаг --json — машинный вывод",
          ].join("\n"),
        );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`ошибка: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
