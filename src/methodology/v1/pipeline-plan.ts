export interface PipelineStep {
  id: string;
  order: number;
  title: string;
  description: string;
  executor: "agent" | "human";
  command: string;
  args: string[];
  requires?: string[];
  requiresEnv?: string[];
  produces?: string;
}

export interface PipelineFile {
  version: string;
  log: string;
  steps: PipelineStep[];
}

export interface PlannedStep {
  step: PipelineStep;
  status: "run" | "skip";
  reason?: string;
}

export interface PipelineRunOptions {
  dryRun: boolean;
  fromOrder: number;
  onlyId?: string;
}

export function readRunOptions(argv: string[]): PipelineRunOptions {
  const fromFlag = argv.indexOf("--from");
  const fromRaw = fromFlag === -1 ? undefined : argv[fromFlag + 1];
  const fromOrder = fromRaw ? Number(fromRaw) : 1;
  const onlyFlag = argv.indexOf("--only");
  const onlyId = onlyFlag === -1 ? undefined : argv[onlyFlag + 1];
  return {
    dryRun: argv.includes("--dry-run"),
    fromOrder: Number.isFinite(fromOrder) ? fromOrder : 1,
    onlyId,
  };
}

export function planSteps(pipeline: PipelineFile, options: PipelineRunOptions): PlannedStep[] {
  return pipeline.steps
    .slice()
    .sort((a, b) => a.order - b.order)
    .filter((step) => step.order >= options.fromOrder)
    .filter((step) => (options.onlyId ? step.id === options.onlyId : true))
    .map((step) => {
      if (step.executor === "human") {
        return { step, status: "skip" as const, reason: "шаг выполняет человек" };
      }
      return { step, status: "run" as const };
    });
}
