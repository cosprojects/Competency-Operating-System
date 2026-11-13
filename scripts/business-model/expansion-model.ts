/**
 * COS-BP-011 — прогноз расширения профессий на 36 месяцев.
 *
 * Модель не заменяет финансовую модель COS-BP-008: она отвечает на вопрос
 * «что будет с продуктом, контентом и аудиторией при разных темпах расширения».
 *
 * Запуск:
 *   node --experimental-strip-types scripts/business-model/expansion-model.ts
 *   node --experimental-strip-types scripts/business-model/expansion-model.ts --json
 *
 * Артефакт:
 *   docs/08-business-plan/reports/bp-011-expansion-model.md
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type Scenario = {
  id: string;
  title: string;
  /** Новых профессий в квартал после запуска IT-направления. */
  addsPerQuarter: number;
  /** Месяц, с которого добавляются новые профессии (1-based). */
  launchMonth: number;
  /** Зрелый органический трафик на одну новую профессию, визитов/мес. */
  visitorsPerProfession: number;
  /** Трафик дизайн-теста (12 профессий), визитов/мес на старте. */
  designVisitors: number;
  registrationRate: number;
  paidRate: number;
  churn: number;
  arpu: number;
  /** Новых компетенций на профессию. */
  competenciesPerProfession: number;
  /** Новых материалов на профессию. */
  materialsPerProfession: number;
};

const MONTHS = 36;
const START_DESIGN_PROFESSIONS = 12;
const START_COMPETENCIES = 131;
const START_MATERIALS = 46;

const SCENARIOS: Scenario[] = [
  {
    id: "conservative",
    title: "Консервативный",
    addsPerQuarter: 2,
    launchMonth: 4,
    visitorsPerProfession: 250,
    designVisitors: 1_500,
    registrationRate: 0.08,
    paidRate: 0.02,
    churn: 0.08,
    arpu: 590,
    competenciesPerProfession: 25,
    materialsPerProfession: 8,
  },
  {
    id: "base",
    title: "Базовый",
    addsPerQuarter: 3,
    launchMonth: 4,
    visitorsPerProfession: 450,
    designVisitors: 3_000,
    registrationRate: 0.1,
    paidRate: 0.03,
    churn: 0.07,
    arpu: 690,
    competenciesPerProfession: 25,
    materialsPerProfession: 8,
  },
  {
    id: "aggressive",
    title: "Агрессивный",
    addsPerQuarter: 5,
    launchMonth: 4,
    visitorsPerProfession: 700,
    designVisitors: 5_000,
    registrationRate: 0.12,
    paidRate: 0.04,
    churn: 0.06,
    arpu: 790,
    competenciesPerProfession: 25,
    materialsPerProfession: 8,
  },
];

type MonthRow = {
  month: number;
  professions: number;
  competencies: number;
  materials: number;
  visitors: number;
  registrations: number;
  newPaid: number;
  activePaid: number;
  revenue: number;
};

const rub = (value: number): string => Math.round(value).toLocaleString("ru-RU").replace(/\u00a0/g, "\u202f");
const mln = (value: number): string => (value / 1_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 1 });

const monthsLabel = (month: number): string => {
  const date = new Date(Date.UTC(2027, 0, 1));
  date.setUTCMonth(date.getUTCMonth() + (month - 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};

const simulate = (scenario: Scenario): MonthRow[] => {
  const rows: MonthRow[] = [];
  let professions = START_DESIGN_PROFESSIONS;
  let activePaid = 0;
  const cohorts: { month: number; visitors: number }[] = [];

  for (let month = 1; month <= MONTHS; month += 1) {
    if (month >= scenario.launchMonth && (month - scenario.launchMonth) % 3 === 0) {
      professions += scenario.addsPerQuarter;
      cohorts.push({ month, visitors: 0 });
    }

    // Органика дизайн-теста растёт медленно и упирается в потолок.
    const designVisitors = Math.min(scenario.designVisitors * 1.02 ** (month - 1), scenario.designVisitors * 1.5);
    // Новая профессия набирает трафик за 9 месяцев; каждая когорта считается отдельно.
    let newProfessionVisitors = 0;
    for (const cohort of cohorts) {
      const age = month - cohort.month;
      const ramp = Math.max(0, Math.min(1, (age + 1) / 9));
      newProfessionVisitors += scenario.visitorsPerProfession * scenario.addsPerQuarter * ramp;
    }
    const visitors = designVisitors + newProfessionVisitors;
    const registrations = visitors * scenario.registrationRate;
    const newPaid = registrations * scenario.paidRate;
    activePaid = activePaid * (1 - scenario.churn) + newPaid;
    const revenue = activePaid * scenario.arpu;

    rows.push({
      month,
      professions,
      competencies: START_COMPETENCIES + (professions - START_DESIGN_PROFESSIONS) * scenario.competenciesPerProfession,
      materials: START_MATERIALS + (professions - START_DESIGN_PROFESSIONS) * scenario.materialsPerProfession,
      visitors: Math.round(visitors),
      registrations: Math.round(registrations),
      newPaid: Math.round(newPaid * 100) / 100,
      activePaid: Math.round(activePaid * 100) / 100,
      revenue: Math.round(revenue),
    });
  }
  return rows;
};

const results = SCENARIOS.map((scenario) => ({ scenario, rows: simulate(scenario) }));

const summaryRows = (rows: MonthRow[]) => {
  const at = (month: number) => rows[month - 1]!;
  const yearSum = (from: number, to: number, key: "visitors" | "registrations" | "revenue") =>
    rows.slice(from - 1, to).reduce((sum, row) => sum + row[key], 0);
  return {
    m12: at(12),
    m24: at(24),
    m36: at(36),
    year1: { visitors: yearSum(1, 12, "visitors"), registrations: yearSum(1, 12, "registrations"), revenue: yearSum(1, 12, "revenue") },
    year2: { visitors: yearSum(13, 24, "visitors"), registrations: yearSum(13, 24, "registrations"), revenue: yearSum(13, 24, "revenue") },
    year3: { visitors: yearSum(25, 36, "visitors"), registrations: yearSum(25, 36, "registrations"), revenue: yearSum(25, 36, "revenue") },
  };
};

const renderMarkdown = (): string => {
  const lines: string[] = [];
  lines.push("# COS-BP-011 — прогноз расширения профессий (36 месяцев)");
  lines.push("");
  lines.push("> Сгенерировано `scripts/business-model/expansion-model.ts`. Не редактировать вручную.");
  lines.push("> Модель — сценарии, а не прогноз. Все параметры — допущения, проверяются на запуске вертикалей.");
  lines.push("");
  lines.push("## Допущения");
  lines.push("");
  lines.push("| Параметр | Консервативный | Базовый | Агрессивный |");
  lines.push("|---|---:|---:|---:|");
  const fmt = (value: number, asPercent = false) => (asPercent ? `${Math.round(value * 100)}%` : rub(value));
  for (const key of ["addsPerQuarter", "launchMonth", "visitorsPerProfession", "designVisitors", "registrationRate", "paidRate", "churn", "arpu", "competenciesPerProfession", "materialsPerProfession"] as const) {
    const values = SCENARIOS.map((scenario) => fmt(scenario[key], ["registrationRate", "paidRate", "churn"].includes(key)));
    lines.push(`| ${key} | ${values.join(" | ")} |`);
  }
  lines.push("");
  lines.push("## Сводка");
  lines.push("");
  lines.push("| Показатель | Консервативный | Базовый | Агрессивный |");
  lines.push("|---|---:|---:|---:|");
  const rows = results.map((result) => summaryRows(result.rows));
  lines.push(`| Профессий к M12 | ${rows.map((r) => r.m12.professions).join(" | ")} |`);
  lines.push(`| Профессий к M24 | ${rows.map((r) => r.m24.professions).join(" | ")} |`);
  lines.push(`| Профессий к M36 | ${rows.map((r) => r.m36.professions).join(" | ")} |`);
  lines.push(`| Компетенций к M36 | ${rows.map((r) => rub(r.m36.competencies)).join(" | ")} |`);
  lines.push(`| Материалов к M36 | ${rows.map((r) => rub(r.m36.materials)).join(" | ")} |`);
  lines.push(`| Регистраций за год 1 | ${rows.map((r) => rub(r.year1.registrations)).join(" | ")} |`);
  lines.push(`| Регистраций за год 2 | ${rows.map((r) => rub(r.year2.registrations)).join(" | ")} |`);
  lines.push(`| Регистраций за год 3 | ${rows.map((r) => rub(r.year3.registrations)).join(" | ")} |`);
  lines.push(`| Активных платящих к M36 | ${rows.map((r) => rub(r.m36.activePaid)).join(" | ")} |`);
  lines.push(`| MRR к M36, ₽ | ${rows.map((r) => rub(r.m36.revenue)).join(" | ")} |`);
  lines.push(`| Выручка за год 3, ₽ | ${rows.map((r) => rub(r.year3.revenue)).join(" | ")} |`);
  lines.push("");
  lines.push("## Базовый сценарий по годам");
  lines.push("");
  lines.push("| Период | Профессий | Компетенций | Материалов | Визиты | Регистрации | Активных платящих | Выручка, ₽ |");
  lines.push("|---|---:|---:|---:|---:|---:|---:|---:|");
  const base = results.find((result) => result.scenario.id === "base")!.rows;
  for (let year = 1; year <= 3; year += 1) {
    const end = base[year * 12 - 1]!;
    const slice = base.slice((year - 1) * 12, year * 12);
    lines.push(`| Год ${year} | ${end.professions} | ${rub(end.competencies)} | ${rub(end.materials)} | ${rub(slice.reduce((s, r) => s + r.visitors, 0))} | ${rub(slice.reduce((s, r) => s + r.registrations, 0))} | ${rub(end.activePaid)} | ${rub(slice.reduce((s, r) => s + r.revenue, 0))} |`);
  }
  lines.push("");
  lines.push("## Что означает");
  lines.push("- Темп расширения важнее отдельной цены: при 3 профессиях/квартал к M36 45 профессий, при 2 — 34, при 5 — 67.");
  lines.push("- Даже агрессивный сценарий не делает проект венчурно-масштабным за 3 года: активные платящие — тысячи, не десятки тысяч.");
  lines.push("- Экономика зависит от контента и удержания; без learning loop paid conversion не удержится.");
  lines.push("");
  return lines.join("\n");
};

const main = async (): Promise<void> => {
  const write = !process.argv.includes("--no-write");
  const markdown = renderMarkdown();
  if (write) {
    const dir = path.join("docs", "08-business-plan", "reports");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "bp-011-expansion-model.md"), markdown, "utf8");
  }
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(results.map(({ scenario, rows }) => ({ id: scenario.id, title: scenario.title, rows: rows.filter((row) => [12, 24, 36].includes(row.month)) })), null, 2));
    return;
  }
  console.log(markdown);
};

await main();
