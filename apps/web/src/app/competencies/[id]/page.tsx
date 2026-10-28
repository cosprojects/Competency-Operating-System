import Link from "next/link";
import { notFound } from "next/navigation";
import { FeedbackForm } from "@/components/FeedbackForm";
import { SaveButton } from "@/components/SaveButton";
import { SourceList } from "@/components/SourceList";
import { StatusSelect } from "@/components/StatusSelect";
import { ViewEvent } from "@/components/ViewEvent";
import { getCurrentUser } from "@/lib/auth";
import { findCompetencies, tierLabel } from "@/lib/content";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CompetencyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const occurrences = findCompetencies(id);
  const primary = occurrences[0];
  if (!primary) notFound();

  const user = await getCurrentUser();
  let initialSaved = false;
  let initialStatus: "NOT_STARTED" | "LEARNING" | "LEARNED" = "NOT_STARTED";
  if (user) {
    const db = getDb();
    const [favorite, statusRecord] = await Promise.all([
      db.favorite.findUnique({
        where: {
          userId_targetType_targetId: {
            userId: user.id,
            targetType: "COMPETENCY",
            targetId: id,
          },
        },
      }),
      db.studyStatus.findUnique({
        where: { userId_competencyId: { userId: user.id, competencyId: id } },
      }),
    ]);
    initialSaved = Boolean(favorite);
    initialStatus = (statusRecord?.status ?? "NOT_STARTED") as typeof initialStatus;
  }

  const competency = primary.competency;
  const returnTo = `/competencies/${id}`;

  return (
    <>
      <ViewEvent
        name="competency_view"
        props={{ profession_id: primary.profession.id, competency_id: id }}
      />
      <div className="breadcrumbs">
        <Link href="/">Главная</Link>
        <span>/</span>
        <Link href="/professions">Профессии</Link>
        <span>/</span>
        <Link href={`/professions/${primary.profession.slug}`}>{primary.profession.title}</Link>
        <span>/</span>
        <span>{competency.title}</span>
      </div>

      <div className="page-head">
        <div className="meta" style={{ justifyContent: "space-between" }}>
          <span className={`badge ${competency.tier}`}>{tierLabel(competency.tier)}</span>
          <span className="small muted">{competency.titleEn ?? ""}</span>
        </div>
        <h1>{competency.title}</h1>
        <p>{competency.definition}</p>
        <div className="meta" style={{ marginTop: 14 }}>
          {occurrences.map((item) => (
            <Link className="pill" key={item.profession.id} href={`/professions/${item.profession.slug}`}>
              {item.profession.title}
            </Link>
          ))}
        </div>
        <div className="actions" style={{ marginTop: 18 }}>
          {user ? (
            <>
              <SaveButton
                targetType="COMPETENCY"
                targetId={id}
                initialSaved={initialSaved}
              />
              <StatusSelect competencyId={id} initialStatus={initialStatus} />
            </>
          ) : (
            <Link className="button" href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>
              Войти, чтобы сохранить и открыть материалы
            </Link>
          )}
        </div>
      </div>

      <div className="two-col">
        <div className="section-list">
          <section className="section-block">
            <header>
              <div>
                <h2>Что нужно знать</h2>
                <p>Понятия и темы, на которые опирается компетенция.</p>
              </div>
              <span>{competency.knowledge.length}</span>
            </header>
            {competency.knowledge.length === 0 ? (
              <div className="notice">Состав знаний ещё уточняется.</div>
            ) : (
              <ul className="detail-list">
                {competency.knowledge.map((item) => (
                  <li key={item.id}>
                    <strong>{item.title}</strong>
                    {item.definition ? <span>{item.definition}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="section-block">
            <header>
              <div>
                <h2>Что нужно уметь</h2>
                <p>Наблюдаемые действия и практические навыки.</p>
              </div>
              <span>{competency.skills.length}</span>
            </header>
            {competency.skills.length === 0 ? (
              <div className="notice">Состав навыков ещё уточняется.</div>
            ) : (
              <ul className="detail-list">
                {competency.skills.map((item) => (
                  <li key={item.id}>
                    <strong>{item.title}</strong>
                    {item.definition ? <span>{item.definition}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="section-block">
            <header>
              <div>
                <h2>Материалы</h2>
                <p>
                  Курсы, статьи и другие источники. Ссылки открываются после входа; это позволяет
                  сохранять материалы и возвращаться к ним.
                </p>
              </div>
              <span>{competency.sources.length}</span>
            </header>
            <SourceList
              competencyId={competency.id}
              sources={competency.sources}
              canOpen={Boolean(user)}
              returnTo={returnTo}
            />
          </section>
        </div>

        <aside className="section-list">
          <section className="section-block">
            <header>
              <div>
                <h2>В профессии</h2>
                <p>Компетенция может входить в несколько направлений.</p>
              </div>
            </header>
            <div className="source-list">
              {occurrences.map((item) => (
                <Link className="source-card" key={item.profession.id} href={`/professions/${item.profession.slug}`}>
                  <h3>{item.profession.title}</h3>
                  <p>{item.section.title}</p>
                </Link>
              ))}
            </div>
          </section>

          {competency.prerequisites.length > 0 ? (
            <section className="section-block">
              <header>
                <div>
                  <h2>Сначала полезно освоить</h2>
                </div>
              </header>
              <ul className="detail-list">
                {competency.prerequisites.map((prerequisite) => (
                  <li key={prerequisite}>
                    <Link href={`/competencies/${prerequisite}`}>{prerequisite}</Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="section-block">
            <header>
              <div>
                <h2>Обратная связь</h2>
                <p>Ошибка в описании, лишний материал или пробел в карте.</p>
              </div>
            </header>
            <FeedbackForm context="competency" targetType="COMPETENCY" targetId={id} />
          </section>
        </aside>
      </div>
    </>
  );
}
