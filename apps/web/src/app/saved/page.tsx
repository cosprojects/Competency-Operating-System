import Link from "next/link";
import { redirect } from "next/navigation";
import { SaveButton } from "@/components/SaveButton";
import { getCurrentUser } from "@/lib/auth";
import { findCompetency, findSource, statusLabel } from "@/lib/content";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Сохранённое — AXIONA",
};

export default async function SavedPage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?returnTo=${encodeURIComponent("/saved")}`);

  const db = getDb();
  const [favorites, statuses] = await Promise.all([
    db.favorite.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    db.studyStatus.findMany({ where: { userId: user.id } }),
  ]);
  const statusByCompetency = new Map(statuses.map((item) => [item.competencyId, item.status]));

  const competencyItems = favorites
    .filter((item) => item.targetType === "COMPETENCY")
    .map((item) => ({ favorite: item, competency: findCompetency(item.targetId) }))
    .filter((item) => Boolean(item.competency));
  const sourceItems = favorites
    .filter((item) => item.targetType === "SOURCE")
    .map((item) => ({ favorite: item, source: findSource(item.targetId) }))
    .filter((item) => Boolean(item.source));

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Личное</div>
        <h1>Сохранённое</h1>
        <p>
          Компетенции и материалы, к которым вы хотите вернуться. Статусы изучения — ваша
          самоотметка, а не подтверждение уровня.
        </p>
      </div>

      {competencyItems.length === 0 && sourceItems.length === 0 ? (
        <div className="empty">
          <h2>Пока пусто</h2>
          <p>Откройте профессию, найдите компетенцию и сохраните её или материал.</p>
          <Link className="button" href="/professions">
            Перейти к профессиям
          </Link>
        </div>
      ) : null}

      {competencyItems.length > 0 ? (
        <section className="section">
          <div className="section-head">
            <div>
              <h2>Компетенции</h2>
              <p>{competencyItems.length} сохранённых</p>
            </div>
          </div>
          <div className="card-grid">
            {competencyItems.map((item) => {
              if (!item.competency) return null;
              const status = statusByCompetency.get(item.competency.competency.id) ?? "NOT_STARTED";
              return (
                <article className="card" key={item.favorite.id}>
                  <div className="meta" style={{ justifyContent: "space-between" }}>
                    <span className="badge neutral">{item.competency.profession.title}</span>
                    <span className="small muted">{statusLabel(status)}</span>
                  </div>
                  <h3 style={{ marginTop: 10 }}>
                    <Link href={`/competencies/${item.competency.competency.id}`}>
                      {item.competency.competency.title}
                    </Link>
                  </h3>
                  <p>{item.competency.competency.definition}</p>
                  <div style={{ marginTop: 14 }}>
                    <SaveButton
                      targetType="COMPETENCY"
                      targetId={item.competency.competency.id}
                      initialSaved
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {sourceItems.length > 0 ? (
        <section className="section">
          <div className="section-head">
            <div>
              <h2>Материалы</h2>
              <p>{sourceItems.length} сохранённых</p>
            </div>
          </div>
          <div className="source-list">
            {sourceItems.map((item) => {
              if (!item.source) return null;
              return (
                <article className="source-card" key={item.favorite.id}>
                  <h3>{item.source.title}</h3>
                  <p>{item.source.summary}</p>
                  <div className="source-actions">
                    <a
                      className="button small"
                      href={item.source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Открыть материал
                    </a>
                    <SaveButton targetType="SOURCE" targetId={item.source.id} initialSaved />
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="notice info" style={{ marginTop: 22 }}>
        Сохранения привязаны к аккаунту и доступны после входа с того же email.
      </div>
    </>
  );
}
