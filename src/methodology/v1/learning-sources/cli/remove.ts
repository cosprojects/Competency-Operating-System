import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import type { LearningSourceRegistry } from "../types.ts";
import { flagValue } from "../../competency/cli/common.ts";

/**
 * Удаление источников из реестра вместе со связями и решениями source review.
 *
 *   npm run sources:remove -- --domains scan-interfax.ru,sendsay.ru --write
 *   npm run sources:remove -- --ids source-id-1,source-id-2 --write
 *
 * По умолчанию dry-run. Удаляет только явно указанные источники; связи с другими
 * источниками и решения по ним не трогает.
 */

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

interface LinksFile {
  linksVersion?: string;
  updatedAt?: string;
  description?: string;
  links: Array<{ competencyId: string; sourceIds: string[]; rationale?: string }>;
}

interface ReviewFile {
  reviewVersion: string;
  releaseId: string;
  updatedAt: string;
  reviewedBy: string | null;
  decisions: Array<{ professionId?: string; competencyId: string; sourceId: string; decision: string; reason?: string; reviewedBy?: string; reviewedAt?: string }>;
  notes?: string[];
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const write = argv.includes("--write");
  const domains = (flagValue(argv, "--domains") ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  const idsArg = (flagValue(argv, "--ids") ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  if (domains.length === 0 && idsArg.length === 0) {
    throw new Error("Укажи --domains или --ids");
  }
  const registryPath = path.join(root, "src/methodology/v1/learning-sources/registry.json");
  const linksPath = path.join(root, "src/methodology/v1/competency/model/learning-source-links.json");
  const reviewPath = path.join(root, "release/beta-1-source-review.json");
  const registry = await readJson<LearningSourceRegistry>(registryPath);
  const links = await readJson<LinksFile>(linksPath);
  const review = await readJson<ReviewFile>(reviewPath);

  const removeIds = new Set<string>(idsArg);
  for (const source of registry.sources) {
    if (domains.includes(domainOf(source.url))) removeIds.add(source.id);
  }
  const removable = registry.sources.filter((source) => removeIds.has(source.id));
  if (removable.length === 0) {
    throw new Error("Ничего не найдено по указанным доменам/id");
  }
  for (const source of removable) {
    console.log(`remove ${source.id} · ${source.status} · ${source.url}`);
  }
  const remaining = registry.sources.filter((source) => !removeIds.has(source.id));
  const linksBefore = links.links.reduce((n, link) => n + link.sourceIds.length, 0);
  const newLinks = links.links
    .map((link) => ({ ...link, sourceIds: link.sourceIds.filter((id) => !removeIds.has(id)) }))
    .filter((link) => link.sourceIds.length > 0);
  const linksAfter = newLinks.reduce((n, link) => n + link.sourceIds.length, 0);
  const decisionsBefore = review.decisions.length;
  const newDecisions = review.decisions.filter((decision) => !removeIds.has(decision.sourceId));
  console.log(
    `sources:remove: sources ${registry.sources.length} → ${remaining.length}; pairs ${linksBefore} → ${linksAfter}; review ${decisionsBefore} → ${newDecisions.length}`,
  );
  if (!write) {
    console.log("dry-run: файлы не изменены. Для записи добавь --write.");
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  registry.sources = remaining;
  registry.updatedAt = today;
  links.links = newLinks;
  links.updatedAt = today;
  review.decisions = newDecisions;
  review.updatedAt = today;
  await writeJson(registryPath, registry);
  await writeJson(linksPath, links);
  await writeJson(reviewPath, review);
  console.log(registryPath);
  console.log(linksPath);
  console.log(reviewPath);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
