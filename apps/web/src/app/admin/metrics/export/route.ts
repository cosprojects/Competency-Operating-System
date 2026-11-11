import { NextResponse } from "next/server";
import {
  buildPdf,
  csvResponse,
  isoDate,
  pdfResponse,
  toCsv,
} from "@/lib/admin-export";
import { requireApiCapability } from "@/lib/access";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const PERIOD_LABEL: Record<string, string> = {
  "7": "7 дней",
  "30": "30 дней",
  "90": "90 дней",
  all: "Всё время",
};

const FUNNEL = [
  ["page_view", "Визиты"],
  ["profession_view", "Открыли профессию"],
  ["source_gate_view", "Упёрлись в гейт входа"],
  ["signup_start", "Начали регистрацию"],
  ["signup_complete", "Завершили регистрацию"],
  ["source_click", "Открыли материал"],
  ["source_view_submit", "Отметка просмотра"],
  ["source_review_submit", "Голос за материал"],
] as const;

/** Выгрузка аналитики для админки: CSV или PDF. */
export async function GET(request: Request) {
  const admin = await requireApiCapability("metrics:read");
  if (!admin) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const format = params.get("format") === "pdf" ? "pdf" : "csv";
  const daysParam = params.get("days") ?? "30";
  const period = PERIOD_LABEL[daysParam] ? daysParam : "30";
  const since = period === "all" ? undefined : new Date(Date.now() - Number(period) * 86_400_000);
  const byPeriod = since ? { gte: since } : undefined;

  const db = getDb();
  const [usersTotal, usersNew, favorites, views, reviews, feedbackTotal, eventGroups, feedbackGroups, decisions] =
    await Promise.all([
      db.user.count(),
      db.user.count({ where: since ? { createdAt: byPeriod } : {} }),
      db.favorite.count({ where: since ? { createdAt: byPeriod } : {} }),
      db.sourceView.count({ where: since ? { firstViewedAt: byPeriod } : {} }),
      db.sourceReview.count({ where: since ? { createdAt: byPeriod } : {} }),
      db.feedback.count({ where: since ? { createdAt: byPeriod } : {} }),
      db.analyticsEvent.groupBy({
        by: ["name"],
        where: since ? { createdAt: byPeriod } : {},
        _count: { _all: true },
      }),
      db.feedback.groupBy({
        by: ["type"],
        where: since ? { createdAt: byPeriod } : {},
        _count: { _all: true },
      }),
      db.materialDecision.findMany({ where: { revokedAt: null }, select: { action: true } }),
    ]);

  const eventCount = new Map(eventGroups.map((group) => [group.name, group._count._all]));
  const approved = decisions.filter((row) => row.action === "APPROVE").length;
  const blocked = decisions.filter((row) => row.action === "BLOCK").length;
  const today = new Date().toISOString().slice(0, 10);

  const metrics: Array<[string, number]> = [
    ["Пользователи всего", usersTotal],
    [`Новые пользователи (${PERIOD_LABEL[period]})`, usersNew],
    ["Сохранения", favorites],
    ["Просмотры материалов", views],
    ["Голоса за материалы", reviews],
    ["Обратная связь", feedbackTotal],
    ["Подтверждено материалов", approved],
    ["Заблокировано материалов", blocked],
  ];

  if (format === "csv") {
    const rows: Array<Array<string | number>> = [["metric", "value"]];
    for (const [label, value] of metrics) rows.push([label, value]);
    for (const [name, label] of FUNNEL) rows.push([`Событие: ${label}`, eventCount.get(name) ?? 0]);
    for (const group of feedbackGroups) rows.push([`Обратная связь: ${group.type}`, group._count._all]);
    return csvResponse(toCsv(rows), `axiona-metrics-${period}-${today}.csv`);
  }

  const pdf = await buildPdf({
    title: "Аналитика",
    subtitle: `Период: ${PERIOD_LABEL[period]} · выгрузка от ${today}`,
    sections: [
      { heading: "Показатели", lines: metrics.map(([label, value]) => `${label}: ${value}`) },
      {
        heading: "Воронка (события)",
        lines: FUNNEL.map(([name, label]) => `${label}: ${eventCount.get(name) ?? 0}`),
      },
      {
        heading: "Обратная связь по типам",
        lines:
          feedbackGroups.length > 0
            ? feedbackGroups.map((group) => `${group.type}: ${group._count._all}`)
            : ["Пока нет отзывов за период"],
      },
    ],
  });
  return pdfResponse(pdf, `axiona-metrics-${period}-${today}.pdf`);
}
