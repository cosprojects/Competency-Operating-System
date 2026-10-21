import path from "node:path";
import type { FetchLike } from "../../candidate-parser/types.ts";
import type { CatalogFile } from "../../competency/types.ts";
import { loadCatalog } from "../../competency/catalog.ts";
import { LlmBudget } from "../../competency/llm/policy.ts";
import { cacheDir, dataDir, flagValue, makeTransport, policyFromArgv, readJson, writeJson } from "../../competency/cli/common.ts";
import { runMaterialAgent, describeAgentReadiness } from "../agent.ts";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const domain = flagValue(argv, "--domain") ?? "it";
  const profession = flagValue(argv, "--profession") ?? "uxui";
  const professionId = profession.includes(".") ? profession : `${domain}.${profession}`;
  const slug = professionId.slice(professionId.indexOf(".") + 1);
  const catalog: CatalogFile = await loadCatalog(root, domain);
  const blocks = catalog.blocks.filter((block) => block.professionIds.includes(professionId));
  if (blocks.length === 0) throw new Error(`В каталоге нет accepted-блоков для ${professionId}`);
  if (argv.includes("--dry-run")) {
    console.log(`dry-run material-agent ${professionId}: ${blocks.length} accepted-блоков`);
    return;
  }
  const limit = flagValue(argv, "--limit");
  const classify = argv.includes("--classify");
  const policy = classify ? policyFromArgv(argv) : undefined;
  const budget = policy ? new LlmBudget(policy) : undefined;
  const transport = classify ? (await makeTransport(argv, policy!)).transport : undefined;
  const fetchImpl: FetchLike = (input, init) => fetch(input, init);
  const journal = await runMaterialAgent({
    domain,
    professionId,
    catalog,
    fetchImpl,
    retrievedOn: new Date().toISOString().slice(0, 10),
    ...(flagValue(argv, "--sources") ? { sourceIds: flagValue(argv, "--sources")!.split(",") } : {}),
    ...(limit ? { limitCompetencies: Number(limit) } : {}),
    ...(flagValue(argv, "--per-competency") ? { limitPerCompetency: Number(flagValue(argv, "--per-competency")) } : {}),
    ...(process.env.YOUTUBE_API_KEY ? { youtubeApiKey: process.env.YOUTUBE_API_KEY } : {}),
    ...(classify ? { classify: true, transport, policy, budget, cache: { dir: cacheDir(root) } } : {}),
  });
  const output = path.join(root, "data", "materials-agent", `${domain}-${slug}.json`);
  await writeJson(output, journal);
  console.log(`Material Agent ${professionId}: ${describeAgentReadiness(journal)}`);
  for (const note of journal.notes) console.log(`  note: ${note}`);
  for (const item of journal.discoveryCoverage) console.log(`  ${item.title}: ${item.materials}`);
  console.log(output);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
