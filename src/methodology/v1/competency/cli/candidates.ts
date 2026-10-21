import path from "node:path";
import type { CompetencyCandidate, ProfessionRecord, TagRecord } from "../types.ts";
import { buildCandidates } from "../candidates.ts";
import { loadCatalog } from "../catalog.ts";
import { LlmBudget } from "../llm/policy.ts";
import { renderCandidateReview } from "../render.ts";
import { cacheDir, dataDir, flagValue, makeTransport, policyFromArgv, readJson, writeJson } from "./common.ts";

interface TagsFile {
  domain: string;
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
  const base = flagValue(argv, "--tags-file") ?? path.join(dataDir(root), profession ? `tags-${domain}-${profession}.json` : `tags-${domain}.json`);
  const tagsFile = await readJson<TagsFile>(base);
  const professions = await readJson<ProfessionsFile>(
    path.join(dataDir(root), `professions-${domain}.json`),
  );
  const catalog = await loadCatalog(root, domain);
  const professionTitles = Object.fromEntries(professions.professions.map((item) => [item.id, item.title]));
  const tags = profession
    ? tagsFile.tags.filter((tag) => tag.professionIds.includes(`${domain}.${profession}`))
    : tagsFile.tags;
  const eligible = tags.filter((tag) => tag.kind === "knowledge" || tag.kind === "skill");
  const batches = Math.ceil(eligible.length / 20);

  if (argv.includes("--dry-run")) {
    const byKind = eligible.reduce<Record<string, number>>((acc, tag) => {
      acc[tag.kind] = (acc[tag.kind] ?? 0) + 1;
      return acc;
    }, {});
    console.log(`dry-run: тегов ${eligible.length} (${JSON.stringify(byKind)}), батчей ${batches}`);
    return;
  }

  const policy = policyFromArgv(argv);
  const { transport, kind } = await makeTransport(argv, policy);
  const budget = new LlmBudget(policy);
  const result = await buildCandidates({
    domain,
    tags,
    professionTitles,
    transport,
    policy,
    budget,
    ...(argv.includes("--no-cache") ? {} : { cache: { dir: cacheDir(root) } }),
    existingCatalogTitles: catalog.blocks.map((block) => block.title),
    ...(flagValue(argv, "--limit-batches") ? { limitBatches: Number(flagValue(argv, "--limit-batches")) } : {}),
  });

  const suffix = profession ? `-${profession}` : "";
  const output = path.join(dataDir(root), `candidates-${domain}${suffix}.json`);
  await writeJson(output, {
    domain,
    generatedOn: new Date().toISOString().slice(0, 10),
    writesToGraph: false,
    transport: kind,
    candidates: result.candidates,
    unassignedTagIds: result.unassignedTagIds,
    issues: result.issues,
    runs: result.runs,
    budget: { calls: budget.calls, costUsd: budget.costUsd },
    stats: {
      tags: eligible.length,
      candidates: result.candidates.length,
      unassigned: result.unassignedTagIds.length,
    },
  });
  const reviewPath = path.join(dataDir(root), "review", `candidates-${domain}${suffix}.md`);
  await writeJson(`${reviewPath}.json`, { candidates: result.candidates, unassigned: result.unassignedTagIds });
  await import("node:fs/promises").then(({ mkdir, writeFile }) =>
    mkdir(path.dirname(reviewPath), { recursive: true }).then(() =>
      writeFile(reviewPath, renderCandidateReview(result.candidates as CompetencyCandidate[], result.unassignedTagIds), "utf8"),
    ),
  );

  console.log(
    `Кандидатов: ${result.candidates.length}; неназначено: ${result.unassignedTagIds.length}; issues: ${result.issues.length}; вызовов: ${budget.calls}; $${budget.costUsd.toFixed(4)}`,
  );
  console.log(output);
  console.log(reviewPath);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
