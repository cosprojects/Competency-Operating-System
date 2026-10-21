import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CandidateQueue } from "../candidate-parser/types.ts";
import { buildMethodologistPatch, type MethodologistGraph } from "./decide.ts";
import { attachMatchText } from "./normalize.ts";
import type { ProfessionCatalogFile } from "../candidate-parser/types.ts";

const queuePath = path.resolve("data/competency-candidates/queue.json");
const catalogPath = path.resolve("src/methodology/v1/profession-catalog.json");
const graphPath = path.resolve("src/methodology/v1/design-competency-graph.json");
const outputPath = path.resolve("data/competency-candidates/methodologist-patch.json");

let queueRaw: string;
try {
  queueRaw = await readFile(queuePath, "utf8");
} catch {
  console.error("Нет очереди. Сначала: npm run parse:candidates");
  process.exit(1);
}

const loaded = JSON.parse(queueRaw) as CandidateQueue;
const normalized = await attachMatchText(loaded, process.env.DEEPSEEK_API_KEY);
if (normalized.skipped) {
  console.log("Нормализация пропущена: нет DEEPSEEK_API_KEY. Сопоставление идёт по исходному тексту.");
} else {
  console.log(`Нормализация: ${normalized.translated} описаний переданы по-русски для сопоставления. Фрагменты источника не изменены.`);
}
const queue = normalized.queue;
const catalog = JSON.parse(await readFile(catalogPath, "utf8")) as ProfessionCatalogFile;
const graph = JSON.parse(await readFile(graphPath, "utf8")) as MethodologistGraph;
const patch = buildMethodologistPatch({
  queue,
  graph,
  professions: catalog.professions,
});

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(patch, null, 2)}\n`, "utf8");

const summary = Object.entries(patch.counts)
  .filter(([, count]) => count > 0)
  .map(([outcome, count]) => `${outcome}=${count}`)
  .join(", ");
console.log(`Патч: ${patch.decisions.length} решений (${summary || "пусто"})`);
console.log(outputPath);
