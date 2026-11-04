import { readFile } from "node:fs/promises";
import path from "node:path";
import { validateTaskFile, type TaskFile, type TaskRecord } from "./lib.ts";

const ENV_FILE = "tasks/.env.local";
const FIELD_COLORS = ["GRAY", "BLUE", "GREEN", "YELLOW", "ORANGE", "RED", "PINK", "PURPLE"] as const;

interface ProjectField {
  id: string;
  name: string;
  dataType: string;
  options?: Array<{ id: string; name: string }>;
}

interface ProjectItem {
  id: string;
  content?: { number?: number; state?: string } | null;
}

interface ProjectData {
  id: string;
  title: string;
  fields: ProjectField[];
  items: ProjectItem[];
}

async function loadEnv(): Promise<void> {
  try {
    const raw = await readFile(path.join(process.cwd(), ENV_FILE), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const withoutExport = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
      const index = withoutExport.indexOf("=");
      if (index === -1) continue;
      const key = withoutExport.slice(0, index).trim();
      const value = withoutExport.slice(index + 1).trim().replace(/^["']|["']$/g, "");
      if (key && !process.env[key]) process.env[key] = value;
    }
  } catch {
    // файла может не быть
  }
}

async function readTasks(): Promise<TaskFile> {
  return validateTaskFile(JSON.parse(await readFile(path.join(process.cwd(), "tasks/tasks.json"), "utf8")) as unknown);
}

function projectToken(): string {
  const token = process.env.PROJECT_TOKEN ?? process.env.GH_TOKEN;
  if (!token) throw new Error("Нужен PROJECT_TOKEN — classic PAT со scope project.");
  return token;
}

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      authorization: `Bearer ${projectToken()}`,
      "content-type": "application/json",
      accept: "application/vnd.github+json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const payload = (await response.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (!response.ok || payload.errors?.length) {
    throw new Error(`GraphQL: ${payload.errors?.map((error) => error.message).join("; ") ?? response.status}`);
  }
  return payload.data as T;
}

async function githubRest<T>(pathname: string): Promise<T> {
  const response = await fetch(`https://api.github.com${pathname}`, {
    headers: {
      authorization: `Bearer ${projectToken()}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
    },
  });
  if (!response.ok) throw new Error(`REST ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return (await response.json()) as T;
}

async function findProject(owner: string, number: number | null, title: string): Promise<{ id: string; title: string }> {
  if (number) {
    const result = await gql<{ user: { projectV2: { id: string; title: string } | null } }>(
      `query($login:String!,$number:Int!){ user(login:$login){ projectV2(number:$number){ id title } } }`,
      { login: owner, number },
    );
    if (!result.user.projectV2) throw new Error(`Project ${owner}/${number} не найден или нет доступа`);
    return result.user.projectV2;
  }
  const result = await gql<{ user: { projectsV2: { nodes: Array<{ id: string; title: string; number: number }> } } }>(
    `query($login:String!){ user(login:$login){ projectsV2(first:50){ nodes { id title number } } } }`,
    { login: owner },
  );
  const found = result.user.projectsV2.nodes.find((project) => project.title === title);
  if (!found) throw new Error(`Project «${title}» не найден`);
  return found;
}

async function loadProject(projectId: string): Promise<ProjectData> {
  const result = await gql<{
    node: {
      id: string;
      title: string;
      fields: { nodes: ProjectField[] };
      items: { nodes: ProjectItem[] };
    };
  }>(
    `query($id:ID!){
      node(id:$id){
        ... on ProjectV2 {
          id title
          fields(first:50){ nodes {
            ... on ProjectV2FieldCommon { id name dataType }
            ... on ProjectV2SingleSelectField { id name options { id name } }
          } }
          items(first:100){ nodes { id content { ... on Issue { number state } } } }
        }
      }
    }`,
    { id: projectId },
  );
  return {
    id: result.node.id,
    title: result.node.title,
    fields: result.node.fields.nodes,
    items: result.node.items.nodes,
  };
}

function fieldByName(project: ProjectData, name: string): ProjectField | undefined {
  return project.fields.find((field) => field.name === name);
}

async function createSingleSelectField(projectId: string, name: string, values: string[]): Promise<ProjectField> {
  const options = [...new Set(values)].map((value, index) => ({
    name: value,
    color: FIELD_COLORS[index % FIELD_COLORS.length],
    description: "",
  }));
  const result = await gql<{ createProjectV2Field: { projectV2Field: ProjectField } }>(
    `mutation($input:CreateProjectV2FieldInput!){ createProjectV2Field(input:$input){ projectV2Field { ... on ProjectV2SingleSelectField { id name options { id name } } } } }`,
    {
      input: {
        projectId,
        dataType: "SINGLE_SELECT",
        name,
        singleSelectOptions: options,
      },
    },
  );
  return result.createProjectV2Field.projectV2Field;
}

async function addItem(projectId: string, issueNodeId: string): Promise<string> {
  const result = await gql<{ addProjectV2ItemById: { item: { id: string } } }>(
    `mutation($input:AddProjectV2ItemByIdInput!){ addProjectV2ItemById(input:$input){ item { id } } }`,
    { input: { projectId, contentId: issueNodeId } },
  );
  return result.addProjectV2ItemById.item.id;
}

async function deleteItem(projectId: string, itemId: string): Promise<void> {
  await gql(
    `mutation($input:DeleteProjectV2ItemInput!){ deleteProjectV2Item(input:$input){ deletedItemId } }`,
    { input: { projectId, itemId } },
  );
}

async function setField(projectId: string, itemId: string, fieldId: string, optionId: string): Promise<void> {
  await gql(
    `mutation($input:UpdateProjectV2ItemFieldValueInput!){ updateProjectV2ItemFieldValue(input:$input){ projectV2Item { id } } }`,
    { input: { projectId, itemId, fieldId, value: { singleSelectOptionId: optionId } } },
  );
}

function statusName(task: TaskRecord): string {
  if (task.status === "In Progress") return "In progress";
  if (task.status === "Review") return "In review";
  return task.status;
}

function optionId(field: ProjectField | undefined, name: string): string | undefined {
  return field?.options?.find((option) => option.name === name)?.id;
}

async function main(): Promise<void> {
  await loadEnv();
  const dryRun = process.argv.includes("--dry-run");
  const prune = process.argv.includes("--prune");
  const file = await readTasks();
  const owner = process.env.GITHUB_PROJECT_OWNER ?? file.project.owner;
  const title = process.env.GITHUB_PROJECT_TITLE ?? file.project.title;
  const number = process.env.GITHUB_PROJECT_NUMBER ? Number(process.env.GITHUB_PROJECT_NUMBER) : null;
  const projectInfo = await findProject(owner, number, title);
  let project = await loadProject(projectInfo.id);

  const active = file.tasks.filter((task) => !task.deferred);
  const deferred = file.tasks.filter((task) => task.deferred && task.issueNumber);
  const missingFields = ["Area", "Stage", "Release"].filter((name) => !fieldByName(project, name));
  console.log(`project: ${project.title}; items: ${project.items.length}; active tasks: ${active.length}; deferred: ${deferred.length}`);
  console.log(`fields: ${project.fields.map((field) => field.name).join(", ")}`);
  if (missingFields.length > 0) console.log(`missing fields: ${missingFields.join(", ")}`);

  if (!dryRun) {
    for (const name of ["Area", "Stage", "Release"]) {
      if (fieldByName(project, name)) continue;
      const values =
        name === "Area"
          ? active.map((task) => task.area)
          : name === "Stage"
            ? active.map((task) => task.stage)
            : active.map((task) => task.version);
      const created = await createSingleSelectField(project.id, name, values);
      console.log(`created field ${created.name}: ${created.options?.map((option) => option.name).join(", ")}`);
    }
    project = await loadProject(project.id);
  }

  const statusField = fieldByName(project, "Status");
  const priorityField = fieldByName(project, "Priority");
  const areaField = fieldByName(project, "Area");
  const stageField = fieldByName(project, "Stage");
  const releaseField = fieldByName(project, "Release");
  const itemByIssue = new Map<number, ProjectItem>();
  for (const item of project.items) {
    if (item.content?.number) itemByIssue.set(item.content.number, item);
  }

  for (const task of active) {
    if (!task.issueNumber) {
      console.log(`${task.id}: issue не создан, пропуск`);
      continue;
    }
    let item = itemByIssue.get(task.issueNumber);
    if (!item) {
      const issue = await githubRest<{ node_id: string }>(
        `/repos/${file.project.repository}/issues/${task.issueNumber}`,
      );
      if (dryRun) {
        console.log(`${task.id}: будет добавлен в Project`);
        continue;
      }
      const itemId = await addItem(project.id, issue.node_id);
      item = { id: itemId };
      itemByIssue.set(task.issueNumber, item);
      console.log(`${task.id}: добавлен в Project`);
    }
    const fields: Array<[ProjectField | undefined, string]> = [
      [statusField, statusName(task)],
      [priorityField, task.priority],
      [areaField, task.area],
      [stageField, task.stage],
      [releaseField, task.version],
    ];
    for (const [field, value] of fields) {
      if (!field) continue;
      const id = optionId(field, value);
      if (!id) {
        console.log(`${task.id}: нет опции ${field.name}=${value}`);
        continue;
      }
      if (dryRun) {
        console.log(`${task.id}: ${field.name} -> ${value}`);
      } else {
        await setField(project.id, item.id, field.id, id);
      }
    }
  }

  if (prune) {
    for (const task of deferred) {
      const item = itemByIssue.get(task.issueNumber!);
      if (!item) continue;
      if (dryRun) {
        console.log(`${task.id}: будет удалён из Project`);
      } else {
        await deleteItem(project.id, item.id);
        console.log(`${task.id}: удалён из Project`);
      }
    }
  }
  console.log(dryRun ? "dry-run: изменений нет" : "project sync: готово");
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
