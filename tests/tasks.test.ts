import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  labelNames,
  nextTaskId,
  renderIssueBody,
  validateTaskFile,
  type TaskFile,
  type TaskRecord,
} from "../scripts/tasks/lib.ts";

function task(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: "T-001",
    version: "v0.1.0",
    title: "Проверить контент",
    description: "Сделать spot-check.",
    context: "Нужен человеческий spot-check перед Beta.",
    deliverable: "Подписанный чек-лист.",
    outOfScope: ["Переписывание контента"],
    dependsOn: [],
    acceptance: ["Проверены страницы"],
    priority: "P0",
    area: "Content",
    stage: "I",
    status: "Backlog",
    labels: [],
    ...overrides,
  };
}

function file(tasks: TaskRecord[] = [task()]): TaskFile {
  return {
    version: "1.0.0",
    project: {
      owner: "cosprojects",
      title: "AXIONA Launch",
      repository: "cosprojects/Competency-Operating-System",
    },
    versions: [
      { id: "v0.1.0", title: "Beta 1 foundation", stage: "I", goal: "Проверить базу." },
    ],
    tasks,
  };
}

describe("task manifest", () => {
  it("валидирует корректный файл", () => {
    assert.equal(validateTaskFile(file()).tasks.length, 1);
  });

  it("ловит задачу без критериев готовности", () => {
    const broken = file([task({ acceptance: [] })]);
    assert.throws(() => validateTaskFile(broken), /acceptance/);
  });

  it("ловит неизвестный приоритет", () => {
    const broken = { ...file(), tasks: [{ ...task(), priority: "P9" }] };
    assert.throws(() => validateTaskFile(broken), /priority/);
  });

  it("генерирует следующий ID", () => {
    assert.equal(nextTaskId([]), "T-001");
    assert.equal(nextTaskId([task({ id: "T-007" }), task({ id: "T-003" })]), "T-008");
  });

  it("собирает labels без дублей", () => {
    const labels = labelNames(task({ labels: ["task", "frontend"] }));
    assert.deepEqual(labels, ["task", "release:v0.1.0", "priority:p0", "area:content", "stage:i", "frontend"]);
  });

  it("рендерит маркер и чек-лист", () => {
    const body = renderIssueBody(task());
    assert.match(body, /axiona-task:T-001/);
    assert.match(body, /- \[ \] Проверены страницы/);
  });
});
