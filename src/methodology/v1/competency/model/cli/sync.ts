import path from "node:path";
import { writeFile } from "node:fs/promises";
import type { CanonicalMap } from "../../canonical/types.ts";
import type { PriorityFile } from "../../priority/types.ts";
import type { SourceRegistry, TargetFile } from "../../types.ts";
import { professionIdOf, professionSlugOf } from "../../priority/source.ts";
import { flagValue, readJson } from "../../cli/common.ts";
import {
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
  const spheres = buildSphere();
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
  await write("src/methodology/v1/competency/model/spheres.json", spheres);
  await write("src/methodology/v1/competency/model/professions.json", { modelVersion: "1.0.0", professions: [professionRecord] });
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
