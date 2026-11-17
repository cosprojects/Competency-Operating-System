/**
 * Аудит качества разборов: насколько текст опирается на источник.
 *
 *   npm run guides:audit
 *   npm run guides:audit -- --min 0.5 --out data/guides/audit-2026-11-18
 *
 * Читает кластер `src/methodology/v1/guides/content/it.json` и кеш страниц
 * `data/guides/.cache/pages` (ключ — `page:v2:<url>`). Сеть не нужна.
 *
 * Метрика привязки к источнику (0…1) считается по трём слоям, которые легко
 * проверить автоматически: числа, латинские термины и значимые слова разбора,
 * встречающиеся в тексте источника. Это не литературная правка, а сигнал:
 * что и где стоит вычитать руками.
 *
 * Отчёт: `data/guides/audit-<date>/report.md` + `audit.json` (в git не коммитятся).
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderGuideText, validateGuideDoc } from "../validate.ts";
import type { GuideCluster, GuideClusterItem } from "../types.ts";

const ROOT = path.resolve(import.meta.dirname, "../../../../..");
const CLUSTER_FILE = path.join(ROOT, "src/methodology/v1/guides/content/it.json");
const PAGE_CACHE = path.join(ROOT, "data/guides/.cache/pages");
const DEFAULT_MIN = 0.6;

const hash = (value: string) => createHash("sha1").update(value).digest("hex");
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function flagValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

/** Кластер пишется после каждого пункта: читаем с повтором, если файл в момент записи. */
async function readCluster(): Promise<GuideCluster> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return JSON.parse(await readFile(CLUSTER_FILE, "utf8")) as GuideCluster;
    } catch (error) {
      lastError = error;
      await sleep(150 * (attempt + 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("не удалось прочитать кластер");
}

interface CachedPageText {
  text: string;
  lang: "ru" | "en";
}

async function readCachedPage(url: string): Promise<CachedPageText | null> {
  try {
    const raw = await readFile(path.join(PAGE_CACHE, `${hash(`page:v2:${url}`)}.json`), "utf8");
    const page = JSON.parse(raw) as { text?: unknown; cyrShare?: unknown };
    if (typeof page.text !== "string") return null;
    const cyr = (page.text.match(/[а-яё]/gi) ?? []).length;
    const lat = (page.text.match(/[a-z]/gi) ?? []).length;
    const cyrShare = typeof page.cyrShare === "number" ? page.cyrShare : cyr / (cyr + lat || 1);
    return { text: page.text, lang: cyrShare > 0.5 ? "ru" : "en" };
  } catch {
    return null;
  }
}

function numbers(text: string): string[] {
  return (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((value) => value.replace(",", "."));
}

function latinTerms(text: string): string[] {
  return [...new Set((text.match(/[A-Za-z][A-Za-z0-9.+#-]{2,}/g) ?? []).map((value) => value.toLowerCase()))];
}

function significantWords(text: string): string[] {
  const stop = new Set([
    "который", "которая", "которые", "чтобы", "поэтому", "например", "также", "тогда", "между",
    "нужно", "можно", "будет", "только", "потому", "вместе", "всегда", "важно", "стоит", "через",
    "этого", "этому", "этот", "этом", "также", "когда", "более", "менее", "после", "перед", "очень",
    "почему", "какой", "такой", "свой", "свои", "если", "или", "для", "при", "над", "под", "без",
    "это", "как", "чем", "что", "где", "там", "тут", "уже", "ещё", "еще", "них", "него", "нее",
  ]);
  return [
    ...new Set(
      (text.toLowerCase().match(/[а-яё]{6,}/g) ?? []).filter((word) => !stop.has(word)).map((word) => word.slice(0, 6)),
    ),
  ];
}

/** Доля проверяемых единиц разбора, которые находятся в тексте источника. */
function overlapScore(units: string[], haystack: string): number | null {
  if (units.length === 0) return null;
  const hits = units.filter((unit) => haystack.includes(unit)).length;
  return Math.round((hits / units.length) * 1000) / 1000;
}

interface SourceCheck {
  url: string;
  inCache: boolean;
  lang: "ru" | "en" | null;
  score: number | null;
  numbersScore: number | null;
  latinScore: number | null;
  wordsScore: number | null;
}

export interface AuditEntry {
  id: string;
  title: string;
  status: "ok" | "no_data";
  competencyTitle: string;
  sections: number;
  chars: number;
  structural: string[];
  sources: SourceCheck[];
  score: number | null;
  verdict: "ok" | "watch" | "review" | "no_data";
}

async function auditItem(item: GuideClusterItem, min: number): Promise<AuditEntry> {
  const text = item.sections.length > 0 ? renderGuideText({ status: "ok", sections: item.sections }) : "";
  const structural = item.status === "ok" ? validateGuideDoc({ status: "ok", sections: item.sections }).issues : [];
  const guideNumbers = numbers(text);
  const guideLatin = latinTerms(text);
  const guideWords = significantWords(text);

  const sources: SourceCheck[] = [];
  for (const source of item.sources) {
    const page = await readCachedPage(source.url);
    if (page === null) {
      sources.push({ url: source.url, inCache: false, lang: null, score: null, numbersScore: null, latinScore: null, wordsScore: null });
      continue;
    }
    const haystack = page.text.toLowerCase();
    const numbersScore = overlapScore(guideNumbers, haystack);
    const latinScore = overlapScore(guideLatin, haystack);
    // Русские слова разбора не встречаются в английском источнике: слой нечестен и пропускается.
    const wordsScore = page.lang === "ru" ? overlapScore(guideWords, haystack) : null;
    const layers: Array<{ score: number; weight: number }> = [];
    if (numbersScore !== null) layers.push({ score: numbersScore, weight: 0.4 });
    if (latinScore !== null) layers.push({ score: latinScore, weight: 0.2 });
    if (wordsScore !== null) layers.push({ score: wordsScore, weight: 0.4 });
    const weight = layers.reduce((sum, layer) => sum + layer.weight, 0);
    const score = weight > 0 ? Math.round((layers.reduce((sum, layer) => sum + layer.score * layer.weight, 0) / weight) * 1000) / 1000 : null;
    sources.push({ url: source.url, inCache: true, lang: page.lang, score, numbersScore, latinScore, wordsScore });
  }
  const scored = sources.map((source) => source.score).filter((score): score is number => score !== null);
  const score = scored.length > 0 ? Math.max(...scored) : null;
  const verdict: AuditEntry["verdict"] =
    item.status === "no_data" ? "no_data" : score === null ? "watch" : score >= min + 0.2 ? "ok" : score >= min ? "watch" : "review";
  return {
    id: item.id,
    title: item.title,
    status: item.status,
    competencyTitle: item.competencyTitle,
    sections: item.sections.length,
    chars: text.length,
    structural,
    sources,
    score,
    verdict,
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round(((sorted[middle - 1]! + sorted[middle]!) / 2) * 1000) / 1000 : sorted[middle]!;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const min = Number(flagValue(argv, "--min") ?? String(DEFAULT_MIN));
  const date = new Date().toISOString().slice(0, 10);
  const outDir = path.resolve(ROOT, flagValue(argv, "--out") ?? path.join("data/guides", `audit-${date}`));
  const cluster = await readCluster();
  const entries: AuditEntry[] = [];
  for (const item of Object.values(cluster.items)) entries.push(await auditItem(item, min));

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
