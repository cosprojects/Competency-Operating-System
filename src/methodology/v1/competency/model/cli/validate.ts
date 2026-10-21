import path from "node:path";
import type {
  CompetenciesFile,
  ProfessionCompetencyFile,
  ProfessionsFile,
  ProfessionSourceFile,
  SpheresFile,
  SphereSourceFile,
} from "../types.ts";
import { validateModel } from "../validate.ts";
import { flagValue, readJson } from "../../cli/common.ts";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const domain = flagValue(argv, "--domain") ?? "it";
  const profession = flagValue(argv, "--profession") ?? "uxui";
  const slug = profession.includes(".") ? profession.slice(profession.indexOf(".") + 1) : profession;
  const professionId = profession.includes(".") ? profession : `${domain}.${profession}`;
  const base = path.join(root, "src/methodology/v1/competency");
  const spheres = await readJson<SpheresFile>(path.join(base, "model/spheres.json"));
  const professions = await readJson<ProfessionsFile>(path.join(base, "model/professions.json"));
  const competencies = await readJson<CompetenciesFile>(path.join(base, "model/competencies.json"));
  const professionCompetencies = await readJson<ProfessionCompetencyFile>(path.join(base, `model/profession-competencies/${slug}.json`));
  const sphereSource = await readJson<SphereSourceFile>(path.join(base, `sources/spheres/${domain}.json`)).catch(() => undefined);
  const professionSource = await readJson<ProfessionSourceFile>(path.join(base, `sources/professions/${professionId}.json`)).catch(() => undefined);
  const errors = validateModel({ spheres, professions, competencies, professionCompetencies, ...(sphereSource ? { sphereSource } : {}), ...(professionSource ? { professionSource } : {}) });
  console.log(`model:validate ${professionId}: competencies ${competencies.competencies.length}; profession links ${professionCompetencies.competencies.length}; errors ${errors.length}`);
  for (const error of errors) console.error(`  ${error}`);
  if (errors.length > 0) process.exit(1);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
