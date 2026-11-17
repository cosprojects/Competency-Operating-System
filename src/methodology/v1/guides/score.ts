/**
 * Оценка привязки разбора к источнику — общая логика аудита и ревью.
 *
 * Считает, насколько текст разбора опирается на найденный источник: числа,
 * латинские термины и значимые слова, которые встречаются в тексте страницы.
 * Для английских источников слой русских слов пропускается (иначе оценка ложно падает).
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderGuideText, validateGuideDoc } from "./validate.ts";
import type { GuideCluster, GuideClusterItem } from "./types.ts";

export const ROOT = path.resolve(import.meta.dirname, "../../../..");
export const CLUSTER_FILE = path.join(ROOT, "src/methodology/v1/guides/content/it.json");
export const PAGE_CACHE = path.join(ROOT, "data/guides/.cache/pages");
export const DEFAULT_MIN = 0.6;

export const hash = (value: string) => createHash("sha1").update(value).digest("hex");
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Кластер пишется после каждого пункта: читаем с повтором, если файл в момент записи. */
export async function readCluster(): Promise<GuideCluster> {
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

export interface CachedPageText {
  text: string;
  lang: "ru" | "en";
}

export async function readCachedPage(url: string): Promise<CachedPageText | null> {
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

const STOP_WORDS = new Set([
  "который", "которая", "которые", "чтобы", "поэтому", "например", "также", "тогда", "между",
  "нужно", "можно", "будет", "только", "потому", "вместе", "всегда", "важно", "стоит", "через",
  "этого", "этому", "этот", "этом", "также", "когда", "более", "менее", "после", "перед", "очень",
  "почему", "какой", "такой", "свой", "свои", "если", "или", "для", "при", "над", "под", "без",
  "это", "как", "чем", "что", "где", "там", "тут", "уже", "ещё", "еще", "них", "него", "нее",
]);

function significantWords(text: string): string[] {
  return [
    ...new Set(
      (text.toLowerCase().match(/[а-яё]{6,}/g) ?? [])
        .filter((word) => !STOP_WORDS.has(word))
        .map((word) => word.slice(0, 6)),
    ),
  ];
}

/** Доля проверяемых единиц разбора, которые находятся в тексте источника. */
function overlapScore(units: string[], haystack: string): number | null {
  if (units.length === 0) return null;
  const hits = units.filter((unit) => haystack.includes(unit)).length;
  return Math.round((hits / units.length) * 1000) / 1000;
}

export interface SourceCheck {
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

export async function scoreItem(item: GuideClusterItem, min = DEFAULT_MIN): Promise<AuditEntry> {
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

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round(((sorted[middle - 1]! + sorted[middle]!) / 2) * 1000) / 1000 : sorted[middle]!;
}
