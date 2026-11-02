import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import type { CompetencyCandidate, TagRecord } from "../types.ts";
import type { TagMappingFile } from "../mapping/types.ts";
import type { ProfessionView } from "../model/profession-view.ts";
import type { CompetenciesFile } from "../model/types.ts";
import { buildBlocks } from "../blocks.ts";
import { loadCatalog } from "../catalog.ts";
import { LlmBudget } from "../llm/policy.ts";
import { cacheDir, dataDir, flagValue, makeTransport, policyFromArgv, readJson, writeJson } from "./common.ts";

interface TagsFile { tags: TagRecord[] }

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const domain = flagValue(argv, "--domain") ?? "it";
  const profession = flagValue(argv, "--profession") ?? "3ddesigner";
  const slug = profession.includes(".") ? profession.split(".").pop()! : profession;
  const professionId = `${domain}.${slug}`;
  const base = path.join(root, "src/methodology/v1/competency");
  const mapping = await readJson<TagMappingFile>(path.join(base, "mapping", `${professionId}.json`));
  const view = await readJson<ProfessionView>(path.join(base, "model/professions/views", `${slug}.json`));
  const competencies = await readJson<CompetenciesFile>(path.join(base, "model/competencies.json"));
  const tagsFile = await readJson<TagsFile>(path.join(dataDir(root), `tags-${domain}-${slug}.json`));
  const catalog = await loadCatalog(root, domain);
  const titleById = new Map(competencies.competencies.map((item) => [item.id, item.title]));
  const definitionById = new Map(competencies.competencies.map((item) => [item.id, item.definition]));
  const tagByTitle = new Map(tagsFile.tags.map((tag) => [tag.title.trim().toLowerCase(), tag]));
  const coveredCanonicalIds = new Set(catalog.blocks.flatMap((block) => block.canonicalIds ?? []));
  const candidates: CompetencyCandidate[] = [];
  for (const entry of mapping.entries) {
    if (coveredCanonicalIds.has(entry.competencyId)) continue;
    const tagIds = entry.tags
      .map((tag) => tagByTitle.get(tag.title.trim().toLowerCase())?.id)
      .filter((id): id is string => Boolean(id));
    if (tagIds.length < 2) continue;
    const title = titleById.get(entry.competencyId) ?? entry.competencyId;
    const definition = definitionById.get(entry.competencyId) ?? "";
    candidates.push({
      id: `mapped-${entry.competencyId}`,
      slug: entry.competencyId,
      title,
      aliases: [],
      definition,
      scopeHint: "profession",
      canonicalId: entry.competencyId,
      tagIds: [...new Set(tagIds)],
      professionIds: [professionId],
      rationale: entry.rationale,
      status: "candidate",
      llmMeta: { promptVersion: "mapping-block-v1", model: "mapping-draft", inputHash: entry.competencyId, costUsd: 0 },
      issues: [],
    });
  }
  if (candidates.length === 0) {
    console.log(`${professionId}: нет компетенций с ≥2 тегами; нечего собирать`);
    return;
  }
  const limit = flagValue(argv, "--limit") ? Number(flagValue(argv, "--limit")) : undefined;
  if (argv.includes("--dry-run")) {
    console.log(`${professionId}: кандидатов ${candidates.length}; тегов ${tagsFile.tags.length}; limit ${limit ?? "all"}`);
    return;
  }
  const policy = policyFromArgv(argv);
  const { transport, kind } = await makeTransport(argv, policy);
  const budget = new LlmBudget(policy);
  const result = await buildBlocks({
    domain,
    candidates,
    tags: tagsFile.tags,
    professionTitles: { [professionId]: view.title },
    transport,
    policy,
    budget,
    ...(argv.includes("--no-cache") ? {} : { cache: { dir: cacheDir(root) } }),
    existingCatalogTitles: catalog.blocks.map((block) => block.title),
    ...(limit ? { limit } : {}),
  });
  const out = path.join(dataDir(root), `blocks-${domain}-${slug}.json`);
  await writeJson(out, {
    domain,
    professionId,
    generatedOn: new Date().toISOString().slice(0, 10),
    writesToGraph: false,
    transport: kind,
    blocks: result.blocks,
    tags: result.tags,
    issues: result.issues,
    runs: result.runs,
    budget: { calls: budget.calls, costUsd: budget.costUsd },
    stats: { candidates: candidates.length, blocks: result.blocks.length, issues: result.issues.length },
  });
  const review = path.join(dataDir(root), "review", `blocks-${domain}-${slug}.md`);
  await mkdir(path.dirname(review), { recursive: true });
  await writeFile(review, result.issues.length ? result.issues.map((issue) => `- ${issue}`).join("\n") + "\n" : "No issues\n", "utf8");
  console.log(`${professionId}: blocks ${result.blocks.length}/${candidates.length}; issues ${result.issues.length}; calls ${budget.calls}; $${budget.costUsd.toFixed(4)}`);
  console.log(out);
}
try { await main(); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exit(1); }
