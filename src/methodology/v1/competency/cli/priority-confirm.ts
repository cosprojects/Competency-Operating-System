import path from "node:path";
import { writeFile } from "node:fs/promises";
import type { PriorityFile } from "../priority/types.ts";
import { validatePriorityFile } from "../priority/validate.ts";
import { professionIdOf, professionSlugOf, resolvePriorityBlocks } from "../priority/source.ts";
import { flagValue, readJson } from "./common.ts";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const domain = flagValue(argv, "--domain") ?? "it";
  const profession = flagValue(argv, "--profession") ?? "uxui";
  const professionId = professionIdOf(domain, profession);
  const slug = professionSlugOf(professionId);
  const filePath = flagValue(argv, "--priority-file") ?? path.join(root, "src/methodology/v1/competency/priority", `${slug}.json`);
  const reviewer = flagValue(argv, "--reviewer") ?? "cos-methodologist";
  const file = await readJson<PriorityFile>(filePath);
  const blocks = await resolvePriorityBlocks({ root, domain, profession, source: "auto" });
  const checked = validatePriorityFile(file, { blocks: blocks.blocks, requireComplete: true });
  if (checked.errors.length > 0) {
    for (const error of checked.errors) console.error(`  ошибка: ${error}`);
    throw new Error("priority: файл не готов к подтверждению");
  }
  const date = new Date().toISOString().slice(0, 10);
  const confirmed: PriorityFile = {
    ...file,
    status: "accepted",
    updatedOn: date,
    marks: file.marks.map((mark) => ({ ...mark, reviewer, reviewedAt: date, confidence: mark.confidence === "low" ? "medium" : mark.confidence })),
  };
  console.log(`priority:confirm ${professionId}: marks ${confirmed.marks.length}; reviewer ${reviewer}; status accepted`);
  if (!argv.includes("--write")) {
    console.log("dry-run: запустите с --write");
    return;
  }
  await writeFile(filePath, `${JSON.stringify(confirmed, null, 2)}\n`, "utf8");
  console.log(filePath);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
