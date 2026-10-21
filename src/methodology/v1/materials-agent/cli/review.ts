import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { MaterialQueueJournal } from "../queue.ts";
import { renderMaterialQueueReview } from "../review.ts";
import { flagValue } from "../../competency/cli/common.ts";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const domain = flagValue(argv, "--domain") ?? "it";
  const profession = flagValue(argv, "--profession") ?? "motion";
  const input = flagValue(argv, "--journal") ?? path.join(root, "data/materials-agent", `${domain}-${profession}-queue.json`);
  const journal = JSON.parse(await readFile(input, "utf8")) as MaterialQueueJournal;
  const output = path.join(root, "data/materials-agent", `${domain}-${profession}-review.md`);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, renderMaterialQueueReview(journal), "utf8");
  console.log(`${journal.professionId}: review ${journal.totals.items} items; linked ${journal.totals.linked}`);
  console.log(output);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
