import Link from "next/link";
import { IconSearch } from "@/components/icons";
import { redirect } from "next/navigation";
import { LearningCard } from "@/components/saved/LearningCard";
import type { LearningCardData, LearningItemData } from "@/components/saved/LearningCard";
import { WelcomeNotice } from "@/components/account/WelcomeNotice";
import { getCurrentUser } from "@/lib/auth";
import { findCompetencies, getProfessions, groupSources, tierLabel } from "@/lib/content";
import type { ContentSource } from "@/lib/content-types";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Изучаю — AXIONA",
};

type Profession = ReturnType<typeof getProfessions>[number];
type Competency = Profession["sections"][number]["competencies"][number];

function buildCard(
  competency: Competency,
  profession: Profession,
  learnedIds: Set<string>,
  saved: boolean,
): LearningCardData {
  const items: LearningItemData[] = [
    ...competency.knowledge.map((item) => ({
      id: item.id,
      title: item.title,
      definition: item.definition,
      kind: "KNOWLEDGE" as const,
      learned: learnedIds.has(item.id),
    })),
    ...competency.skills.map((item) => ({
      id: item.id,
      title: item.title,
      definition: item.definition,
      kind: "SKILL" as const,
      learned: learnedIds.has(item.id),
    })),
  ];
  const materials = groupSources(competency.sources).map((group) => ({
    title: group.title,
    sources: group.sources.map((source: ContentSource) => ({ ...source, saved: false })),
  }));
  return {
    competencyId: competency.id,
    title: competency.title,
    definition: competency.definition,
    tierLabel: tierLabel(competency.tier),
    tierClass: competency.tier,
    professionSlug: profession.slug,
    professionTitle: profession.title,
    saved,
    items,
    materials,
    occurrences: findCompetencies(competency.id).map((occurrence) => ({
      professionSlug: occurrence.profession.slug,
      professionTitle: occurrence.profession.title,
      sectionTitle: occurrence.section.title,
    })),
  };
}

export default async function SavedPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; welcome?: string }>;
}) {
  const { q, welcome } = await searchParams;
  const query = (q ?? "").trim().toLowerCase();
  const user = await getCurrentUser();
  if (!user) redirect(`/login?returnTo=${encodeURIComponent("/saved")}`);

  const db = getDb();
  const [favorites, marks] = await Promise.all([
    db.favorite.findMany({
      where: { userId: user.id, targetType: { in: ["PROFESSION", "COMPETENCY", "SOURCE"] } },
    }),
    db.studyMark.findMany({ where: { userId: user.id, status: "LEARNED" } }),
  ]);
  const savedCompetencyIds = new Set(
    favorites.filter((item) => item.targetType === "COMPETENCY").map((item) => item.targetId),
  );
  const learnedIds = new Set(marks.map((mark) => mark.targetId));

  const active: LearningCardData[] = [];
  const learned: LearningCardData[] = [];
  const seenActive = new Set<string>();
  const seenLearned = new Set<string>();

  for (const profession of getProfessions()) {
    for (const competency of profession.sections.flatMap((section) => section.competencies)) {
      const isSaved = savedCompetencyIds.has(competency.id);
      const items = [...competency.knowledge, ...competency.skills];
      const fullyLearned = items.length > 0 && items.every((item) => learnedIds.has(item.id));
      if (isSaved && !seenActive.has(competency.id)) {
        seenActive.add(competency.id);
        active.push(buildCard(competency, profession, learnedIds, true));
      }
      if (fullyLearned && !isSaved && !seenLearned.has(competency.id)) {
        seenLearned.add(competency.id);
        learned.push(buildCard(competency, profession, learnedIds, false));
      }
    }
  }

  const matches = (card: LearningCardData) =>
    !query ||
    card.title.toLowerCase().includes(query) ||
    card.definition.toLowerCase().includes(query) ||
    card.professionTitle.toLowerCase().includes(query) ||
    card.items.some((item) => item.title.toLowerCase().includes(query)) ||
    card.materials.some((group) =>
      group.sources.some((source) => source.title.toLowerCase().includes(query)),
    );

  const activeVisible = active.filter(matches);
  const learnedVisible = learned.filter(matches);
  const empty = activeVisible.length === 0 && learnedVisible.length === 0;

  return (
    <>
      <header className="studying-head">
        <div className="studying-head-text">
          <p className="eyebrow">Личное пространство</p>
          <h1>Изучаю</h1>
          <p>От намерения — к освоению. Соберите свой маршрут и двигайтесь в удобном темпе.</p>
        </div>
      </header>

      <div className="studying-toolbar">
        <nav className="studying-tabs" aria-label="Разделы «Изучаю»">
          <span className="studying-tab is-active" aria-current="page">
            Компетенции
          </span>
          <Link className="studying-tab" href="/professions">
            Профессии
          </Link>
        </nav>
        <form className="studying-search" method="get" role="search">
          <label className="sr-only" htmlFor="studying-search">
            Поиск в изучаемом
          </label>
          <IconSearch className="studying-search-icon" />
          <input
            className="studying-search-input"
            id="studying-search"
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Знание, навык или компетенция"
          />
        </form>
      </div>

      {welcome === "1" ? <WelcomeNotice /> : null}

      {empty ? (
        <div className="empty">
          <h2>{query ? "Ничего не найдено" : "Пока пусто"}</h2>
          <p>
            {query
              ? "Проверьте запрос или сохраните новые компетенции."
              : "Откройте профессию, сохраните компетенцию и отметьте знания и навыки — они появятся здесь."}
          </p>
          <Link className="button" href="/professions">
            Выбрать направление
          </Link>
        </div>
      ) : (
        <>
          <div className="studying-list">
            {activeVisible.map((card, index) => (
              <LearningCard key={card.competencyId} card={card} order={index + 1} defaultExpanded={index === 0} />
            ))}
          </div>

          {learnedVisible.length > 0 ? (
            <section className="learning-learned">
              <div className="learning-learned-head">
                <h2>Изучено</h2>
                <span>Пока это самооценка, а не подтверждение профессионального уровня.</span>
              </div>
              <div className="studying-list">
                {learnedVisible.map((card, index) => (
                  <LearningCard
                    key={`learned-${card.competencyId}`}
                    card={card}
                    order={activeVisible.length + index + 1}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}
