import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import type { CatalogFile, Material } from "../../competency/types.ts";
import { loadCatalog } from "../../competency/catalog.ts";
import { acceptMaterials } from "../accept.ts";
import { flagValue } from "../../competency/cli/common.ts";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const domain = flagValue(argv, "--domain") ?? "it";
  const journal = flagValue(argv, "--journal") ?? path.join(root, "data/materials-agent", `${domain}-uxui-queue.json`);
  const minRelevance = Number(flagValue(argv, "--min-relevance") ?? 0.7);
  const payload = JSON.parse(await readFile(journal, "utf8")) as { materials: Material[] };
  const catalog = await loadCatalog(root, domain);
  const reviewsPath = flagValue(argv, "--reviews");
  let blockedSourceIds: Set<string> | undefined;
  if (reviewsPath) {
    const reviewsFile = JSON.parse(await readFile(path.resolve(root, reviewsPath), "utf8")) as {
      blockedSourceIds?: string[];
      pairs?: Array<{ sourceId: string; status: string }>;
    };
    blockedSourceIds = new Set([
      ...(reviewsFile.blockedSourceIds ?? []),
      ...(reviewsFile.pairs ?? []).filter((pair) => pair.status === "blocked").map((pair) => pair.sourceId),
    ]);
  }
  const result = acceptMaterials(catalog, payload.materials ?? [], {
    minRelevance,
    ...(blockedSourceIds ? { blockedSourceIds } : {}),
  });
  const updated: CatalogFile = {
    ...catalog,
    materials: [...catalog.materials, ...result.accepted],
    updatedOn: new Date().toISOString().slice(0, 10),
  };
  const file = path.join(root, "src/methodology/v1/competency/catalog", `${domain}.json`);
  if (!argv.includes("--write")) {
    console.log(`materials:accept dry-run: ${result.accepted.length} accepted, ${result.skipped.length} skipped`);
    for (const item of result.skipped.slice(0, 10)) console.log(`  skip ${item.id}: ${item.reason}`);
    return;
  }
  await writeFile(file, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
  console.log(`materials:accept ${journal}: accepted ${result.accepted.length}; skipped ${result.skipped.length}; catalog materials ${updated.materials.length}`);
  console.log(file);
}
try { await main(); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exit(1); }
