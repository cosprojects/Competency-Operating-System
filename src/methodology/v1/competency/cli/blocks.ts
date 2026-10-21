import path from "node:path";
import type {
  CompetencyCandidate,
  ProfessionRecord,
  TagRecord,
} from "../types.ts";
import { buildBlocks } from "../blocks.ts";
import { loadCatalog } from "../catalog.ts";
import { LlmBudget } from "../llm/policy.ts";
import { renderBlockReview } from "../render.ts";
import { cacheDir, dataDir, flagValue, makeTransport, policyFromArgv, readJson, writeJson } from "./common.ts";
import { mkdir, writeFile } from "node:fs/promises";

interface CandidatesFile {
  candidates: CompetencyCandidate[];
  unassignedTagIds: string[];
  extraTags?: TagRecord[];
}
interface TagsFile {
  tags: TagRecord[];
}
interface ProfessionsFile {
  professions: ProfessionRecord[];
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const domain = flagValue(argv, "--domain") ?? "it";
  const profession = flagValue(argv, "--profession");
  const suffix = profession ? `-${profession}` : "";
  const candidatesFile = await readJson<CandidatesFile>(
    flagValue(argv, "--candidates-file") ?? path.join(dataDir(root), `candidates-${domain}${suffix}.json`),
  );
  const tagsFile = await readJson<TagsFile>(
    flagValue(argv, "--tags-file") ??
      path.join(dataDir(root), profession ? `tags-${domain}-${profession}.json` : `tags-${domain}.json`),
  );
  const professions = await readJson<ProfessionsFile>(
    path.join(dataDir(root), `professions-${domain}.json`),
  );
  const catalog = await loadCatalog(root, domain);
  const slug = flagValue(argv, "--slug");
  const candidates = slug
    ? candidatesFile.candidates.filter((item) => item.slug === slug || item.id === slug)
    : candidatesFile.candidates;

  if (argv.includes("--dry-run")) {
    console.log(`dry-run: кандидатов ${candidates.length}; тегов ${tagsFile.tags.length}`);
    return;
  }

  const policy = policyFromArgv(argv);
  const { transport, kind } = await makeTransport(argv, policy);
  const budget = new LlmBudget(policy);
  const result = await buildBlocks({
    domain,
    candidates,
    tags: tagRecordsOf(candidates, [...tagsFile.tags, ...(candidatesFile.extraTags ?? [])]),
    professionTitles: Object.fromEntries(professions.professions.map((item) => [item.id, item.title])),
    transport,
    policy,
    budget,
    ...(argv.includes("--no-cache") ? {} : { cache: { dir: cacheDir(root) } }),
    existingCatalogTitles: catalog.blocks.map((block) => block.title),
    ...(flagValue(argv, "--limit") ? { limit: Number(flagValue(argv, "--limit")) } : {}),
  });

  const output = path.join(dataDir(root), `blocks-${domain}${suffix}.json`);
  await writeJson(output, {
    domain,
    generatedOn: new Date().toISOString().slice(0, 10),
    writesToGraph: false,
    transport: kind,
    blocks: result.blocks,
    tags: result.tags,
    issues: result.issues,
    runs: result.runs,
    budget: { calls: budget.calls, costUsd: budget.costUsd },
    stats: { blocks: result.blocks.length, tags: result.tags.length, issues: result.issues.length },
  });
  const reviewPath = path.join(dataDir(root), "review", `blocks-${domain}${suffix}.md`);
  await mkdir(path.dirname(reviewPath), { recursive: true });
  await writeFile(reviewPath, renderBlockReview(result.blocks, result.issues), "utf8");

  console.log(
    `Блоков: ${result.blocks.length}; новых тегов: ${result.tags.length}; issues: ${result.issues.length}; вызовов: ${budget.calls}; $${budget.costUsd.toFixed(4)}`,
  );
  console.log(output);
  console.log(reviewPath);
}

/** Блок получает только теги кандидатов; остальные нужны для разрешения evidenceTagIds. */
function tagRecordsOf(candidates: CompetencyCandidate[], tags: TagRecord[]): TagRecord[] {
  const ids = new Set(candidates.flatMap((candidate) => candidate.tagIds));
  return tags.filter((tag) => ids.has(tag.id));
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
