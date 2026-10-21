import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FetchLike } from "../../candidate-parser/types.ts";
import type { SourceRegistry, TargetFile } from "../types.ts";
import { searchEscoOccupations } from "../sources/esco.ts";
import { searchOnetOccupations } from "../sources/onet.ts";

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
  const query = flagValue(argv, "--query");
  const registry = JSON.parse(
    await readFile(path.join(root, "src/methodology/v1/competency/sources/registry.json"), "utf8"),
  ) as SourceRegistry;
  const targets = JSON.parse(
    await readFile(path.join(root, "src/methodology/v1/competency/targets", `${domain}.json`), "utf8"),
  ) as TargetFile;
  const fetchImpl: FetchLike = (input, init) => fetch(input, init);
  const cache = { dir: path.join(root, "data/competency/cache") };

  const probes: Array<{
    sourceId: string;
    status: string;
    query: string;
    found: number;
    note?: string;
  }> = [];

  const queries = query
    ? [query]
    : targets.professions.map((item) => item.esco?.search ?? item.titleEn).filter(Boolean);

  for (const source of registry.sources) {
    if (source.status !== "active") {
      probes.push({ sourceId: source.id, status: source.status, query: "", found: 0, note: source.notes });
      continue;
    }
    if (source.id === "esco") {
      for (const text of queries) {
        try {
          const hits = await searchEscoOccupations(fetchImpl, text);
          probes.push({ sourceId: "esco", status: "found", query: text, found: hits.length });
        } catch (error) {
          probes.push({
            sourceId: "esco",
            status: "unavailable",
            query: text,
            found: 0,
            note: error instanceof Error ? error.message : "ошибка",
          });
        }
      }
    } else if (source.id === "onet") {
      try {
        const hits = await searchOnetOccupations(fetchImpl, cache, {
          titleIncludes: targets.professions.flatMap((item) => item.onet?.titleIncludes ?? []),
          socCodes: targets.professions.flatMap((item) => item.onet?.socCodes ?? []),
        });
        probes.push({ sourceId: "onet", status: "found", query: "targets", found: hits.length });
      } catch (error) {
        probes.push({
          sourceId: "onet",
          status: "unavailable",
          query: "targets",
          found: 0,
          note: error instanceof Error ? error.message : "ошибка",
        });
      }
    } else {
      probes.push({
        sourceId: source.id,
        status: "registered",
        query: "",
        found: 0,
        note: source.notes ?? "поиск по профессиям не поддерживается адаптером",
      });
    }
  }

  const outDir = path.join(root, "data/competency");
  await mkdir(outDir, { recursive: true });
  const outputPath = path.join(outDir, "sources.json");
  await writeFile(
    outputPath,
    `${JSON.stringify({ registry, probes, generatedOn: new Date().toISOString().slice(0, 10) }, null, 2)}\n`,
    "utf8",
  );
  console.log(`Источников: ${registry.sources.length}; активных: ${registry.sources.filter((item) => item.status === "active").length}`);
  for (const probe of probes) {
    console.log(`  ${probe.sourceId}: ${probe.status}${probe.found ? ` (${probe.found})` : ""}${probe.note ? ` — ${probe.note}` : ""}`);
  }
  console.log(outputPath);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
