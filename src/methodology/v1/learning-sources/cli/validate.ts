import path from "node:path";
import { readFile } from "node:fs/promises";
import type { LearningSourceRegistry } from "../types.ts";
import type { CompetenciesFile } from "../../competency/model/types.ts";
import { validateLearningSources } from "../validate.ts";

async function main(): Promise<void> {
  const root = process.cwd();
  const file = path.join(root, "src/methodology/v1/learning-sources/registry.json");
  const registry = JSON.parse(await readFile(file, "utf8")) as LearningSourceRegistry;
  const errors = validateLearningSources(registry);
  const sourceIds = new Set(registry.sources.map((source) => source.id));
  try {
    const competencies = JSON.parse(
      await readFile(path.join(root, "src/methodology/v1/competency/model/competencies.json"), "utf8"),
    ) as CompetenciesFile;
    for (const competency of competencies.competencies) {
      for (const sourceId of competency.learningSourceIds ?? []) {
        if (!sourceIds.has(sourceId)) errors.push(`${competency.id}: learning source not found: ${sourceId}`);
      }
    }
  } catch {
    // модель может быть ещё не собрана
  }
  console.log(`learning sources: ${registry.sources.length}; active ${registry.sources.filter((s) => s.status === "active").length}; errors ${errors.length}`);
  for (const error of errors) console.log(`  - ${error}`);
  if (errors.length > 0) process.exit(1);
}
try { await main(); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exit(1); }
