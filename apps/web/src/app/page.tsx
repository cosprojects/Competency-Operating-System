import type { Metadata } from "next";
import { Eyebrow } from "@/components/ui/Eyebrow";
import Link from "next/link";
import { WelcomeToast } from "@/components/account/WelcomeToast";
import { IconCheckCircle } from "@/components/icons";
import { HomeWhyButton } from "@/components/home/HomeWhyButton";
import { AxionaHero3D } from "@/components/home/AxionaHero3D";
import { StepCard } from "@/components/ui/StepCard";
import { ProfessionTile } from "@/components/ProfessionTile";
import type { SearchProfession } from "@/components/ProfessionTile";
import { allChangelog, formatChangelogDate } from "@/content/changelog";
import { SiteFooter } from "@/components/SiteFooter";
import { PrimaryCta } from "@/components/ui/PrimaryCta";
import { FeedbackCta } from "@/components/feedback/FeedbackCta";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getProfessions, pluralWord, professionSphere } from "@/lib/content";
import { canonical, socialMetadata } from "@/lib/site";
import { organizationJsonLd, websiteJsonLd } from "@/lib/structured-data";
import { JsonLd } from "@/components/JsonLd";
import { sphereBadgeStyle } from "@/lib/spheres";

const HOME_TITLE = "AXIONA — разберись в профессии и строй свой путь развития";
const HOME_DESCRIPTION =
  "AXIONA собирает профессиональные знания и навыки в понятную структуру: компетенции, знания, навыки и материалы для развития.";

export const metadata: Metadata = {
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  alternates: canonical("/"),
  ...socialMetadata({ title: HOME_TITLE, description: HOME_DESCRIPTION, path: "/" }),
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
  { stage: "01 · Сейчас", title: "Beta: карта профессий, план и прогресс", text: "Уже открыты направления дизайна, компетенции, знания и навыки, материалы к ним. ИПР и личное пространство изучения. Структура обновляется — покрытие видно прямо в карте." },
  { stage: "02 · Дальше", title: "Больше направлений и проверенная база", text: "Добавляем новые профессии и проверяем формулировки компетенций, связи между ними и учебные источники." },
  { stage: "03 · Дальше", title: "Методология оценки", text: "Внедрим научные и эффективные методы оценки навыков, чтобы строить картину твоих навыков и поможем оценить текущий уровень знаний в направлении." },
  { stage: "04 · Дальше", title: "Персональный маршрут развития", text: "Построим индивидуальный маршрут к выбранной цели и покажем, с чего начать, а результат шагов будет виден в профиле." },
  { stage: "05 · Позже", title: "Команды и организации", text: "Общий язык компетенций для команд со своей методологией развития: цели развития, пробелы, прогресс и управление." },
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
      <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
      <div className="home-page">
        <div className="home-page-frame">
        <div className="home-page-hero">
          <AxionaHero3D theme="light" />
          <section className="home-page-sec1">
            <div className="home-page-hero-copy">
              <Eyebrow>Beta 1</Eyebrow>
              <h1>Разберись в профессии.<br />Строй свой путь развития</h1>
              <p className="home-page-lead">
                AXIONA собирает профессиональные знания и навыки в понятную структуру, чтобы каждый
                мог увидеть, из чего складывается его профессия, оценить интересующие направления и
                найти материалы для обучения.
              </p>
              <div className="home-page-hero-actions">
                <PrimaryCta className="button" href="/professions">Изучить направления</PrimaryCta>
                <HomeWhyButton />
              </div>
            </div>
          </section>
        </div>

        <div className="home-page-main">
            <section className="home-page-intro">
              <h2>С чего начать</h2>
              <div className="home-page-start">
                {START_STEPS.map((step) => (
                  <StepCard key={step.title} title={step.title} text={step.text} />
                ))}
              </div>
            </section>

            <section className="home-page-latest">
              <h2>Последние добавленные</h2>
              <div className="home-page-latest-grid">
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

            <Link className="home-page-plan-banner" href="/plan">
              <img className="home-page-plan-wave" src="/assets/content/bg-wave.svg" alt="" aria-hidden="true" />
              <img className="home-page-plan-image" src="/assets/content/bg-plan-banner.png" alt="" aria-hidden="true" />
              <span className="home-page-plan-text">
                <strong>Собери матрицу компетенций</strong>
                <span>Определи грейд и узнай, что нужно подтянуть для роста.</span>
              </span>
              <span className="home-page-plan-button">Перейти к плану <img className="home-page-icon" src="/icons/home/arrow-right.svg" alt="" aria-hidden="true" /></span>
            </Link>

            <section className="home-page-notice">
              <p className="home-page-notice-title">Помогите сделать систему полезнее</p>
              <div className="home-page-notice-text">
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
              <FeedbackCta className="button secondary home-page-notice-button">
                Поделитесь своим мнением
              </FeedbackCta>
            </section>

            <section className="home-page-roadmap">
              <div className="home-page-roadmap-head">
                <h2>Что будет дальше</h2>
                <p className="home-page-subtitle">Этапы работы: что уже готово и что в планах.</p>
              </div>
              <div className="home-page-timeline">
                {ROADMAP.map((item) => (
                  <article className="home-page-stage" key={item.title}>
                    <span className="home-page-stage-icon" aria-hidden="true">
                      <IconCheckCircle />
                    </span>
                    <div className="home-page-stage-body">
                      <p className="home-page-stage-label">{item.stage}</p>
                      <p className="home-page-stage-title">{item.title}</p>
                      <p className="home-page-stage-desc">{item.text}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
        </div>

        <aside className="home-page-aside">
            <section className="home-page-panel home-page-about">
              <h2>
                <img className="home-page-icon" src="/icons/home/lightbulb.svg" alt="" aria-hidden="true" /> Что такое AXIONA
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

            <section className="home-page-panel home-page-log" aria-labelledby="home-page-log-title">
              <h2 id="home-page-log-title"><img className="home-page-icon" src="/icons/home/starfall.svg" alt="" aria-hidden="true" /> Последние обновления</h2>
              {/* Весь лог: список скроллится внутри блока (как в макете), а не обрезается. */}
              <div className="home-page-log-list" tabIndex={0} aria-label="Записи лога обновлений">
                {allChangelog().map((entry) => (
                  <article className="home-page-log-item" key={`${entry.date}-${entry.title}`}>
                    <div className="home-page-log-head">
                      <span className="home-page-log-date">{formatChangelogDate(entry.date)}</span>
                      <p className="home-page-log-title">{entry.title}</p>
                    </div>
                    <p className="home-page-log-desc">{entry.description}</p>
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
