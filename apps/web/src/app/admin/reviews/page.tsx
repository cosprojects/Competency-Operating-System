import Link from "next/link";
import { AdminReviewActions } from "@/components/admin/AdminReviewActions";
import { requireAdmin } from "@/lib/admin";
import { findCompetency, findSource } from "@/lib/content";
import { getDb } from "@/lib/db";
import { resolveSourceReviewStatus, sourceReviewBadge } from "@/lib/source-review";
import { getActiveLoggedInUsers } from "@/lib/source-review-server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Спорные материалы — AXIONA admin",
};

interface Counts {
  sourceId: string;
  competencyId: string;
  confirms: number;
  blocks: number;
}

/** Очередь спорных материалов: блокировки пользователей и админ-решения (COS-REL-009). */
export default async function AdminReviewsPage() {
  await requireAdmin("/admin/reviews");
  const db = getDb();
  const [grouped, wide, adminRows, comments, activeUsers] = await Promise.all([
    db.sourceReview.groupBy({
      by: ["sourceId", "competencyId", "action"],
      where: { scope: "competency" },
      _count: { _all: true },
    }),
    db.sourceReview.groupBy({
      by: ["sourceId", "action"],
      where: { scope: "source" },
      _count: { _all: true },
    }),
    db.sourceReview.findMany({
      where: { actorKey: { startsWith: "admin:" }, action: "BLOCK" },
      select: { sourceId: true },
    }),
    db.sourceReview.findMany({
      where: { comment: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { sourceId: true, competencyId: true, comment: true, action: true, createdAt: true },
    }),
    getActiveLoggedInUsers(db),
  ]);

  const pairs = new Map<string, Counts>();
  const touch = (sourceId: string, competencyId: string): Counts => {
    const key = `${sourceId}|${competencyId}`;
    const existing = pairs.get(key);
    if (existing) return existing;
    const created = { sourceId, competencyId, confirms: 0, blocks: 0 };
    pairs.set(key, created);
    return created;
  };
  for (const row of grouped) {
    const pair = touch(row.sourceId, row.competencyId);
    if (row.action === "BLOCK") pair.blocks += row._count._all;
    else pair.confirms += row._count._all;
  }
  const wideBlocks = new Map<string, number>();
  for (const row of wide) {
    if (row.action !== "BLOCK") continue;
    wideBlocks.set(row.sourceId, row._count._all);
    const existing = [...pairs.values()].filter((pair) => pair.sourceId === row.sourceId);
    if (existing.length === 0) touch(row.sourceId, "*").blocks += row._count._all;
    else for (const pair of existing) pair.blocks += row._count._all;
  }
  const adminBlocked = new Set(adminRows.map((row) => row.sourceId));
  const lastComment = new Map<string, { comment: string; action: string; at: Date }>();
  for (const row of comments) {
    const key = `${row.sourceId}|${row.competencyId}`;
    if (!lastComment.has(key) && row.comment) {
      lastComment.set(key, { comment: row.comment, action: row.action, at: row.createdAt });
    }
  }

  const rows = [...pairs.values()]
    .map((pair) => {
      const status = resolveSourceReviewStatus({
        baseStatus: "needs_confirmation",
        counts: { confirms: pair.confirms, blocks: pair.blocks },
        activeUsers,
      });
      return { ...pair, status };
    })
    .filter((row) => row.blocks > 0 || adminBlocked.has(row.sourceId))
    .sort((a, b) => b.blocks - a.blocks || b.confirms - a.confirms);

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Админка</div>
        <h1>Спорные материалы</h1>
        <p>
          Очередь блокировок: пользовательские голоса и админ-решения. Активных залогиненных за
          30 дней: {activeUsers}. Порог — {Math.max(2, Math.ceil(activeUsers * 0.05))} блокировок и{" "}
          {Math.max(2, Math.ceil(activeUsers * 0.1))} подтверждений.
        </p>
        <div className="actions" style={{ marginTop: 14 }}>
          <Link className="button secondary small" href="/admin/feedback">
            Обратная связь
          </Link>
          <Link className="button secondary small" href="/admin/metrics">
            Метрики
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          <h2>Спорных материалов нет</h2>
          <p>Когда пользователи начнут блокировать материалы, они появятся здесь.</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Материал</th>
                <th>Компетенция</th>
                <th>Подтверждений</th>
                <th>Блокировок</th>
                <th>Статус</th>
                <th>Последний комментарий</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const source = findSource(row.sourceId);
                const competency =
                  row.competencyId === "*" ? undefined : findCompetency(row.competencyId);
                const badge = sourceReviewBadge(row.status);
                const comment = lastComment.get(`${row.sourceId}|${row.competencyId}`);
                return (
                  <tr key={`${row.sourceId}|${row.competencyId}`}>
                    <td style={{ maxWidth: 280 }}>
                      {source?.title ?? row.sourceId}
                      <div className="small muted">{row.sourceId}</div>
                    </td>
                    <td style={{ maxWidth: 220 }}>
                      {competency?.competency.title ?? (row.competencyId === "*" ? "весь материал" : row.competencyId)}
                    </td>
                    <td>{row.confirms}</td>
                    <td>
                      {row.blocks}
                      {wideBlocks.get(row.sourceId) ? (
                        <span className="small muted"> (в т.ч. на источник)</span>
                      ) : null}
                    </td>
                    <td>{badge?.label ?? row.status}</td>
                    <td style={{ maxWidth: 300 }}>
                      {comment ? (
                        <>
                          <div>{comment.comment}</div>
                          <div className="small muted">
                            {comment.action} · {comment.at.toISOString().slice(0, 10)}
                          </div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <AdminReviewActions sourceId={row.sourceId} adminBlocked={adminBlocked.has(row.sourceId)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
