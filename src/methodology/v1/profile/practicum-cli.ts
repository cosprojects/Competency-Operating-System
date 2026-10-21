import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FetchLike } from "../candidate-parser/types.ts";
import { collectPracticumDesign, renderPracticumMarkdown } from "./practicum.ts";

function flagValues(argv: string[], name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== name) continue;
    const value = argv[index + 1];
    if (value && !value.startsWith("--")) values.push(value);
  }
  return values;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const outDir = path.join(root, "data/profile");
  const fetchImpl: FetchLike = (input, init) => fetch(input, init);
  const slugs = flagValues(argv, "--slug");

  const journal = await collectPracticumDesign({
    fetchImpl,
    retrievedOn: new Date().toISOString().slice(0, 10),
    cache: { dir: path.join(outDir, "source-cache"), refresh: argv.includes("--refresh") },
    ...(slugs.length > 0 ? { professionSlugs: slugs } : {}),
  });

  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "practicum-design.json");
  const mdPath = path.join(outDir, "practicum-design.md");
  await writeFile(jsonPath, `${JSON.stringify(journal, null, 2)}\n`, "utf8");
  await writeFile(mdPath, renderPracticumMarkdown(journal), "utf8");

  const withSkills = journal.professions.filter((profession) => profession.skills.length > 0);
  console.log(`Профессий: ${journal.professions.length}, с навыками: ${withSkills.length}`);
  console.log(`Навыков/тем: ${withSkills.reduce((sum, item) => sum + item.lessons.length, 0)}`);
  for (const profession of journal.professions) {
    console.log(
      `  ${profession.name}: инструментов ${profession.tools.length}, тем ${profession.lessons.length}`,
    );
  }
  console.log(`Записываю: ${jsonPath}`);
  console.log(`Записываю: ${mdPath}`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
