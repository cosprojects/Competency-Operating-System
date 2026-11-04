import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  issueMarker,
  labelNames,
  nextTaskId,
  renderIssueBody,
  renderTaskTable,
  validateTaskFile,
  type TaskFile,
  type TaskPriority,
  type TaskRecord,
  type TaskStatus,
  type TaskVersion,
} from "./lib.ts";

const TASKS_FILE = "tasks/tasks.json";
const TASKS_ENV_FILE = "tasks/.env.local";

function flag(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

function flags(argv: string[], name: string): string[] {
  const result: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === name && argv[index + 1] && !argv[index + 1]!.startsWith("--")) {
      result.push(argv[index + 1]!);
    }
  }
  return result;
}

function has(argv: string[], name: string): boolean {
  return argv.includes(name);
}

async function readTasks(): Promise<TaskFile> {
  const raw = JSON.parse(await readFile(path.join(process.cwd(), TASKS_FILE), "utf8")) as unknown;
  return validateTaskFile(raw);
}

async function writeTasks(file: TaskFile): Promise<void> {
  await writeFile(path.join(process.cwd(), TASKS_FILE), `${JSON.stringify(file, null, 2)}\n`, "utf8");
}

async function loadTasksEnv(): Promise<string> {
  const envPath = path.join(process.cwd(), TASKS_ENV_FILE);
  try {
    const raw = await readFile(envPath, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const withoutExport = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed;
      const index = withoutExport.indexOf("=");
      if (index === -1) continue;
      const key = withoutExport.slice(0, index).trim();
      const value = withoutExport.slice(index + 1).trim().replace(/^["']|["']$/g, "");
      if (key && !process.env[key]) process.env[key] = value;
    }
    return envPath;
  } catch {
    return `${envPath} (не найден)`;
  }
}

function token(): string {
  const value = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (!value) {
    throw new Error(
      `Нужен GH_TOKEN или GITHUB_TOKEN с доступом к Issues (read/write). ` +
        `Проверены process.env и ${process.cwd()}/tasks/.env.local. ` +
        "Fine-grained token: Issues read/write + доступ к репозиторию. " +
        "Для Projects v2, если включаете sync полей: Projects read/write. " +
        "Токен не коммитить.",
    );
  }
  return value;
}

async function github<T>(pathname: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`https://api.github.com${pathname}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token()}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API ${response.status}: ${text.slice(0, 500)}`);
  }
  return (await response.json()) as T;
}

interface IssueResponse {
  number: number;
  html_url: string;
  node_id: string;
}

async function ensureMilestone(repository: string, version: TaskVersion): Promise<number> {
  const [owner, repo] = repository.split("/");
  if (!owner || !repo) throw new Error(`Плохой repository «${repository}»`);
  const milestones = await github<Array<{ number: number; title: string }>>(
    `/repos/${owner}/${repo}/milestones?state=all&per_page=100`,
  );
  const existing = milestones.find((item) => item.title === version.id);
  if (existing) return existing.number;
  const created = await github<{ number: number }>(`/repos/${owner}/${repo}/milestones`, {
    method: "POST",
    body: JSON.stringify({
      title: version.id,
      description: `${version.title} (этап ${version.stage}): ${version.goal}`,
      state: "open",
    }),
  });
  return created.number;
}

async function ensureLabel(repository: string, name: string): Promise<void> {
  const [owner, repo] = repository.split("/");
  if (!owner || !repo) throw new Error(`Плохой repository «${repository}»`);
  try {
    await github(`/repos/${owner}/${repo}/labels/${encodeURIComponent(name)}`);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("404")) throw error;
    const color = name.startsWith("priority:")
      ? "b60205"
      : name.startsWith("area:")
        ? "1d76db"
        : name.startsWith("stage:")
          ? "5319e7"
          : "0e8a16";
    await github(`/repos/${owner}/${repo}/labels`, {
      method: "POST",
      body: JSON.stringify({ name, color, description: "AXIONA task automation" }),
    });
  }
}

async function findIssueByMarker(repository: string, taskId: string): Promise<IssueResponse | null> {
  const [owner, repo] = repository.split("/");
  if (!owner || !repo) throw new Error(`Плохой repository «${repository}»`);
  const query = `repo:${owner}/${repo} is:issue in:body "${issueMarker(taskId)}"`;
  const result = await github<{ items: IssueResponse[] }>(`/search/issues?q=${encodeURIComponent(query)}`);
  return result.items[0] ?? null;
}

async function createIssue(repository: string, task: TaskRecord, milestone: number): Promise<IssueResponse> {
  const [owner, repo] = repository.split("/");
  if (!owner || !repo) throw new Error(`Плохой repository «${repository}»`);
  for (const label of labelNames(task)) await ensureLabel(repository, label);
  return github<IssueResponse>(`/repos/${owner}/${repo}/issues`, {
    method: "POST",
    body: JSON.stringify({
      title: `${task.id}: ${task.title}`,
      body: renderIssueBody(task),
      labels: labelNames(task),
      milestone,
    }),
  });
}

async function updateIssue(repository: string, task: TaskRecord, milestone: number): Promise<void> {
  if (!task.issueNumber) return;
  const [owner, repo] = repository.split("/");
  if (!owner || !repo) throw new Error(`Плохой repository «${repository}»`);
  for (const label of labelNames(task)) await ensureLabel(repository, label);
  await github(`/repos/${owner}/${repo}/issues/${task.issueNumber}`, {
    method: "PATCH",
    body: JSON.stringify({
      title: `${task.id}: ${task.title}`,
      body: renderIssueBody(task),
      labels: labelNames(task),
      milestone,
      ...(task.deferred || task.status === "Done" ? { state: "closed" } : { state: "open" }),
    }),
  });
}

async function sync(dryRun: boolean, updateExisting: boolean, versionFilter?: string): Promise<void> {
  await loadTasksEnv();
  const file = await readTasks();
  const repository = process.env.GITHUB_REPOSITORY ?? file.project.repository;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const versionById = new Map(file.versions.map((version) => [version.id, version]));

  const selected = versionFilter ? file.tasks.filter((task) => task.version === versionFilter) : file.tasks;
  for (const task of selected) {
    if (task.deferred && !task.issueNumber) {
      skipped += 1;
      continue;
    }
    if (task.status === "Done" && !task.issueNumber) {
      skipped += 1;
      continue;
    }
    const version = versionById.get(task.version);
    if (!version) throw new Error(`${task.id}: неизвестная версия «${task.version}»`);
    const milestone = dryRun ? 0 : await ensureMilestone(repository, version);
    if (!task.issueNumber) {
      const found = dryRun ? null : await findIssueByMarker(repository, task.id);
      if (found) {
        task.issueNumber = found.number;
        task.issueUrl = found.html_url;
        updated += 1;
        console.log(`${task.id}: найден issue #${found.number}`);
        continue;
      }
      if (dryRun) {
        console.log(`${task.id}: будет создан issue (${task.version}, ${task.priority}, ${task.area}, ${task.stage})`);
        created += 1;
        continue;
      }
      const issue = await createIssue(repository, task, milestone);
      task.issueNumber = issue.number;
      task.issueUrl = issue.html_url;
      created += 1;
      console.log(`${task.id}: создан issue #${issue.number}`);
      continue;
    }

    if (updateExisting) {
      if (dryRun) {
        console.log(`${task.id}: будет обновлён issue #${task.issueNumber}`);
      } else {
        await updateIssue(repository, task, milestone);
        console.log(`${task.id}: обновлён issue #${task.issueNumber}`);
      }
      updated += 1;
    } else {
      skipped += 1;
    }
  }

  if (!dryRun) await writeTasks(file);
  console.log(
    `tasks:sync: created ${created}; updated ${updated}; skipped ${skipped}; total ${selected.length}` +
      (dryRun ? " (dry-run)" : ""),
  );
}

async function doctor(): Promise<void> {
  const envPath = await loadTasksEnv();
  const file = await readTasks();
  console.log(`env file: ${envPath}`);
  token();
  const user = await github<{ login: string }>("/user");
  const [owner, repo] = file.project.repository.split("/");
  if (!owner || !repo) throw new Error(`Плохой repository «${file.project.repository}»`);
  const repository = await github<{ full_name: string; private: boolean; permissions?: { push?: boolean } }>(
    `/repos/${owner}/${repo}`,
  );
  console.log("token: найден");
  console.log(`user: ${user.login}`);
  console.log(`repo: ${repository.full_name}; private=${repository.private}; push=${repository.permissions?.push ?? "unknown"}`);
  console.log(`project: ${file.project.owner}/${file.project.title}`);
  console.log(`versions: ${file.versions.length}; tasks: ${file.tasks.length}`);
  console.log(`project number env: ${process.env.GITHUB_PROJECT_NUMBER ?? "не задан (нужен для GraphQL-полей)"}`);
  console.log(`project token: ${process.env.PROJECT_TOKEN ? "найден" : "не задан (нужен classic PAT с project)"}`);
}

async function add(argv: string[]): Promise<void> {
  const title = flag(argv, "--title");
  const description = flag(argv, "--description");
  if (!title || !description) throw new Error("Нужны --title и --description");
  const acceptance = flags(argv, "--acceptance");
  if (acceptance.length === 0) throw new Error("Нужен хотя бы один --acceptance");
  const context = flag(argv, "--context");
  const deliverable = flag(argv, "--deliverable");
  if (!context || !deliverable) throw new Error("Нужны --context и --deliverable");
  const priority = (flag(argv, "--priority") ?? "P2") as TaskPriority;
  const status = (flag(argv, "--status") ?? "Backlog") as TaskStatus;
  const area = flag(argv, "--area") ?? "General";
  const stage = flag(argv, "--stage") ?? "I";
  const file = await readTasks();
  const version = flag(argv, "--version") ?? file.versions[0]?.id;
  if (!version) throw new Error("Нужен --version (например v0.2.0)");
  if (!file.versions.some((item) => item.id === version)) {
    throw new Error(`Неизвестная версия «${version}». Доступны: ${file.versions.map((item) => item.id).join(", ")}`);
  }
  const task: TaskRecord = {
    id: nextTaskId(file.tasks),
    version,
    title: title.trim(),
    description: description.trim(),
    context: context.trim(),
    deliverable: deliverable.trim(),
    outOfScope: flags(argv, "--out-of-scope"),
    dependsOn: flags(argv, "--depends-on"),
    acceptance,
    priority,
    area,
    stage,
    status,
    labels: flags(argv, "--label"),
    deferred: has(argv, "--deferred"),
  };
  file.tasks.push(task);
  validateTaskFile(file);
  await writeTasks(file);
  console.log(`${task.id}: добавлена в ${TASKS_FILE}`);
  console.log(renderTaskTable([task]));
  console.log("Дальше: npm run tasks:sync");
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const command = argv[0] ?? "list";
  if (command === "list") {
    const file = await readTasks();
    const versionFilter = flag(argv, "--version");
    const tasks = versionFilter ? file.tasks.filter((task) => task.version === versionFilter) : file.tasks;
    if (has(argv, "--json")) console.log(JSON.stringify(file, null, 2));
    else console.log(renderTaskTable(tasks));
    return;
  }
  if (command === "doctor") {
    await doctor();
    return;
  }
  if (command === "add") {
    await add(argv);
    return;
  }
  if (command === "sync") {
    await sync(has(argv, "--dry-run"), has(argv, "--update"), flag(argv, "--version"));
    return;
  }
  throw new Error(`Неизвестная команда «${command}». Доступно: list, add, sync, doctor.`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
