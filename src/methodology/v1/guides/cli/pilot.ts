/**
 * Агент разборов: подробные учебные описания знаний и навыков.
 *
 *   npm run guides:agent -- --profession uxui --limit 50
 *   npm run guides:agent -- --profession uxui --all --skip-existing --concurrency 4
 *   npm run guides:agent -- --profession all --all --skip-existing --concurrency 4
 *   npm run guides:agent -- --profession uxui --limit 2 --out data/guides/dry-run   # дымовой прогон
 *
 * Требует BRAVE_API_KEY и DEEPSEEK_API_KEY (корневой .env.local — npm-скрипт читает его сам).
 *
 * Результаты:
 *   data/guides/<run>/<profession>/guides.json + report.md — сырой прогон (в git не коммитится);
 *   data/guides/<run>/summary.md — сводка по профессиям;
 *   src/methodology/v1/guides/content/it.json — кластер валидных разборов (коммитится).
 *
 * Оптимизация: RU-поиск первым (EN — только если RU не дал источника), кеш поиска,
 * страниц и LLM-ответов в data/guides/.cache, батчи плана запросов по 15 пунктов,
 * `--skip-existing` не пересобирает готовые пункты, `--concurrency` ведёт несколько
 * пунктов параллельно (запись кластера сериализуется, чтобы файл не терял данные).
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeepSeekTransport } from "../../competency/llm/transport.ts";
import {
  BudgetExceededError,
  DEFAULT_LLM_POLICY,
  LlmBudget,
  estimateCost,
  type LlmPolicy,
} from "../../competency/llm/policy.ts";
import type { TokenUsage } from "../../ai-guardrails.ts";
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
import {
  pickItems,
  professionOrder,
  type PublicContent,
  type PublicProfession,
} from "../items.ts";
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
const UA = "COS-GuidesAgent/0.3 (+https://axiona.world)";
const BRAVE_DELAY_MS = 700;
const CACHE_ROOT = path.join(ROOT, "data/guides/.cache");
const CLUSTER_FILE = path.join(ROOT, "src/methodology/v1/guides/content/it.json");
const LLM_RETRIES = 3;

interface Flags {
  profession: string;
  limit: number;
  all: boolean;
  skipExisting: boolean;
  retryNoData: boolean;
  items: string[] | null;
  concurrency: number;
  out: string;
  maxCostUsd: number;
}

interface LlmMeter {
  calls: number;
  costUsd: number;
  input: number;
  output: number;
}

interface CacheSnapshot {
  braveHits: number;
  pageHits: number;
  llmHits: number;
}

const cacheStats: CacheSnapshot = { braveHits: 0, pageHits: 0, llmHits: 0 };
let braveCalls = 0;

function flagValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

function readFlags(): Flags {
  const argv = process.argv.slice(2);
  const all = argv.includes("--all");
  const retryNoData = argv.includes("--retry-no-data");
  const itemsRaw = flagValue(argv, "--items");
  const items = itemsRaw ? itemsRaw.split(",").map((id) => id.trim()).filter(Boolean) : null;
  const profession = flagValue(argv, "--profession") ?? "uxui";
  const rawLimit = Number(flagValue(argv, "--limit") ?? "50");
  const limit =
    all || !Number.isFinite(rawLimit) || rawLimit <= 0 ? (all ? Number.POSITIVE_INFINITY : 50) : Math.floor(rawLimit);
  const rawConcurrency = Number(flagValue(argv, "--concurrency") ?? "1");
  const concurrency = Math.min(8, Math.max(1, Number.isFinite(rawConcurrency) ? Math.floor(rawConcurrency) : 1));
  const maxCostUsd = Number(flagValue(argv, "--max-cost") ?? "1.5");
  const scope = profession === "all" ? "all" : profession;
  const date = new Date().toISOString().slice(0, 10);
  const out =
    flagValue(argv, "--out") ??
    path.join("data/guides", `${items ? "rework" : retryNoData ? "retry" : "run"}-${scope}-${date}`);
  return {
    profession,
    limit,
    all,
    skipExisting: argv.includes("--skip-existing"),
    retryNoData,
    items,
    concurrency,
    out: path.resolve(ROOT, out),
    maxCostUsd: Number.isFinite(maxCostUsd) && maxCostUsd > 0 ? maxCostUsd : 1.5,
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const hash = (value: string) => createHash("sha1").update(value).digest("hex");

function isBudgetError(error: unknown): boolean {
  return error instanceof BudgetExceededError || (error instanceof Error && error.name === "BudgetExceededError");
}

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
/* Публикация                                                          */
/* ------------------------------------------------------------------ */

async function loadContent(): Promise<PublicContent> {
  const raw = await readFile(path.join(ROOT, "apps/web/src/content/generated/beta-1.json"), "utf8");
  return JSON.parse(raw) as PublicContent;
}

function selectProfessions(content: PublicContent, scope: string): PublicProfession[] {
  const slugs = scope === "all" ? professionOrder(content.professions) : [scope];
  return slugs.map((slug) => {
    const profession = content.professions.find((item) => item.slug === slug);
    if (!profession) throw new Error(`Профессия ${slug} не найдена в публикации`);
    return profession;
  });
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

interface LlmReply {
  content: string;
  costUsd: number;
  tokens: { input: number; output: number };
}

class LlmCaller {
  readonly transport: DeepSeekTransport;
  readonly budget: LlmBudget;
  readonly policy: LlmPolicy;
  calls = 0;
  costUsd = 0;
  tokens = { input: 0, output: 0 };

  constructor(maxCostUsd: number, maxCalls = 600) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("Нет DEEPSEEK_API_KEY");
    this.policy = { ...DEFAULT_LLM_POLICY, maxCallsPerRun: maxCalls, maxCostUsd, maxOutputTokens: 4500 };
    this.transport = new DeepSeekTransport({ apiKey, policy: this.policy, fetchImpl: fetch });
    this.budget = new LlmBudget(this.policy);
  }

  meter(): LlmMeter {
    return { calls: this.calls, costUsd: this.costUsd, input: this.tokens.input, output: this.tokens.output };
  }

  private record(usage: TokenUsage | undefined): LlmReply["tokens"] & { costUsd: number } {
    if (!usage) return { input: 0, output: 0, costUsd: 0 };
    const input = usage.cacheHitTokens + usage.cacheMissTokens;
    const costUsd = estimateCost(usage);
    this.calls += 1;
    this.budget.record(usage);
    this.costUsd += costUsd;
    this.tokens.input += input;
    this.tokens.output += usage.outputTokens;
    return { input, output: usage.outputTokens, costUsd };
  }

  /** Запрос с повтором на сетевых ошибках и 429: длинный прогон не должен терять пункты. */
  async chat(system: string, user: string, maxTokens: number): Promise<LlmReply> {
    this.budget.assertCanCall();
    let lastError: unknown = null;
    for (let attempt = 0; attempt < LLM_RETRIES; attempt += 1) {
      try {
        const response = await this.transport.chat({ system, user, maxTokens, temperature: 0.2 });
        const recorded = this.record(response.usage);
        return { content: response.content, costUsd: recorded.costUsd, tokens: { input: recorded.input, output: recorded.output } };
      } catch (error) {
        lastError = error;
        if (isBudgetError(error)) throw error;
        if (attempt < LLM_RETRIES - 1) await sleep(1_500 * (attempt + 1));
      }
    }
    throw lastError instanceof Error ? lastError : new Error("DeepSeek: неизвестная ошибка");
  }

  /** Ответ модели с кешем по ключу: повторный прогон не тратит токены. */
  async cachedChat(cacheKey: string, system: string, user: string, maxTokens: number): Promise<LlmReply> {
    const cached = await readCache<{ content: string }>("llm", cacheKey);
    if (cached) {
      cacheStats.llmHits += 1;
      return { content: cached.content, costUsd: 0, tokens: { input: 0, output: 0 } };
    }
    const reply = await this.chat(system, user, maxTokens);
    await writeCache("llm", cacheKey, { content: reply.content });
    return reply;
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
      parsed = parseJsonObject(content.content);
    } catch (error) {
      if (isBudgetError(error)) throw error;
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

interface SynthesisResult {
  content: GuideContent | null;
  costUsd: number;
  tokens: { input: number; output: number };
}

async function synthesize(caller: LlmCaller, item: ItemInput, source: FetchedPage): Promise<SynthesisResult> {
  const user = buildGuideUser(item, source);
  const cacheKey = `guide:${PROMPT_VERSION}:${item.id}:${hash(user)}`;
  const first = await caller.cachedChat(cacheKey, GUIDE_SYSTEM, user, 4500);
  let costUsd = first.costUsd;
  const tokens = { ...first.tokens };
  const parsed = parseGuideContent(first.content);
  if (!parsed) return { content: null, costUsd, tokens };
  if (parsed.status === "no_data") return { content: parsed, costUsd, tokens };
  const check = validateGuideDoc(parsed);
  if (check.ok) return { content: parsed, costUsd, tokens };
  const repairUser = [
    user,
    "",
    "<validation_errors>",
    check.issues.join("\n"),
    "</validation_errors>",
    "Исправь ответ: верни только JSON нужной структуры, не меняя факты источника.",
  ].join("\n");
  const repaired = await caller.cachedChat(`${cacheKey}:repair`, GUIDE_SYSTEM, repairUser, 4500);
  costUsd += repaired.costUsd;
  tokens.input += repaired.tokens.input;
  tokens.output += repaired.tokens.output;
  const second = parseGuideContent(repaired.content);
  if (!second) return { content: null, costUsd, tokens };
  if (second.status === "no_data") return { content: second, costUsd, tokens };
  return { content: validateGuideDoc(second).ok ? second : null, costUsd, tokens };
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
/* Прогон пункта                                                       */
/* ------------------------------------------------------------------ */

type RunMode = "normal" | "retry";

interface SearchStage {
  query: string;
  lang: "ru" | "en";
}

/**
 * Каскад поисковых запросов.
 * Обычный проход: RU → EN → запасная короткая сущность (EN и запасной — только если RU не дал источника).
 * Повторный проход по `no_data`: EN первым (для API/MCP/Git русских разборов мало), затем короткая
 * сущность без служебных слов, затем исходный запрос — и на каждом шаге пробуем синтез заново.
 */
function queryCascade(item: ItemInput, planned: { ru: string; en?: string }, mode: RunMode): SearchStage[] {
  const stages: SearchStage[] = [];
  const push = (query: string | undefined, lang: "ru" | "en") => {
    if (!query) return;
    if (stages.some((stage) => stage.query === query && stage.lang === lang)) return;
    stages.push({ query, lang });
  };
  const fallback = fallbackQueries(item).ru;
  if (mode === "retry") {
    push(planned.en, "en");
    push(fallback, "ru");
    push(planned.ru, "ru");
    return stages;
  }
  push(planned.ru, "ru");
  push(planned.en, "en");
  push(fallback, "ru");
  return stages;
}

function sourceEntries(sources: FetchedPage[]): GuideSource[] {
  return sources.map((page) => ({
    title: page.title || hostOf(page.url),
    url: page.url,
    host: hostOf(page.url),
    lang: sourceLang(page.cyrShare),
    chars: page.chars,
  }));
}

async function runItem(
  caller: LlmCaller,
  item: ItemInput,
  planned: { ru: string; en?: string },
  mode: RunMode = "normal",
): Promise<GuideResult> {
  const queries = { ru: planned.ru, ...(planned.en ? { en: planned.en } : {}) };
  let tokens = { input: 0, output: 0 };
  let costUsd = 0;
  const candidateLimit = mode === "retry" ? 8 : 5;
  const sourceLimit = mode === "retry" ? 3 : 2;

  const fetchCandidates = async (hits: SearchHit[]): Promise<FetchedPage[]> => {
    const candidates = pickCandidates(hits, candidateLimit);
    const pages: FetchedPage[] = [];
    for (const candidate of candidates) pages.push(await fetchPage(candidate.url));
    return pages;
  };

  let discovered: FetchedPage[] = [];
  let lastReason = "нет источника, тематически совпадающего с пунктом (порог релевантности)";

  for (const stage of queryCascade(item, planned, mode)) {
    const hits: SearchHit[] = [];
    await braveSearch(stage.query, stage.lang, hits);
    const sources = chooseSources(await fetchCandidates(hits), item, sourceLimit);
    if (sources.length === 0) continue;
    discovered = sources;
    for (const source of sources) {
      let synthesis: SynthesisResult;
      try {
        synthesis = await synthesize(caller, item, source);
      } catch (error) {
        if (isBudgetError(error)) throw error;
        lastReason = `синтез не удался: ${error instanceof Error ? error.message.slice(0, 120) : "ошибка"}`;
        continue;
      }
      tokens = { input: tokens.input + synthesis.tokens.input, output: tokens.output + synthesis.tokens.output };
      costUsd += synthesis.costUsd;
      if (!synthesis.content) {
        lastReason = "ответ модели не прошёл разбор или валидатор";
        continue;
      }
      if (synthesis.content.status === "no_data") {
        lastReason = "источник признан недостаточным для подробного разбора";
        continue;
      }
      return {
        item,
        status: "ok",
        guide: synthesis.content,
        sources: sourceEntries(sources),
        queries,
        tokens,
        costUsd,
      };
    }
    // Обычный проход: найденные источники исчерпаны — дальше не ищем (так было и раньше).
    if (mode === "normal") break;
  }

  return {
    item,
    status: "no_data",
    guide: null,
    sources: sourceEntries(discovered),
    queries,
    reason: lastReason,
    tokens,
    costUsd,
  };
}

/* ------------------------------------------------------------------ */
/* Прогон профессии: пул воркеров + сериализованная запись кластера    */
/* ------------------------------------------------------------------ */

interface ProfessionRun {
  results: GuideResult[];
  fatal: Error | null;
  seconds: number;
}

async function runProfession(
  caller: LlmCaller,
  items: ItemInput[],
  planned: Map<string, { ru: string; en?: string }>,
  flags: Flags,
  cluster: GuideCluster,
): Promise<ProfessionRun> {
  const results: GuideResult[] = new Array(items.length);
  const startedAt = Date.now();
  let cursor = 0;
  let done = 0;
  let fatal: Error | null = null;
  let saveChain: Promise<void> = Promise.resolve();
  const enqueueSave = () => {
    saveChain = saveChain.then(() => saveCluster(cluster));
  };

  const worker = async (): Promise<void> => {
    while (!fatal) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      const item = items[index];
      if (!item) return;
      const query = planned.get(item.id) ?? fallbackQueries(item);
      const mode: RunMode = flags.retryNoData || flags.items ? "retry" : "normal";
      let result: GuideResult;
      try {
        result = await runItem(caller, item, query, mode);
      } catch (error) {
        if (isBudgetError(error)) {
          fatal = error instanceof Error ? error : new Error("бюджет LLM исчерпан");
          return;
        }
        result = {
          item,
          status: "no_data",
          guide: null,
          sources: [],
          queries: { ru: query.ru, ...(query.en ? { en: query.en } : {}) },
          reason: `ошибка: ${error instanceof Error ? error.message.slice(0, 120) : "неизвестно"}`,
          tokens: { input: 0, output: 0 },
          costUsd: 0,
        };
      }
      results[index] = result;
      // Повторный проход не затирает прежний no_data-пункт неудачей: обновляем только если разбор получился.
      if (!((flags.retryNoData || flags.items) && result.status !== "ok" && cluster.items[item.id])) {
        cluster.items[item.id] = toClusterItem(result);
      }
      enqueueSave();
      done += 1;
      const elapsed = (Date.now() - startedAt) / 1000;
      const rate = done / elapsed;
      const etaSeconds = rate > 0 ? Math.round((items.length - done) / rate) : 0;
      console.error(
        `[${flags.profession} ${done}/${items.length}] ${result.status === "ok" ? "✓" : "—"} ${item.title} ` +
          `(${result.guide?.sections.length ?? 0} разд., ${result.sources[0]?.host ?? "нет источника"}) ` +
          `${Math.round(elapsed)}s, осталось ~${Math.round(etaSeconds / 60)} мин`,
      );
    }
  };

  await Promise.all(Array.from({ length: Math.min(flags.concurrency, items.length) }, () => worker()));
  await saveChain;
  return { results: results.filter((result) => result !== undefined), fatal, seconds: Math.round((Date.now() - startedAt) / 1000) };
}

/* ------------------------------------------------------------------ */
/* Отчёты                                                              */
/* ------------------------------------------------------------------ */

interface RunTotals {
  braveCalls: number;
  cache: CacheSnapshot;
  llm: LlmMeter;
}

function meterDelta(before: LlmMeter, after: LlmMeter): LlmMeter {
  return {
    calls: after.calls - before.calls,
    costUsd: Math.round((after.costUsd - before.costUsd) * 10000) / 10000,
    input: after.input - before.input,
    output: after.output - before.output,
  };
}

function renderReport(results: GuideResult[], slug: string, totals: RunTotals, clusterCount: number): string {
  const ok = results.filter((result) => result.status === "ok");
  const noData = results.filter((result) => result.status === "no_data");
  const ru = ok.filter((result) => result.sources[0]?.lang === "ru");
  const en = ok.filter((result) => result.sources[0]?.lang === "en");
  const sectionCounts = ok.map((result) => result.guide?.sections.length ?? 0);
  const chars = ok.map((result) => (result.guide ? renderGuideText(result.guide).length : 0)).sort((a, b) => a - b);
  const avg = (values: number[]) => (values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0);
  const lines: string[] = [];
  lines.push(`# Разборы — ${slug} — ${new Date().toISOString().slice(0, 10)}`);
  lines.push("");
  lines.push(`- пунктов: ${results.length}; с разбором: ${ok.length}; без данных: ${noData.length}`);
  lines.push(`- источник русский: ${ru.length}; английский: ${en.length}`);
  lines.push(
    `- разделов: среднее ${avg(sectionCounts)}; символов: медиана ${chars[Math.floor(chars.length / 2)] ?? "—"}, макс ${chars.at(-1) ?? "—"}`,
  );
  lines.push(`- в кластере всего: ${clusterCount} пунктов`);
  lines.push(
    `- Brave: ${totals.braveCalls} запросов (кеш ${totals.cache.braveHits}); страницы: кеш ${totals.cache.pageHits}; LLM: кеш ${totals.cache.llmHits}`,
  );
  lines.push(`- вызовов LLM: ${totals.llm.calls}; токены: вход ${totals.llm.input}, выход ${totals.llm.output}`);
  lines.push(`- стоимость LLM: $${totals.llm.costUsd.toFixed(4)}`);
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

interface SummaryRow {
  slug: string;
  planned: number;
  ok: number;
  noData: number;
  ru: number;
  costUsd: number;
  braveCalls: number;
  seconds: number;
}

function renderSummary(scope: string, rows: SummaryRow[], clusterCount: number, seconds: number): string {
  const sum = rows.reduce(
    (acc, row) => ({
      planned: acc.planned + row.planned,
      ok: acc.ok + row.ok,
      noData: acc.noData + row.noData,
      ru: acc.ru + row.ru,
      costUsd: acc.costUsd + row.costUsd,
      braveCalls: acc.braveCalls + row.braveCalls,
    }),
    { planned: 0, ok: 0, noData: 0, ru: 0, costUsd: 0, braveCalls: 0 },
  );
  const lines: string[] = [];
  lines.push(`# Разборы — ${scope} — ${new Date().toISOString().slice(0, 10)}`);
  lines.push("");
  lines.push(
    `- профессий: ${rows.length}; пунктов: ${sum.planned}; с разбором: ${sum.ok}; без данных: ${sum.noData}`,
  );
  lines.push(`- в кластере всего: ${clusterCount} пунктов`);
  lines.push(`- стоимость LLM: $${sum.costUsd.toFixed(4)}; Brave: ${sum.braveCalls} новых запросов`);
  lines.push(`- время прогона: ${Math.round(seconds / 60)} мин`);
  lines.push("");
  lines.push("| Профессия | Пунктов | С разбором | Без данных | RU | LLM, $ | Brave | Время |");
  lines.push("|---|---|---|---|---|---|---|---|");
  for (const row of rows) {
    lines.push(
      `| ${row.slug} | ${row.planned} | ${row.ok} | ${row.noData} | ${row.ru} | ${row.costUsd.toFixed(4)} | ${row.braveCalls} | ${Math.round(row.seconds / 60)} мин |`,
    );
  }
  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  const flags = readFlags();
  if (!process.env.BRAVE_API_KEY) throw new Error("Нет BRAVE_API_KEY (корневой .env.local)");
  if (!process.env.DEEPSEEK_API_KEY) throw new Error("Нет DEEPSEEK_API_KEY (корневой .env.local)");

  const content = await loadContent();
  const professions = selectProfessions(content, flags.profession);
  const cluster = await loadCluster();
  const covered = (id: string) => Boolean(cluster.items[id]);
  const selectedLimit = flags.limit;
  const wanted = flags.items ? new Set(flags.items) : null;
  const selection = professions
    .map((profession) => ({
      profession,
      items: wanted
        ? pickItems(profession, Number.POSITIVE_INFINITY).filter((item) => wanted.has(item.id))
        : pickItems(profession, selectedLimit, (id) => {
            if (flags.retryNoData) return cluster.items[id]?.status !== "no_data";
            return flags.skipExisting ? covered(id) : false;
          }),
    }))
    .filter((entry) => entry.items.length > 0);
  const totalSelected = selection.reduce((sum, entry) => sum + entry.items.length, 0);

  const already = Object.keys(cluster.items).length;
  console.error(
    `guides:agent: профессий ${professions.length}; пунктов по плану ${totalSelected}; ` +
      `concurrency ${flags.concurrency}; ` +
      (flags.items
        ? `точечная переработка ${flags.items.length} пунктов (в кластере ${already}); `
        : flags.retryNoData
        ? `повторный проход по no_data (в кластере ${already}); `
        : `${flags.skipExisting ? "готовые и общие для профессий пункты пропускаются; " : ""}в кластере ${already}`),
  );
  if (totalSelected === 0) {
    console.log(
      flags.retryNoData ? "Нечего делать: в кластере нет пунктов со статусом no_data." : "Нечего делать: все выбранные пункты уже в кластере.",
    );
    return;
  }

  const caller = new LlmCaller(flags.maxCostUsd, Math.max(600, Math.ceil(totalSelected * 3)));
  await mkdir(flags.out, { recursive: true });
  const startedAt = Date.now();
  const rows: SummaryRow[] = [];
  let fatal: Error | null = null;

  for (const entry of selection) {
    const profession = entry.profession;
    // Пересчитываем на входе в профессию: предыдущие профессии могли закрыть общие пункты.
    const items = flags.items
      ? entry.items
      : flags.retryNoData
        ? entry.items.filter((item) => cluster.items[item.id]?.status === "no_data")
        : flags.skipExisting
          ? entry.items.filter((item) => !cluster.items[item.id])
          : entry.items;
    if (items.length === 0) {
      console.error(`[${profession.slug}] всё уже в кластере — пропуск`);
      rows.push({ slug: profession.slug, planned: 0, ok: 0, noData: 0, ru: 0, costUsd: 0, braveCalls: 0, seconds: 0 });
      continue;
    }
    const before = {
      brave: braveCalls,
      cache: { ...cacheStats },
      meter: caller.meter(),
      time: Date.now(),
    };
    console.error(`[${profession.slug}] старт: ${items.length} пунктов`);
    try {
      const planned = await planQueries(caller, items);
      const run = await runProfession(caller, items, planned, { ...flags, profession: profession.slug }, cluster);
      const meter = meterDelta(before.meter, caller.meter());
      const totals: RunTotals = {
        braveCalls: braveCalls - before.brave,
        cache: {
          braveHits: cacheStats.braveHits - before.cache.braveHits,
          pageHits: cacheStats.pageHits - before.cache.pageHits,
          llmHits: cacheStats.llmHits - before.cache.llmHits,
        },
        llm: meter,
      };
      const ok = run.results.filter((result) => result.status === "ok").length;
      const noData = run.results.length - ok;
      const ru = run.results.filter((result) => result.status === "ok" && result.sources[0]?.lang === "ru").length;

      const dir = path.join(flags.out, profession.slug);
      await mkdir(dir, { recursive: true });
      await writeFile(
        path.join(dir, "guides.json"),
        `${JSON.stringify(
          {
            flags: { ...flags, profession: profession.slug, limit: flags.all ? "all" : flags.limit },
            totals,
            results: run.results,
          },
          null,
          2,
        )}\n`,
      );
      const report = renderReport(run.results, profession.slug, totals, Object.keys(cluster.items).length);
      await writeFile(path.join(dir, "report.md"), report);

      rows.push({
        slug: profession.slug,
        planned: run.results.length,
        ok,
        noData,
        ru,
        costUsd: meter.costUsd,
        braveCalls: totals.braveCalls,
        seconds: run.seconds,
      });
      console.error(
        `[${profession.slug}] готово: ${ok}/${run.results.length} с разбором, $${meter.costUsd.toFixed(4)}, ` +
          `${Math.round(run.seconds / 60)} мин`,
      );
      if (run.fatal) {
        fatal = run.fatal;
        break;
      }
    } catch (error) {
      fatal = error instanceof Error ? error : new Error("прогон прерван");
      console.error(`[${profession.slug}] прервано: ${fatal.message}`);
      break;
    }
  }

  const summary = renderSummary(flags.profession, rows, Object.keys(cluster.items).length, (Date.now() - startedAt) / 1000);
  await writeFile(path.join(flags.out, "summary.md"), summary);
  console.log(summary);
  if (fatal) {
    console.error(`\nПрогон прерван: ${fatal.message}. Кластер сохранён, продолжить: --skip-existing`);
    process.exitCode = 1;
  }
}

await main();
