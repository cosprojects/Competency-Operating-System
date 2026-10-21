import path from "node:path";
import { writeFile } from "node:fs/promises";
import type { CompetencyBlock } from "../types.ts";
import type { CanonicalMap } from "../canonical/types.ts";
import { professionIdOf, professionSlugOf } from "../priority/source.ts";
import { dataDir, flagValue, readJson } from "./common.ts";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const domain = flagValue(argv, "--domain") ?? "it";
  const profession = flagValue(argv, "--profession") ?? "uxui";
  const professionId = professionIdOf(domain, profession);
  const slug = professionSlugOf(professionId);
  const mapPath =
    flagValue(argv, "--map-file") ??
    path.join(root, "src/methodology/v1/competency/canonical", `${slug}.json`);
  const blocksPath =
    flagValue(argv, "--blocks-file") ??
    path.join(dataDir(root), `blocks-${domain}-${slug}.json`);
  const map = await readJson<CanonicalMap>(mapPath);
  const blocks = (await readJson<{ blocks: CompetencyBlock[] }>(blocksPath)).blocks;
  const byCanonical = new Map<string, CompetencyBlock[]>();
  for (const block of blocks) {
    for (const canonicalId of block.canonicalIds ?? []) {
      const list = byCanonical.get(canonicalId) ?? [];
      list.push(block);
      byCanonical.set(canonicalId, list);
    }
  }
  const changes: string[] = [];
  for (const branch of map.branches) {
    for (const section of branch.sections) {
      for (const competency of section.competencies) {
        const matches = byCanonical.get(competency.id) ?? [];
        if (matches.length === 0) continue;
        for (const block of matches) {
          if (!competency.coveredBy.includes(block.id)) competency.coveredBy.push(block.id);
        }
        const nextStatus =
          competency.status === "covered" || matches.some((block) => block.status === "accepted")
            ? "covered"
            : "partial";
        if (competency.status !== nextStatus) {
          changes.push(`${competency.id}: ${competency.status} → ${nextStatus}`);
          competency.status = nextStatus;
        }
        competency.note = matches.some((block) => block.status === "accepted")
          ? "Покрыто accepted-блоком"
          : "Покрыто review-блоком; нужна приёмка";
      }
    }
  }
  map.updatedOn = new Date().toISOString().slice(0, 10);
  if (argv.includes("--write")) {
    await writeFile(mapPath, `${JSON.stringify(map, null, 2)}\n`, "utf8");
    console.log(`canonical: обновлено ${changes.length} записей; ${mapPath}`);
  } else {
    console.log(`canonical: предлагается ${changes.length} изменений (запустите с --write)`);
  }
  for (const change of changes) console.log(`  ${change}`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
