/** Загрузка реальной онтологии из репозитория в контрактный снимок. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildSnapshot,
  catalogFileSchema,
  competenciesFileSchema,
  descriptionsFileSchema,
  professionCompetenciesFileSchema,
  professionsFileSchema,
  registryFileSchema,
  type BuildResult,
} from "./adapters.ts";

const MODEL_DIR = "src/methodology/v1/competency/model";
const CATALOG_PATH = "src/methodology/v1/competency/catalog/it.json";
const REGISTRY_PATH = "src/methodology/v1/learning-sources/registry.json";

export function loadOntologySnapshot(
  root: string = process.cwd(),
  options: { releaseId?: string; generatedAt?: string } = {},
): BuildResult & { catalog: ReturnType<typeof catalogFileSchema.parse> } {
  const readJson = (path: string): unknown =>
    JSON.parse(readFileSync(resolve(root, path), "utf8"));

  const professions = professionsFileSchema.parse(readJson(`${MODEL_DIR}/professions.json`));
  const competencies = competenciesFileSchema.parse(readJson(`${MODEL_DIR}/competencies.json`));
  const catalog = catalogFileSchema.parse(readJson(CATALOG_PATH));
  const registry = registryFileSchema.parse(readJson(REGISTRY_PATH));
  const descriptions = descriptionsFileSchema.parse(
    readJson(`${MODEL_DIR}/professions/descriptions.json`),
  );

  const professionCompetencies = professions.professions.map((profession) => {
    const fileName = profession.id.split(".")[1] ?? profession.id;
    return professionCompetenciesFileSchema.parse(
      readJson(`${MODEL_DIR}/profession-competencies/${fileName}.json`),
    );
  });

  const result = buildSnapshot({
    professions,
    descriptions,
    competencies,
    catalog,
    registry,
    professionCompetencies,
    ...(options.releaseId ? { releaseId: options.releaseId } : {}),
    ...(options.generatedAt ? { generatedAt: options.generatedAt } : {}),
  });
  return { ...result, catalog };
}
