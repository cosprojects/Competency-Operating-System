import type { Metadata } from "next";
import { Eyebrow } from "@/components/ui/Eyebrow";
import Link from "next/link";
import { WelcomeToast } from "@/components/account/WelcomeToast";
import { IconCheckCircle } from "@/components/icons";
import { HomeWhyButton } from "@/components/home/HomeWhyButton";
import { ProfessionTile } from "@/components/ProfessionTile";
import type { SearchProfession } from "@/components/ProfessionTile";
import { allChangelog, formatChangelogDate } from "@/content/changelog";
import { SiteFooter } from "@/components/SiteFooter";
import { PrimaryCta } from "@/components/ui/PrimaryCta";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getProfessions, pluralWord, professionSphere } from "@/lib/content";
import { sphereBadgeStyle } from "@/lib/spheres";

export const metadata: Metadata = {
  title: "AXIONA — разберись в профессии и строй свой путь развития",
  description:
    "AXIONA собирает профессиональные знания и навыки в понятную структуру: компетенции, знания, навыки и материалы для развития.",
};

const START_STEPS = [
  {
    title: "Выберите направление",
    text: "Посмотрите разделы и поймите, из чего состоит направление.",
  },
  {
    title: "Откройте компетенцию",
    text: "Проверьте, какие знания и навыки в неё входят и что с ними делать.",
  },
  {
    title: "Найдите материал",
    text: "Посмотрите разделы и поймите, из чего состоит направление.",
  },
];

const ROADMAP = [
  { stage: "01 · Сейчас", title: "Beta • Карта профессий • План развития • Прогресс изучения", text: "Уже открыта: Направления дизайна, компетенции, знания, навыки и материалы к ним, где видно, что на чём стоит. Структура улучшается и обновляется." },
  { stage: "02 · Дальше", title: "Больше направлений и проверенная база", text: "Добавим новые профессии и будем следить за качеством: формулировки компетенций, связи между ними и учебные источники." },
  { stage: "03 · Дальше", title: "Личное пространство", text: "Появится сохранение компетенций и материалов, статусы изучения и цель — чтобы возвращаться к своему плану, а не искать заново." },
  { stage: "04 · Дальше", title: "Профиль компетенций", text: "Соберём картину твоих навыков и поможем оценить текущий уровень знаний в направлении." },
  { stage: "05 · Дальше", title: "Персональный маршрут развития", text: "Построим индивидуальный маршрут к выбранной цели и покажем с чего начать, а результат шагов будет виден в профиле." },
  { stage: "06 · Позже", title: "Команды и организации", text: "Общий язык компетенций для команд со своей методологией развития: цели развития, пробелы, прогресс и управление." },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { welcome } = await searchParams;
  const user = await getCurrentUser();
  let savedSlugs: string[] = [];
  if (user) {
    const favorites = await getDb().favorite.findMany({
      where: { userId: user.id, targetType: "PROFESSION" },
    });
    savedSlugs = favorites.map((favorite) => favorite.targetId);
  }
  const saved = new Set(savedSlugs);

  // Карточки главной — та же ProfessionTile, что и в разделе «Направления»;
  // отличается только скрытым прогрессом покрытия (макет 369-14582).
  const latest: SearchProfession[] = [...getProfessions()]
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
    .slice(0, 2)
    .map((profession) => {
      const sphere = professionSphere(profession);
      return {
        slug: profession.slug,
        title: profession.title,
        description: profession.description,
        sphereTitle: sphere.title,
        sphereStyle: sphereBadgeStyle(sphere.color),
        countText: `${profession.coverage.published} из ${profession.coverage.total} ${pluralWord(
          profession.coverage.total,
          ["компетенция", "компетенции", "компетенций"],
        )}`,
        percent: profession.coverage.percent,
        searchText: "",
      };
    });

  return (
    <>
      <div className="home2">
        <div className="home2-frame">
        <div className="home2-hero">
          <video
            className="home2-hero-video"
            src="/assets/content/AXIONA-bg.mp4"
            poster="/assets/content/AXIONA-bg-poster.png"
            autoPlay
            muted
            loop
            playsInline
            aria-hidden="true"
          />
          <section className="home2-sec1">
            <div className="home2-hero-copy">
              <Eyebrow>Beta 1</Eyebrow>
              <h1>Разберись в профессии.<br />Строй свой путь развития</h1>
              <p className="home2-lead">
                AXIONA собирает профессиональные знания и навыки в понятную структуру, чтобы каждый
                мог увидеть, из чего складывается его профессия, оценить интересующие направления и
                найти материалы для обучения.
              </p>
              <div className="home2-hero-actions">
                <PrimaryCta className="button" href="/professions">Изучить направления</PrimaryCta>
                <HomeWhyButton />
              </div>
            </div>
          </section>
        </div>

        <div className="home2-main">
            <section className="home2-intro">
              <h2>Собираю все для твоего развития</h2>
              <div className="home2-start">
                {START_STEPS.map((step) => (
                  <article className="home2-start-card" key={step.title}>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="home2-latest">
              <h2>Последние добавленные</h2>
              <div className="home2-latest-grid">
                {latest.map((profession, index) => (
                  <ProfessionTile
                    key={profession.slug}
                    profession={profession}
                    index={index}
                    saved={saved.has(profession.slug)}
                    viewer={Boolean(user)}
                    showCoverage={false}
                  />
                ))}
              </div>
            </section>

            <Link className="home2-plan-banner" href="/plan">
              <img className="home2-plan-wave" src="/assets/content/bg-wave.svg" alt="" aria-hidden="true" />
              <img className="home2-plan-image" src="/assets/content/bg-plan-banner.png" alt="" aria-hidden="true" />
              <span className="home2-plan-text">
                <strong>Собери матрицу компетенций</strong>
                <span>Определи грейд и узнай, что нужно подтянуть для роста.</span>
              </span>
              <span className="home2-plan-button">Перейти к плану <img className="home2-icon" src="/icons/home/arrow-right.svg" alt="" aria-hidden="true" /></span>
            </Link>

            <section className="home2-notice">
              <p className="home2-notice-title">Помогите сделать систему полезнее</p>
              <div className="home2-notice-text">
                <p>
                  Мы хотим, чтобы эти карты действительно помогали людям ориентироваться в профессии,
                  находить новые направления для развития и понимать, какие знания могут быть полезны в
                  работе.
                </p>
                <p>
                  Попробуйте изучить карту своей профессии. Насколько полно она отражает реальные
                  требования к специалисту? Всё ли понятно? Каких компетенций, знаний или навыков не
                  хватает?
                </p>
                <p>
                  Поделитесь своим мнением. Ваш опыт поможет нам сделать систему точнее, полезнее и
                  ближе к реальным потребностям людей.
                </p>
              </div>
              <PrimaryCta className="button secondary home2-notice-button" href="/feedback">
                Поделитесь своим мнением
              </PrimaryCta>
            </section>

            <section className="home2-roadmap">
              <div className="home2-roadmap-head">
                <h2>Дорожная карта развития системы</h2>
                <p className="home2-subtitle">Последовательность этапов развития платформы компетенций.</p>
              </div>
              <div className="home2-timeline">
                {ROADMAP.map((item) => (
                  <article className="home2-stage" key={item.title}>
                    <span className="home2-stage-icon" aria-hidden="true">
                      <IconCheckCircle />
                    </span>
                    <div className="home2-stage-body">
                      <p className="home2-stage-label">{item.stage}</p>
                      <p className="home2-stage-title">{item.title}</p>
                      <p className="home2-stage-desc">{item.text}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
        </div>

        <aside className="home2-aside">
            <section className="home2-panel home2-about">
              <h2>
                <img className="home2-icon" src="/icons/home/lightbulb.svg" alt="" aria-hidden="true" /> Что такое AXIONA
              </h2>
              <p>
                Каждая профессия имеет свою структуру: знания, навыки и компетенции, необходимые для
                решения профессиональных задач. Понять, что изучать и какие навыки развивать, бывает
                сложно. AXIONA помогает увидеть профессию в целом и разобраться в её составляющих.
                Выберите интересующую вас профессию, изучите её компетенции и связанные знания. Не
                обязательно знать всё заранее — начните с того, что вам интересно, и постепенно
                поймёте свои возможности и направления развития.
              </p>
            </section>

            <section className="home2-panel home2-log" aria-labelledby="home2-log-title">
              <h2 id="home2-log-title"><img className="home2-icon" src="/icons/home/starfall.svg" alt="" aria-hidden="true" /> Последние обновления</h2>
              <div className="home2-log-list">
                {allChangelog().slice(0, 6).map((entry) => (
                  <article className="home2-log-item" key={`${entry.date}-${entry.title}`}>
                    <div className="home2-log-head">
                      <span className="home2-log-date">{formatChangelogDate(entry.date)}</span>
                      <p className="home2-log-title">{entry.title}</p>
                    </div>
                    <p className="home2-log-desc">{entry.description}</p>
                  </article>
                ))}
              </div>
            </section>
        </aside>
        </div>
      </div>
      <SiteFooter />
      {welcome === "1" ? <WelcomeToast /> : null}
    </>
  );
}
