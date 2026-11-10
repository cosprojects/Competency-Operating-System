import Link from "next/link";
import { requireCapability } from "@/lib/access";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Аналитика — AXIONA admin",
};

const PERIODS = [
  ["7", "7 дней"],
  ["30", "30 дней"],
  ["90", "90 дней"],
  ["all", "Всё время"],
] as const;

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

export default async function AdminMetricsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  await requireCapability("metrics:read", "/admin/metrics");
  const { days } = await searchParams;
  const period = days && PERIODS.some(([value]) => value === days) ? days : "30";
  const since =
    period === "all" ? undefined : new Date(Date.now() - Number(period) * 86_400_000);
  const byPeriod = since ? { gte: since } : undefined;
  const db = getDb();

  const [
    usersTotal,
    usersNew,
    favorites,
    views,
    reviews,
    feedbackTotal,
    eventGroups,
    feedbackGroups,
    eventRows,
    decisions,
    audit,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: since ? { createdAt: byPeriod } : {} }),
    db.favorite.count({ where: since ? { createdAt: byPeriod } : {} }),
    db.sourceView.count({ where: since ? { firstViewedAt: byPeriod } : {} }),
    db.sourceReview.count({ where: since ? { createdAt: byPeriod } : {} }),
    db.feedback.count({ where: since ? { createdAt: byPeriod } : {} }),
    db.analyticsEvent.groupBy({ by: ["name"], where: since ? { createdAt: byPeriod } : {}, _count: { _all: true } }),
    db.feedback.groupBy({ by: ["type"], where: since ? { createdAt: byPeriod } : {}, _count: { _all: true } }),
    db.analyticsEvent.findMany({
      where: since ? { createdAt: byPeriod } : {},
      select: { name: true, userId: true, anonId: true },
    }),
    db.materialDecision.findMany({ where: { revokedAt: null }, select: { action: true } }),
    db.adminAudit.findMany({ orderBy: { createdAt: "desc" }, take: 15 }),
  ]);

  const eventCount = new Map(eventGroups.map((group) => [group.name, group._count._all]));
  const activeUsers = new Set(eventRows.map((row) => row.userId ?? row.anonId).filter(Boolean)).size;
  const approved = decisions.filter((row) => row.action === "APPROVE").length;
  const blocked = decisions.filter((row) => row.action === "BLOCK").length;

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Админка</div>
        <h1>Аналитика</h1>
        <p>
          Только first-party события. На малой выборке это ориентиры, а не доказательство спроса:
          смотри период и знаменатель.
        </p>
        <div className="admin-filters" style={{ marginTop: 14 }}>
          {PERIODS.map(([value, label]) => (
            <Link
              key={value}
              className={`admin-filter${period === value ? " is-active" : ""}`}
              href={`/admin/metrics?days=${value}`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="card-grid">
        <div className="card">
          <span className="small muted">Пользователи всего</span>
          <h2 style={{ marginTop: 6 }}>{usersTotal}</h2>
          <span className="small muted">+{usersNew} за период</span>
        </div>
        <div className="card">
          <span className="small muted">Активные (события)</span>
          <h2 style={{ marginTop: 6 }}>{activeUsers}</h2>
          <span className="small muted">за период</span>
        </div>
        <div className="card">
          <span className="small muted">Сохранения</span>
          <h2 style={{ marginTop: 6 }}>{favorites}</h2>
          <span className="small muted">за период</span>
        </div>
        <div className="card">
          <span className="small muted">Просмотры материалов</span>
          <h2 style={{ marginTop: 6 }}>{views}</h2>
          <span className="small muted">за период</span>
        </div>
        <div className="card">
          <span className="small muted">Голоса за материалы</span>
          <h2 style={{ marginTop: 6 }}>{reviews}</h2>
          <span className="small muted">за период</span>
        </div>
        <div className="card">
          <span className="small muted">Отзывы</span>
          <h2 style={{ marginTop: 6 }}>{feedbackTotal}</h2>
          <span className="small muted">за период</span>
        </div>
      </div>

      <section className="section">
        <h2>Воронка</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Шаг</th>
              <th>Событий</th>
            </tr>
          </thead>
          <tbody>
            {FUNNEL.map(([name, label]) => (
              <tr key={name}>
                <td>{label}</td>
                <td>{eventCount.get(name) ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="small muted" style={{ marginTop: 10 }}>
          Воронка строится по событиям и пишется только при согласии на аналитику. Всего аккаунтов
          и новые за период — в карточке «Пользователи» выше.
        </p>
      </section>

      <section className="section">
        <h2>Материалы</h2>
        <div className="card-grid">
          <div className="card">
            <span className="small muted">Одобрено владельцем</span>
            <h2 style={{ marginTop: 6 }}>{approved}</h2>
          </div>
          <div className="card">
            <span className="small muted">Заблокировано владельцем</span>
            <h2 style={{ marginTop: 6 }}>{blocked}</h2>
          </div>
        </div>
        <h3 style={{ marginTop: 18 }}>Отзывы по типам</h3>
        {feedbackGroups.length === 0 ? (
          <div className="empty"><p>Отзывов пока нет.</p></div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Тип</th>
                <th>Количество</th>
              </tr>
            </thead>
            <tbody>
              {feedbackGroups.map((group) => (
                <tr key={group.type}>
                  <td>{group.type}</td>
                  <td>{group._count._all}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="section">
        <h2>События</h2>
        {eventGroups.length === 0 ? (
          <div className="empty"><p>Событий пока нет. Проверь consent и отправку событий.</p></div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Событие</th>
                <th>Количество</th>
              </tr>
            </thead>
            <tbody>
              {[...eventGroups]
                .sort((a, b) => b._count._all - a._count._all)
                .map((group) => (
                  <tr key={group.name}>
                    <td>{group.name}</td>
                    <td>{group._count._all}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="section">
        <h2>Последние действия владельца</h2>
        {audit.length === 0 ? (
          <div className="empty"><p>Действий пока нет.</p></div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Кто</th>
                <th>Действие</th>
                <th>Объект</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((row) => (
                <tr key={row.id}>
                  <td>{row.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                  <td>{row.actorEmail}</td>
                  <td>{row.action}</td>
                  <td>{row.targetId ?? row.targetType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
