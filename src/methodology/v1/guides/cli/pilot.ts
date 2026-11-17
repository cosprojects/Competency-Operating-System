/**
 * Агент разборов: подробные учебные описания знаний и навыков.
 *
 *   npm run guides:agent -- --profession uxui --limit 50
 *   npm run guides:agent -- --profession uxui --limit 2 --out data/guides/dry-run   # дымовой прогон
 *
 * Требует BRAVE_API_KEY и DEEPSEEK_API_KEY (корневой .env.local).
 *
 * Результаты:
 *   data/guides/<run>/guides.json + report.md  — сырой прогон (в git не коммитится);
 *   src/methodology/v1/guides/content/it.json  — кластер валидных разборов (коммитится).
 *
 * Оптимизация: RU-поиск первым (EN — только если RU не дал источника), кеш поиска,
 * страниц и LLM-ответов в data/guides/.cache, батчи плана запросов по 15 пунктов.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeepSeekTransport } from "../../competency/llm/transport.ts";
import { DEFAULT_LLM_POLICY, LlmBudget, estimateCost, type LlmPolicy } from "../../competency/llm/policy.ts";
import {
  fallbackQueries,
  hostOf,
  isDeniedUrl,
  isTopicRelevant,
  isUsableSource,
  keywordRelevance,
  pickCandidates,
  scoreHit,
  sourceLang,
} from "../plan.ts";
import { parseGuideContent, renderGuideText, validateGuideDoc } from "../validate.ts";
import type {
  FetchedPage,
  GuideCluster,
  GuideClusterItem,
  GuideContent,
  GuideDoc,
  GuideResult,
  GuideSource,
  ItemInput,
  ItemKind,
  SearchHit,
} from "../types.ts";

const ROOT = path.resolve(import.meta.dirname, "../../../../..");
const PROMPT_VERSION = "guides-2";
const UA = "COS-GuidesAgent/0.2 (+https://axiona.world)";
const BRAVE_DELAY_MS = 700;
const CACHE_ROOT = path.join(ROOT, "data/guides/.cache");
const CLUSTER_FILE = path.join(ROOT, "src/methodology/v1/guides/content/it.json");

interface Flags {
  profession: string;
  limit: number;
  out: string;
  maxCostUsd: number;
}

const cacheStats = { braveHits: 0, pageHits: 0, llmHits: 0 };
let braveCalls = 0;

function flagValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

function readFlags(): Flags {
  const argv = process.argv.slice(2);
  const profession = flagValue(argv, "--profession") ?? "uxui";
  const limit = Number(flagValue(argv, "--limit") ?? "50");
  const maxCostUsd = Number(flagValue(argv, "--max-cost") ?? "1.5");
  const date = new Date().toISOString().slice(0, 10);
  const out = flagValue(argv, "--out") ?? path.join("data/guides", `run-${profession}-${date}`);
  return {
    profession,
    limit: Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 50,
    out: path.resolve(ROOT, out),
    maxCostUsd: Number.isFinite(maxCostUsd) ? maxCostUsd : 1.5,
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const hash = (value: string) => createHash("sha1").update(value).digest("hex");

async function readCache<T>(kind: string, key: string): Promise<T | null> {
  try {
    const raw = await readFile(path.join(CACHE_ROOT, kind, `${hash(key)}.json`), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeCache(kind: string, key: string, value: unknown): Promise<void> {
  const dir = path.join(CACHE_ROOT, kind);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${hash(key)}.json`), JSON.stringify(value));
}

/* ------------------------------------------------------------------ */
/* Выборка пунктов                                                     */
/* ------------------------------------------------------------------ */

interface PublicItem {
  id: string;
  title: string;
  definition?: string;
}

interface PublicCompetency {
  id: string;
  title: string;
  knowledge: PublicItem[];
  skills: PublicItem[];
}

interface PublicProfession {
  slug: string;
  sections: Array<{ title: string; competencies: PublicCompetency[] }>;
}

interface PublicContent {
  professions: PublicProfession[];
}

async function loadContent(): Promise<PublicContent> {
  const raw = await readFile(path.join(ROOT, "apps/web/src/content/generated/beta-1.json"), "utf8");
  return JSON.parse(raw) as PublicContent;
}

function interleave(
  knowledge: PublicItem[],
  skills: PublicItem[],
): Array<PublicItem & { kind: ItemKind }> {
  const result: Array<PublicItem & { kind: ItemKind }> = [];
  const max = Math.max(knowledge.length, skills.length);
  for (let index = 0; index < max; index += 1) {
    const known = knowledge[index];
    if (known) result.push({ ...known, kind: "knowledge" });
    const skill = skills[index];
    if (skill) result.push({ ...skill, kind: "skill" });
  }
  return result;
}

/** Уникальные пункты по кругу между компетенциями: покрытие тем и оба типа. */
export function pickItems(profession: PublicProfession, limit: number): ItemInput[] {
  const queues = profession.sections.flatMap((section) =>
    section.competencies.map((competency) => ({
      sectionTitle: section.title,
      competencyTitle: competency.title,
      items: interleave(competency.knowledge, competency.skills),
    })),
  );
  const result: ItemInput[] = [];
  const seen = new Set<string>();
  let round = 0;
  while (result.length < limit) {
    let taken = 0;
    for (const queue of queues) {
      const item = queue.items[round];
      if (!item || seen.has(item.id)) continue;
      seen.add(item.id);
      result.push({
        id: item.id,
        kind: item.kind,
        title: item.title,
        definition: item.definition ?? "",
        competencyTitle: queue.competencyTitle,
        sectionTitle: queue.sectionTitle,
      });
      taken += 1;
      if (result.length >= limit) break;
    }
    if (taken === 0) break;
    round += 1;
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* LLM                                                                 */
/* ------------------------------------------------------------------ */

const QUERY_SYSTEM = [
  "Ты готовишь поисковые запросы для учебного разбора знания или навыка дизайнера.",
  "Верни строго JSON без пояснений: {\"queries\":[{\"id\":\"...\",\"ru\":\"...\",\"en\":\"...\"}]}.",
  "Правила:",
  "- ru — 2–5 слов, сущность + интент («как …», «что такое …», «этапы …»), без кавычек и полного длинного названия;",
  "- en — технический английский термин для поиска документации/статей (2–5 слов);",
  "- не добавляй «курс», «купить», «вакансия», названия сайтов;",
  "- id должен точно совпадать с входным id.",
].join("\n");

const GUIDE_SYSTEM = [
  "Ты методист платформы компетенций AXIONA. Готовишь подробный учебный разбор для знания или навыка дизайнера.",
  "Верни строго JSON без пояснений: {\"status\":\"ok\",\"sections\":[{\"heading\":\"...\",\"text\":\"...\"}]} или {\"status\":\"no_data\"}.",
  "Требования к разбору:",
  "- 3–5 разделов; заголовок 3–6 слов; текст раздела 2–5 предложений (300–1200 символов);",
  "- обязательные разделы по смыслу: что это; зачем в работе дизайнера; как применять (по шагам); пример из источника; на что обратить внимание;",
  "- только факты из текста источника; не добавляй ссылки, цифры, сравнения и рекомендации, которых там нет;",
  "- русский язык, спокойный наставник, без слов «уровень», «оценка», «тест на»;",
  "- если источника недостаточно для трёх содержательных разделов — верни {\"status\":\"no_data\"}.",
].join("\n");

function parseJsonObject(content: string): unknown {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(content.slice(start, end + 1));
  } catch {
    return null;
  }
}

class LlmCaller {
  readonly transport: DeepSeekTransport;
  readonly budget: LlmBudget;
  readonly policy: LlmPolicy;
  calls = 0;
  costUsd = 0;
  tokens = { input: 0, output: 0 };

  constructor(maxCostUsd: number) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("Нет DEEPSEEK_API_KEY");
    this.policy = { ...DEFAULT_LLM_POLICY, maxCallsPerRun: 600, maxCostUsd, maxOutputTokens: 4500 };
    this.transport = new DeepSeekTransport({ apiKey, policy: this.policy, fetchImpl: fetch });
    this.budget = new LlmBudget(this.policy);
  }

  async chat(system: string, user: string, maxTokens: number): Promise<string> {
    this.budget.assertCanCall();
    const response = await this.transport.chat({ system, user, maxTokens, temperature: 0.2 });
    this.calls += 1;
    this.budget.record(response.usage);
    if (response.usage) {
      this.costUsd += estimateCost(response.usage);
      this.tokens.input += response.usage.cacheHitTokens + response.usage.cacheMissTokens;
      this.tokens.output += response.usage.outputTokens;
    }
    return response.content;
  }

  /** Ответ модели с кешем по ключу: повторный прогон не тратит токены. */
  async cachedChat(cacheKey: string, system: string, user: string, maxTokens: number): Promise<string> {
    const cached = await readCache<{ content: string }>("llm", cacheKey);
    if (cached) {
      cacheStats.llmHits += 1;
      return cached.content;
    }
    const content = await this.chat(system, user, maxTokens);
    await writeCache("llm", cacheKey, { content });
    return content;
  }
}

async function planQueries(caller: LlmCaller, items: ItemInput[]): Promise<Map<string, { ru: string; en?: string }>> {
  const planned = new Map<string, { ru: string; en?: string }>();
  const batchSize = 15;
  for (let offset = 0; offset < items.length; offset += batchSize) {
    const batch = items.slice(offset, offset + batchSize);
    const user = JSON.stringify(
      batch.map((item) => ({ id: item.id, title: item.title, kind: item.kind, definition: item.definition })),
    );
    let parsed: unknown = null;
    try {
      const content = await caller.cachedChat(`plan:${PROMPT_VERSION}:${hash(user)}`, QUERY_SYSTEM, user, 3000);
      parsed = parseJsonObject(content);
    } catch (error) {
      console.error("планировщик: ошибка", error instanceof Error ? error.message : error);
    }
    const queries = (parsed as { queries?: unknown } | null)?.queries;
    if (Array.isArray(queries)) {
      for (const raw of queries) {
        const entry = raw as { id?: unknown; ru?: unknown; en?: unknown };
        if (typeof entry.id !== "string" || typeof entry.ru !== "string") continue;
        planned.set(entry.id, {
          ru: entry.ru.trim(),
          ...(typeof entry.en === "string" && entry.en.trim() ? { en: entry.en.trim() } : {}),
        });
      }
    }
    for (const item of batch) if (!planned.has(item.id)) planned.set(item.id, fallbackQueries(item));
    console.error(`запросы: ${Math.min(offset + batchSize, items.length)}/${items.length}`);
  }
  return planned;
}

/* ------------------------------------------------------------------ */
/* Поиск и загрузка                                                    */
/* ------------------------------------------------------------------ */

interface CachedHit {
  title: string;
  url: string;
  description: string;
  language?: string;
}

async function braveSearch(query: string, lang: "ru" | "en", hits: SearchHit[]): Promise<void> {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) throw new Error("Нет BRAVE_API_KEY");
  const cacheKey = `brave:${lang}:${query}`;
  let results = await readCache<CachedHit[]>("brave", cacheKey);
  if (results) {
    cacheStats.braveHits += 1;
  } else {
    const params = new URLSearchParams({ q: query, count: "8", safesearch: "moderate", search_lang: lang });
    const url = `https://api.search.brave.com/res/v1/web/search?${params.toString()}`;
    const headers = { "user-agent": UA, accept: "application/json", "x-subscription-token": apiKey };
    braveCalls += 1;
    let response = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
    if (response.status === 429) {
      await sleep(2_000);
      response = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
    }
    if (!response.ok) {
      console.error(`brave: HTTP ${response.status} на «${query}»`);
      return;
    }
    const body = (await response.json()) as { web?: { results?: CachedHit[] } };
    results = body.web?.results ?? [];
    await writeCache("brave", cacheKey, results);
    await sleep(BRAVE_DELAY_MS);
  }
  results.forEach((result, index) => {
    if (!result.url || !result.title) return;
    const description = result.description ?? "";
    hits.push({
      title: result.title,
      url: result.url,
      description,
      ...(result.language ? { lang: result.language } : {}),
      score: scoreHit({ title: result.title, url: result.url, description, query, queryLang: lang }, index),
      query,
      queryLang: lang,
    });
  });
}

/** Декодирует HTML-сущности в заголовках и названиях источников. */
export function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function cleanHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|section|article|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function pageStats(html: string): Pick<FetchedPage, "chars" | "cyrShare" | "headings"> {
  const text = cleanHtml(html);
  const cyr = (text.match(/[а-яё]/gi) ?? []).length;
  const lat = (text.match(/[a-z]/gi) ?? []).length;
  return {
    chars: text.length,
    cyrShare: cyr + lat ? Math.round((cyr / (cyr + lat)) * 100) / 100 : 0,
    headings: (html.match(/<h[1-3][\s>]/gi) ?? []).length,
  };
}

async function fetchPage(url: string): Promise<FetchedPage> {
  const cacheKey = `page:v2:${url}`;
  const cached = await readCache<FetchedPage>("pages", cacheKey);
  if (cached) {
    cacheStats.pageHits += 1;
    return cached;
  }
  let page: FetchedPage;
  try {
    const response = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(15_000),
      redirect: "follow",
    });
    if (!response.ok) {
      page = { url, title: "", text: "", chars: 0, cyrShare: 0, headings: 0, error: `HTTP ${response.status}` };
    } else {
      const contentType = response.headers.get("content-type") ?? "";
      if (!/text\/html|text\/plain/.test(contentType)) {
        page = { url, title: "", text: "", chars: 0, cyrShare: 0, headings: 0, error: `content-type ${contentType}` };
      } else {
        const html = (await response.text()).slice(0, 800_000);
        const title = decodeEntities((html.match(/<title[^>]*>([^<]*)/i)?.[1] ?? "").trim());
        const text = cleanHtml(html).slice(0, 20_000);
        page = { url, title, text, ...pageStats(html) };
      }
    }
  } catch (error) {
    page = {
      url,
      title: "",
      text: "",
      chars: 0,
      cyrShare: 0,
      headings: 0,
      error: error instanceof Error ? error.message.slice(0, 80) : "ошибка загрузки",
    };
  }
  await writeCache("pages", cacheKey, page);
  return page;
}

/** Ранжирует источники: тематическая релевантность, русский язык, объём, заголовки. */
export function chooseSources(pages: FetchedPage[], item: ItemInput, limit = 2): FetchedPage[] {
  const usable = pages.filter(
    (page) => !page.error && isUsableSource(page) && isTopicRelevant(page, item) && !isDeniedUrl(page.url),
  );
  return usable
    .map((page) => ({
      page,
      score:
        keywordRelevance(page, item) * 3 +
        (sourceLang(page.cyrShare) === "ru" ? 0.4 : 0) +
        (page.headings > 0 ? 0.2 : 0) +
        (page.chars >= 4000 ? 0.2 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.page)
    .slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* Синтез                                                              */
/* ------------------------------------------------------------------ */

function kindLabel(kind: ItemKind): string {
  return kind === "skill" ? "навык" : "знание";
}

function buildGuideUser(item: ItemInput, source: FetchedPage): string {
  const lang = sourceLang(source.cyrShare);
  return [
    `ТЕМА: ${item.title}`,
    `ТИП: ${kindLabel(item.kind)}`,
    `КОМПЕТЕНЦИЯ: ${item.competencyTitle}`,
    `ОПРЕДЕЛЕНИЕ: ${item.definition}`,
    `ИСТОЧНИК (${lang}): ${source.title || source.url} — ${source.url}`,
    lang === "en" ? "Источник на английском: передай смысл на русском, не переводи дословно." : "",
    "",
    "ТЕКСТ ИСТОЧНИКА:",
    source.text.slice(0, 12_000),
  ]
    .filter(Boolean)
    .join("\n");
}

async function synthesize(
  caller: LlmCaller,
  item: ItemInput,
  source: FetchedPage,
): Promise<GuideContent | null> {
  const user = buildGuideUser(item, source);
  const cacheKey = `guide:${PROMPT_VERSION}:${item.id}:${hash(user)}`;
  const raw = await caller.cachedChat(cacheKey, GUIDE_SYSTEM, user, 4500);
  const first = parseGuideContent(raw);
  if (!first) return null;
  if (first.status === "no_data") return first;
  const check = validateGuideDoc(first);
  if (check.ok) return first;
  const repairUser = [
    user,
    "",
    "<validation_errors>",
    check.issues.join("\n"),
    "</validation_errors>",
    "Исправь ответ: верни только JSON нужной структуры, не меняя факты источника.",
  ].join("\n");
  const repaired = await caller.cachedChat(`${cacheKey}:repair`, GUIDE_SYSTEM, repairUser, 4500);
  const second = parseGuideContent(repaired);
  if (!second) return null;
  if (second.status === "no_data") return second;
  return validateGuideDoc(second).ok ? second : null;
}

/* ------------------------------------------------------------------ */
/* Кластер                                                             */
/* ------------------------------------------------------------------ */

async function loadCluster(): Promise<GuideCluster> {
  try {
    const raw = await readFile(CLUSTER_FILE, "utf8");
    return JSON.parse(raw) as GuideCluster;
  } catch {
    return {
      guidesVersion: "1.0.0",
      domain: "it",
      updatedAt: new Date().toISOString().slice(0, 10),
      promptVersion: PROMPT_VERSION,
      items: {},
    };
  }
}

async function saveCluster(cluster: GuideCluster): Promise<void> {
  cluster.updatedAt = new Date().toISOString().slice(0, 10);
  cluster.promptVersion = PROMPT_VERSION;
  await mkdir(path.dirname(CLUSTER_FILE), { recursive: true });
  await writeFile(CLUSTER_FILE, `${JSON.stringify(cluster, null, 2)}\n`);
}

function toClusterItem(result: GuideResult): GuideClusterItem {
  return {
    id: result.item.id,
    title: result.item.title,
    kind: result.item.kind,
    competencyTitle: result.item.competencyTitle,
    sectionTitle: result.item.sectionTitle,
    status: result.status,
    sections: result.guide?.sections ?? [],
    sources: result.sources.map((source) => ({ title: source.title, url: source.url, lang: source.lang })),
    generatedAt: new Date().toISOString().slice(0, 10),
    promptVersion: PROMPT_VERSION,
    review: { status: "auto" },
    ...(result.reason ? { reason: result.reason } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Прогон                                                              */
/* ------------------------------------------------------------------ */

async function runItem(
  caller: LlmCaller,
  item: ItemInput,
  planned: { ru: string; en?: string },
): Promise<GuideResult> {
  const tokensBefore = { ...caller.tokens };
  const costBefore = caller.costUsd;
  const readTokens = () => ({
    input: caller.tokens.input - tokensBefore.input,
    output: caller.tokens.output - tokensBefore.output,
  });
  const readCost = () => Math.round((caller.costUsd - costBefore) * 10000) / 10000;
  const queries = { ru: planned.ru, ...(planned.en ? { en: planned.en } : {}) };

  const fetchCandidates = async (hits: SearchHit[]): Promise<FetchedPage[]> => {
    const candidates = pickCandidates(hits, 5);
    const pages: FetchedPage[] = [];
    for (const candidate of candidates) pages.push(await fetchPage(candidate.url));
    return pages;
  };

  const ruHits: SearchHit[] = [];
  await braveSearch(planned.ru, "ru", ruHits);
  let pages = await fetchCandidates(ruHits);
  let sources = chooseSources(pages, item, 2);
  if (sources.length === 0 && planned.en) {
    const enHits: SearchHit[] = [];
    await braveSearch(planned.en, "en", enHits);
    pages = [...pages, ...(await fetchCandidates(enHits))];
    sources = chooseSources(pages, item, 2);
  }
  // Запасной короткий запрос по сущности: длинная формулировка иногда не находит источник.
  if (sources.length === 0) {
    const fallback = fallbackQueries(item).ru;
    if (fallback !== planned.ru) {
      const extraHits: SearchHit[] = [];
      await braveSearch(fallback, "ru", extraHits);
      pages = [...pages, ...(await fetchCandidates(extraHits))];
      sources = chooseSources(pages, item, 2);
    }
  }
  const sourceEntries = (): GuideSource[] =>
    sources.map((page) => ({
      title: page.title || hostOf(page.url),
      url: page.url,
      host: hostOf(page.url),
      lang: sourceLang(page.cyrShare),
      chars: page.chars,
    }));

  if (sources.length === 0) {
    return {
      item,
      status: "no_data",
      guide: null,
      sources: [],
      queries,
      reason: "нет источника, тематически совпадающего с пунктом (порог релевантности)",
      tokens: readTokens(),
      costUsd: readCost(),
    };
  }

  let lastReason = "источник не дал достаточно материала";
  for (const source of sources) {
    let content: GuideContent | null;
    try {
      content = await synthesize(caller, item, source);
    } catch (error) {
      lastReason = `синтез не удался: ${error instanceof Error ? error.message.slice(0, 120) : "ошибка"}`;
      continue;
    }
    if (!content) {
      lastReason = "ответ модели не прошёл разбор или валидатор";
      continue;
    }
    if (content.status === "no_data") {
      lastReason = "источник признан недостаточным для подробного разбора";
      continue;
    }
    return {
      item,
      status: "ok",
      guide: content,
      sources: sourceEntries(),
      queries,
      tokens: readTokens(),
      costUsd: readCost(),
    };
  }
  return {
    item,
    status: "no_data",
    guide: null,
    sources: sourceEntries(),
    queries,
    reason: lastReason,
    tokens: readTokens(),
    costUsd: readCost(),
  };
}

function renderReport(results: GuideResult[], flags: Flags, caller: LlmCaller, cluster: GuideCluster): string {
  const ok = results.filter((result) => result.status === "ok");
  const noData = results.filter((result) => result.status === "no_data");
  const ru = ok.filter((result) => result.sources[0]?.lang === "ru");
  const en = ok.filter((result) => result.sources[0]?.lang === "en");
  const sectionCounts = ok.map((result) => result.guide?.sections.length ?? 0);
  const chars = ok.map((result) => (result.guide ? renderGuideText(result.guide).length : 0)).sort((a, b) => a - b);
  const avg = (values: number[]) => (values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0);
  const lines: string[] = [];
  lines.push(`# Разборы — ${flags.profession} — ${new Date().toISOString().slice(0, 10)}`);
  lines.push("");
  lines.push(`- пунктов: ${results.length}; с разбором: ${ok.length}; без данных: ${noData.length}`);
  lines.push(`- источник русский: ${ru.length}; английский: ${en.length}`);
  lines.push(
    `- разделов: среднее ${avg(sectionCounts)}; символов: медиана ${chars[Math.floor(chars.length / 2)] ?? "—"}, макс ${chars.at(-1) ?? "—"}`,
  );
  lines.push(`- в кластере всего: ${Object.keys(cluster.items).length} пунктов`);
  lines.push(
    `- Brave: ${braveCalls} запросов (кеш ${cacheStats.braveHits}); страницы: кеш ${cacheStats.pageHits}; LLM: кеш ${cacheStats.llmHits}`,
  );
  lines.push(`- вызовов LLM: ${caller.calls}; токены: вход ${caller.tokens.input}, выход ${caller.tokens.output}`);
  lines.push(`- стоимость LLM: $${caller.costUsd.toFixed(4)}`);
  lines.push("");
  lines.push("| Пункт | Тип | Статус | Разделов | Источник | Ланг |");
  lines.push("|---|---|---|---|---|---|");
  for (const result of results) {
    const source = result.sources[0];
    lines.push(
      `| ${result.item.title} | ${kindLabel(result.item.kind)} | ${result.status} | ${result.guide?.sections.length ?? "—"} | ${source?.host ?? "—"} | ${source?.lang ?? "—"} |`,
    );
  }
  if (noData.length > 0) {
    lines.push("");
    lines.push("## Почему без данных");
    for (const result of noData) lines.push(`- ${result.item.title}: ${result.reason ?? "—"}`);
  }
  const sample = ok[0];
  if (sample?.guide) {
    lines.push("");
    lines.push(`## Пример разбора: ${sample.item.title}`);
    for (const section of sample.guide.sections) lines.push("", `### ${section.heading}`, "", section.text);
    lines.push("");
    lines.push(`Источники: ${sample.sources.map((source) => source.title).join(", ")}`);
  }
  return lines.join("\n");
}

async function main(): Promise<void> {
  const flags = readFlags();
  if (!process.env.BRAVE_API_KEY) throw new Error("Нет BRAVE_API_KEY (корневой .env.local)");
  const content = await loadContent();
  const profession = content.professions.find((item) => item.slug === flags.profession);
  if (!profession) throw new Error(`Профессия ${flags.profession} не найдена в публикации`);
  const items = pickItems(profession, flags.limit);
  console.error(`Пункты: ${items.length} (${profession.slug})`);
  const caller = new LlmCaller(flags.maxCostUsd);
  const planned = await planQueries(caller, items);
  await mkdir(flags.out, { recursive: true });
  const cluster = await loadCluster();
  const results: GuideResult[] = [];
  for (const [index, item] of items.entries()) {
    const query = planned.get(item.id) ?? fallbackQueries(item);
    try {
      const result = await runItem(caller, item, query);
      results.push(result);
      cluster.items[item.id] = toClusterItem(result);
      await saveCluster(cluster);
      console.error(
        `[${index + 1}/${items.length}] ${result.status === "ok" ? "✓" : "—"} ${item.title} (${result.guide?.sections.length ?? 0} разд., ${result.sources[0]?.host ?? "нет источника"})`,
      );
    } catch (error) {
      results.push({
        item,
        status: "no_data",
        guide: null,
        sources: [],
        queries: { ru: query.ru, ...(query.en ? { en: query.en } : {}) },
        reason: `ошибка: ${error instanceof Error ? error.message.slice(0, 120) : "неизвестно"}`,
        tokens: { input: 0, output: 0 },
        costUsd: 0,
      });
      console.error(`[${index + 1}/${items.length}] ✕ ${item.title}: ${error instanceof Error ? error.message : error}`);
    }
    await writeFile(
      path.join(flags.out, "guides.json"),
      JSON.stringify({ flags, braveCalls, cacheStats, results }, null, 2),
    );
  }
  const report = renderReport(results, flags, caller, cluster);
  await writeFile(path.join(flags.out, "report.md"), report);
  console.log(report);
  console.log(
    `\nГотово: ${results.filter((result) => result.status === "ok").length}/${results.length} · $${caller.costUsd.toFixed(4)} · Brave ${braveCalls} (кеш ${cacheStats.braveHits})`,
  );
}

await main();
