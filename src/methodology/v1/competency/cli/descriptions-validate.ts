import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import { validateDescription } from "../descriptions/validate.ts";

/** Проверка качества всех описаний без LLM и сети. */
async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function main(): Promise<void> {
  const root = process.cwd();
  const scopeArg = process.argv.indexOf("--profession");
  const scope = (scopeArg !== -1 ? process.argv[scopeArg + 1] : "all") ?? "all";
  const base = path.join(root, "src/methodology/v1/competency");
  const model = await readJson<{ competencies: Array<{ id: string; title: string; definition: string }> }>(
    path.join(base, "model/competencies.json"),
  );
  const catalog = await readJson<{
    blocks: Array<{ canonicalIds?: string[]; tags?: Array<{ id: string; title: string; kind: "knowledge" | "skill"; definition: string }> }>;
  }>(path.join(base, "catalog/it.json"));
  const descriptionsPayload = await readJson<{ descriptions?: Record<string, string> }>(
    path.join(base, "model/professions/descriptions.json"),
  ).catch(() => ({ descriptions: {} as Record<string, string> }));
  const descriptionByProfession = descriptionsPayload.descriptions ?? {};
  const viewsDir = path.join(base, "model/professions/views");
  const files = (await readdir(viewsDir)).filter((file) => file.endsWith(".json"));
  const views = await Promise.all(
    files.map(async (file) => ({
      file,
      view: await readJson<{ professionId: string; title: string; description?: string; sections: Array<{ competencies: Array<{ competencyId: string }> }> }>(path.join(viewsDir, file)),
    })),
  );
  const wanted = scope === "all" ? null : new Set(scope.split(",").map((item) => item.trim()));
  const selected = views.filter(({ view }) => !wanted || wanted.has(view.professionId.split(".").pop() ?? ""));
  const errors: string[] = [];
  let professions = 0;
  const seenProfessionDescriptions = new Map<string, string>();
  const addProfession = (id: string, title: string, description: string) => {
    professions += 1;
    const issues = validateDescription(description, { kind: "profession", title });
    if (issues.length > 0) errors.push(`${id}: ${issues.map((item) => item.message).join("; ")}`);
    const key = description.toLowerCase();
    const previous = seenProfessionDescriptions.get(key);
    if (previous) errors.push(`${id}: описание совпадает с ${previous}`);
    else seenProfessionDescriptions.set(key, id);
  };
  for (const { view } of selected) {
    addProfession(
      view.professionId,
      view.title,
      (descriptionByProfession[view.professionId] ?? view.description ?? "").trim(),
    );
  }
  if ((wanted && wanted.has("uxui")) || (!wanted && !selected.some(({ view }) => view.professionId === "it.uxui"))) {
    addProfession("it.uxui", "UX/UI-дизайнер", (descriptionByProfession["it.uxui"] ?? "").trim());
  }

  const compIds = new Set<string>();
  if (wanted) {
    for (const { view } of selected) {
      for (const section of view.sections) for (const item of section.competencies) compIds.add(item.competencyId);
    }
  } else {
    for (const competency of model.competencies) compIds.add(competency.id);
  }
  const tagIds = new Set<string>();
  for (const block of catalog.blocks) {
    if (block.canonicalIds?.some((id) => compIds.has(id))) {
      for (const tag of block.tags ?? []) tagIds.add(tag.id);
    }
  }
  if (!wanted) for (const block of catalog.blocks) for (const tag of block.tags ?? []) tagIds.add(tag.id);

  let competencies = 0;
  for (const id of compIds) {
    const competency = model.competencies.find((item) => item.id === id);
    if (!competency) continue;
    competencies += 1;
    const issues = validateDescription(competency.definition, { kind: "competency", title: competency.title });
    if (issues.length > 0) errors.push(`${competency.id}: ${issues.map((item) => item.message).join("; ")}`);
  }
  const tagById = new Map<string, { id: string; title: string; kind: "knowledge" | "skill"; definition: string }>();
  for (const block of catalog.blocks) for (const tag of block.tags ?? []) tagById.set(tag.id, tag);
  let tags = 0;
  for (const id of tagIds) {
    const tag = tagById.get(id);
    if (!tag) continue;
    tags += 1;
    const issues = validateDescription(tag.definition, { kind: tag.kind, title: tag.title });
    if (issues.length > 0) errors.push(`${tag.id} (${tag.title}): ${issues.map((item) => item.message).join("; ")}`);
  }

  console.log(
    `descriptions:validate: профессий ${professions}, компетенций ${competencies}, тегов ${tags}; ошибок ${errors.length}`,
  );
  for (const error of errors.slice(0, 60)) console.log(`  - ${error}`);
  if (errors.length > 0) process.exitCode = 1;
}
try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
