import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Основной инструмент агрегации ресурсной базы по профессиям.
 *
 * Один прогон: источники (Brave/журналы) → реестр и связи → модель → review → gate/сборка.
 *
 *   # план без изменений
 *   npm run aggregate -- --profession all
 *
 *   # применить: взять сохранённые журналы прогона (Brave не тратится)
 *   npm run aggregate -- --profession all --write
 *
 *   # заново сходить в Brave и сразу записать
 *   npm run aggregate -- --profession motion,uxui --fetch --write
 *
 *   # только источники для одной профессии, без release-сборки
 *   npm run aggregate -- --profession motion --write --no-release
 *
 * Журналы: data/learning-sources/expansion-<slug>-<date>.json
 * Отчёт: data/aggregation/aggregate-<scope>-<date>.json
 */

function flagValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

function run(command: string, args: string[]): void {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit", cwd: process.cwd() });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} завершился с кодом ${result.status ?? "null"}`);
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const domain = flagValue(argv, "--domain") ?? "it";
  const scope = flagValue(argv, "--profession") ?? "all";
  const date = flagValue(argv, "--date") ?? "2026-11-03";
  const release = flagValue(argv, "--release") ?? "beta-1";
  const write = argv.includes("--write");
  const fetchSources = argv.includes("--fetch");
  const noRelease = argv.includes("--no-release");
  const noDescriptions = argv.includes("--no-descriptions");

  const viewsDir = path.join(root, "src/methodology/v1/competency/model/professions/views");
  const views = fs.readdirSync(viewsDir).filter((file) => file.endsWith(".json")).map((file) => file.replace(/\.json$/, ""));
  const professions = scope === "all" ? views : scope.split(",").map((item) => item.trim()).filter(Boolean);
  for (const slug of professions) {
    if (!views.includes(slug)) throw new Error(`Неизвестная профессия: ${slug}. Доступны: ${views.join(", ")}`);
  }

  console.log(`aggregate: domain=${domain}; профессий ${professions.length}; write=${write}; fetch=${fetchSources}; date=${date}`);
  if (!write) {
    console.log("dry-run: покажу план. Для записи добавь --write.");
  }

  const sources = professions.map((slug) => {
    const journal = path.join(root, "data/learning-sources", `expansion-${slug}-${date}.json`);
    return { slug, journal, hasJournal: fs.existsSync(journal) };
  });

  if (fetchSources) {
    for (const item of sources) {
      if (!write) {
        console.log(`plan: sources:expand ${item.slug} (Brave) — запись журнала/реестра`);
        continue;
      }
      run("npm", ["run", "sources:expand", "--", "--profession", item.slug, "--provider", "brave", "--per-competency", "2", "--classify", "--write", "--audit", "--review-decisions", "--max-calls", "150"]);
    }
  } else {
    for (const item of sources) {
      if (!item.hasJournal) {
        console.log(`skip sources: ${item.slug} — нет журнала ${path.relative(root, item.journal)} (нужен --fetch)`);
        continue;
      }
      if (!write) {
        console.log(`plan: sources:expand ${item.slug} --from-journal ${path.relative(root, item.journal)}`);
        continue;
      }
      run("npm", ["run", "sources:expand", "--", "--profession", item.slug, "--from-journal", path.relative(root, item.journal), "--write", "--audit", "--review-decisions"]);
    }
  }

  if (!write) {
    console.log("\nplan: sources:repair → model:sync → descriptions:agent → reviews:decide → learning:map/aggregate → release:validate/build:draft");
    return;
  }

  run("npm", ["run", "sources:repair", "--", "--write"]);
  run("npm", ["run", "model:sync", "--", "--domain", domain, "--profession", "uxui", "--write"]);
  if (!noDescriptions) {
    run("npm", ["run", "descriptions:agent", "--", "--profession", scope === "all" ? "all" : professions.join(","), "--write", "--budget-usd", "0.5"]);
  }
  run("npm", ["run", "reviews:decide", "--", "--release", release, "--write"]);
  run("npm", ["run", "learning:map"]);
  run("npm", ["run", "learning:aggregate"]);

  if (!noRelease) {
    run("npm", ["run", "release:validate", "--", "--release", release]);
    run("npm", ["run", "release:build:draft"]);
  }

  const registry = JSON.parse(fs.readFileSync(path.join(root, "src/methodology/v1/learning-sources/registry.json"), "utf8"));
  const links = JSON.parse(fs.readFileSync(path.join(root, "src/methodology/v1/competency/model/learning-source-links.json"), "utf8"));
  const report = {
    generatedAt: new Date().toISOString(),
    domain,
    scope: professions,
    date,
    sourceMode: fetchSources ? "brave" : "journals",
    registry: {
      sources: registry.sources.length,
      active: registry.sources.filter((source: { status: string }) => source.status === "active").length,
      auto: registry.sources.filter((source: { discoveredBy?: string }) => source.discoveredBy === "search").length,
    },
    links: links.links.reduce((sum: number, link: { sourceIds: string[] }) => sum + link.sourceIds.length, 0),
    release,
    releaseBuilt: !noRelease,
    descriptions: !noDescriptions,
  };
  const outDir = path.join(root, "data/aggregation");
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `aggregate-${scope === "all" ? "all" : professions.join("-")}-${date}.json`);
  fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`\naggregate: готово; отчёт ${path.relative(root, out)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
