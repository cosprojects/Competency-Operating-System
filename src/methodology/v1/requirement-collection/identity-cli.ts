import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { matchIdentities } from "./identity.ts";
import type { RequirementJournal } from "./types.ts";

function flagValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  const value = index === -1 ? undefined : argv[index + 1];
  if (!value || value.startsWith("--")) return undefined;
  return value;
}

const professionId = flagValue(process.argv, "--profession");
if (!professionId) {
  console.error("Нужен --profession с id из каталога.");
  process.exit(1);
}

const sourcePath = path.resolve(`data/requirement-collection/${professionId}.json`);
const journal = JSON.parse(await readFile(sourcePath, "utf8")) as RequirementJournal;
const identity = matchIdentities(journal, `data/requirement-collection/${professionId}.json`);
const outputPath = path.resolve(`data/requirement-collection/${professionId}-identity.json`);
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(identity, null, 2)}\n`, "utf8");

const counts = identity.decisions.reduce<Record<string, number>>((sum, item) => {
  sum[item.outcome] = (sum[item.outcome] ?? 0) + 1;
  return sum;
}, {});
console.log(
  `Идентичности: ${identity.identities.length}. Решения: ${identity.decisions.length} (${Object.entries(counts)
    .map(([name, count]) => `${name}=${count}`)
    .join(", ")}).`,
);
console.log(outputPath);
