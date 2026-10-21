import path from "node:path";
import { readdir, writeFile } from "node:fs/promises";
import type { SourceRegistry, TargetFile } from "../../types.ts";
import type {
  CompetenciesFile,
  ProfessionModelRecord,
  ProfessionsFile,
  SpheresFile,
} from "../types.ts";
import { buildProfessionCompetenciesFromView, validateProfessionView, type ProfessionView } from "../profession-view.ts";
import { buildSourceFiles } from "../build.ts";
import { flagValue, readJson } from "../../cli/common.ts";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const base = path.join(root, "src/methodology/v1/competency");
  const viewsDir = path.join(base, "model/professions/views");
  const files = (await readdir(viewsDir)).filter((file) => file.endsWith(".json"));
  const competencies = await readJson<CompetenciesFile>(path.join(base, "model/competencies.json"));
  const existingProfessions = await readJson<ProfessionsFile>(path.join(base, "model/professions.json"));
  const existingSpheres = await readJson<SpheresFile>(path.join(base, "model/spheres.json"));
  const targets = await readJson<TargetFile>(path.join(base, `targets/${flagValue(argv, "--domain") ?? "it"}.json`));
  const registry = await readJson<SourceRegistry>(path.join(base, "sources/registry.json"));
  const domain = flagValue(argv, "--domain") ?? "it";

  const allErrors: string[] = [];
  const views: ProfessionView[] = [];
  for (const file of files) {
    const view = await readJson<ProfessionView>(path.join(viewsDir, file));
    allErrors.push(...validateProfessionView(view, competencies.competencies));
    views.push(view);
  }
  if (allErrors.length > 0) {
    for (const error of allErrors) console.error(`  ${error}`);
    throw new Error(`model:views: ошибок ${allErrors.length}`);
  }

  const byId = new Map(existingProfessions.professions.map((item) => [item.id, item]));
  for (const view of views) {
    const slug = view.professionId.split(".").pop() ?? view.professionId;
    const target = targets.professions.find((item) => item.id === slug);
    if (!target) throw new Error(`model:views: нет target для ${view.professionId}`);
    const record: ProfessionModelRecord = {
      id: view.professionId,
      sphereId: view.sphereId,
      title: view.title,
      ...(view.titleEn ? { titleEn: view.titleEn } : {}),
      canonicalMapFile: `model/professions/views/${slug}.json`,
      viewFile: `model/professions/views/${slug}.json`,
      catalogFile: `catalog/${domain}.json`,
      priorityFile: `model/profession-competencies/${slug}.json`,
      sourcesFile: `sources/professions/${view.professionId}.json`,
    };
    byId.set(view.professionId, record);
    const sourceFiles = buildSourceFiles({ target, professionId: view.professionId, registry });
    const professionCompetencies = buildProfessionCompetenciesFromView(view, competencies.competencies);
    if (argv.includes("--write")) {
      await writeFile(path.join(base, `model/profession-competencies/${slug}.json`), `${JSON.stringify(professionCompetencies, null, 2)}\n`, "utf8");
      await writeFile(path.join(base, `sources/professions/${view.professionId}.json`), `${JSON.stringify(sourceFiles.profession, null, 2)}\n`, "utf8");
    }
    console.log(`${view.professionId}: links ${professionCompetencies.competencies.length}; sources ${sourceFiles.profession.occupationSources.length}`);
  }

  const professionIds = [...byId.keys()];
  const spheres: SpheresFile = {
    modelVersion: "1.0.0",
    spheres: existingSpheres.spheres.map((sphere) =>
      sphere.id === "it" ? { ...sphere, professionIds: [...new Set([...sphere.professionIds, ...views.map((view) => view.professionId)])] } : sphere,
    ),
  };
  const professions: ProfessionsFile = { modelVersion: "1.0.0", professions: [...byId.values()] };
  console.log(`model:views: professions ${professionIds.length}; views ${views.length}`);
  if (!argv.includes("--write")) {
    console.log("dry-run: запустите с --write");
    return;
  }
  await writeFile(path.join(base, "model/spheres.json"), `${JSON.stringify(spheres, null, 2)}\n`, "utf8");
  await writeFile(path.join(base, "model/professions.json"), `${JSON.stringify(professions, null, 2)}\n`, "utf8");
  console.log(path.join(base, "model/professions.json"));
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
