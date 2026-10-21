import path from "node:path";
import type { TagRecord } from "../types.ts";
import type { SeedFile } from "../seeds.ts";
import { materializeSeed } from "../seeds.ts";
import { hashId, slugify } from "../sources/common.ts";
import { dataDir, flagValue, readJson, writeJson } from "./common.ts";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const domain = flagValue(argv, "--domain") ?? "it";
  const seedId = flagValue(argv, "--seed");
  const professionId = flagValue(argv, "--profession");
  const seedFile = await readJson<SeedFile>(
    path.join(root, "src/methodology/v1/competency/seeds", `${domain}.json`),
  );
  const tags = await readJson<{ tags: TagRecord[] }>(
    flagValue(argv, "--tags-file") ?? path.join(dataDir(root), `tags-${domain}.json`),
  );
  const selectedProfession = professionId ? (professionId.includes(".") ? professionId : `${domain}.${professionId}`) : undefined;
  const seeds = seedFile.seeds.filter(
    (seed) => (!seedId || seed.id === seedId) && (!selectedProfession || seed.professionIds.includes(selectedProfession)),
  );
  if (seeds.length === 0) throw new Error(`Seed «${seedId ?? ""}» не найден`);
  const generatedOn = new Date().toISOString().slice(0, 10);
  const extraTags: TagRecord[] = [];
  const candidates = seeds.map((seed) => {
    const seedExtra = (seed.extraTags ?? []).map((tag) => ({
      id: hashId("tag", `${tag.title}|${tag.kind}`),
      slug: slugify(tag.title, "tag"),
      title: tag.title,
      aliases: [],
      kind: tag.kind,
      definition: tag.definition,
      professionIds: seed.professionIds,
      sourceRefs: [],
      evidenceState: "needs_review" as const,
      competencyLinks: [],
      materialIds: [],
      needsReview: true,
    }));
    for (const tag of seedExtra) {
      if (!extraTags.some((item) => item.id === tag.id)) extraTags.push(tag);
    }
    return materializeSeed(seed, tags.tags, generatedOn, seedExtra);
  });
  const suffix = professionId ? `-${professionId.split(".").pop()}` : seedId ? `-${seedId}` : "";
  const output = path.join(dataDir(root), "seeds", `${domain}${suffix}.candidates.json`);
  await writeJson(output, {
    domain,
    generatedOn,
    writesToGraph: false,
    candidates: candidates.map((item) => item.candidate),
    extraTags,
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
