import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import type { LearningSourceRegistry } from "../types.ts";
import { flagValue } from "../../competency/cli/common.ts";

/**
 * Применение предложенных меток доступа к авто-источникам.
 *
 *   npm run sources:access -- --proposal data/learning-sources/access-proposal-2026-11-03.json --write
 *
 * proposal: [{ sourceId, access, rationale? }]. Без --write — dry-run.
 */

const ALLOWED = new Set(["free", "freemium", "paid", "mixed", "unknown"]);

interface ProposalItem {
  sourceId: string;
  access: string;
  rationale?: string;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const proposalPath = flagValue(argv, "--proposal");
  if (!proposalPath) throw new Error("Укажи --proposal <file.json>");
  const proposal = JSON.parse(
    await readFile(path.resolve(root, proposalPath), "utf8"),
  ) as ProposalItem[];
  const registryPath = path.join(root, "src/methodology/v1/learning-sources/registry.json");
  const registry = JSON.parse(await readFile(registryPath, "utf8")) as LearningSourceRegistry;
  const byId = new Map(registry.sources.map((source) => [source.id, source]));
  let changed = 0;
  const skipped: string[] = [];
  for (const item of proposal) {
    if (!ALLOWED.has(item.access)) {
      skipped.push(`${item.sourceId}: недопустимый access «${item.access}»`);
      continue;
    }
    const source = byId.get(item.sourceId);
    if (!source) {
      skipped.push(`${item.sourceId}: нет в реестре`);
      continue;
    }
    if (source.access === item.access) continue;
    source.access = item.access as never;
    if (item.rationale) {
      source.notes = `${source.notes ? `${source.notes}; ` : ""}access: ${item.rationale}`;
    }
    changed += 1;
  }
  console.log(`sources:access: изменений ${changed}; пропущено ${skipped.length}`);
  for (const item of skipped.slice(0, 10)) console.log(`  skip ${item}`);
  if (argv.includes("--write")) {
    registry.updatedAt = new Date().toISOString().slice(0, 10);
    await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
    console.log(registryPath);
  } else {
    console.log("dry-run: реестр не изменён. Для записи добавь --write.");
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
