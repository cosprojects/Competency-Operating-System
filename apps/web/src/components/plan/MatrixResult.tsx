import Link from "next/link";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { NextStepCard } from "@/components/ui/NextStepCard";
import { PlanStudyButton } from "@/components/plan/PlanStudyButton";
import type { LatestMatrix, StudyProgress } from "@/lib/matrix-server";
import type { MatrixSummary } from "@/lib/matrix";

function Dots({ current, target }: { current: number; target: number }) {
  return (
    <span className="plan-dots" aria-label={`Текущий уровень ${current}, цель ${target}`}>
      {[1, 2, 3, 4].map((level) => (
        <span
          key={level}
          className={`plan-dot${level <= current ? " is-filled" : ""}${level === target ? " is-target" : ""}`}
        />
      ))}
    </span>
  );
}

function studyLabel(progress: StudyProgress | undefined): string {
  if (!progress) return "нет данных об изучении";
  if (progress.totalItems === 0) return "нет знаний и навыков для отметок";
  return `изучение: ${progress.learnedItems} из ${progress.totalItems}`;
}

export function MatrixResult({
  latest,
  summary,
  study,
}: {
  latest: LatestMatrix;
  summary: MatrixSummary;
  study: Record<string, StudyProgress>;
}) {
  const ratio = summary.total === 0 ? 0 : Math.round((summary.met / summary.total) * 100);
  const reassessHref = `/plan/assess?profession=${latest.profession.slug}&grade=${latest.grade.code}`;
  const nextGap = summary.gaps[0];
  const nextStudy = nextGap ? study[nextGap.competencyId] : undefined;

  return (
    <div className="plan-result">
      <header className="plan-page-head">
        <div className="plan-result-head-row">
          <div>
            <Eyebrow>План · результат</Eyebrow>
            <h1>Твоя матрица</h1>
            <p className="plan-lead">
              {latest.profession.title} · {latest.grade.title}. Это снимок самооценки, а не подтверждённый
              уровень. Его можно пересобрать в любой момент.
            </p>
          </div>
          <Link className="button secondary small" href={reassessHref}>
            Переоценить
          </Link>
        </div>
        {latest.stale ? (
          <p className="plan-warning">
            Матрица собрана по прежней версии чек-листа. Переоцени уровни, чтобы сравнить с актуальными
            требованиями.
          </p>
        ) : null}
      </header>

      <section className="plan-summary" aria-label="Итог матрицы">
        <div className="plan-summary-main">
          <div className="plan-summary-number">
            {summary.met}
            <span> / {summary.total}</span>
          </div>
          <p>требований грейда закрыто</p>
          <div className="plan-progress-bar" aria-hidden="true">
            <span style={{ width: `${ratio}%` }} />
          </div>
        </div>
        <div className="plan-summary-percent" aria-label={`Заполнено ${ratio}%`}>
          <strong>{ratio}%</strong>
          <span>требований</span>
        </div>
        <div className="plan-summary-side">
          <div>
            <strong>{summary.strengths.length}</strong>
            <span>сильных сторон</span>
          </div>
          <div>
            <strong>{summary.gaps.length}</strong>
            <span>зон роста</span>
          </div>
        </div>
      </section>

      <div className="plan-result-grid">
        <section className="plan-section plan-gaps-panel" aria-labelledby="plan-gaps">
          <div className="plan-section-head">
            <div>
              <h2 id="plan-gaps">Что подтянуть</h2>
              <p className="small muted">
                Сначала — самые большие разрывы. «Изучение» показывает активность, но не заменяет уровень.
              </p>
            </div>
          </div>

          {summary.gaps.length === 0 ? (
            <p className="plan-empty">Все требования грейда закрыты по самооценке. Можно выбрать следующий грейд.</p>
          ) : (
            <div className="plan-gap-list">
              {summary.gaps.map((gap) => {
                const progress = study[gap.competencyId];
                return (
                  <article className="plan-gap" key={gap.competencyId}>
                    <div className="plan-gap-top">
                      <div>
                        <h3>{gap.title}</h3>
                        <p className="small muted">
                          Сейчас {gap.currentLevel} · цель {gap.targetLevel} · разрыв {gap.gap}
                        </p>
                      </div>
                      <Dots current={gap.currentLevel} target={gap.targetLevel} />
                    </div>
                    <div className="plan-gap-actions">
                      <span className="small muted">{studyLabel(progress)}</span>
                      <PlanStudyButton
                        competencyId={gap.competencyId}
                        professionSlug={latest.profession.slug}
                        saved={Boolean(progress?.saved)}
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="plan-result-side">
          <section className="plan-side-card" aria-labelledby="plan-strengths">
            <div className="plan-section-head">
              <div>
                <h2 id="plan-strengths">Сильные стороны</h2>
                <p className="small muted">Текущий уровень не ниже целевого.</p>
              </div>
            </div>
            {summary.strengths.length > 0 ? (
              <div className="plan-strength-list">
                {summary.strengths.map((item) => (
                  <span className="plan-strength-chip" key={item.competencyId}>
                    {item.title} · {item.currentLevel}
                  </span>
                ))}
              </div>
            ) : (
              <p className="small muted">Пока нет совпадений с целевым уровнем — это нормальный старт.</p>
            )}
          </section>

          <NextStepCard
            titleId="plan-next-step"
            title={nextGap ? nextGap.title : "Выбрать следующий грейд"}
            note={
              nextGap ? (
                <Link className="learning-next-note" href={reassessHref}>
                  Или переоценить уровень →
                </Link>
              ) : undefined
            }
          >
            {nextGap ? (
              <>
                <p>
                  Сейчас {nextGap.currentLevel} → цель {nextGap.targetLevel}. Начни с этого разрыва: добавь
                  компетенцию в «Изучаю».
                </p>
                <PlanStudyButton
                  competencyId={nextGap.competencyId}
                  professionSlug={latest.profession.slug}
                  saved={Boolean(nextStudy?.saved)}
                />
              </>
            ) : (
              <p>Все требования закрыты. Посмотри следующий грейд или переоцени уровни.</p>
            )}
          </NextStepCard>
        </aside>
      </div>

      <section className="plan-section" aria-labelledby="plan-table">
        <div className="plan-section-head">
          <div>
            <h2 id="plan-table">Вся матрица</h2>
            <p className="small muted">Из чего состоит твой грейд и где ты сейчас.</p>
          </div>
        </div>
        <div className="plan-table-wrap">
          <table className="plan-table">
            <thead>
              <tr>
                <th scope="col">Компетенция</th>
                <th scope="col">Сейчас</th>
                <th scope="col">Цель</th>
                <th scope="col">Изучение</th>
              </tr>
            </thead>
            <tbody>
              {latest.rows.map((row) => {
                const current = latest.levels[row.id] ?? 0;
                const progress = study[row.id];
                return (
                  <tr key={row.id}>
                    <th scope="row">{row.title}</th>
                    <td>
                      <Dots current={current} target={row.targetLevel} />
                    </td>
                    <td>{row.targetLevel}</td>
                    <td>{studyLabel(progress)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="plan-actions">
        <Link className="button" href={reassessHref}>
          Пройти заново
        </Link>
        <Link className="button secondary" href="/plan">
          К плану
        </Link>
      </div>
    </div>
  );
}
