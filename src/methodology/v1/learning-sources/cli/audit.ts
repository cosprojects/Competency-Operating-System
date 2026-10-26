import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { LearningSourceRegistry } from "../types.ts";
import { checkLearningSource } from "../audit.ts";

function flagValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const file = path.join(root, "src/methodology/v1/learning-sources/registry.json");
  const registry = JSON.parse(await readFile(file, "utf8")) as LearningSourceRegistry;
  const profession = flagValue(argv, "--profession");
  const includeBlocked = argv.includes("--include-blocked");
  const selected = registry.sources.filter(
    (source) => (!profession || source.professionIds.includes(profession.includes(".") ? profession : `it.${profession}`)) &&
      (includeBlocked || source.status === "active"),
  );
  const results = [];
  for (const source of selected) results.push(await checkLearningSource(source));
  const out = path.join(root, "data/learning-sources", `audit-${new Date().toISOString().slice(0, 10)}.json`);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify({ checked: selected.length, results }, null, 2)}\n`, "utf8");
  const ok = results.filter((item) => item.status === "active").length;
  console.log(`learning sources: checked ${results.length}; active ${ok}; degraded ${results.length - ok}`);
  console.log(out);
}
try { await main(); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exit(1); }
