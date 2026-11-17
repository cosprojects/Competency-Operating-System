/**
 * Ревью разборов: фактчек текста по источнику (LLM-редактор) + выборка и отчёт.
 *
 *   npm run guides:review
 *   npm run guides:review -- --sample 0.2 --concurrency 4 --max-cost 1.5
 *   npm run guides:review -- --limit 10 --out data/guides/review-smoke
 *
 * Что проверяется на каждом пункте: каждое фактическое утверждение есть в тексте источника,
 * нет обобщений и сравнений «от себя», нет ссылок/оценок уровня, разбор про тему пункта.
 *
 * В выборку попадают: детерминированная доля всех разборов (по умолчанию 20%), все пункты
 * с низкой привязкой к источнику (аудит), все разборы по английскому источнику.
 *
 * Результат: `data/guides/review-<date>/review.json` + `report.md` (в git не коммитятся).
 * Ревью не меняет кластер: `review.status` остаётся `auto`, пока разбор не прочитал человек.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeepSeekTransport } from "../../competency/llm/transport.ts";
import { DEFAULT_LLM_POLICY, LlmBudget, estimateCost } from "../../competency/llm/policy.ts";
import { renderGuideText } from "../validate.ts";
import {
  DEFAULT_MIN,
  ROOT,
  hash,
  readCachedPage,
  readCluster,
  scoreItem,
  type AuditEntry,
} from "../score.ts";
import type { GuideClusterItem } from "../types.ts";

const REVIEW_PROMPT_VERSION = "review-2";
const LLM_CACHE = path.join(ROOT, "data/guides/.cache/llm");
const MAX_SOURCE_CHARS = 12_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function flagValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

async function readCache(key: string): Promise<string | null> {
  try {
    const raw = await readFile(path.join(LLM_CACHE, `${hash(key)}.json`), "utf8");
    const value = JSON.parse(raw) as { content?: unknown };
    return typeof value.content === "string" ? value.content : null;
  } catch {
    return null;
  }
}

async function writeCache(key: string, content: string): Promise<void> {
  await mkdir(LLM_CACHE, { recursive: true });
  await writeFile(path.join(LLM_CACHE, `${hash(key)}.json`), JSON.stringify({ content }));
}

const REVIEW_SYSTEM = [
  "Ты — редактор-фактчекер учебных разборов платформы компетенций AXIONA.",
  "На вход: знание/навык, текст разбора и текст источника (страницы, по которой писался разбор).",
  "Проверь разбор:",
  "1) каждое фактическое утверждение (термины, числа, шаги, названия, примеры) должно быть в тексте источника;",
  "2) нет обобщений, сравнений, цифр и рекомендаций, которых в источнике нет;",
  "3) нет ссылок, оценок уровня, обещаний «тест»/«оценка»;",
  "4) разбор про тему пункта, а не про соседнюю тему;",
  "5) нет противоречий внутри разбора.",
  "Верни строго JSON без пояснений:",
  '{"verdict":"pass"|"fix"|"reject","confidence":0..1,',
  '"issues":[{"section":"заголовок раздела","claim":"утверждение из разбора","problem":"что не так","severity":"high"|"medium"|"low"}],',
  '"summary":"1–2 предложения вывода"}',
  "verdict: pass — можно публиковать; fix — есть неточности, нужна правка; reject — разбор не по теме или выдуман.",
  "Если источник обрывочный, но разбор ему не противоречит — pass с низким confidence, без выдуманных претензий.",
].join("\n");

interface ReviewIssue {
  section: string;
  claim: string;
  problem: string;
  severity: "high" | "medium" | "low";
}

interface ReviewResult {
  id: string;
  title: string;
  competencyTitle: string;
  auditScore: number | null;
  reason: string;
  verdict: "pass" | "fix" | "reject" | "error";
  confidence: number;
  issues: ReviewIssue[];
  summary: string;
  costUsd: number;
}

class Reviewer {
  readonly transport: DeepSeekTransport;
  readonly budget: LlmBudget;
  calls = 0;
  costUsd = 0;
  cacheHits = 0;

  constructor(maxCostUsd: number, maxCalls: number) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("Нет DEEPSEEK_API_KEY (корневой .env.local)");
    const policy = { ...DEFAULT_LLM_POLICY, maxCallsPerRun: maxCalls, maxCostUsd, maxOutputTokens: 2500 };
    this.transport = new DeepSeekTransport({ apiKey, policy, fetchImpl: fetch });
    this.budget = new LlmBudget(policy);
  }

  async ask(cacheKey: string, user: string): Promise<string> {
    const cached = await readCache(cacheKey);
    if (cached !== null) {
      this.cacheHits += 1;
      return cached;
    }
    this.budget.assertCanCall();
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        // Бюджет 4500: у модели reasoning съедает часть max_tokens, при 2500 content бывает пустым.
        const response = await this.transport.chat({ system: REVIEW_SYSTEM, user, maxTokens: 4500, temperature: 0.1 });
        this.calls += 1;
        this.budget.record(response.usage);
        if (response.usage) this.costUsd += estimateCost(response.usage);
        const content = response.content.trim();
        if (content.length === 0) throw new Error("пустой ответ модели");
        await writeCache(cacheKey, content);
        return content;
      } catch (error) {
        lastError = error;
        if (attempt < 3) await sleep(1_500 * (attempt + 1));
      }
    }
    throw lastError instanceof Error ? lastError : new Error("DeepSeek: неизвестная ошибка");
  }
}

function parseReview(raw: string): { verdict: ReviewResult["verdict"]; confidence: number; issues: ReviewIssue[]; summary: string } | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  const data = parsed as { verdict?: unknown; confidence?: unknown; issues?: unknown; summary?: unknown };
  const verdict =
    data.verdict === "pass" || data.verdict === "fix" || data.verdict === "reject" ? data.verdict : "fix";
  const confidence = typeof data.confidence === "number" ? Math.max(0, Math.min(1, data.confidence)) : 0.5;
  const issues: ReviewIssue[] = [];
  if (Array.isArray(data.issues)) {
    for (const entry of data.issues) {
      const issue = entry as { section?: unknown; claim?: unknown; problem?: unknown; severity?: unknown };
      if (typeof issue.problem !== "string" || !issue.problem.trim()) continue;
      const severity = issue.severity === "high" || issue.severity === "medium" ? issue.severity : "low";
      issues.push({
        section: typeof issue.section === "string" ? issue.section : "",
        claim: typeof issue.claim === "string" ? issue.claim : "",
        problem: issue.problem.trim(),
        severity,
      });
    }
  }
  return { verdict, confidence, issues, summary: typeof data.summary === "string" ? data.summary.trim() : "" };
}

async function buildUserPrompt(item: GuideClusterItem, audit: AuditEntry | null): Promise<string> {
  const guide = renderGuideText({ status: "ok", sections: item.sections });
  const parts: string[] = [
    `ПУНКТ: ${item.title}`,
    `ТИП: ${item.kind === "knowledge" ? "знание" : "навык"}`,
    `КОМПЕТЕНЦИЯ: ${item.competencyTitle}`,
    "",
    "РАЗБОР:",
    guide,
    "",
  ];
  // Сначала источник с лучшей привязкой, затем второй (если есть).
  const ranked = (audit?.sources ?? []).slice().sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const urls = item.sources.map((source) => source.url);
  const ordered = ranked.length > 0 ? ranked.map((entry) => entry.url) : urls;
  let index = 0;
  for (const url of ordered.slice(0, 2)) {
    const page = await readCachedPage(url);
    if (!page) continue;
    index += 1;
    parts.push(`ИСТОЧНИК ${index} (${url}):`, page.text.slice(0, MAX_SOURCE_CHARS), "");
  }
  if (index === 0) parts.push("ИСТОЧНИК: текст страницы недоступен (только название/URL из кластера).", "");
  return parts.join("\n");
}

interface Selection {
  item: GuideClusterItem;
  audit: AuditEntry | null;
  reasons: string[];
}

function selectForReview(
  items: GuideClusterItem[],
  audits: Map<string, AuditEntry>,
  options: { sample: number; min: number; limit: number | null },
): Selection[] {
  const ok = items
    .filter((item) => item.status === "ok")
    .sort((a, b) => a.id.localeCompare(b.id));
  const selected = new Map<string, Selection>();
  const add = (item: GuideClusterItem, reason: string) => {
    const entry = selected.get(item.id) ?? { item, audit: audits.get(item.id) ?? null, reasons: [] };
    if (!entry.reasons.includes(reason)) entry.reasons.push(reason);
    selected.set(item.id, entry);
  };

  if (options.sample > 0 && ok.length > 0) {
    const step = Math.max(1, Math.round(1 / Math.min(1, options.sample)));
    for (let index = 0; index < ok.length; index += step) {
      const item = ok[index];
      if (item) add(item, `выборка ${Math.round(Math.min(1, options.sample) * 100)}%`);
    }
  }
  for (const item of ok) {
    const audit = audits.get(item.id);
    if (audit?.score !== null && audit?.score !== undefined && audit.score < options.min) add(item, "низкая привязка");
    if (item.sources[0]?.lang === "en") add(item, "EN-источник");
  }

  const result = [...selected.values()].sort((a, b) => a.item.id.localeCompare(b.item.id));
  return options.limit ? result.slice(0, options.limit) : result;
}

function countBy<T extends string>(values: T[]): Record<T, number> {
  const result = {} as Record<T, number>;
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const sampleRaw = Number(flagValue(argv, "--sample") ?? "0.2");
  const sample = Number.isFinite(sampleRaw) ? Math.max(0, Math.min(1, sampleRaw)) : 0.2;
  const min = Number(flagValue(argv, "--min") ?? String(DEFAULT_MIN));
  const concurrency = Math.max(1, Math.min(8, Number(flagValue(argv, "--concurrency") ?? "4")));
  const itemsRaw = flagValue(argv, "--items");
  const wanted = itemsRaw ? new Set(itemsRaw.split(",").map((id) => id.trim()).filter(Boolean)) : null;
  const limitRaw = Number(flagValue(argv, "--limit") ?? "");
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : null;
  const maxCostUsd = Number(flagValue(argv, "--max-cost") ?? "1.5");
  const date = new Date().toISOString().slice(0, 10);
  const outDir = path.resolve(
    ROOT,
    flagValue(argv, "--out") ?? path.join("data/guides", wanted ? `review-items-${date}` : `review-${date}`),
  );

  const cluster = await readCluster();
  const items = Object.values(cluster.items);
  const audits = new Map<string, AuditEntry>();
  for (const item of items) audits.set(item.id, await scoreItem(item, min));

  const selection = wanted
    ? items
        .filter((item) => item.status === "ok" && wanted.has(item.id))
        .map((item) => ({ item, audit: audits.get(item.id) ?? null, reasons: ["точечная переработка"] }))
    : selectForReview(items, audits, { sample, min, limit });
  if (selection.length === 0) {
    console.log("Нет пунктов для ревью.");
    return;
  }
  console.error(
    `guides:review: к проверке ${selection.length} из ${items.filter((item) => item.status === "ok").length} разборов; ` +
      `concurrency ${concurrency}; стоимость до $${maxCostUsd}`,
  );

  const reviewer = new Reviewer(maxCostUsd, Math.max(200, selection.length * 2));
  const results: ReviewResult[] = new Array(selection.length);
  let cursor = 0;
  let done = 0;
  const startedAt = Date.now();

  const worker = async (): Promise<void> => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= selection.length) return;
      const entry = selection[index];
      if (!entry) return;
      const user = await buildUserPrompt(entry.item, entry.audit);
      const cacheKey = `review:${REVIEW_PROMPT_VERSION}:${entry.item.id}:${hash(user)}`;
      let result: ReviewResult;
      try {
        let raw = await reviewer.ask(cacheKey, user);
        let parsed = parseReview(raw);
        if (!parsed) {
          // Модель вернула не-JSON: просим исправить ответ (вне кеша первого шага).
          const repairUser = [
            user,
            "",
            "<answer>",
            raw.slice(0, 4_000),
            "</answer>",
            "Верни только JSON по схеме из системных инструкций, без пояснений.",
          ].join("\n");
          raw = await reviewer.ask(`${cacheKey}:repair`, repairUser);
          parsed = parseReview(raw);
        }
        result = {
          id: entry.item.id,
          title: entry.item.title,
          competencyTitle: entry.item.competencyTitle,
          auditScore: entry.audit?.score ?? null,
          reason: entry.reasons.join(", "),
          verdict: parsed?.verdict ?? "error",
          confidence: parsed?.confidence ?? 0,
          issues: parsed?.issues ?? [],
          summary: parsed?.summary ?? "",
          costUsd: 0,
        };
      } catch (error) {
        result = {
          id: entry.item.id,
          title: entry.item.title,
          competencyTitle: entry.item.competencyTitle,
          auditScore: entry.audit?.score ?? null,
          reason: entry.reasons.join(", "),
          verdict: "error",
          confidence: 0,
          issues: [],
          summary: error instanceof Error ? error.message.slice(0, 160) : "ошибка",
          costUsd: 0,
        };
      }
      results[index] = result;
      done += 1;
      const elapsed = Math.round((Date.now() - startedAt) / 1000);
      console.error(
        `[review ${done}/${selection.length}] ${result.verdict === "pass" ? "✓" : result.verdict === "fix" ? "!" : "✕"} ` +
          `${entry.item.title} (${result.verdict}, ${result.issues.length} зам., ${elapsed}s)`,
      );
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, selection.length) }, () => worker()));
  const finished = results.filter((result) => result !== undefined);

  const verdicts = countBy(finished.map((result) => result.verdict));
  const severities = countBy(finished.flatMap((result) => result.issues.map((issue) => issue.severity)));
  const issuesByProblem = new Map<string, number>();
  for (const issue of finished.flatMap((result) => result.issues)) {
    const key = issue.problem.length > 120 ? `${issue.problem.slice(0, 117)}…` : issue.problem;
    issuesByProblem.set(key, (issuesByProblem.get(key) ?? 0) + 1);
  }
  const problematic = finished
    .filter((result) => result.verdict === "fix" || result.verdict === "reject" || result.verdict === "error")
    .sort((a, b) => {
      const rank = (verdict: ReviewResult["verdict"]) => (verdict === "reject" ? 0 : verdict === "error" ? 1 : 2);
      return rank(a.verdict) - rank(b.verdict) || (a.confidence - b.confidence);
    });

  const lines: string[] = [];
  lines.push(`# Ревью разборов — ${date}`);
  lines.push("");
  lines.push(`- проверено: **${finished.length}** из ${items.filter((item) => item.status === "ok").length} разборов`);
  const reasons = countBy(finished.flatMap((result) => result.reason.split(", ")));
  lines.push(`- почему в выборке: ${Object.entries(reasons).map(([reason, count]) => `${reason} — ${count}`).join("; ")}`);
  lines.push(
    `- вердикты: pass ${verdicts.pass ?? 0}, fix ${verdicts.fix ?? 0}, reject ${verdicts.reject ?? 0}, ошибок ${verdicts.error ?? 0}`,
  );
  lines.push(`- замечания по важности: high ${severities.high ?? 0}, medium ${severities.medium ?? 0}, low ${severities.low ?? 0}`);
  lines.push(`- стоимость LLM: $${reviewer.costUsd.toFixed(4)}; вызовов ${reviewer.calls}; из кеша ${reviewer.cacheHits}`);
  lines.push("");
  if (problematic.length === 0) {
    lines.push("## Требуют правки");
    lines.push("");
    lines.push("Нет: все проверенные разборы прошли фактчек.");
  } else {
    lines.push("## Требуют правки");
    lines.push("");
    lines.push("| Пункт | Компетенция | Вердикт | Замечаний | Главное замечание |");
    lines.push("|---|---|---|---|---|");
    for (const result of problematic) {
      const first = result.issues[0];
      lines.push(
        `| ${result.title} | ${result.competencyTitle} | ${result.verdict} | ${result.issues.length} | ${first ? first.problem.replace(/\|/g, "/").slice(0, 120) : result.summary.slice(0, 120)} |`,
      );
    }
  }
  if (issuesByProblem.size > 0) {
    lines.push("");
    lines.push("## Частые замечания");
    lines.push("");
    for (const [problem, count] of [...issuesByProblem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
      lines.push(`- ${problem} — ${count}`);
    }
  }
  const samples = finished.filter((result) => result.verdict === "pass" && result.summary).slice(0, 5);
  if (samples.length > 0) {
    lines.push("");
    lines.push("## Выборочные выводы ok");
    lines.push("");
    for (const result of samples) lines.push(`- ${result.title}: ${result.summary}`);
  }

  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "report.md"), `${lines.join("\n")}\n`);
  await writeFile(
    path.join(outDir, "review.json"),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        promptVersion: REVIEW_PROMPT_VERSION,
        sample,
        min,
        summary: { checked: finished.length, verdicts, severities, costUsd: reviewer.costUsd },
        results: finished,
      },
      null,
      2,
    )}\n`,
  );
  console.log(lines.join("\n"));
  console.log(`\nРевью: ${path.relative(ROOT, path.join(outDir, "report.md"))}`);
}

await main();
