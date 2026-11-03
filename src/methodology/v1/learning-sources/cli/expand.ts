import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { LearningSourceRegistry } from "../types.ts";
import type { SourceCandidate } from "../discovery/types.ts";
import type { FetchLike } from "../../candidate-parser/types.ts";
import { GoogleCustomSearchProvider } from "../search.ts";
import { loadCompetencyContexts, queriesForContext } from "../discovery/context.ts";
import { buildCandidates, isBannedCandidateTitle } from "../discovery/candidates.ts";
import { promoteCandidates } from "../discovery/promote.ts";
import { discoverWithWikipedia, type RawProviderHit } from "../discovery/wikipedia.ts";
import { discoverWithGithub } from "../discovery/github.ts";
import { discoverWithYoutube } from "../discovery/youtube.ts";
import { discoverWithBrave } from "../discovery/brave.ts";
import { cacheDir, flagValue, makeTransport, policyFromArgv } from "../../competency/cli/common.ts";
import { LlmBudget } from "../../competency/llm/policy.ts";
import { reviewSourceCandidates } from "../discovery/review.ts";

function fetchLike(fetchImpl: typeof fetch): FetchLike {
  return (input, init) => fetchImpl(input, init as RequestInit);
}

async function googleCandidates(
  fetchImpl: typeof fetch,
  contexts: Awaited<ReturnType<typeof loadCompetencyContexts>>,
  limit: number,
): Promise<RawProviderHit[]> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_CX;
  if (!apiKey || !cx) throw new Error("Для --provider google нужны GOOGLE_CSE_API_KEY и GOOGLE_CSE_CX");
  const provider = new GoogleCustomSearchProvider(apiKey, cx);
  const hits: RawProviderHit[] = [];
  for (const context of contexts) {
    for (const query of queriesForContext(context)) {
      const results = await provider.search(query.query, limit).catch(() => []);
      for (const result of results) {
        hits.push({
          url: result.url,
          title: result.title,
          ...(result.snippet ? { snippet: result.snippet } : {}),
          provider: "google-cse",
          competencyId: context.competencyId,
          competencyTitle: context.title,
          query: query.query,
          language: query.language,
        });
      }
    }
  }
  return hits;
}

/**
 * Автоматическое расширение ресурсной базы: официальные API → нормализация и скоринг
 * → реестр (dry-run по умолчанию).
 *
 *   npm run sources:expand -- --profession motion --per-competency 2
 *   npm run sources:expand -- --profession motion --write --audit --review-decisions
 */
async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const domain = flagValue(argv, "--domain") ?? "it";
  const profession = flagValue(argv, "--profession") ?? "uxui";
  const slug = profession.includes(".") ? profession.slice(profession.indexOf(".") + 1) : profession;
  const professionId = `${domain}.${slug}`;
  const provider = flagValue(argv, "--provider") ?? "all";
  const perCompetency = Number(flagValue(argv, "--per-competency") ?? 2);
  const minScore = Number(flagValue(argv, "--min-score") ?? 0.3);
  const limitCompetencies = flagValue(argv, "--limit-competencies")
    ? Number(flagValue(argv, "--limit-competencies"))
    : undefined;
  const today = flagValue(argv, "--date") ?? new Date().toISOString().slice(0, 10);
  const minConfidence = Number(flagValue(argv, "--min-confidence") ?? 0.75);
  const registry = JSON.parse(
    await readFile(path.join(root, "src/methodology/v1/learning-sources/registry.json"), "utf8"),
  ) as LearningSourceRegistry;
  const contexts = await loadCompetencyContexts(root, domain, professionId);
  const selected = limitCompetencies ? contexts.slice(0, limitCompetencies) : contexts;
  if (selected.length === 0) throw new Error(`Нет компетенций профессии ${professionId}`);

  const fromJournal = flagValue(argv, "--from-journal");
  const hits: RawProviderHit[] = [];
  let journalCandidates: SourceCandidate[] | undefined;
  if (fromJournal) {
    const payload = JSON.parse(await readFile(path.resolve(root, fromJournal), "utf8")) as {
      candidates?: SourceCandidate[];
    };
    journalCandidates = (payload.candidates ?? []).filter(
      (candidate) =>
        candidate.review?.verdict === "accept" &&
        candidate.review.confidence >= minConfidence &&
        !isBannedCandidateTitle(candidate.title),
    );
    console.log(
      `sources:expand ${professionId}: из журнала ${fromJournal}: accept+confidence≥${minConfidence} — ${journalCandidates.length}`,
    );
  }
  if (!fromJournal && (provider === "wikipedia" || provider === "all")) {
    hits.push(...(await discoverWithWikipedia(fetchLike(fetch), selected)));
  }
  if (!fromJournal && (provider === "github" || provider === "all")) {
    const delayMs = process.env.GITHUB_TOKEN ? 0 : selected.length > 4 ? 6500 : 0;
    hits.push(...(await discoverWithGithub(fetchLike(fetch), selected, { delayMs })));
  }
  if (!fromJournal && (provider === "google" || provider === "all")) {
    if (process.env.GOOGLE_CSE_API_KEY && process.env.GOOGLE_CSE_CX) {
      hits.push(...(await googleCandidates(fetch, selected, 10)));
    } else if (provider === "google") {
      throw new Error("Для --provider google нужны GOOGLE_CSE_API_KEY и GOOGLE_CSE_CX");
    }
  }
  if (!fromJournal && (provider === "brave" || provider === "all")) {
    const key = process.env.BRAVE_API_KEY;
    if (key) {
      const delayMs = flagValue(argv, "--delay-ms") ? Number(flagValue(argv, "--delay-ms")) : 0;
      hits.push(...(await discoverWithBrave(fetchLike(fetch), selected, { apiKey: key, delayMs })));
    }
    else if (provider === "brave") throw new Error("Для --provider brave нужен BRAVE_API_KEY");
  }
  if (!fromJournal && (provider === "youtube" || provider === "all")) {
    const key = process.env.YOUTUBE_API_KEY;
    if (key) hits.push(...(await discoverWithYoutube(fetchLike(fetch), selected, { apiKey: key })));
    else if (provider === "youtube") throw new Error("Для --provider youtube нужен YOUTUBE_API_KEY");
  }
  const contextMap = new Map(selected.map((context) => [context.competencyId, context]));
  const built =
    journalCandidates ??
    buildCandidates(hits, contextMap, registry, {
      minScore,
      limitPerCompetency: perCompetency,
    });
  let candidates = built;
  if (argv.includes("--classify") && !fromJournal) {
    const policy = policyFromArgv(argv);
    const { transport } = await makeTransport(argv, policy);
    const reviewed = await reviewSourceCandidates({
      candidates: built,
      contexts: contextMap,
      transport,
      policy,
      budget: new LlmBudget(policy),
      cache: { dir: cacheDir(root) },
    });
    candidates = reviewed.candidates;
    for (const issue of reviewed.issues.slice(0, 10)) console.log(`  review issue: ${issue}`);
    console.log(
      `  LLM-ревью: accept ${candidates.filter((item) => item.review?.verdict === "accept").length}, ` +
        `confirm ${candidates.filter((item) => item.review?.verdict === "confirm").length}, ` +
        `reject ${candidates.filter((item) => item.review?.verdict === "reject").length}`,
    );
  }

  const journal = {
    generatedOn: today,
    professionId,
    provider,
    contexts: selected.length,
    hits: hits.length,
    candidates,
  };
  const dir = path.join(root, "data/learning-sources");
  await mkdir(dir, { recursive: true });
  const jsonPath = path.join(dir, `expansion-${slug}-${today}.json`);
  await writeFile(jsonPath, `${JSON.stringify(journal, null, 2)}\n`, "utf8");

  console.log(
    `sources:expand ${professionId}: компетенций ${selected.length}; хитов ${hits.length}; кандидатов ${candidates.length} (${provider})`,
  );
  if (provider === "all" && (!process.env.GOOGLE_CSE_API_KEY || !process.env.GOOGLE_CSE_CX)) {
    console.log("  google пропущен: нет GOOGLE_CSE_API_KEY/GOOGLE_CSE_CX (официальный API, ключи не заданы).");
  }
  const byCompetency = new Map<string, typeof candidates>();
  for (const candidate of candidates) {
    const list = byCompetency.get(candidate.competencyId) ?? [];
    list.push(candidate);
    byCompetency.set(candidate.competencyId, list);
  }
  for (const [competencyId, list] of byCompetency) {
    console.log(`  ${competencyId}:`);
    for (const candidate of list) {
      console.log(
        `    ${candidate.score.toFixed(2)} · ${candidate.kind} · ${candidate.domain} · ${candidate.title.slice(0, 70)}` +
          (candidate.existingSourceId ? ` (уже в реестре: ${candidate.existingSourceId})` : "") +
          (candidate.review ? ` · LLM:${candidate.review.verdict}/${candidate.review.confidence.toFixed(2)}` : ""),
      );
    }
  }
  console.log(jsonPath);

  const write = argv.includes("--write");
  const audit = argv.includes("--audit");
  const reviewDecisions = argv.includes("--review-decisions");
  if (!write) {
    console.log("dry-run: реестр не изменён. Для записи добавь --write (и --audit для проверки ссылок).");
    return;
  }
  const promotable = argv.includes("--classify") || fromJournal
    ? candidates.filter(
        (candidate) =>
          candidate.review?.verdict === "accept" &&
          candidate.review.confidence >= minConfidence,
      )
    : candidates;
  if (argv.includes("--classify") && !fromJournal) {
    console.log(
      `  к записи готовы: ${promotable.length} из ${candidates.filter((candidate) => candidate.review?.verdict === "accept").length} accept (confidence ≥ ${minConfidence})`,
    );
  }
  const result = await promoteCandidates(root, domain, professionId, promotable, {
    write,
    audit,
    reviewDecisions,
    today,
    releaseId: "beta-1",
  });
  const mdPath = path.join(dir, `expansion-${slug}-${today}.md`);
  await writeFile(mdPath, result.report, "utf8");
  console.log(
    `sources:expand записано: новых ${result.added.length}; связали существующие ${result.linkedExisting.length}; пропущено ${result.skipped.length}`,
  );
  console.log(mdPath);
  console.log("Дальше: npm run model:sync -- --domain it --profession " + slug + " --write, затем release:validate / release:build");
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
