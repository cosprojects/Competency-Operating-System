import Link from "next/link";
import { redirect } from "next/navigation";
import { SavedProfessionCard, SavedSkillCard } from "@/components/saved/SavedCards";
import type { SavedProfessionView, SavedSkillView } from "@/components/saved/SavedCards";
import { WelcomeNotice } from "@/components/account/WelcomeNotice";
import { getCurrentUser } from "@/lib/auth";
import { contentTypeSummary, findCompetencies, getProfessions, tierLabel } from "@/lib/content";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Сохранённое — AXIONA",
};

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
  const favorites = await db.favorite.findMany({
    where: { userId: user.id, targetType: { in: ["PROFESSION", "COMPETENCY"] } },
    orderBy: { createdAt: "desc" },
  });
  const savedProfessionSlugs = new Set(
    favorites.filter((item) => item.targetType === "PROFESSION").map((item) => item.targetId),
  );
  const savedCompetencyIds = new Set(
    favorites.filter((item) => item.targetType === "COMPETENCY").map((item) => item.targetId),
  );

  const professions: SavedProfessionView[] = [];
  const seenProfessions = new Set<string>();
  for (const profession of getProfessions()) {
    if (!savedProfessionSlugs.has(profession.slug)) continue;
    seenProfessions.add(profession.slug);
    professions.push({
      slug: profession.slug,
      title: profession.title,
      description: profession.description,
      published: profession.coverage.published,
      total: profession.coverage.total,
      percent: profession.coverage.percent,
    });
  }

  const skills: SavedSkillView[] = [];
  const seenSkills = new Set<string>();
  for (const profession of getProfessions()) {
    for (const competency of profession.sections.flatMap((section) => section.competencies)) {
      if (!savedCompetencyIds.has(competency.id) || seenSkills.has(competency.id)) continue;
      seenSkills.add(competency.id);
      skills.push({
        id: competency.id,
        title: competency.title,
        definition: competency.definition,
        tierLabel: tierLabel(competency.tier),
        tierClass: competency.tier,
        summary: contentTypeSummary(competency),
        professionSlug: profession.slug,
      });
    }
  }
  // Данные до связки: профессия для сохранённой компетенции может быть не сохранена явно.
  for (const competencyId of savedCompetencyIds) {
    if (seenProfessions.size > 0) break;
    const occurrence = findCompetencies(competencyId)[0];
    if (!occurrence) continue;
    seenProfessions.add(occurrence.profession.slug);
    professions.push({
      slug: occurrence.profession.slug,
      title: occurrence.profession.title,
      description: occurrence.profession.description,
      published: occurrence.profession.coverage.published,
      total: occurrence.profession.coverage.total,
      percent: occurrence.profession.coverage.percent,
    });
  }

  const visibleProfessions = query
    ? professions.filter(
        (profession) =>
          profession.title.toLowerCase().includes(query) ||
          profession.description.toLowerCase().includes(query),
      )
    : professions;
  const visibleSkills = query
    ? skills.filter(
        (skill) =>
          skill.title.toLowerCase().includes(query) || skill.definition.toLowerCase().includes(query),
      )
    : skills;

  const empty = visibleProfessions.length === 0 && visibleSkills.length === 0;

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Профиль</div>
        <h1>Сохранённое</h1>
        <p>Профессии и компетенции, к которым вы хотите вернуться.</p>
        <form className="saved-search" method="get" role="search">
          <input
            className="input"
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Введите название профессии или навыка"
            aria-label="Поиск по сохранённому"
          />
        </form>
      </div>

      {welcome === "1" ? <WelcomeNotice /> : null}

      {empty ? (
        <div className="empty">
          <h2>{query ? "Ничего не найдено" : "Пока пусто"}</h2>
          <p>
            {query
              ? "Проверьте запрос или сохраните новые профессии и компетенции."
              : "Откройте профессию и сохраните её или компетенцию — они появятся здесь."}
          </p>
          <Link className="button" href="/professions">
            Выбрать профессию
          </Link>
        </div>
      ) : (
        <>
          {visibleProfessions.length > 0 ? (
            <section className="saved-section">
              <h2>Профессии</h2>
              <div className="saved-section-box saved-professions">
                {visibleProfessions.map((profession) => (
                  <SavedProfessionCard key={profession.slug} profession={profession} />
                ))}
              </div>
            </section>
          ) : null}

          {visibleSkills.length > 0 ? (
            <section className="saved-section">
              <h2>Навыки и знания</h2>
              <div className="saved-section-box">
                <div className="saved-skills">
                  {visibleSkills.map((skill) => (
                    <SavedSkillCard key={skill.id} skill={skill} />
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          <aside className="saved-notice">
            <div className="saved-notice-title">Помогите нам сделать систему полезнее</div>
            <p>
              Мы хотим, чтобы эти карты действительно помогали людям ориентироваться в профессии,
              находить новые направления для развития и понимать, какие знания могут быть полезны в
              работе. Поделитесь своим мнением — ваш опыт поможет сделать систему точнее и полезнее.
            </p>
            <Link className="saved-notice-button" href="/feedback">
              Поделитесь своим мнением
            </Link>
          </aside>
        </>
      )}
    </>
  );
}
