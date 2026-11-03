import path from "node:path";
import { readdir, readFile, writeFile } from "node:fs/promises";
import type { LearningSourceRegistry } from "../types.ts";
import { flagValue } from "../../competency/cli/common.ts";

/**
 * Починка связей авто-источников с профессиями:
 *  - blocked-источники отвязываются от компетенций (не могут быть свидетельством);
 *  - professionIds авто-источника расширяется до всех профессий, где компетенция встречается.
 *
 *   npm run sources:repair -- --write
 */

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

interface ProfessionCompetencyFile {
  professionId: string;
  competencies: Array<{ competencyId: string }>;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const write = argv.includes("--write");
  const registryPath = path.join(root, "src/methodology/v1/learning-sources/registry.json");
  const linksPath = path.join(root, "src/methodology/v1/competency/model/learning-source-links.json");
  const reviewPath = path.join(root, "release", `${flagValue(argv, "--release") ?? "beta-1"}-source-review.json`);
  const registry = await readJson<LearningSourceRegistry>(registryPath);
  const links = await readJson<{ linksVersion?: string; updatedAt?: string; links: Array<{ competencyId: string; sourceIds: string[]; rationale?: string }> }>(linksPath);
  const review = await readJson<{ decisions: Array<{ sourceId: string }>; updatedAt?: string }>(reviewPath).catch(() => undefined);

  const modelDir = path.join(root, "src/methodology/v1/competency/model/profession-competencies");
  const files = await readdir(modelDir);
  const compProfessions = new Map<string, Set<string>>();
  for (const file of files.filter((name) => name.endsWith(".json"))) {
    const record = await readJson<ProfessionCompetencyFile>(path.join(modelDir, file));
    for (const competency of record.competencies) {
      const set = compProfessions.get(competency.competencyId) ?? new Set<string>();
      set.add(record.professionId);
      compProfessions.set(competency.competencyId, set);
    }
  }

  const sourceById = new Map(registry.sources.map((source) => [source.id, source]));
  const blockedIds = new Set(
    registry.sources.filter((source) => source.status === "blocked").map((source) => source.id),
  );
  const linkedCompetencies = new Map<string, Set<string>>();
  for (const link of links.links) {
    for (const sourceId of link.sourceIds) {
      const set = linkedCompetencies.get(sourceId) ?? new Set<string>();
      set.add(link.competencyId);
      linkedCompetencies.set(sourceId, set);
    }
  }

  // 1. blocked-источники не должны быть связаны.
  const beforeLinks = links.links.reduce((n, link) => n + link.sourceIds.length, 0);
  links.links = links.links
    .map((link) => ({ ...link, sourceIds: link.sourceIds.filter((id) => !blockedIds.has(id)) }))
    .filter((link) => link.sourceIds.length > 0);
  const afterLinks = links.links.reduce((n, link) => n + link.sourceIds.length, 0);
  let reviewRemoved = 0;
  if (review) {
    const before = review.decisions.length;
    review.decisions = review.decisions.filter((decision) => !blockedIds.has(decision.sourceId));
    reviewRemoved = before - review.decisions.length;
  }

  // 2. professionIds авто-источников = все профессии их компетенций.
  let professionUpdates = 0;
  for (const [sourceId, competencies] of linkedCompetencies) {
    const source = sourceById.get(sourceId);
    if (!source || blockedIds.has(sourceId)) continue;
    const professions = new Set(source.professionIds);
    for (const competencyId of competencies) {
      for (const professionId of compProfessions.get(competencyId) ?? []) professions.add(professionId);
    }
    if (professions.size !== source.professionIds.length) {
      source.professionIds = [...professions];
      professionUpdates += 1;
    }
  }

  console.log(
    `sources:repair: blocked sources ${blockedIds.size}; links ${beforeLinks} → ${afterLinks}; review decisions removed ${reviewRemoved}; professionIds updated ${professionUpdates}`,
  );
  if (!write) {
    console.log("dry-run: добавь --write.");
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  registry.updatedAt = today;
  links.updatedAt = today;
  await writeJson(registryPath, registry);
  await writeJson(linksPath, links);
  if (review) {
    review.updatedAt = today;
    await writeJson(reviewPath, review);
  }
  console.log(registryPath);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
