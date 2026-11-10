import Link from "next/link";
import { MaterialDecisionActions } from "@/components/admin/MaterialDecisionActions";
import { requireCapability } from "@/lib/access";
import { findCompetency, findSource } from "@/lib/content";
import { getDb } from "@/lib/db";
import { resolveSourceReviewStatus, sourceReviewBadge } from "@/lib/source-review";
import type { SourceReviewStatus } from "@/lib/source-review";
import { getActiveLoggedInUsers } from "@/lib/source-review-server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Материалы — AXIONA admin",
};

const STATUS_FILTERS = [
  ["", "Все"],
  ["needs_confirmation", "Нужно подтверждение"],
  ["disputed", "Спорные"],
  ["blocked", "Заблокированы"],
  ["confirmed", "Подтверждены"],
] as const;

interface PairRow {
  competencyId: string;
  confirms: number;
  blocks: number;
  status: SourceReviewStatus;
  comment?: { text: string; action: string; at: Date };
}

interface MaterialRow {
  sourceId: string;
  pairs: PairRow[];
  confirms: number;
  blocks: number;
  status: SourceReviewStatus;
  decision: "APPROVE" | "BLOCK" | null;
  lastComment?: { text: string; action: string; at: Date };
}

export default async function AdminMaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; status?: string }>;
}) {
  await requireCapability("source-review:moderate", "/admin/materials");
  const { tab, status } = await searchParams;
  const activeTab = tab === "audit" ? "audit" : "votes";
  const db = getDb();

  const [grouped, wide, comments, activeUsers] = await Promise.all([
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
      where: { comment: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { sourceId: true, competencyId: true, comment: true, action: true, createdAt: true },
    }),
    getActiveLoggedInUsers(db),
  ]);

  const decisions = await db.materialDecision.findMany({
    where: { revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { sourceId: true, action: true },
  });
  const decisionBySource = new Map<string, "APPROVE" | "BLOCK">();
  for (const decision of decisions) {
    if (!decisionBySource.has(decision.sourceId)) {
      decisionBySource.set(decision.sourceId, decision.action as "APPROVE" | "BLOCK");
    }
  }

  const pairMap = new Map<string, PairRow>();
  const materialMap = new Map<string, MaterialRow>();
  const material = (sourceId: string): MaterialRow => {
    let row = materialMap.get(sourceId);
    if (!row) {
      row = { sourceId, pairs: [], confirms: 0, blocks: 0, status: "needs_confirmation", decision: decisionBySource.get(sourceId) ?? null };
      materialMap.set(sourceId, row);
    }
    return row;
  };
  const pair = (sourceId: string, competencyId: string): PairRow => {
    const key = `${sourceId}|${competencyId}`;
    let row = pairMap.get(key);
    if (!row) {
      row = { competencyId, confirms: 0, blocks: 0, status: "needs_confirmation" };
      pairMap.set(key, row);
      material(sourceId).pairs.push(row);
    }
    return row;
  };

  for (const entry of grouped) {
    const row = pair(entry.sourceId, entry.competencyId);
    if (entry.action === "BLOCK") row.blocks += entry._count._all;
    else row.confirms += entry._count._all;
  }
  for (const entry of wide) {
    if (entry.action !== "BLOCK") continue;
    const pairs = [...pairMap.entries()].filter(([key]) => key.startsWith(`${entry.sourceId}|`));
    if (pairs.length === 0) pair(entry.sourceId, "*").blocks += entry._count._all;
    else for (const [, row] of pairs) row.blocks += entry._count._all;
  }
  for (const [sourceId, action] of decisionBySource) {
    const row = material(sourceId);
    row.decision = action;
  }
  for (const comment of comments) {
    const row = pairMap.get(`${comment.sourceId}|${comment.competencyId}`);
    if (row && comment.comment && !row.comment) {
      row.comment = { text: comment.comment, action: comment.action, at: comment.createdAt };
    }
    const parent = materialMap.get(comment.sourceId);
    if (parent && comment.comment && !parent.lastComment) {
      parent.lastComment = { text: comment.comment, action: comment.action, at: comment.createdAt };
    }
  }

  for (const row of pairMap.values()) {
    row.status = resolveSourceReviewStatus({
      baseStatus: "needs_confirmation",
      counts: { confirms: row.confirms, blocks: row.blocks },
      activeUsers,
    });
  }

  for (const row of materialMap.values()) {
    row.confirms = row.pairs.reduce((sum, item) => sum + item.confirms, 0);
    row.blocks = row.pairs.reduce((sum, item) => sum + item.blocks, 0);
    if (row.decision === "APPROVE") row.status = "confirmed";
    else if (row.decision === "BLOCK") row.status = "blocked";
    else if (row.pairs.some((item) => item.status === "blocked")) row.status = "blocked";
    else if (row.pairs.some((item) => item.status === "disputed")) row.status = "disputed";
    else if (row.pairs.length > 0 && row.pairs.every((item) => item.status === "confirmed")) row.status = "confirmed";
    else row.status = "needs_confirmation";
  }

  const rows = [...materialMap.values()]
    .filter((row) => (status ? row.status === status : true))
    .sort((a, b) => b.blocks - a.blocks || b.confirms - a.confirms || a.sourceId.localeCompare(b.sourceId));

  const auditRows =
    activeTab === "audit"
      ? await db.reviewDecision.findMany({ orderBy: { createdAt: "desc" }, take: 100 })
      : [];

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Админка</div>
        <h1>Материалы</h1>
        <p>
          Один материал — одно решение. Голоса показываются по компетенциям, решение владельца
          действует на материал целиком. Порог: {Math.max(2, Math.ceil(activeUsers * 0.05))}{" "}
          блокировок / {Math.max(2, Math.ceil(activeUsers * 0.1))} подтверждений при {activeUsers}{" "}
          активных.
        </p>
      </div>

      <nav className="admin-tabs" aria-label="Разделы материалов">
        <Link className={`admin-tab${activeTab === "votes" ? " is-active" : ""}`} href="/admin/materials">
          Голоса пользователей
        </Link>
        <Link
          className={`admin-tab${activeTab === "audit" ? " is-active" : ""}`}
          href="/admin/materials?tab=audit"
        >
          Аудит приёмки
        </Link>
      </nav>

      {activeTab === "votes" ? (
        <>
          <div className="admin-filters">
            {STATUS_FILTERS.map(([value, label]) => (
              <Link
                key={value}
                className={`admin-filter${(status ?? "") === value ? " is-active" : ""}`}
                href={value ? `/admin/materials?status=${value}` : "/admin/materials"}
              >
                {label}
              </Link>
            ))}
          </div>

          {rows.length === 0 ? (
            <div className="empty">
              <h2>Спорных материалов нет</h2>
              <p>Когда пользователи начнут подтверждать и блокировать материалы, они появятся здесь.</p>
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Материал</th>
                    <th>Голоса по компетенциям</th>
                    <th>Итого</th>
                    <th>Статус</th>
                    <th>Комментарий</th>
                    <th>Решение</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const source = findSource(row.sourceId);
                    const badge = sourceReviewBadge(row.status);
                    return (
                      <tr key={row.sourceId}>
                        <td className="admin-cell-wide">
                          {source ? (
                            <a href={source.url} target="_blank" rel="noopener noreferrer">
                              {source.title}
                            </a>
                          ) : (
                            row.sourceId
                          )}
                          <div className="small muted">{row.sourceId}</div>
                        </td>
                        <td className="admin-cell-wide">
                          <ul className="admin-pair-list">
                            {row.pairs.map((pair) => (
                              <li key={pair.competencyId}>
                                <span>
                                  {pair.competencyId === "*"
                                    ? "весь материал"
                                    : findCompetency(pair.competencyId)?.competency.title ?? pair.competencyId}
                                </span>
                                <span className="small muted">
                                  +{pair.confirms} / −{pair.blocks}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td>
                          +{row.confirms} / −{row.blocks}
                        </td>
                        <td>{badge?.label ?? row.status}</td>
                        <td className="admin-cell-wide">
                          {row.lastComment ? (
                            <>
                              <div>{row.lastComment.text}</div>
                              <div className="small muted">
                                {row.lastComment.action} · {row.lastComment.at.toISOString().slice(0, 10)}
                              </div>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          <MaterialDecisionActions sourceId={row.sourceId} decision={row.decision} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          {auditRows.length === 0 ? (
            <div className="empty">
              <h2>Аудит приёмки пуст</h2>
              <p>Здесь появятся решения пайплайна приёмки материалов.</p>
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Материал</th>
                    <th>Компетенция</th>
                    <th>Итог</th>
                    <th>Решение</th>
                    <th>Причина</th>
                  </tr>
                </thead>
                <tbody>
                  {auditRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.createdAt.toISOString().slice(0, 10)}</td>
                      <td className="admin-cell-wide">{row.title ?? row.materialUrl}</td>
                      <td>{row.competencyId ?? "—"}</td>
                      <td>{row.outcome}</td>
                      <td>{row.decision}</td>
                      <td className="admin-cell-wide">{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
