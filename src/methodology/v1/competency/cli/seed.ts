import path from "node:path";
import type { TagRecord } from "../types.ts";
import type { SeedFile } from "../seeds.ts";
import { materializeSeed } from "../seeds.ts";
import { dataDir, flagValue, readJson, writeJson } from "./common.ts";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const domain = flagValue(argv, "--domain") ?? "it";
  const seedId = flagValue(argv, "--seed");
  const seedFile = await readJson<SeedFile>(
    path.join(root, "src/methodology/v1/competency/seeds", `${domain}.json`),
  );
  const tags = await readJson<{ tags: TagRecord[] }>(
    flagValue(argv, "--tags-file") ?? path.join(dataDir(root), `tags-${domain}.json`),
  );
  const seeds = seedId ? seedFile.seeds.filter((seed) => seed.id === seedId) : seedFile.seeds;
  if (seeds.length === 0) throw new Error(`Seed «${seedId ?? ""}» не найден`);
  const generatedOn = new Date().toISOString().slice(0, 10);
  const candidates = seeds.map((seed) => materializeSeed(seed, tags.tags, generatedOn));
  const output = path.join(dataDir(root), "seeds", `${domain}${seedId ? `-${seedId}` : ""}.candidates.json`);
  await writeJson(output, {
    domain,
    generatedOn,
    writesToGraph: false,
    candidates: candidates.map((item) => item.candidate),
    matched: candidates.map((item) => ({ title: item.candidate.title, tagIds: item.matchedTagIds, missing: item.missing })),
  });
  for (const item of candidates) {
    console.log(`seed ${item.candidate.title}: тегов ${item.candidate.tagIds.length}${item.missing ? " (нужна проверка)" : ""}`);
  }
  console.log(output);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
