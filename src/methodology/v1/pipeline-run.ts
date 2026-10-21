import { spawn } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { planSteps, readRunOptions, type PipelineFile } from "./pipeline-plan.ts";

async function fileExists(relativePath: string): Promise<boolean> {
  try {
    await access(path.resolve(relativePath));
    return true;
  } catch {
    return false;
  }
}

function runCommand(command: string, args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

const pipelinePath = path.resolve("src/methodology/v1/pipeline.json");
const pipeline = JSON.parse(await readFile(pipelinePath, "utf8")) as PipelineFile;
const options = readRunOptions(process.argv);
const planned = planSteps(pipeline, options);

interface LogEntry {
  id: string;
  order: number;
  command: string;
  args: string[];
  status: "ok" | "failed" | "skipped" | "planned";
  exitCode: number | null;
  reason?: string;
}

const entries: LogEntry[] = [];

for (const item of planned) {
  const commandLine = [item.step.command, ...item.step.args].filter(Boolean).join(" ");
  if (item.status === "skip") {
    console.log(`пропуск ${item.step.order}. ${item.step.title}: ${item.reason}`);
    entries.push({
      id: item.step.id,
      order: item.step.order,
      command: commandLine,
      args: item.step.args,
      status: "skipped",
      exitCode: null,
      reason: item.reason,
    });
    continue;
  }

  const missing = [];
  for (const required of item.step.requires ?? []) {
    if (!(await fileExists(required))) missing.push(required);
  }
  if (missing.length > 0) {
    const reason = `нет файла: ${missing.join(", ")}`;
    console.error(`стоп ${item.step.order}. ${item.step.title}: ${reason}`);
    entries.push({
      id: item.step.id,
      order: item.step.order,
      command: commandLine,
      args: item.step.args,
      status: "failed",
      exitCode: 1,
      reason,
    });
    break;
  }

  if (options.dryRun) {
    console.log(`план ${item.step.order}. ${commandLine}`);
    entries.push({
      id: item.step.id,
      order: item.step.order,
      command: commandLine,
      args: item.step.args,
      status: "planned",
      exitCode: null,
    });
    continue;
  }

  console.log(`старт ${item.step.order}. ${commandLine}`);
  const exitCode = await runCommand(item.step.command, item.step.args);
  entries.push({
    id: item.step.id,
    order: item.step.order,
    command: commandLine,
    args: item.step.args,
    status: exitCode === 0 ? "ok" : "failed",
    exitCode,
  });
  if (exitCode !== 0) break;
}

const logPath = path.resolve(pipeline.log);
await mkdir(path.dirname(logPath), { recursive: true });
await writeFile(
  logPath,
  `${JSON.stringify(
    {
      pipelineVersion: pipeline.version,
      startedAt: new Date().toISOString(),
      dryRun: options.dryRun,
      steps: entries,
    },
    null,
    2,
  )}\n`,
  "utf8",
);
console.log(logPath);

if (entries.some((entry) => entry.status === "failed")) process.exit(1);
