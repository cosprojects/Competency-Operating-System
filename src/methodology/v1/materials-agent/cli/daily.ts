import path from "node:path";
import { readdir, writeFile } from "node:fs/promises";
import type { CatalogFile, Material } from "../../competency/types.ts";
import type { CompetenciesFile, ProfessionCompetencyFile } from "../../competency/model/types.ts";
import { loadCatalog } from "../../competency/catalog.ts";
import { LlmBudget } from "../../competency/llm/policy.ts";
import { cacheDir, flagValue, makeTransport, policyFromArgv, readJson, writeJson } from "../../competency/cli/common.ts";
import { buildCoverageReport, type CoverageInputCompetency } from "../coverage.ts";
import { COVERAGE_LIMITS, formatOf, type MaterialFormat } from "../limits.ts";
import { acceptMaterials } from "../accept.ts";
import { runMaterialQueue } from "../queue.ts";
import { createMaterialAgentDeps } from "../agent.ts";
import { reviewMaterials } from "../verdict.ts";
import {
  DAILY_SOURCES,
  appendHistory,
  selectDailyTarget,
  type DailyHistoryEntry,
  type DailyPlan,
  type DailySlot,
  type DailyState,
} from "../daily.ts";

/**
 * Ежедневный добор материалов (COS-REL-009 §7.1).
 *
 *   npm run materials:daily                 # план на сегодня (dry-run)
 *   npm run materials:daily -- --write      # выполнить один поиск и принять один материал
 *   npm run materials:daily -- --force      # повторный прогон в тот же день
 *
 * Один прогон = один слот «профессия × компетенция × формат» и один источник.
 * Бюджет LLM по умолчанию $0.02; при ошибке слот получает cooldown через coverage-state.
 */

const STATE_PATH = "data/materials-agent/daily-state.json";
const COVERAGE_STATE_PATH = "data/materials-agent/coverage-state.json";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

type CoverageAttempts = Record<string, Partial<Record<MaterialFormat, { accepted?: number; attempts?: number; lastAttemptAt?: string }>>>;

async function loadSlots(root: string, domain: string, catalog: CatalogFile): Promise<DailySlot[]> {
  const modelDir = path.join(root, "src/methodology/v1/competency/model");
  const [competencies, professions, state] = await Promise.all([
    readJson<CompetenciesFile>(path.join(modelDir, "competencies.json")),
    readJson<{ professions: Array<{ id: string; title: string }> }>(path.join(modelDir, "professions.json")),
    readJson<CoverageAttempts>(path.join(root, COVERAGE_STATE_PATH)).catch(() => ({} as CoverageAttempts)),
  ]);
  const titleById = new Map(competencies.competencies.map((item) => [item.id, item.title]));
  const professionTitleById = new Map(professions.professions.map((item) => [item.id, item.title]));
  const blockIdsByCompetency = new Map<string, string[]>();
  for (const block of catalog.blocks) {
    if (block.status !== "accepted") continue;
    for (const canonicalId of block.canonicalIds ?? []) {
      const list = blockIdsByCompetency.get(canonicalId) ?? [];
      list.push(block.id);
      blockIdsByCompetency.set(canonicalId, list);
    }
  }
  const dir = path.join(modelDir, "profession-competencies");
  const files = (await readdir(dir)).filter((file) => file.endsWith(".json"));
  const slots: DailySlot[] = [];
  for (const file of files) {
    const record = await readJson<ProfessionCompetencyFile>(path.join(dir, file));
    const competencyRows: CoverageInputCompetency[] = record.competencies.map((competency) => ({
      competencyId: competency.competencyId,
      title: titleById.get(competency.competencyId) ?? competency.competencyId,
      tier: competency.tier,
      blockIds: blockIdsByCompetency.get(competency.competencyId) ?? [],
    }));
    // Новые/несобранные компетенции без accepted-блоков нечего искать.
    const withBlocks = competencyRows.filter((competency) => competency.blockIds.length > 0);
    if (withBlocks.length === 0) continue;
    const report = buildCoverageReport({
      professionId: record.professionId,
      competencies: withBlocks,
      materials: catalog.materials,
      state: state as never,
    });
    for (const row of report.rows) {
      for (const format of row.formats) {
        const entry = (state as CoverageAttempts)[row.competencyId]?.[format.format];
        slots.push({
          professionId: record.professionId,
          professionTitle: professionTitleById.get(record.professionId) ?? record.professionId,
          competencyId: row.competencyId,
          competencyTitle: row.title,
          format: format.format,
          tier: row.tier,
          accepted: format.accepted,
          target: format.target,
          min: format.min,
          attempts: format.attempts ?? entry?.attempts ?? 0,
          ...(format.nextAttemptAt ? { nextAttemptAt: format.nextAttemptAt } : {}),
          ...(entry?.lastAttemptAt ? { lastAttemptAt: entry.lastAttemptAt } : {}),
          status: format.status,
          professionAccepted: report.totals.acceptedMaterials,
        });
      }
    }
    // Пустые слоты новых профессий тоже держим в плане только при наличии блоков.
    for (const competency of withBlocks.filter((item) => !report.rows.some((row) => row.competencyId === item.competencyId))) {
      for (const format of ["course", "video", "article", "reference", "case"] as MaterialFormat[]) {
        slots.push({
          professionId: record.professionId,
          professionTitle: professionTitleById.get(record.professionId) ?? record.professionId,
          competencyId: competency.competencyId,
          competencyTitle: competency.title,
          format,
          tier: competency.tier,
          accepted: 0,
          target: COVERAGE_LIMITS.targetByTier[competency.tier],
          min: COVERAGE_LIMITS.minPerFormat,
          attempts: 0,
          status: "not_started",
          professionAccepted: report.totals.acceptedMaterials,
        });
      }
    }
  }
  return slots;
}

async function loadDailyState(root: string): Promise<DailyState> {
  return readJson<DailyState>(path.join(root, STATE_PATH)).catch(() => ({ history: [] }));
}

async function markAttempt(root: string, plan: DailyPlan, result: DailyHistoryEntry["result"]): Promise<void> {
  const coveragePath = path.join(root, COVERAGE_STATE_PATH);
  const state = await readJson<CoverageAttempts>(coveragePath).catch(() => ({} as CoverageAttempts));
  const current = state[plan.slot.competencyId]?.[plan.slot.format] ?? {};
  state[plan.slot.competencyId] = {
    ...state[plan.slot.competencyId],
    [plan.slot.format]: {
      ...current,
      attempts: Math.min((current.attempts ?? 0) + 1, COVERAGE_LIMITS.maxFormatRounds + 1),
      lastAttemptAt: plan.date,
    },
  };
  await writeJson(coveragePath, state);
  const daily = await loadDailyState(root);
  await writeJson(
    path.join(root, STATE_PATH),
    appendHistory(daily, {
      date: plan.date,
      professionId: plan.slot.professionId,
      competencyId: plan.slot.competencyId,
      format: plan.slot.format,
      source: plan.source,
      result,
    }),
  );
}

async function executePlan(
  root: string,
  domain: string,
  plan: DailyPlan,
  catalog: CatalogFile,
  argv: string[],
): Promise<{ result: DailyHistoryEntry["result"]; material?: Material; reason: string }> {
  const block = catalog.blocks.find(
    (item) =>
      item.status === "accepted" &&
      (item.canonicalIds ?? []).includes(plan.slot.competencyId) &&
      item.professionIds.includes(plan.slot.professionId),
  );
  if (!block) return { result: "error", reason: "нет accepted-блока для компетенции" };

  const basePolicy = policyFromArgv(argv);
  const policy = {
    ...basePolicy,
    maxCallsPerRun: Math.min(basePolicy.maxCallsPerRun, 6),
    maxCostUsd: Math.min(basePolicy.maxCostUsd, 0.02),
  };
  const { transport } = await makeTransport(argv, policy);
  const budget = new LlmBudget(policy);
  const fetchImpl = (input: string | URL | Request, init?: RequestInit) => fetch(input, init);
  const queue = await runMaterialQueue(
    {
      domain,
      professionId: plan.slot.professionId,
      catalog,
      fetchImpl: fetchImpl as never,
      retrievedOn: plan.date,
      sourceIds: [plan.source],
      limit: 1,
      limitPerCompetency: 1,
      competencyIds: [plan.slot.competencyId],
      classify: true,
      transport,
      policy,
      budget,
      maxAttempts: 1,
      cache: { dir: cacheDir(root) },
    },
    createMaterialAgentDeps({}),
  );
  if (queue.materials.length === 0) return { result: "no_material", reason: "источник не дал материалов" };

  const tierByCompetency = new Map([[plan.slot.competencyId, plan.slot.tier]]);
  const acceptedByFormat = new Map<string, number>();
  for (const material of catalog.materials) {
    if (material.status !== "accepted") continue;
    const format = formatOf(material.kind);
    for (const link of material.links) {
      const key = `${link.competencyId}|${format}`;
      acceptedByFormat.set(key, (acceptedByFormat.get(key) ?? 0) + 1);
    }
  }
  const reviewed = await reviewMaterials({
    materials: queue.materials,
    blocks: catalog.blocks.filter((item) => item.status === "accepted"),
    transport,
    policy,
    budget,
    retrievedOn: plan.date,
    cache: { dir: cacheDir(root) },
    limit: 3,
    tierByCompetency,
    acceptedByFormat,
  });
  const candidates = reviewed.materials.filter((material) => {
    if (formatOf(material.kind) !== plan.slot.format) return false;
    if (material.review?.status !== "accepted") return false;
    return material.links.some(
      (link) => link.competencyId === block.id && link.relevance >= 0.7,
    );
  });
  if (candidates.length === 0) {
    const needsConfirmation = reviewed.materials.filter((material) => material.review?.status === "needs_confirmation").length;
    return {
      result: needsConfirmation > 0 ? "rejected" : "no_material",
      reason:
        reviewed.materials.length === 0
          ? "LLM не вернул материалы"
          : `нет accept-материала формата ${plan.slot.format} (needs_confirmation: ${needsConfirmation})`,
    };
  }
  const best = candidates.sort(
    (a, b) => (b.review?.confidence ?? 0) - (a.review?.confidence ?? 0),
  )[0]!;
  const acceptedResult = acceptMaterials(catalog, [best], { minRelevance: 0.7 });
  if (acceptedResult.accepted.length === 0) {
    return { result: "rejected", reason: acceptedResult.skipped[0]?.reason ?? "приёмка отклонила материал" };
  }
  const updated: CatalogFile = {
    ...catalog,
    materials: [...catalog.materials, ...acceptedResult.accepted],
    updatedOn: plan.date,
  };
  await writeFile(
    path.join(root, "src/methodology/v1/competency/catalog", `${domain}.json`),
    `${JSON.stringify(updated, null, 2)}\n`,
    "utf8",
  );
  return { result: "accepted", material: acceptedResult.accepted[0], reason: "принят 1 материал" };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const domain = flagValue(argv, "--domain") ?? "it";
  const date = flagValue(argv, "--date") ?? todayIso();
  const write = argv.includes("--write");
  const force = argv.includes("--force");
  const sourceOverride = flagValue(argv, "--source");
  const daily = await loadDailyState(root);
  if (!force && daily.lastRunDate === date && !argv.includes("--plan")) {
    console.log(`materials:daily: за ${date} уже был прогон (${daily.history.at(-1)?.result ?? "—"}). Повторно — с --force.`);
    return;
  }
  const catalog = await loadCatalog(root, domain);
  const slots = await loadSlots(root, domain, catalog);
  if (slots.length === 0) {
    console.log("materials:daily: нет слотов для поиска (нет accepted-блоков или все форматы закрыты).");
    return;
  }
  const plan = selectDailyTarget(slots, daily.history, date);
  if (!plan) {
    console.log(`materials:daily: все слоты закрыты или в cooldown — сеть не нужна (слотов ${slots.length}).`);
    return;
  }
  if (sourceOverride) {
    if (!DAILY_SOURCES.includes(sourceOverride as never)) {
      throw new Error(`Неизвестный источник «${sourceOverride}». Доступны: ${DAILY_SOURCES.join(", ")}`);
    }
    plan.source = sourceOverride;
  }
  const planPath = path.join(root, "data/materials-agent", `daily-plan-${date}.json`);
  await writeJson(planPath, plan);
  console.log(
    `materials:daily ${date}: ${plan.slot.professionTitle} / ${plan.slot.competencyTitle} / ${plan.slot.format}; ` +
      `сейчас ${plan.slot.accepted}/${plan.slot.target}; источник ${plan.source}; слотов с дефицитом ${plan.eligibleSlots}/${plan.totalSlots}`,
  );
  if (!write) {
    console.log("dry-run: план записан, сеть не вызывалась. Для выполнения добавь --write.");
    return;
  }
  try {
    const outcome = await executePlan(root, domain, plan, catalog, argv);
    await markAttempt(root, plan, outcome.result);
    console.log(`materials:daily: ${outcome.result} — ${outcome.reason}`);
    if (outcome.material) console.log(`  + ${outcome.material.title} (${outcome.material.canonicalUrl})`);
  } catch (error) {
    await markAttempt(root, plan, "error");
    throw error;
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
