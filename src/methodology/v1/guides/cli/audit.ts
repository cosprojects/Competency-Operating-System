/**
 * Аудит качества разборов: насколько текст опирается на источник.
 *
 *   npm run guides:audit
 *   npm run guides:audit -- --min 0.5 --out data/guides/audit-2026-11-18
 *
 * Читает кластер `src/methodology/v1/guides/content/it.json` и кеш страниц
 * `data/guides/.cache/pages` (ключ — `page:v2:<url>`). Сеть не нужна.
 * Метрика и её слои — в `src/methodology/v1/guides/score.ts` (общая с ревью).
 *
 * Отчёт: `data/guides/audit-<date>/report.md` + `audit.json` (в git не коммитятся).
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_MIN,
  ROOT,
  median,
  readCluster,
  scoreItem,
  type AuditEntry,
} from "../score.ts";

function flagValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const min = Number(flagValue(argv, "--min") ?? String(DEFAULT_MIN));
  const date = new Date().toISOString().slice(0, 10);
  const outDir = path.resolve(ROOT, flagValue(argv, "--out") ?? path.join("data/guides", `audit-${date}`));
  const cluster = await readCluster();
  const entries: AuditEntry[] = [];
  for (const item of Object.values(cluster.items)) entries.push(await scoreItem(item, min));

  const ok = entries.filter((entry) => entry.status === "ok");
  const scored = ok.map((entry) => entry.score).filter((score): score is number => score !== null);
  const belowMin = ok.filter((entry) => entry.score !== null && entry.score < min).sort((a, b) => (a.score ?? 0) - (b.score ?? 0));
  const noScore = ok.filter((entry) => entry.score === null);
  const structuralIssues = ok.filter((entry) => entry.structural.length > 0);
  const review = ok.filter((entry) => entry.verdict === "review").sort((a, b) => (a.score ?? 0) - (b.score ?? 0));

  const lines: string[] = [];
  lines.push(`# Аудит разборов — ${date}`);
  lines.push("");
  lines.push(`- пунктов в кластере: ${entries.length}; с разбором: ${ok.length}; без данных: ${entries.length - ok.length}`);
  lines.push(`- источников в кеше страниц: ${entries.flatMap((entry) => entry.sources).filter((source) => source.inCache).length} из ${entries.flatMap((entry) => entry.sources).length}`);
  lines.push(`- привязка к источнику: медиана ${median(scored)}, среднее ${Math.round((scored.reduce((sum, score) => sum + score, 0) / (scored.length || 1)) * 1000) / 1000} (порог ${min})`);
  lines.push(`- ниже порога: ${belowMin.length}; без источника в кеше: ${noScore.length}; структурные замечания: ${structuralIssues.length}`);
  lines.push("");
  lines.push("## Требуют вычитки (низкая привязка к источнику)");
  lines.push("");
  lines.push("| Пункт | Компетенция | Привязка | Источник |");
  lines.push("|---|---|---|---|");
  for (const entry of review.slice(0, 25)) {
    const source = entry.sources.find((candidate) => candidate.inCache) ?? entry.sources[0];
    lines.push(`| ${entry.title} | ${entry.competencyTitle} | ${entry.score ?? "—"} | ${source ? new URL(source.url).host : "—"} |`);
  }
  if (review.length === 0) lines.push("| — | — | — | — |");
  if (structuralIssues.length > 0) {
    lines.push("");
    lines.push("## Структурные замечания");
    lines.push("");
    for (const entry of structuralIssues.slice(0, 20)) lines.push(`- ${entry.title}: ${entry.structural.join("; ")}`);
  }
  if (noScore.length > 0) {
    lines.push("");
    lines.push("## Нет источника в кеше страниц");
    lines.push("");
    for (const entry of noScore.slice(0, 20)) lines.push(`- ${entry.title}: ${entry.sources.map((source) => source.url).join(", ") || "—"}`);
  }
  lines.push("");
  lines.push("## Сводка по компетенциям");
  lines.push("");
  const byCompetency = new Map<string, { total: number; scored: number[] }>();
  for (const entry of ok) {
    const bucket = byCompetency.get(entry.competencyTitle) ?? { total: 0, scored: [] };
    bucket.total += 1;
    if (entry.score !== null) bucket.scored.push(entry.score);
    byCompetency.set(entry.competencyTitle, bucket);
  }
  lines.push("| Компетенция | Пунктов | Медиана привязки |");
  lines.push("|---|---|---|");
  for (const [title, bucket] of [...byCompetency.entries()].sort((a, b) => a[0].localeCompare(b[0], "ru"))) {
    lines.push(`| ${title} | ${bucket.total} | ${median(bucket.scored)} |`);
  }

  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "report.md"), `${lines.join("\n")}\n`);
  await writeFile(
    path.join(outDir, "audit.json"),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), min, summary: { items: entries.length, ok: ok.length, median: median(scored), belowMin: belowMin.length }, entries }, null, 2)}\n`,
  );
  console.log(lines.join("\n"));
  console.log(`\nАудит: ${path.relative(ROOT, path.join(outDir, "report.md"))}`);
}

await main();
