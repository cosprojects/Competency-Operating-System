import type { Metadata } from "next";
import Link from "next/link";
import { StepCard } from "@/components/ui/StepCard";
import { ProfessionTile } from "@/components/ProfessionTile";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { MatrixCard } from "@/components/plan/MatrixCard";
import { getCurrentUser } from "@/lib/auth";
import { getProfessions } from "@/lib/content";
import { getDb } from "@/lib/db";
import { getLatestMatrix } from "@/lib/matrix-server";
import { listMatrixProfessions } from "@/lib/matrix";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "План — матрица компетенций",
  description: "Собери матрицу своих компетенций, сравни с грейдом и пойми, что подтянуть.",
};

const STEPS = [
  ["Выбери профессию", "Посмотри, какие бывают дизайнерские роли, и выбери свою."],
  ["Выбери грейд", "Сравни уровни и выбери тот, который описывает текущую работу."],
  ["Оцени компетенции", "Пройди по требованиям и отметь, где ты сейчас: от «не владею» до «лидерство»."],
  ["Разбери разрывы", "Получи матрицу, сильные стороны и список того, что подтянуть."],
];

const BENEFITS = [
  ["5–10 минут", "без длинных тестов"],
  ["13 профессий", "свой пакет у каждой"],
  ["Честные разрывы", "без оценок личности"],
  ["Можно переоценить", "матрица на самоопределение"],
];

const LEVEL_ART = [
  { code: "01", title: "Осведомлённость", text: "Понимаю область: задачи, процесс, инструменты, ограничения", tone: "lilac" },
  { code: "02", title: "Умение", text: "Решаю базовые задачи, доделываю часть работы за ведущим", tone: "sky" },
  { code: "03", title: "Экспертиза", text: "Делаю большинство задач сам, разбираюсь в нетиповой ситуации", tone: "mint" },
  { code: "04", title: "Лидерство", text: "Передаю экспертизу: обучаю, менторю, развиваю методы и культуру", tone: "blue" },
];

export default async function PlanPage() {
  const user = await getCurrentUser();
  const latest = user ? await getLatestMatrix(user.id) : null;
  const professions = listMatrixProfessions();
  const contentProfessions = new Map(getProfessions().map((profession) => [profession.slug, profession]));
  const featured = professions.slice(0, 3);
  const nextHref = user ? "/plan/start" : `/login?returnTo=${encodeURIComponent("/plan/start")}`;

  const savedProfessionIds = new Set<string>();
  if (user) {
    const db = getDb();
    const favorites = await db.favorite.findMany({
      where: {
        userId: user.id,
        targetType: "PROFESSION",
        targetId: { in: featured.map((profession) => profession.slug) },
      },
      select: { targetId: true },
    });
    for (const favorite of favorites) savedProfessionIds.add(favorite.targetId);
  }

  const met = latest ? latest.rows.filter((row) => (latest.levels[row.id] ?? 0) >= row.targetLevel).length : 0;

  return (
    <div className="plan-page plan-page--home">
      <header className="plan-hero">
        <Eyebrow>Личное развитие</Eyebrow>
        <h1>Матрица компетенций</h1>
        <p className="plan-lead">
          Собери карту своих навыков, сравни её с грейдом и пойми, что подтянуть.
          <br />
          Это самооценка, уровень ты определяешь сам, а грейд — пока только ориентир.
        </p>
        <div className="plan-hero-actions">
          <Link className="button plan-home-cta" href={nextHref}>
            Собрать матрицу
          </Link>
          {latest ? (
            <Link className="button secondary plan-home-cta" href="/plan/result">
              Посмотреть матрицу
            </Link>
          ) : null}
        </div>
      </header>

      <div className="plan-glass">
        <div className="plan-benefits" aria-label="Преимущества">
          {BENEFITS.map(([title, text]) => (
            <div key={title}>
              <strong>{title}</strong>
              <span>{text}</span>
            </div>
          ))}
        </div>

        <section className="plan-steps" aria-label="Как это работает">
          {STEPS.map(([title, text]) => (
            <StepCard key={title} title={title ?? ""} text={text ?? ""} />
          ))}
        </section>

        {!latest ? (
        <section className="plan-home-profs" aria-labelledby="plan-home-profs">
          <div className="plan-home-section-head">
            <h2 id="plan-home-profs">Выбери профессию и построй матрицу компетенций</h2>
            <Link className="plan-home-all" href="/plan/start">
              Все профессии <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="plan-home-prof-grid">
            {featured.map((profession, index) => {
              const content = contentProfessions.get(profession.slug);
              const coverage = content?.coverage;
              return (
                <ProfessionTile
                  key={profession.slug}
                  badge="Дизайн"
                  href={
                    user
                      ? `/plan/grade?profession=${profession.slug}`
                      : `/login?returnTo=${encodeURIComponent(`/plan/grade?profession=${profession.slug}`)}`
                  }
                  profession={{
                    slug: profession.slug,
                    title: profession.title,
                    description: profession.description ?? "Структура компетенций, знания, навыки и учебные материалы.",
                    countText: coverage
                      ? `${coverage.published} из ${coverage.total} компетенций`
                      : "пакет компетенций",
                    percent: coverage?.percent ?? 0,
                    searchText: profession.title,
                    sphereTitle: "Дизайн",
                    sphereStyle: { color: "", backgroundColor: "" },
                  }}
                  index={index}
                  saved={savedProfessionIds.has(profession.slug)}
                  viewer={Boolean(user)}
                />
              );
            })}
          </div>
        </section>
        ) : null}


        {latest ? <MatrixCard latest={latest} met={met} total={latest.rows.length} /> : null}

        <section className="plan-home-levels" aria-labelledby="plan-home-levels">
          <div className="plan-home-section-head">
            <div>
              <h2 id="plan-home-levels">{latest ? "Что такое уровни" : "Что такое матрица"}</h2>
              <p className="small muted">Одна шкала для оценки компетенций.</p>
            </div>
          </div>
          <div className="plan-home-level-grid">
            {LEVEL_ART.map((level) => (
              <article className="plan-home-level" key={level.code}>
                <span className={`plan-home-level-glow plan-home-level-glow--${level.tone}`} aria-hidden="true" />
                <div className="plan-home-level-card">
                  <div className="plan-home-level-head">
                    <span className="plan-home-level-num">{level.code}</span>
                    <strong>{level.title}</strong>
                  </div>
                  <p>{level.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
