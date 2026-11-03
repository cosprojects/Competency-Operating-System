import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { LlmBudget } from "../llm/policy.ts";
import { cacheDir, flagValue, makeTransport, policyFromArgv } from "./common.ts";
import { runDescriptionAgent } from "../descriptions/agent.ts";

/**
 * Субагент описаний: профессии, компетенции, знания и навыки.
 *
 *   npm run descriptions:agent -- --profession aidesigner            # dry-run, показать before/after
 *   npm run descriptions:agent -- --profession aidesigner --write    # применить
 *   npm run descriptions:agent -- --profession all --write           # раскатка
 *
 * По умолчанию перегенерируются только невалидные описания; --all/--force — все.
 */
async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const scope = flagValue(argv, "--profession") ?? "uxui";
  const professionIds =
    scope === "all"
      ? ["all"]
      : scope.split(",").map((item) => item.trim()).filter(Boolean);
  const write = argv.includes("--write");
  const all = argv.includes("--all") || argv.includes("--force");
  const limit = flagValue(argv, "--limit") ? Number(flagValue(argv, "--limit")) : undefined;
  const date = flagValue(argv, "--date") ?? new Date().toISOString().slice(0, 10);
  const policy = policyFromArgv(argv);
  const { transport, kind } = await makeTransport(argv, policy);
  const budget = new LlmBudget(policy);
  const cache = { dir: cacheDir(root) };

  const viewsDir = path.join(root, "src/methodology/v1/competency/model/professions/views");
  let ids = professionIds;
  if (ids[0] === "all") {
    const { readdir } = await import("node:fs/promises");
    const files = (await readdir(viewsDir)).filter((file) => file.endsWith(".json"));
    ids = files.map((file) => file.replace(/\.json$/, ""));
    if (!ids.includes("uxui")) ids.push("uxui");
  }

  console.log(
    `descriptions:agent: ${ids.length} профессий; режим ${write ? "write" : "dry-run"}; ${all ? "все" : "только невалидные"}; transport ${kind}`,
  );
  const report = await runDescriptionAgent({
    root,
    professionIds: ids,
    all,
    includeAllCompetencies: scope === "all",
    write,
    ...(limit !== undefined && Number.isFinite(limit) ? { limit } : {}),
    transport,
    policy,
    budget,
    cache,
    generatedAt: date,
  });
  const outDir = path.join(root, "data/descriptions");
  await mkdir(outDir, { recursive: true });
  const out = path.join(outDir, `${date}-${scope === "all" ? "all" : ids.join("-")}.json`);
  await writeFile(out, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(
    `descriptions:agent: предложено ${report.suggestions.length}; ошибок ${report.failures.length}; ` +
      `вызовов ${report.budget.calls}; $${report.budget.costUsd.toFixed(4)}`,
  );
  const byEntity = report.suggestions.reduce<Record<string, number>>((acc, item) => {
    acc[item.entity] = (acc[item.entity] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`  ${Object.entries(byEntity).map(([key, value]) => `${key}: ${value}`).join(", ")}`);
  for (const item of report.suggestions.slice(0, 6)) {
    console.log(`  ~ ${item.title}: ${item.after.slice(0, 120)}`);
  }
  for (const item of report.failures.slice(0, 10)) console.log(`  ! ${item.entity} ${item.id}: ${item.reason}`);
  console.log(out);
  if (report.failures.length > 0) process.exitCode = 1;
}
try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
