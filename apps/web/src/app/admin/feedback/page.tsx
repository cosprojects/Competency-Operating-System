import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { FeedbackStatusSelect } from "@/components/FeedbackStatusSelect";
import { requireAdmin } from "@/lib/admin";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Отзывы — AXIONA admin",
};

const STATUSES = ["NEW", "TRIAGED", "RESOLVED"] as const;
const TYPES = [
  "CONTENT_ERROR",
  "MISSING_COMPETENCY",
  "BAD_MATERIAL",
  "MISSING_FEATURE",
  "IMPROVEMENT",
  "GENERAL",
] as const;

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string }>;
}) {
  await requireAdmin();
  const { status, type } = await searchParams;
  const where: Prisma.FeedbackWhereInput = {};
  if (status && STATUSES.includes(status as (typeof STATUSES)[number])) {
    where.status = status as (typeof STATUSES)[number];
  }
  if (type && TYPES.includes(type as (typeof TYPES)[number])) {
    where.type = type as (typeof TYPES)[number];
  }

  const db = getDb();
  const [items, total] = await Promise.all([
    db.feedback.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 }),
    db.feedback.count({ where }),
  ]);

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Админка</div>
        <h1>Обратная связь</h1>
        <p>
          Показано {items.length} из {total}. Статусы: NEW → TRIAGED → RESOLVED. CSV — для
          еженедельного разбора.
        </p>
        <div className="actions" style={{ marginTop: 14 }}>
          <Link className="button secondary small" href="/admin/feedback/export">
            Скачать CSV
          </Link>
          <Link className="button secondary small" href="/admin/metrics">
            Метрики
          </Link>
        </div>
      </div>

      <form className="card" method="get" style={{ marginBottom: 16 }}>
        <div className="form-row">
          <div className="field">
            <label htmlFor="status">Статус</label>
            <select className="select" id="status" name="status" defaultValue={status ?? ""}>
              <option value="">Все</option>
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="type">Тип</label>
            <select className="select" id="type" name="type" defaultValue={type ?? ""}>
              <option value="">Все</option>
              {TYPES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <button className="button small" type="submit" style={{ alignSelf: "end" }}>
            Фильтровать
          </button>
        </div>
      </form>

      {items.length === 0 ? (
        <div className="empty">
          <h2>Отзывов пока нет</h2>
          <p>Форма работает, но сообщений ещё не было.</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Тип</th>
                <th>Объект</th>
                <th>Оценка</th>
                <th>Комментарий</th>
                <th>Контакт</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                  <td>{item.type}</td>
                  <td>
                    {item.targetType ? `${item.targetType}: ${item.targetId ?? ""}` : "—"}
                    <div className="small muted">{item.pagePath}</div>
                  </td>
                  <td>{item.rating ?? "—"}</td>
                  <td style={{ maxWidth: 360 }}>{item.comment ?? "—"}</td>
                  <td>{item.contactEmail ?? (item.userId ? "аккаунт" : "аноним")}</td>
                  <td>
                    <FeedbackStatusSelect
                      feedbackId={item.id}
                      initialStatus={item.status as (typeof STATUSES)[number]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
