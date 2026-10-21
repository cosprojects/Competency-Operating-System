import path from "node:path";
import { readFile } from "node:fs/promises";
import type { SourceRegistry } from "../types.ts";

async function main(): Promise<void> {
  const root = process.cwd();
  const registry = JSON.parse(
    await readFile(path.join(root, "src/methodology/v1/competency/sources/registry.json"), "utf8"),
  ) as SourceRegistry;
  const materials = registry.sources.filter((source) => source.kind === "materials");
  console.log(`Material-источников: ${materials.length}`);
  for (const source of materials) {
    console.log(
      `  ${source.id}: ${source.status} · ${source.access} · ${source.license}${source.requiresEnv?.length ? ` · env: ${source.requiresEnv.join(",")}` : ""}${source.notes ? ` — ${source.notes}` : ""}`,
    );
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
