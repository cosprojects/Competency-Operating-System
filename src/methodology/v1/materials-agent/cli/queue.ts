import path from "node:path";
import type { FetchLike } from "../../candidate-parser/types.ts";
import type { CatalogFile } from "../../competency/types.ts";
import { loadCatalog } from "../../competency/catalog.ts";
import { LlmBudget } from "../../competency/llm/policy.ts";
import { cacheDir, flagValue, makeTransport, policyFromArgv, readJson, writeJson } from "../../competency/cli/common.ts";
import { createMaterialAgentDeps } from "../agent.ts";
import { runMaterialQueue } from "../queue.ts";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const domain = flagValue(argv, "--domain") ?? "it";
  const profession = flagValue(argv, "--profession") ?? "uxui";
  const professionId = profession.includes(".") ? profession : `${domain}.${profession}`;
  const slug = professionId.slice(professionId.indexOf(".") + 1);
  const catalog: CatalogFile = await loadCatalog(root, domain);
  const classify = argv.includes("--classify");
  const policy = classify ? policyFromArgv(argv) : undefined;
  const budget = policy ? new LlmBudget(policy) : undefined;
  const transport = classify ? (await makeTransport(argv, policy!)).transport : undefined;
  const fetchImpl: FetchLike = (input, init) => fetch(input, init);
  const journal = await runMaterialQueue(
    {
      domain,
      professionId,
      catalog,
      fetchImpl,
      retrievedOn: new Date().toISOString().slice(0, 10),
      ...(flagValue(argv, "--sources") ? { sourceIds: flagValue(argv, "--sources")!.split(",") } : {}),
      ...(flagValue(argv, "--limit") ? { limit: Number(flagValue(argv, "--limit")) } : {}),
      ...(flagValue(argv, "--per-competency") ? { limitPerCompetency: Number(flagValue(argv, "--per-competency")) } : {}),
      ...(flagValue(argv, "--concurrency") ? { concurrency: Number(flagValue(argv, "--concurrency")) } : {}),
      ...(flagValue(argv, "--retry") ? { maxAttempts: Number(flagValue(argv, "--retry")) } : {}),
      ...(classify ? { classify: true, transport, policy, budget, cache: { dir: cacheDir(root) } } : {}),
    },
    createMaterialAgentDeps({}),
  );
  const output = path.join(root, "data", "materials-agent", `${domain}-${slug}-queue.json`);
  await writeJson(output, journal);
  console.log(
    `Material Queue ${professionId}: items ${journal.totals.items}; completed ${journal.totals.completed}; failed ${journal.totals.failed}; discovered ${journal.totals.discovered}; linked ${journal.totals.linked}; calls ${journal.totals.calls}; $${journal.totals.costUsd.toFixed(4)}`,
  );
  for (const note of journal.notes.slice(0, 10)) console.log(`  note: ${note}`);
  console.log(output);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
