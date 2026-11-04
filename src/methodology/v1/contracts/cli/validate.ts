/**
 * `npm run contracts:validate` — проверка текущей методологии контрактом COS-ARCH-170.
 *
 * Читает существующие JSON, строит снимок онтологии по контракту и печатает отчёт.
 * Структурные нарушения — ошибка (exit 1). Долг качества — предупреждение,
 * если не передан --strict.
 */
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
} from "../adapters.ts";
import { LIFECYCLE_TRANSITIONS, type Lifecycle } from "../ontology.ts";

const root = process.cwd();
const strict = process.argv.includes("--strict");
const asJson = process.argv.includes("--json");

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(resolve(root, path), "utf8"));
}

const modelDir = "src/methodology/v1/competency/model";
const catalogPath = "src/methodology/v1/competency/catalog/it.json";

const professions = professionsFileSchema.parse(readJson(`${modelDir}/professions.json`));
const competencies = competenciesFileSchema.parse(readJson(`${modelDir}/competencies.json`));
const catalog = catalogFileSchema.parse(readJson(catalogPath));
const registry = registryFileSchema.parse(
  readJson("src/methodology/v1/learning-sources/registry.json"),
);
const descriptions = descriptionsFileSchema.parse(
  readJson(`${modelDir}/professions/descriptions.json`),
);

const professionCompetencies = professions.professions.map((profession) => {
  const fileName = profession.id.split(".")[1] ?? profession.id;
  return professionCompetenciesFileSchema.parse(
    readJson(`${modelDir}/profession-competencies/${fileName}.json`),
  );
});

const { snapshot, warnings, qualityDebt } = buildSnapshot({
  professions,
  descriptions,
  competencies,
  catalog,
  registry,
  professionCompetencies,
});

const countBy = <T extends string>(values: T[]): Array<[T, number]> => {
  const map = new Map<T, number>();
  for (const value of values) map.set(value, (map.get(value) ?? 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
};

const byType = countBy(snapshot.nodes.map((node) => node.type));
const byLifecycle = countBy(snapshot.nodes.map((node) => node.lifecycle));
const byEvidence = countBy(snapshot.nodes.map((node) => node.evidenceState));
const byEdge = countBy(snapshot.edges.map((edge) => edge.type));

const invalidTransitions = snapshot.nodes.filter((node) => !(node.lifecycle in LIFECYCLE_TRANSITIONS));
const report = {
  contractVersion: snapshot.contractVersion,
  modelVersion: snapshot.modelVersion,
  nodes: snapshot.nodes.length,
  edges: snapshot.edges.length,
  byType: Object.fromEntries(byType),
  byLifecycle: Object.fromEntries(byLifecycle),
  byEvidence: Object.fromEntries(byEvidence),
  byEdge: Object.fromEntries(byEdge),
  qualityDebt: qualityDebt.length,
  warnings: warnings.length,
  structuralErrors: invalidTransitions.length,
};

if (asJson) {
  console.log(JSON.stringify({ report, warnings, qualityDebt }, null, 2));
} else {
  console.log("COS-ARCH-170 · контракт онтологии");
  console.log(`модель ${snapshot.modelVersion} · контракт ${snapshot.contractVersion}`);
  console.log(`\nузлы: ${report.nodes}  рёбра: ${report.edges}`);
  console.log("  по типу:    " + byType.map(([k, v]) => `${k} ${v}`).join(" · "));
  console.log("  жизненный:  " + byLifecycle.map(([k, v]) => `${k as Lifecycle} ${v}`).join(" · "));
  console.log("  evidence:   " + byEvidence.map(([k, v]) => `${k} ${v}`).join(" · "));
  console.log("  рёбра:      " + byEdge.map(([k, v]) => `${k} ${v}`).join(" · "));
  if (warnings.length > 0) {
    console.log(`\nпредупреждения (${warnings.length}):`);
    for (const warning of warnings.slice(0, 8)) console.log(`  · ${warning}`);
    if (warnings.length > 8) console.log(`  · … ещё ${warnings.length - 8}`);
  }
  console.log(
    `\nдолг качества (не ошибка контракта): ${qualityDebt.length} узлов короче политики описаний`,
  );
  console.log(
    `\nRESULT: ${invalidTransitions.length === 0 && (!strict || qualityDebt.length === 0) ? "PASS" : "FAIL"}`,
  );
}

const failed = invalidTransitions.length > 0 || (strict && qualityDebt.length > 0);
if (failed) process.exit(1);
