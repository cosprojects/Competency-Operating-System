import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseCompetencyCandidates } from "./parse.ts";
import type { ProfessionCatalogFile } from "./types.ts";

const catalogPath = path.resolve("src/methodology/v1/profession-catalog.json");
const outputPath = path.resolve("data/competency-candidates/queue.json");

function requestedProfessions(argv: string[]): string[] | undefined {
  const flag = argv.indexOf("--profession");
  if (flag === -1) return undefined;
  const ids = argv.slice(flag + 1).filter((item) => !item.startsWith("--"));
  return ids.length > 0 ? ids : undefined;
}

const catalog = JSON.parse(await readFile(catalogPath, "utf8")) as ProfessionCatalogFile;
const retrievedOn = new Date().toISOString().slice(0, 10);
const queue = await parseCompetencyCandidates({
  catalog,
  fetchImpl: (input, init) => fetch(input, init),
  retrievedOn,
  onetApiKey: process.env.ONET_API_KEY,
  professionIds: requestedProfessions(process.argv),
});

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(queue, null, 2)}\n`, "utf8");

const counts = queue.sources.map((source) => `${source.id}=${source.status}:${source.candidateCount}`).join(", ");
console.log(`Очередь: ${queue.candidates.length} кандидатов (${counts})`);
console.log(outputPath);
for (const source of queue.sources) {
  if (source.note) console.log(`${source.id}: ${source.note}`);
}
