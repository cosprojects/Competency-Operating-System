import path from "node:path";
import { writeFile } from "node:fs/promises";
import type { CatalogFile, CompetencyBlock, TagRecord } from "../types.ts";
import type { CanonicalMap } from "../canonical/types.ts";
import { emptyCatalog, loadCatalog, validateCatalog } from "../catalog.ts";
import { professionIdOf, professionSlugOf } from "../priority/source.ts";
import { dataDir, flagValue, readJson } from "./common.ts";

function mergeTags(blocks: CompetencyBlock[]): TagRecord[] {
  const byId = new Map<string, TagRecord>();
  for (const block of blocks) {
    for (const tag of block.tags) {
      const existing = byId.get(tag.id);
      if (!existing) {
        byId.set(tag.id, structuredClone(tag));
        continue;
      }
      for (const professionId of tag.professionIds) {
        if (!existing.professionIds.includes(professionId)) existing.professionIds.push(professionId);
      }
      for (const ref of tag.sourceRefs) {
        if (!existing.sourceRefs.some((item) => item.sourceId === ref.sourceId && item.externalId === ref.externalId)) {
          existing.sourceRefs.push(ref);
        }
      }
      for (const link of tag.competencyLinks) {
        if (!existing.competencyLinks.some((item) => item.competencyId === link.competencyId && item.componentId === link.componentId)) {
          existing.competencyLinks.push(link);
        }
      }
    }
  }
  return [...byId.values()].sort((a, b) => a.title.localeCompare(b.title));
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const domain = flagValue(argv, "--domain") ?? "it";
  const profession = flagValue(argv, "--profession") ?? "uxui";
  const professionId = professionIdOf(domain, profession);
  const slug = professionSlugOf(professionId);
  const catalogPath = path.join(root, "src/methodology/v1/competency/catalog", `${domain}.json`);
  const mapPath = flagValue(argv, "--map-file") ?? path.join(root, "src/methodology/v1/competency/canonical", `${slug}.json`);
  const blockFiles = (flagValue(argv, "--blocks-file") ?? `data/competency/blocks-${domain}.json,data/competency/blocks-${domain}-${slug}.json`)
    .split(",")
    .map((file) => file.trim())
    .filter(Boolean);
  const map = await readJson<CanonicalMap>(mapPath);
  const mapped = new Set<string>();
  const canonicalIds = new Set<string>();
  for (const branch of map.branches) {
    for (const section of branch.sections) {
      for (const competency of section.competencies) {
        canonicalIds.add(competency.id);
        for (const blockId of competency.coveredBy) mapped.add(blockId);
      }
    }
  }
  const byId = new Map<string, CompetencyBlock>();
  for (const file of blockFiles) {
    const payload = await readJson<{ blocks: CompetencyBlock[] }>(path.resolve(root, file));
    for (const block of payload.blocks ?? []) {
      if (!block.professionIds.includes(professionId)) continue;
      const hasCanonical = (block.canonicalIds ?? []).some((id) => canonicalIds.has(id));
      if (!mapped.has(block.id) && !hasCanonical) continue;
      byId.set(block.id, {
        ...block,
        status: "accepted",
        issues: block.issues.filter((issue) => !issue.includes("уже есть")),
      });
    }
  }
  const blocks = [...byId.values()].sort((a, b) => a.title.localeCompare(b.title));
  const current = await loadCatalog(root, domain);
  const catalog: CatalogFile = {
    ...emptyCatalog(domain, new Date().toISOString().slice(0, 10)),
    blocks,
    tags: mergeTags(blocks),
    materials: current.materials,
  };
  const errors = validateCatalog(catalog);
  console.log(`catalog:accept ${professionId}: блоков ${blocks.length}; тегов ${catalog.tags.length}; ошибок ${errors.length}`);
  for (const error of errors) console.error(`  ${error}`);
  if (errors.length > 0) process.exit(1);
  if (!argv.includes("--write")) {
    console.log("dry-run: запустите с --write, чтобы записать каталог");
    return;
  }
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  console.log(catalogPath);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
