import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { CompetenciesFile, ProfessionCompetencyFile, ProfessionsFile } from "../../competency/model/types.ts";
import type { LearningSourceRegistry } from "../types.ts";
import { buildOpenSourceAggregation, renderOpenSourceAggregation } from "../aggregate.ts";

async function main(): Promise<void> {
  const root = process.cwd();
  const base = path.join(root, "src/methodology/v1");
  const registry = JSON.parse(await readFile(path.join(base, "learning-sources/registry.json"), "utf8")) as LearningSourceRegistry;
  const links = JSON.parse(await readFile(path.join(base, "competency/model/learning-source-links.json"), "utf8")) as { links: Array<{ competencyId: string; sourceIds: string[] }> };
  const competencies = JSON.parse(await readFile(path.join(base, "competency/model/competencies.json"), "utf8")) as CompetenciesFile;
  const professions = JSON.parse(await readFile(path.join(base, "competency/model/professions.json"), "utf8")) as ProfessionsFile;
  const professionCompetencies: ProfessionCompetencyFile[] = [];
  for (const profession of professions.professions) {
    const slug = profession.id.split(".").pop()!;
    try {
      professionCompetencies.push(JSON.parse(await readFile(path.join(base, `competency/model/profession-competencies/${slug}.json`), "utf8")) as ProfessionCompetencyFile);
    } catch {
      // profession without materialized layer
    }
  }
  const result = buildOpenSourceAggregation({ registry, links: links.links, competencies, professions, professionCompetencies, generatedAt: new Date().toISOString().slice(0, 10) });
  const dir = path.join(root, "data/learning-sources");
  await mkdir(dir, { recursive: true });
  const jsonPath = path.join(dir, `open-sources-by-profession-${result.generatedAt}.json`);
  const mdPath = path.join(dir, `open-sources-by-profession-${result.generatedAt}.md`);
  await writeFile(jsonPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await writeFile(mdPath, renderOpenSourceAggregation(result), "utf8");
  console.log(`open sources: professions ${result.professions.length}; open ${result.professions.reduce((n, item) => n + item.openSources, 0)}; warnings ${result.warnings.length}; excluded ${result.excluded.length}`);
  for (const profession of result.professions) console.log(`  ${profession.professionId}: ${profession.openSources} open / ${profession.competencies} competencies; without ${profession.withoutOpenSource.length}`);
  console.log(jsonPath);
  console.log(mdPath);
}
try { await main(); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exit(1); }
