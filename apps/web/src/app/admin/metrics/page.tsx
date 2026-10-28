import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Метрики — AXIONA admin",
};

export default async function AdminMetricsPage() {
  await requireAdmin("/admin/metrics");
  const db = getDb();
  const [users, favorites, statuses, events, eventGroups, feedbackGroups, feedbackTotal] =
    await Promise.all([
      db.user.count(),
      db.favorite.count(),
      db.studyStatus.count(),
      db.analyticsEvent.count(),
      db.analyticsEvent.groupBy({ by: ["name"], _count: { _all: true } }),
      db.feedback.groupBy({ by: ["type"], _count: { _all: true } }),
      db.feedback.count(),
    ]);

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Админка</div>
        <h1>Метрики Beta</h1>
        <p>
          Только first-party события. На малой выборке это ориентиры, а не доказательство спроса.
          Смотрите знаменатель и период.
        </p>
        <div className="actions" style={{ marginTop: 14 }}>
          <Link className="button secondary small" href="/admin/feedback">
            Отзывы
          </Link>
        </div>
      </div>

      <div className="card-grid">
        <div className="card">
          <span className="small muted">Пользователи</span>
          <h2 style={{ marginTop: 6 }}>{users}</h2>
        </div>
        <div className="card">
          <span className="small muted">Сохранения</span>
          <h2 style={{ marginTop: 6 }}>{favorites}</h2>
        </div>
        <div className="card">
          <span className="small muted">Статусы</span>
          <h2 style={{ marginTop: 6 }}>{statuses}</h2>
        </div>
        <div className="card">
          <span className="small muted">Отзывы</span>
          <h2 style={{ marginTop: 6 }}>{feedbackTotal}</h2>
        </div>
        <div className="card">
          <span className="small muted">События</span>
          <h2 style={{ marginTop: 6 }}>{events}</h2>
        </div>
      </div>

      <section className="section">
        <h2>События</h2>
        {eventGroups.length === 0 ? (
          <div className="empty">
            <p>Событий пока нет. Проверьте consent и отправку событий.</p>
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Событие</th>
                <th>Количество</th>
              </tr>
            </thead>
            <tbody>
              {eventGroups
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
        <h2>Отзывы по типам</h2>
        {feedbackGroups.length === 0 ? (
          <div className="empty">
            <p>Отзывов пока нет.</p>
          </div>
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
    </>
  );
}
