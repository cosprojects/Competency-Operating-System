import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function flag(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

type EventProps = Record<string, string | number | boolean>;

function readProps(value: unknown): EventProps {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: EventProps = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
      result[key] = item;
    }
  }
  return result;
}

function pct(value: number, denominator: number): string {
  if (denominator <= 0) return "—";
  return `${((value / denominator) * 100).toFixed(1)}%`;
}

function uniqueSize(values: Array<string | null | undefined>): number {
  return new Set(values.filter((value): value is string => Boolean(value))).size;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const days = Number(flag(argv, "--days") ?? 30);
  const since = new Date(Date.now() - (Number.isFinite(days) ? days : 30) * 86_400_000);
  const [users, favorites, statuses, feedbackTotal, events, feedbackGroups] = await Promise.all([
    db.user.findMany({ select: { id: true, createdAt: true } }),
    db.favorite.count(),
    db.studyStatus.count(),
    db.feedback.count(),
    db.analyticsEvent.findMany({
      where: { createdAt: { gte: since } },
      select: { name: true, anonId: true, userId: true, createdAt: true, props: true },
    }),
    db.feedback.groupBy({ by: ["type"], _count: { _all: true } }),
  ]);

  const periodUsers = users.filter((user) => user.createdAt >= since);
  const pageViews = events.filter((event) => event.name === "page_view");
  const visitors = uniqueSize(pageViews.map((event) => event.anonId));
  const professionUsers = uniqueSize(
    events.filter((event) => event.name === "profession_view").map((event) => event.userId ?? event.anonId),
  );
  const competencyUsers = uniqueSize(
    events.filter((event) => event.name === "competency_view").map((event) => event.userId ?? event.anonId),
  );
  const sourceUsers = uniqueSize(
    events.filter((event) => event.name === "source_click").map((event) => event.userId ?? event.anonId),
  );
  const signupStartUsers = uniqueSize(
    events.filter((event) => event.name === "signup_start").map((event) => event.userId ?? event.anonId),
  );
  const signupCompleteUsers = uniqueSize(
    events.filter((event) => event.name === "signup_complete").map((event) => event.userId ?? event.anonId),
  );
  const activatedUsers = uniqueSize(
    events
      .filter((event) => ["favorite_add", "study_status_change", "source_view_submit"].includes(event.name))
      .map((event) => event.userId),
  );
  const ctaClicks = uniqueSize(
    events.filter((event) => event.name === "cta_click").map((event) => event.userId ?? event.anonId),
  );

  const sevenDaysAgo = Date.now() - 7 * 86_400_000;
  const eligibleForReturn = users.filter((user) => user.createdAt.getTime() <= sevenDaysAgo);
  const returned = new Set<string>();
  for (const event of events) {
    if (!event.userId) continue;
    const user = users.find((item) => item.id === event.userId);
    if (user && event.createdAt.getTime() - user.createdAt.getTime() >= 7 * 86_400_000) {
      returned.add(event.userId);
    }
  }
  const returnUsers = eligibleForReturn.filter((user) => returned.has(user.id));

  const counts = new Map<string, number>();
  for (const event of events) counts.set(event.name, (counts.get(event.name) ?? 0) + 1);

  const variantVisitors = new Map<string, number>();
  const variantCta = new Map<string, number>();
  const utmVisitors = new Map<string, number>();
  for (const event of pageViews) {
    const props = readProps(event.props);
    const variant = typeof props.landing_variant === "string" ? props.landing_variant : "—";
    variantVisitors.set(variant, (variantVisitors.get(variant) ?? 0) + 1);
    const source = typeof props.utm_source === "string" ? props.utm_source : "—";
    const medium = typeof props.utm_medium === "string" ? props.utm_medium : "—";
    const key = `${source} / ${medium}`;
    utmVisitors.set(key, (utmVisitors.get(key) ?? 0) + 1);
  }
  for (const event of events.filter((item) => item.name === "cta_click")) {
    const props = readProps(event.props);
    const key = `${typeof props.landing_variant === "string" ? props.landing_variant : "—"} / ${
      typeof props.cta_id === "string" ? props.cta_id : "—"
    }`;
    variantCta.set(key, (variantCta.get(key) ?? 0) + 1);
  }

  const funnelRows: Array<[string, number, number]> = [
    ["Посетители (page_view)", visitors, 0],
    ["Открыли профессию", professionUsers, visitors],
    ["Открыли компетенцию", competencyUsers, professionUsers],
    ["Перешли к материалу", sourceUsers, competencyUsers],
    ["Начали регистрацию", signupStartUsers, visitors],
    ["Завершили регистрацию", signupCompleteUsers, visitors],
    ["Активировались (сохранение/статус/просмотр)", activatedUsers, signupCompleteUsers || periodUsers.length],
    ["Вернулись на 7-й день", returnUsers.length, eligibleForReturn.length],
    ["Нажали CTA", ctaClicks, visitors],
  ];

  const lines = [
    "# AXIONA Beta metrics",
    "",
    `Период событий: с ${isoDate(since)} по ${isoDate(new Date())}. Размер выборки мал; это ориентиры, не доказательство спроса.`,
    "Посетители считаются по `page_view`; при отказе от аналитики события не пишутся, поэтому знаменатель — только согласившиеся.",
    "",
    "## Воронка",
    "",
    "| Этап | Уникальных | Знаменатель | Конверсия |",
    "|---|---:|---:|---:|",
    ...funnelRows.map(([label, value, denominator]) => [
      `| ${label} | ${value} | ${denominator || "—"} | ${pct(value, denominator)} |`,
    ].join("")),
    "",
    "## Сводка",
    "",
    "| Метрика | Значение |",
    "|---|---:|",
    `| Пользователи всего | ${users.length} |`,
    `| Новые пользователи за период | ${periodUsers.length} |`,
    `| Посетители с событиями | ${visitors} |`,
    `| Открыли компетенцию | ${competencyUsers} |`,
    `| Сохраняли/меняли статус | ${activatedUsers} |`,
    `| 7-дневный возврат | ${returnUsers.length} / ${eligibleForReturn.length} |`,
    `| Сохранения всего | ${favorites} |`,
    `| Статусы всего | ${statuses} |`,
    `| Отзывы всего | ${feedbackTotal} |`,
    "",
    "## События",
    "",
    "| Событие | Количество |",
    "|---|---:|",
    ...[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => `| \`${name}\` | ${count} |`),
    "",
    "## Варианты посадочной",
    "",
    "| Вариант | Просмотры страниц |",
    "|---|---:|",
    ...[...variantVisitors.entries()].sort((a, b) => b[1] - a[1]).map(([variant, count]) => `| ${variant} | ${count} |`),
    "",
    "## CTA по вариантам",
    "",
    "| Вариант / CTA | Клики |",
    "|---|---:|",
    ...[...variantCta.entries()].sort((a, b) => b[1] - a[1]).map(([key, count]) => `| ${key} | ${count} |`),
    "",
    "## Источники (UTM)",
    "",
    "| utm_source / utm_medium | Просмотры страниц |",
    "|---|---:|",
    ...[...utmVisitors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([key, count]) => `| ${key} | ${count} |`),
    "",
    "## Отзывы по типам",
    "",
    "| Тип | Количество |",
    "|---|---:|",
    ...feedbackGroups.map((group) => `| \`${group.type}\` | ${group._count._all} |`),
    "",
  ];
  const output = `${lines.join("\n")}\n`;
  console.log(output);

  if (argv.includes("--write")) {
    const dir = path.join(process.cwd(), "docs/12-release/reports");
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `metrics-${isoDate(new Date())}.md`);
    await writeFile(file, output, "utf8");
    const csvRows = [
      "metric,value,denominator,conversion",
      ...funnelRows.map(([label, value, denominator]) =>
        [JSON.stringify(label), value, denominator, denominator > 0 ? (value / denominator).toFixed(4) : ""].join(","),
      ),
    ];
    await writeFile(path.join(dir, `metrics-${isoDate(new Date())}.csv`), `${csvRows.join("\n")}\n`, "utf8");
    console.log(`written: ${file}`);
  }
}

await main().finally(async () => {
  await db.$disconnect();
});
