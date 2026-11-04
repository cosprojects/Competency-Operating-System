export type TaskPriority = "P0" | "P1" | "P2" | "P3";
export type TaskStatus = "Backlog" | "Ready" | "In Progress" | "Review" | "Done";

export interface TaskVersion {
  id: string;
  title: string;
  stage: string;
  goal: string;
}

export interface TaskRecord {
  id: string;
  version: string;
  title: string;
  description: string;
  context: string;
  deliverable: string;
  outOfScope: string[];
  dependsOn: string[];
  deferred?: boolean;
  acceptance: string[];
  priority: TaskPriority;
  area: string;
  stage: string;
  status: TaskStatus;
  labels: string[];
  issueNumber?: number;
  issueUrl?: string;
}

export interface TaskFile {
  version: "1.0.0";
  project: {
    owner: string;
    title: string;
    repository: string;
  };
  versions: TaskVersion[];
  tasks: TaskRecord[];
}

const PRIORITIES = new Set(["P0", "P1", "P2", "P3"]);
const STATUSES = new Set(["Backlog", "Ready", "In Progress", "Review", "Done"]);

export function validateTaskFile(value: unknown): TaskFile {
  if (!value || typeof value !== "object") throw new Error("tasks.json: ожидается объект");
  const file = value as Partial<TaskFile>;
  if (file.version !== "1.0.0") throw new Error("tasks.json: version должен быть 1.0.0");
  if (!file.project?.owner || !file.project?.title || !file.project?.repository) {
    throw new Error("tasks.json: project.owner/title/repository обязательны");
  }
  if (!Array.isArray(file.versions) || file.versions.length === 0) {
    throw new Error("tasks.json: versions должен быть непустым массивом");
  }
  const versionIds = new Set<string>();
  for (const version of file.versions) {
    if (!/^v\d+\.\d+\.\d+$/.test(version.id)) throw new Error(`tasks.json: плохая версия «${version.id}»`);
    if (versionIds.has(version.id)) throw new Error(`tasks.json: повтор версии «${version.id}»`);
    versionIds.add(version.id);
    if (!version.title?.trim() || !version.stage?.trim() || !version.goal?.trim()) {
      throw new Error(`tasks.json: ${version.id}: нужны title/stage/goal`);
    }
  }
  if (!Array.isArray(file.tasks)) throw new Error("tasks.json: tasks должен быть массивом");
  const ids = new Set<string>();
  for (const task of file.tasks) {
    if (!/^T-\d{3,}$/.test(task.id)) throw new Error(`tasks.json: плохой id «${task.id}»`);
    if (ids.has(task.id)) throw new Error(`tasks.json: повтор id «${task.id}»`);
    ids.add(task.id);
    if (!versionIds.has(task.version)) throw new Error(`tasks.json: ${task.id}: неизвестная версия «${task.version}»`);
    if (!task.title?.trim()) throw new Error(`tasks.json: ${task.id}: пустой title`);
    if (!task.description?.trim()) throw new Error(`tasks.json: ${task.id}: пустой description`);
    if (!task.context?.trim()) throw new Error(`tasks.json: ${task.id}: пустой context`);
    if (!task.deliverable?.trim()) throw new Error(`tasks.json: ${task.id}: пустой deliverable`);
    if (!Array.isArray(task.outOfScope)) throw new Error(`tasks.json: ${task.id}: outOfScope должен быть массивом`);
    if (!Array.isArray(task.dependsOn)) throw new Error(`tasks.json: ${task.id}: dependsOn должен быть массивом`);
    if (task.deferred !== undefined && typeof task.deferred !== "boolean") {
      throw new Error(`tasks.json: ${task.id}: deferred должен быть boolean`);
    }
    if (!PRIORITIES.has(task.priority)) throw new Error(`tasks.json: ${task.id}: плохой priority`);
    if (!STATUSES.has(task.status)) throw new Error(`tasks.json: ${task.id}: плохой status`);
    if (!task.area?.trim()) throw new Error(`tasks.json: ${task.id}: пустой area`);
    if (!task.stage?.trim()) throw new Error(`tasks.json: ${task.id}: пустой stage`);
    if (!Array.isArray(task.acceptance) || task.acceptance.length === 0) {
      throw new Error(`tasks.json: ${task.id}: нужен хотя бы один acceptance`);
    }
  }
  const taskIds = new Set((file.tasks as TaskRecord[]).map((task) => task.id));
  for (const task of file.tasks as TaskRecord[]) {
    for (const dependency of task.dependsOn) {
      if (!taskIds.has(dependency)) throw new Error(`tasks.json: ${task.id}: неизвестная зависимость «${dependency}»`);
      if (dependency === task.id) throw new Error(`tasks.json: ${task.id}: задача зависит от себя`);
    }
  }
  return file as TaskFile;
}

export function nextTaskId(tasks: TaskRecord[]): string {
  let max = 0;
  for (const task of tasks) {
    const number = Number(task.id.slice(2));
    if (Number.isFinite(number) && number > max) max = number;
  }
  return `T-${String(max + 1).padStart(3, "0")}`;
}

export function slug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-zа-я0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function labelNames(task: TaskRecord): string[] {
  return [
    "task",
    `release:${task.version}`,
    `priority:${task.priority.toLowerCase()}`,
    `area:${slug(task.area)}`,
    `stage:${slug(task.stage)}`,
    ...(task.deferred ? ["deferred"] : []),
    ...task.labels,
  ]
    .map((label) => label.trim())
    .filter(Boolean)
    .filter((label, index, list) => list.indexOf(label) === index);
}

export function issueMarker(taskId: string): string {
  return `<!-- axiona-task:${taskId} -->`;
}

export function renderIssueBody(task: TaskRecord): string {
  const acceptance = task.acceptance.map((item) => `- [ ] ${item}`).join("\n");
  return [
    issueMarker(task.id),
    `## ${task.title}`,
    "",
    task.description,
    "",
    "## Контекст",
    "",
    task.context,
    "",
    "## Зависимости",
    "",
    task.dependsOn.length > 0 ? task.dependsOn.map((id) => `- ${id}`).join("\n") : "Нет.",
    "",
    "## Результат",
    "",
    task.deliverable,
    "",
    "## Вне scope",
    "",
    task.outOfScope.length > 0 ? task.outOfScope.map((item) => `- ${item}`).join("\n") : "Не определено.",
    "",
    "## Критерии готовности",
    "",
    acceptance,
    "",
    "## Метаданные",
    "",
    `- Версия: ${task.version}`,
    `- Приоритет: ${task.priority}`,
    `- Область: ${task.area}`,
    `- Этап roadmap: ${task.stage}`,
    `- Task ID: ${task.id}`,
    `- Deferred: ${task.deferred ? "да" : "нет"}`,
    "",
    "_Задача создана из `tasks/tasks.json` через локальный sync._",
  ].join("\n");
}

export function renderTaskTable(tasks: TaskRecord[]): string {
  if (tasks.length === 0) {
    return "Задач нет. Добавьте: npm run tasks:add -- --title \"...\" --description \"...\"";
  }
  const lines = ["| ID | Версия | Приоритет | Область | Этап | Статус | Issue | Название |", "|---|---|---|---|---|---|---|---|"];
  for (const task of tasks) {
    lines.push(
      `| ${task.id}${task.deferred ? "*" : ""} | ${task.version} | ${task.priority} | ${task.area} | ${task.stage} | ${task.status} | ${task.issueNumber ? `#${task.issueNumber}` : "—"} | ${task.title} |`,
    );
  }
  return lines.join("\n");
}
