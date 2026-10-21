import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planSteps, readRunOptions, type PipelineFile } from "../src/methodology/v1/pipeline-plan.ts";

const pipeline: PipelineFile = {
  version: "1.0.0",
  log: "data/competency-candidates/pipeline-run.json",
  steps: [
    {
      id: "test",
      order: 1,
      title: "Тесты",
      description: "проверка",
      executor: "agent",
      command: "npm",
      args: ["test"],
    },
    {
      id: "parse-candidates",
      order: 3,
      title: "Очередь",
      description: "сбор",
      executor: "agent",
      command: "npm",
      args: ["run", "parse:candidates"],
      produces: "data/competency-candidates/queue.json",
    },
    {
      id: "accept-patch",
      order: 5,
      title: "Приёмка",
      description: "человек",
      executor: "human",
      command: "",
      args: [],
    },
  ],
};

describe("pipeline runner plan", () => {
  it("keeps agent steps in order and leaves the human step unrun", () => {
    const planned = planSteps(pipeline, { dryRun: false, fromOrder: 1 });
    assert.deepEqual(
      planned.map((item) => [item.step.id, item.status]),
      [
        ["test", "run"],
        ["parse-candidates", "run"],
        ["accept-patch", "skip"],
      ],
    );
  });

  it("reads a start order and a single step from the agent command", () => {
    assert.equal(readRunOptions(["node", "pipeline-run.ts", "--from", "3"]).fromOrder, 3);
    assert.equal(readRunOptions(["node", "pipeline-run.ts", "--only", "parse-candidates"]).onlyId, "parse-candidates");
    assert.equal(readRunOptions(["node", "pipeline-run.ts", "--dry-run"]).dryRun, true);

    const planned = planSteps(pipeline, { dryRun: true, fromOrder: 3 });
    assert.deepEqual(
      planned.map((item) => item.step.id),
      ["parse-candidates", "accept-patch"],
    );
  });
});
