import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import type { Material } from "../../competency/types.ts";
import type { CompetenciesFile, ProfessionCompetencyFile } from "../../competency/model/types.ts";
import { loadCatalog } from "../../competency/catalog.ts";
import { flagValue, readJson, writeJson } from "../../competency/cli/common.ts";
import {
  COVERAGE_LIMITS,
  MATERIAL_FORMATS,
  formatOf,
  resolveFormatCoverage,
  type CoverageState,
  type MaterialFormat,
} from "../limits.ts";
import { buildCoverageReport, renderCoverageReport, type CoverageInputCompetency } from "../coverage.ts";

/**
 * Отчёт покрытия «компетенция × формат» и состояние попыток поиска.
 *
 *   npm run materials:coverage -- --domain it --profession motion --report
 *   npm run materials:coverage -- --profession motion --mark-attempt   # отметить раунд поиска
 */
async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const domain = flagValue(argv, "--domain") ?? "it";
  const profession = flagValue(argv, "--profession") ?? "uxui";
  const slug = profession.includes(".") ? profession.slice(profession.indexOf(".") + 1) : profession;
  const professionId = `${domain}.${slug}`;
  const modelDir = path.join(root, "src/methodology/v1/competency/model");
  const journalPath =
    flagValue(argv, "--journal") ??
    path.join(root, "data/materials-agent", `${domain}-${slug}-queue.json`);
  const statePath =
    flagValue(argv, "--state") ?? path.join(root, "data/materials-agent", "coverage-state.json");

  const verifiedPath =
    flagValue(argv, "--verified") ??
    path.join(root, "data/materials-agent", `${domain}-${slug}-verified.json`);
  const [journal, catalog, competencies, professionCompetencies, state] = await Promise.all([
    readJson<{ materials: Material[] }>(verifiedPath)
      .catch(() => readJson<{ materials: Material[] }>(journalPath))
      .catch(() => ({ materials: [] })),
    loadCatalog(root, domain),
    readJson<CompetenciesFile>(path.join(modelDir, "competencies.json")).catch(() => ({ competencies: [] })),
    readJson<ProfessionCompetencyFile>(
      path.join(modelDir, "profession-competencies", `${slug}.json`),
    ).catch(() => undefined),
    readJson<CoverageState>(statePath).catch(() => ({} as CoverageState)),
  ]);
  const titleById = new Map(competencies.competencies.map((item) => [item.id, item.title]));
  const blockIdsByCompetency = new Map<string, string[]>();
  for (const block of catalog.blocks) {
    for (const competencyId of block.canonicalIds ?? []) {
      const list = blockIdsByCompetency.get(competencyId) ?? [];
      list.push(block.id);
      blockIdsByCompetency.set(competencyId, list);
    }
  }
  const coverageCompetencies: CoverageInputCompetency[] = (professionCompetencies?.competencies ?? []).map(
    (competency) => ({
      competencyId: competency.competencyId,
      title: titleById.get(competency.competencyId) ?? competency.competencyId,
      tier: competency.tier,
      blockIds: blockIdsByCompetency.get(competency.competencyId) ?? [],
    }),
  );
  if (coverageCompetencies.length === 0) {
    throw new Error(`Нет компетенций профессии ${professionId}: проверь profession-competencies/${slug}.json`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const nextState: CoverageState = { ...state };
  if (argv.includes("--mark-attempt")) {
    for (const competency of coverageCompetencies) {
      const current = nextState[competency.competencyId] ?? {};
      const formats: Partial<Record<MaterialFormat, { attempts?: number; lastAttemptAt?: string }>> = {
        ...current,
      };
      for (const format of MATERIAL_FORMATS) {
        const entry = current[format];
        const accepted = (journal.materials ?? []).filter((material) => {
          if (material.review?.status === "rejected") return false;
          if (formatOf(material.kind) !== format) return false;
          return material.links.some((link) =>
            (blockIdsByCompetency.get(competency.competencyId) ?? []).includes(link.competencyId),
          );
        }).length;
        const coverage = resolveFormatCoverage({
          accepted,
          attempts: entry?.attempts ?? 0,
          tier: competency.tier,
          ...(entry?.lastAttemptAt ? { lastAttemptAt: entry.lastAttemptAt } : {}),
        });
        if (coverage.status === "ok") {
          formats[format] = { ...entry, attempts: entry?.attempts ?? 0 };
        } else {
          formats[format] = {
            ...entry,
            attempts: Math.min((entry?.attempts ?? 0) + 1, COVERAGE_LIMITS.maxFormatRounds),
            lastAttemptAt: today,
          };
        }
      }
      nextState[competency.competencyId] = formats;
    }
    await writeJson(statePath, nextState);
    console.log(`coverage-state обновлён: ${statePath}`);
  }

  // Покрытие считаем по принятым материалам каталога и по вердиктам Pass E,
  // а не по всем найденным кандидатам.
  const byId = new Map<string, Material>();
  for (const material of journal.materials ?? []) byId.set(material.id, material);
  for (const material of catalog.materials) byId.set(material.id, material);
  const report = buildCoverageReport({
    professionId,
    competencies: coverageCompetencies,
    materials: [...byId.values()],
    state: nextState,
  });
  const jsonPath = path.join(root, "data/materials-agent", `coverage-${slug}-${report.generatedAt}.json`);
  const mdPath = path.join(root, "data/materials-agent", `coverage-${slug}-${report.generatedAt}.md`);
  await writeJson(jsonPath, report);
  await mkdir(path.dirname(mdPath), { recursive: true });
  await writeFile(mdPath, renderCoverageReport(report), "utf8");

  console.log(
    `materials:coverage ${professionId}: компетенций ${report.totals.competencies}; ` +
      `принято материалов ${report.totals.acceptedMaterials}; ` +
      `ok ${report.totals.formatsOk}, ниже минимума ${report.totals.formatsBelowMin}, ` +
      `insufficient ${report.totals.formatsInsufficient}, не начинали ${report.totals.formatsNotStarted}`,
  );
  for (const row of report.rows) {
    const gaps = row.formats.filter((format) => format.status !== "ok");
    if (gaps.length === 0) continue;
    console.log(
      `  ${row.title}: ${gaps.map((format) => `${format.title} ${format.accepted}/${format.target} (${format.status})`).join("; ")}`,
    );
  }
  console.log(jsonPath);
  console.log(mdPath);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
