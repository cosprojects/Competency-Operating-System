import Link from "next/link";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { SkillLevel } from "@/components/ui/SkillLevel";
import { NextStepCard } from "@/components/ui/NextStepCard";
import { PlanStudyButton } from "@/components/plan/PlanStudyButton";
import type { StudyProgress } from "@/lib/matrix-server";
import type { MatrixLevel, MatrixRequirement, MatrixRow, MatrixSummary } from "@/lib/matrix";

/** Минимум, который нужен результату: подходит и снимку из БД, и предпросмотру без аккаунта. */
export interface MatrixResultData {
  profession: { slug: string; title: string };
  grade: { code: string; title: string; requirements: MatrixRequirement[] };
  rows: MatrixRow[];
  levels: Record<string, MatrixLevel>;
  stale: boolean;
}

function studyLabel(progress: StudyProgress | undefined, anonymous = false): string {
  if (anonymous) return "появится с аккаунтом";
  if (!progress) return "нет данных об изучении";
  if (progress.totalItems === 0) return "нет знаний и навыков для отметок";
  return `изучение: ${progress.learnedItems} из ${progress.totalItems}`;
}

/** Сколько знаний и навыков компетенции отмечено «Изучено» — вторая строка карточки. */
function learnedCount(progress: StudyProgress | undefined): string {
  if (!progress) return "—";
  return `${progress.learnedItems} из ${progress.totalItems}`;
}

/** До входа «Добавить к изучению» ведёт к регистрации: сначала аккаунт, потом сохранение. */
function StudyGateLink({ className }: { className: string }) {
  return (
    <Link className={className} href={`/register?returnTo=${encodeURIComponent("/plan/result")}`}>
      Войти и добавить
    </Link>
  );
}

export function MatrixResult({
  latest,
  summary,
  study,
  anonymous = false,
}: {
  latest: MatrixResultData;
  summary: MatrixSummary;
  study: Record<string, StudyProgress>;
  /** Матрица собрана без аккаунта: живёт в браузере, добавление в «Изучаю» — после входа. */
  anonymous?: boolean;
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

      {anonymous ? (
        <section className="plan-draft-note" aria-label="Матрица без аккаунта">
          <div>
            <strong>Матрица пока живёт в этом браузере.</strong>
            <p>
              Создай аккаунт — сохраним её и откроем «Изучаю»: отметки знаний и навыков, прогресс и
              доступ с другого устройства.
            </p>
          </div>
          <Link className="button small" href={`/register?returnTo=${encodeURIComponent("/plan/result")}`}>
            Создать аккаунт
          </Link>
        </section>
      ) : null}

      <section className="plan-summary" aria-label="Итог матрицы">
        <div className="plan-summary-top">
          <div className="plan-summary-main">
            <p className="plan-summary-number">
              <strong>{summary.met}</strong>
              <span className="plan-summary-number-sep" aria-hidden="true">
                /
              </span>
              <span className="plan-summary-number-total">{summary.total}</span>
            </p>
            <p className="plan-summary-caption">Требований грейда закрыто</p>
          </div>
          <div className="plan-summary-data">
            <div className="plan-summary-stat">
              <span>Зоны роста</span>
              <strong>{summary.gaps.length}</strong>
            </div>
            <div className="plan-summary-stat">
              <span>Сильные стороны</span>
              <strong>{summary.strengths.length}</strong>
            </div>
            <div className="plan-summary-stat is-accent">
              <span>Закрыто требований</span>
              <strong>{ratio}%</strong>
            </div>
          </div>
        </div>
        {summary.total > 0 ? (
          <div
            className="plan-summary-track"
            role="img"
            aria-label={`Закрыто ${summary.met} из ${summary.total} требований грейда`}
          >
            {Array.from({ length: summary.total }, (_, index) => (
              <span
                className={`plan-summary-segment${index < summary.met ? " is-filled" : ""}`}
                key={index}
              />
            ))}
          </div>
        ) : null}
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
                const added = Boolean(progress?.saved);
                return (
                  <article
                    className={`plan-gap${added ? " is-added" : ""}`}
                    key={gap.competencyId}
                  >
                    <div className="plan-gap-head">
                      <h3>{gap.title}</h3>
                      <div className="plan-gap-levels">
                        <span className="plan-gap-levels-text">
                          Сейчас {gap.currentLevel} • Цель {gap.targetLevel}
                        </span>
                        <SkillLevel level={gap.currentLevel} target={gap.targetLevel} />
                      </div>
                    </div>
                    <div className="plan-gap-foot">
                      <div className="plan-gap-learned">
                        <span>{anonymous ? "Изучение" : "Изучено"}</span>
                        <strong>{anonymous ? "с аккаунтом" : learnedCount(progress)}</strong>
                      </div>
                      {anonymous ? (
                        <StudyGateLink className="plan-study-button" />
                      ) : (
                        <PlanStudyButton
                          competencyId={gap.competencyId}
                          professionSlug={latest.profession.slug}
                          saved={added}
                          appearance="card"
                        />
                      )}
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
                  {anonymous ? (
                    <>
                      Сейчас {nextGap.currentLevel} → цель {nextGap.targetLevel}. Создай аккаунт — сохраним
                      матрицу и откроем «Изучаю», чтобы начать с этого разрыва.
                    </>
                  ) : (
                    <>
                      Сейчас {nextGap.currentLevel} → цель {nextGap.targetLevel}. Начни с этого разрыва: добавь
                      компетенцию в «Изучаю».
                    </>
                  )}
                </p>
                {anonymous ? (
                  <Link className="button secondary small" href={`/register?returnTo=${encodeURIComponent("/plan/result")}`}>
                    Создать аккаунт
                  </Link>
                ) : (
                  <PlanStudyButton
                    competencyId={nextGap.competencyId}
                    professionSlug={latest.profession.slug}
                    saved={Boolean(nextStudy?.saved)}
                  />
                )}
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
                      <SkillLevel level={current} />
                    </td>
                    <td>{row.targetLevel}</td>
                    <td>{studyLabel(progress, anonymous)}</td>
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
