import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FetchLike } from "../../candidate-parser/types.ts";
import type { ProfessionRecord } from "../types.ts";
import { collectTags } from "../collect.ts";

interface ProfessionsFile {
  domain: string;
  retrievedOn: string;
  professions: ProfessionRecord[];
}

function flagValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const domain = flagValue(argv, "--domain") ?? "it";
  const professionFilter = flagValue(argv, "--profession");
  const inputPath = path.join(
    root,
    "data/competency",
    professionFilter ? `professions-${domain}-${professionFilter}.json` : `professions-${domain}.json`,
  );
  const source = JSON.parse(await readFile(inputPath, "utf8")) as ProfessionsFile;
  const professions = professionFilter
    ? source.professions.filter((item) => item.slug === professionFilter || item.id === professionFilter)
    : source.professions;
  if (professions.length === 0) throw new Error("Не выбрано ни одной профессии");

  const fetchImpl: FetchLike = (input, init) => fetch(input, init);
  const retrievedOn = new Date().toISOString().slice(0, 10);
  const result = await collectTags({
    professions,
    fetchImpl,
    retrievedOn,
    cache: { dir: path.join(root, "data/competency/cache"), refresh: argv.includes("--refresh") },
  });

  const outDir = path.join(root, "data/competency");
  await mkdir(outDir, { recursive: true });
  const outputPath = path.join(outDir, `tags-${domain}${professionFilter ? `-${professionFilter}` : ""}.json`);
  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        domain,
        retrievedOn,
        writesToGraph: false,
        professionIds: professions.map((item) => item.id),
        tags: result.tags,
        byProfession: result.byProfession,
        stats: result.stats,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(
    `Теги: ${result.stats.tags} (${Object.entries(result.stats.byKind)
      .map(([kind, count]) => `${kind}=${count}`)
      .join(", ")}); без описания: ${result.stats.withoutDefinition}; sourceRefs: ${result.stats.sourceRefs}`,
  );
  for (const profession of professions) {
    console.log(`  ${profession.title}: ${result.byProfession[profession.id]?.length ?? 0} тегов`);
  }
  console.log(outputPath);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
