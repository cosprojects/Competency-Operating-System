import path from "node:path";
import { writeFile } from "node:fs/promises";
import type { CanonicalMap } from "../canonical/types.ts";
import type { PriorityFile, StudyPriorityMark } from "../priority/types.ts";
import { loadCatalog } from "../catalog.ts";
import { professionIdOf, professionSlugOf } from "../priority/source.ts";
import { flagValue, readJson } from "./common.ts";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const domain = flagValue(argv, "--domain") ?? "it";
  const profession = flagValue(argv, "--profession") ?? "uxui";
  const professionId = professionIdOf(domain, profession);
  const slug = professionSlugOf(professionId);
  const mapPath = flagValue(argv, "--map-file") ?? path.join(root, "src/methodology/v1/competency/canonical", `${slug}.json`);
  const outputPath = flagValue(argv, "--priority-file") ?? path.join(root, "src/methodology/v1/competency/priority", `${slug}.json`);
  const map = await readJson<CanonicalMap>(mapPath);
  const catalog = await loadCatalog(root, domain);
  const byCanonical = new Map<string, string>();
  for (const block of catalog.blocks) {
    for (const canonicalId of block.canonicalIds ?? []) byCanonical.set(canonicalId, block.id);
  }
  for (const branch of map.branches) {
    for (const section of branch.sections) {
      for (const competency of section.competencies) {
        if (byCanonical.has(competency.id)) continue;
        const block = catalog.blocks.find((item) => competency.coveredBy.includes(item.id));
        if (block) byCanonical.set(competency.id, block.id);
      }
    }
  }
  const flattened = map.branches.flatMap((branch) =>
    branch.sections.flatMap((section) => section.competencies.map((competency) => ({ branch, section, competency }))),
  );
  const marks: StudyPriorityMark[] = [];
  const seenBlocks = new Set<string>();
  let order = 0;

  for (const item of flattened) {
    const candidates = catalog.blocks.filter((block) =>
      (block.canonicalIds ?? []).includes(item.competency.id) || item.competency.coveredBy.includes(block.id),
    );
    for (const block of candidates) {
      if (seenBlocks.has(block.id)) continue;
      seenBlocks.add(block.id);
      order += 1;
      marks.push({
        competencyId: block.id,
        tier: item.competency.priorityHint,
        order,
        prerequisites: [],
        rationale: item.competency.definition,
        confidence: "low",
        reviewer: "canonical-draft",
        reviewedAt: new Date().toISOString().slice(0, 10),
        signals: { scope: "profession" },
      });
    }
  }
  const file: PriorityFile = {
    priorityVersion: "1.0.0",
    domain,
    professionId,
    updatedOn: new Date().toISOString().slice(0, 10),
    status: "draft",
    marks,
  };
  console.log(`priority:canonical ${professionId}: marks ${marks.length}; блоков в каталоге ${catalog.blocks.length}`);
  if (marks.length !== catalog.blocks.length) {
    console.warn(`  внимание: marks ${marks.length} ≠ блоков ${catalog.blocks.length}`);
  }
  if (!argv.includes("--write")) {
    console.log("dry-run: запустите с --write, чтобы записать priority-файл");
    return;
  }
  await writeFile(outputPath, `${JSON.stringify(file, null, 2)}\n`, "utf8");
  console.log(outputPath);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
