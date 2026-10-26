import path from "node:path";
import { writeFile } from "node:fs/promises";
import type { CanonicalMap } from "../../canonical/types.ts";
import type { PriorityFile } from "../../priority/types.ts";
import type { SourceRegistry, TargetFile } from "../../types.ts";
import type { ProfessionsFile, SpheresFile } from "../types.ts";
import { professionIdOf, professionSlugOf } from "../../priority/source.ts";
import { flagValue, readJson } from "../../cli/common.ts";
import {
  applyLearningSourceLinks,
  buildCompetencies,
  buildPriorityProjection,
  buildProfessionRecord,
  buildProfessionCompetencies,
  buildSourceFiles,
  buildSphere,
} from "../build.ts";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const domain = flagValue(argv, "--domain") ?? "it";
  const profession = flagValue(argv, "--profession") ?? "uxui";
  const professionId = professionIdOf(domain, profession);
  const slug = professionSlugOf(professionId);
  const map = await readJson<CanonicalMap>(path.join(root, "src/methodology/v1/competency/canonical", `${slug}.json`));
  const priority = await readJson<PriorityFile>(path.join(root, "src/methodology/v1/competency/priority", `${slug}.json`));
  const registry = await readJson<SourceRegistry>(path.join(root, "src/methodology/v1/competency/sources/registry.json"));
  const targets = await readJson<TargetFile>(path.join(root, "src/methodology/v1/competency/targets", `${domain}.json`));
  const target = targets.professions.find((item) => item.id === slug);
  if (!target) throw new Error(`Нет target для ${professionId}`);

  const modelDir = path.join(root, "src/methodology/v1/competency/model");

  const sourcesDir = path.join(root, "src/methodology/v1/competency/sources");
  const competencies = buildCompetencies(map);
  const extraPath = path.join(root, "src/methodology/v1/competency/model/competencies-extra.json");
  try {
    const extra = await readJson<{ competencies: typeof competencies.competencies }>(extraPath);
    for (const competency of extra.competencies) {
      if (!competencies.competencies.some((item) => item.id === competency.id)) {
        competencies.competencies.push(competency);
      }
    }
  } catch {
    // extra competencies optional
  }
  // Ручной слой связей с учебными источниками (tracked): переживает пересборку competencies.json.
  try {
    const linksFile = await readJson<{ links: Array<{ competencyId: string; sourceIds: string[] }> }>(
      path.join(modelDir, "learning-source-links.json"),
    );
    const applied = applyLearningSourceLinks(competencies, linksFile.links ?? []);
    if (applied.errors.length > 0) throw new Error(applied.errors.join("; "));
    competencies.competencies = applied.competencies.competencies;
  } catch (error) {
    if (error instanceof Error && error.message.includes("learning-source-links")) throw error;
    // link-файл опционален
  }
  let existingProfessions: ProfessionsFile = { modelVersion: "1.0.0", professions: [] };
  let existingSpheres: SpheresFile = { modelVersion: "1.0.0", spheres: [] };
  try { existingProfessions = await readJson<ProfessionsFile>(path.join(modelDir, "professions.json")); } catch { /* first run */ }
  try { existingSpheres = await readJson<SpheresFile>(path.join(modelDir, "spheres.json")); } catch { /* first run */ }
  const spheres = buildSphere();
  for (const existing of existingSpheres.spheres) {
    const targetSphere = spheres.spheres.find((item) => item.id === existing.id);
    if (targetSphere) targetSphere.professionIds = [...new Set([...targetSphere.professionIds, ...existing.professionIds])];
    else spheres.spheres.push(existing);
  }
  const professionRecord = buildProfessionRecord(target, professionId);
  const professionCompetencies = buildProfessionCompetencies(map, professionId);
  const projection = buildPriorityProjection(priority, map);
  const sourceFiles = buildSourceFiles({ target, professionId, registry });

  // projection used as consistency check; canonical order is source of truth for this sync.
  if (projection.competencies.length !== professionCompetencies.competencies.length) {
    throw new Error("priority projection length mismatch");
  }

  console.log(`model:sync ${professionId}: competencies ${competencies.competencies.length}; profession competencies ${professionCompetencies.competencies.length}`);
  if (!argv.includes("--write")) {
    console.log("dry-run: запустите с --write");
    return;
  }
  const write = async (file: string, value: unknown): Promise<void> => {
    const out = path.join(root, file);
    await writeFile(out, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    console.log(out);
  };
  const byProfession = new Map(existingProfessions.professions.map((item) => [item.id, item]));
  byProfession.set(professionRecord.id, professionRecord);
  await write("src/methodology/v1/competency/model/spheres.json", spheres);
  await write("src/methodology/v1/competency/model/professions.json", { modelVersion: "1.0.0", professions: [...byProfession.values()] });
  await write("src/methodology/v1/competency/model/competencies.json", competencies);
  await write(`src/methodology/v1/competency/model/profession-competencies/${slug}.json`, professionCompetencies);
  await write(`src/methodology/v1/competency/sources/spheres/${domain}.json`, sourceFiles.sphere);
  await write(`src/methodology/v1/competency/sources/professions/${professionId}.json`, sourceFiles.profession);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
