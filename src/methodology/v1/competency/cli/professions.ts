import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FetchLike } from "../../candidate-parser/types.ts";
import type { TargetFile } from "../types.ts";
import { collectProfessions } from "../collect.ts";

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
  const targets = JSON.parse(
    await readFile(path.join(root, "src/methodology/v1/competency/targets", `${domain}.json`), "utf8"),
  ) as TargetFile;
  const fetchImpl: FetchLike = (input, init) => fetch(input, init);
  const retrievedOn = new Date().toISOString().slice(0, 10);
  const result = await collectProfessions({
    domain,
    targets: targets.professions,
    fetchImpl,
    retrievedOn,
    cache: { dir: path.join(root, "data/competency/cache"), refresh: argv.includes("--refresh") },
  });

  const outDir = path.join(root, "data/competency");
  await mkdir(outDir, { recursive: true });
  const outputPath = path.join(outDir, `professions-${domain}.json`);
  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        domain,
        targetVersion: targets.version,
        retrievedOn,
        professions: result.professions,
        searches: result.searches,
        writesToGraph: false,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(`Профессий: ${result.professions.length}`);
  for (const profession of result.professions) {
    console.log(
      `  ${profession.title}: источников ${profession.sources.length}${profession.notes ? ` (${profession.notes.join("; ")})` : ""}`,
    );
  }
  console.log(outputPath);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
