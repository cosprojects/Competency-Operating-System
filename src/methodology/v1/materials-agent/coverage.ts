import type { Material } from "../competency/types.ts";
import {
  COVERAGE_LIMITS,
  FORMAT_TITLES,
  MATERIAL_FORMATS,
  formatOf,
  resolveFormatCoverage,
  targetForTier,
  type CoverageState,
  type FormatCoverageStatus,
  type MaterialFormat,
} from "./limits.ts";

/** Отчёт покрытия «компетенция × формат» против лимитов COS-REL-009 §7.1. */

export interface CompetencyFormatCoverage {
  format: MaterialFormat;
  title: string;
  accepted: number;
  attempts: number;
  target: number;
  min: number;
  max: number;
  status: FormatCoverageStatus;
  nextAttemptAt?: string;
}

export interface CompetencyCoverageRow {
  competencyId: string;
  title: string;
  tier: "foundation" | "core" | "optional";
  formats: CompetencyFormatCoverage[];
}

export interface CoverageReport {
  professionId: string;
  generatedAt: string;
  limits: typeof COVERAGE_LIMITS;
  rows: CompetencyCoverageRow[];
  totals: {
    competencies: number;
    acceptedMaterials: number;
    formatsOk: number;
    formatsBelowMin: number;
    formatsInsufficient: number;
    formatsNotStarted: number;
  };
}

export interface CoverageInputCompetency {
  competencyId: string;
  title: string;
  tier: "foundation" | "core" | "optional";
  /** id accepted-блоков, которые покрывают компетенцию (canonicalIds). */
  blockIds: string[];
}

/** Считается ли материал принятым для покрытия (каталог или вердикт Pass E). */
function isCounted(material: Material): boolean {
  if (material.review) return material.review.status !== "rejected";
  return material.status === "accepted";
}

/** Формат материала по связи с блоком компетенции. */
function formatForCompetency(material: Material, blockIds: Set<string>): MaterialFormat | undefined {
  const linked = material.links.some((link) => blockIds.has(link.competencyId));
  if (!linked) return undefined;
  return formatOf(material.kind);
}

export function buildCoverageReport(input: {
  professionId: string;
  competencies: CoverageInputCompetency[];
  materials: Material[];
  state?: CoverageState;
  now?: Date;
}): CoverageReport {
  const state = input.state ?? {};
  const rows: CompetencyCoverageRow[] = [];
  const countedMaterials = new Set<string>();
  let formatsOk = 0;
  let formatsBelowMin = 0;
  let formatsInsufficient = 0;
  let formatsNotStarted = 0;

  for (const competency of input.competencies) {
    const blockIds = new Set(competency.blockIds);
    const counts = new Map<MaterialFormat, number>();
    for (const material of input.materials) {
      if (!isCounted(material)) continue;
      const format = formatForCompetency(material, blockIds);
      if (!format) continue;
      counts.set(format, (counts.get(format) ?? 0) + 1);
      countedMaterials.add(material.id);
    }
    const competencyState = state[competency.competencyId] ?? {};
    const formats = MATERIAL_FORMATS.map((format) => {
      const accepted = counts.get(format) ?? 0;
      const entry = competencyState[format];
      const attempts = entry?.attempts ?? 0;
      const coverage = resolveFormatCoverage({
        accepted,
        attempts,
        tier: competency.tier,
        ...(entry?.lastAttemptAt ? { lastAttemptAt: entry.lastAttemptAt } : {}),
        ...(input.now ? { now: input.now } : {}),
      });
      if (coverage.status === "ok") formatsOk += 1;
      else if (coverage.status === "below_min") formatsBelowMin += 1;
      else if (coverage.status === "insufficient") formatsInsufficient += 1;
      else formatsNotStarted += 1;
      return {
        format,
        title: FORMAT_TITLES[format],
        accepted,
        attempts,
        ...coverage,
        ...(coverage.nextAttemptAt ? { nextAttemptAt: coverage.nextAttemptAt } : {}),
      };
    });
    rows.push({
      competencyId: competency.competencyId,
      title: competency.title,
      tier: competency.tier,
      formats,
    });
  }

  return {
    professionId: input.professionId,
    generatedAt: new Date().toISOString().slice(0, 10),
    limits: COVERAGE_LIMITS,
    rows,
    totals: {
      competencies: rows.length,
      acceptedMaterials: countedMaterials.size,
      formatsOk,
      formatsBelowMin,
      formatsInsufficient,
      formatsNotStarted,
    },
  };
}

export function renderCoverageReport(report: CoverageReport): string {
  const lines: string[] = [];
  lines.push(`# Покрытие материалов: ${report.professionId}`);
  lines.push("");
  lines.push(`Сгенерировано: ${report.generatedAt}.`);
  lines.push(
    `Цель: ${COVERAGE_LIMITS.minPerFormat}–${COVERAGE_LIMITS.maxPerFormat} на формат (target ${COVERAGE_LIMITS.targetPerFormat}; foundation 5, optional 2).`,
  );
  lines.push(
    `Компетенций: ${report.totals.competencies}; принято материалов: ${report.totals.acceptedMaterials}; ` +
      `ok: ${report.totals.formatsOk}; ниже минимума: ${report.totals.formatsBelowMin}; ` +
      `insufficient: ${report.totals.formatsInsufficient}; не начинали: ${report.totals.formatsNotStarted}.`,
  );
  lines.push("");
  lines.push("| Компетенция | tier | Курсы | Видео | Статьи | Справочники | Кейсы |");
  lines.push("|---|---|---|---:|---:|---:|---:|");
  for (const row of report.rows) {
    const cells = row.formats.map((format) => {
      const mark =
        format.status === "ok"
          ? "ok"
          : format.status === "insufficient"
            ? "insufficient"
            : format.status === "below_min"
              ? "ниже"
              : "—";
      return `${format.accepted}/${format.target} ${mark}`;
    });
    lines.push(`| ${row.title} | ${row.tier} | ${cells.join(" | ")} |`);
  }
  lines.push("");
  const gaps = report.rows.flatMap((row) =>
    row.formats
      .filter((format) => format.status === "insufficient" || format.status === "below_min")
      .map((format) => ({ row, format })),
  );
  if (gaps.length > 0) {
    lines.push("## Пробелы");
    lines.push("");
    for (const { row, format } of gaps) {
      const next = format.nextAttemptAt ? `, следующая попытка ${format.nextAttemptAt}` : "";
      lines.push(
        `- ${row.title} / ${format.title}: ${format.accepted} из ${format.min} (попыток ${format.attempts}, ${format.status}${next})`,
      );
    }
    lines.push("");
  }
  const insufficient = report.rows.flatMap((row) =>
    row.formats.filter((format) => format.status === "insufficient").map((format) => ({ row, format })),
  );
  if (insufficient.length > 0) {
    lines.push("## Исчерпали лимит поиска");
    lines.push("");
    lines.push(
      `Эти форматы искали ${COVERAGE_LIMITS.maxFormatRounds} раунда и не нашли минимум. ` +
        `Нужен новый провайдер, другой запрос или ручное решение — не бесконечный поиск.`,
    );
    lines.push("");
    for (const { row, format } of insufficient) {
      lines.push(`- ${row.title} / ${format.title}: принято ${format.accepted}, цель ${format.target}`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

export function targetForCompetencyTier(tier: "foundation" | "core" | "optional"): number {
  return targetForTier(tier);
}
