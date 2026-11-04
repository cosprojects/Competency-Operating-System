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
} from "./lib.ts";

const TASKS_FILE = "tasks/tasks.json";

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

function token(): string {
  const value = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (!value) {
    throw new Error(
      "Нужен GH_TOKEN или GITHUB_TOKEN с доступом к Issues (read/write). " +
        "Fine-grained token: Issues read/write + доступ к репозиторию. " +
        "Для Projects v2, если включаете sync полей: Projects read/write. " +
        "Токен не коммитить; положить в env или macOS Keychain.",
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

async function createIssue(repository: string, task: TaskRecord): Promise<IssueResponse> {
  const [owner, repo] = repository.split("/");
  if (!owner || !repo) throw new Error(`Плохой repository «${repository}»`);
  for (const label of labelNames(task)) await ensureLabel(repository, label);
  return github<IssueResponse>(`/repos/${owner}/${repo}/issues`, {
    method: "POST",
    body: JSON.stringify({
      title: `${task.id}: ${task.title}`,
      body: renderIssueBody(task),
      labels: labelNames(task),
    }),
  });
}

async function updateIssue(repository: string, task: TaskRecord): Promise<void> {
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
    }),
  });
}

async function sync(dryRun: boolean, updateExisting: boolean): Promise<void> {
  const file = await readTasks();
  const repository = process.env.GITHUB_REPOSITORY ?? file.project.repository;
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const task of file.tasks) {
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
        console.log(`${task.id}: будет создан issue (${task.priority}, ${task.area}, ${task.stage})`);
        created += 1;
        continue;
      }
      const issue = await createIssue(repository, task);
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
        await updateIssue(repository, task);
        console.log(`${task.id}: обновлён issue #${task.issueNumber}`);
      }
      updated += 1;
    } else {
      skipped += 1;
    }
  }

  if (!dryRun) await writeTasks(file);
  console.log(
    `tasks:sync: created ${created}; updated ${updated}; skipped ${skipped}; total ${file.tasks.length}` +
      (dryRun ? " (dry-run)" : ""),
  );
}

async function add(argv: string[]): Promise<void> {
  const title = flag(argv, "--title");
  const description = flag(argv, "--description");
  if (!title || !description) throw new Error("Нужны --title и --description");
  const acceptance = flags(argv, "--acceptance");
  if (acceptance.length === 0) throw new Error("Нужен хотя бы один --acceptance");
  const priority = (flag(argv, "--priority") ?? "P2") as TaskPriority;
  const status = (flag(argv, "--status") ?? "Backlog") as TaskStatus;
  const area = flag(argv, "--area") ?? "General";
  const stage = flag(argv, "--stage") ?? "I";
  const file = await readTasks();
  const task: TaskRecord = {
    id: nextTaskId(file.tasks),
    title: title.trim(),
    description: description.trim(),
    acceptance,
    priority,
    area,
    stage,
    status,
    labels: flags(argv, "--label"),
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
    if (has(argv, "--json")) console.log(JSON.stringify(file, null, 2));
    else console.log(renderTaskTable(file.tasks));
    return;
  }
  if (command === "add") {
    await add(argv);
    return;
  }
  if (command === "sync") {
    await sync(has(argv, "--dry-run"), has(argv, "--update"));
    return;
  }
  throw new Error(`Неизвестная команда «${command}». Доступно: list, add, sync.`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
