import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { CompetenciesFile, ProfessionCompetencyFile, ProfessionsFile } from "../../competency/model/types.ts";
import type { LearningSourceRegistry } from "../types.ts";
import { buildLearningSourceMap, renderLearningSourceMapReport } from "../map.ts";

async function main(): Promise<void> {
  const root = process.cwd();
  const base = path.join(root, "src/methodology/v1");
  const registry = JSON.parse(
    await readFile(path.join(base, "learning-sources/registry.json"), "utf8"),
  ) as LearningSourceRegistry;
  const competencies = JSON.parse(
    await readFile(path.join(base, "competency/model/competencies.json"), "utf8"),
  ) as CompetenciesFile;
  const professions = JSON.parse(
    await readFile(path.join(base, "competency/model/professions.json"), "utf8"),
  ) as ProfessionsFile;
  const professionCompetencies: ProfessionCompetencyFile[] = [];
  for (const profession of professions.professions) {
    const slug = profession.id.slice(profession.id.indexOf(".") + 1);
    try {
      professionCompetencies.push(
        JSON.parse(
          await readFile(path.join(base, `competency/model/profession-competencies/${slug}.json`), "utf8"),
        ) as ProfessionCompetencyFile,
      );
    } catch {
      // профессия без материализованного слоя пропускается
    }
  }

  const result = buildLearningSourceMap({ registry, competencies, professionCompetencies });
  console.log(
    `learning map: источников ${registry.sources.length}; связанных компетенций ${result.byCompetency.size}; ошибок ${result.errors.length}; предупреждений ${result.warnings.length}`,
  );
  for (const item of result.coverage) {
    console.log(`  ${item.professionId}: ${item.covered}/${item.total} компетенций с активным первичным источником`);
  }
  for (const error of result.errors) console.error(`  error: ${error}`);
  for (const warning of result.warnings.slice(0, 10)) console.warn(`  warning: ${warning}`);

  if (process.argv.includes("--report")) {
    const output = path.join(root, "data/learning-sources", `map-${new Date().toISOString().slice(0, 10)}.md`);
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, renderLearningSourceMapReport(result, new Date().toISOString().slice(0, 10)), "utf8");
    console.log(output);
  }
  if (result.errors.length > 0) process.exit(1);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
