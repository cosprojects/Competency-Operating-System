import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProfessionCanvas } from "@/components/canvas/ProfessionCanvas";
import type { CanvasCompetency, CanvasProfession, CompetencyStates } from "@/components/canvas/types";
import { ViewEvent } from "@/components/ViewEvent";
import { getCurrentUser } from "@/lib/auth";
import { findCompetencies, getProfession, professionSphere } from "@/lib/content";
import { getDb } from "@/lib/db";
import { loadProfessionSourceReviews } from "@/lib/source-review-server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const profession = getProfession(slug);
  if (!profession) return { title: "Профессия — AXIONA" };
  return {
    title: `${profession.title} — карта компетенций AXIONA`,
    description: profession.description,
  };
}

export default async function ProfessionCanvasPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ competency?: string; view?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const profession = getProfession(slug);
  if (!profession) notFound();

  const user = await getCurrentUser();
  const db = getDb();
  const competencyIds = profession.sections.flatMap((section) =>
    section.competencies.map((competency) => competency.id),
  );
  // Подтверждения и блокировки материалов (COS-REL-009): статусы считаются на сервере,
  // заблокированные карточки не доходят до клиента.
  const reviewIndex = await loadProfessionSourceReviews(db, profession, user?.id ?? null);

  const states: CompetencyStates = {};
  let professionSaved = false;
  const viewedSourceIds = new Set<string>();
  if (user) {
    const [favorites, studyStatuses, views] = await Promise.all([
      db.favorite.findMany({ where: { userId: user.id } }),
      db.studyStatus.findMany({ where: { userId: user.id } }),
      db.sourceView.findMany({ where: { userId: user.id }, select: { sourceId: true } }),
    ]);
    for (const view of views) viewedSourceIds.add(view.sourceId);
    const savedIds = new Set(
      favorites.filter((favorite) => favorite.targetType === "COMPETENCY").map((favorite) => favorite.targetId),
    );
    professionSaved = favorites.some(
      (favorite) => favorite.targetType === "PROFESSION" && favorite.targetId === profession.slug,
    );
    const statusById = new Map(studyStatuses.map((record) => [record.competencyId, record.status]));
    for (const id of competencyIds) {
      states[id] = {
        saved: savedIds.has(id),
        status: (statusById.get(id) ?? "NOT_STARTED") as "NOT_STARTED" | "LEARNING" | "LEARNED",
      };
    }
  }

  const competencies: CanvasCompetency[] = profession.sections.flatMap((section) =>
    section.competencies.map((competency) => ({
      id: competency.id,
      title: competency.title,
      ...(competency.titleEn ? { titleEn: competency.titleEn } : {}),
      definition: competency.definition,
      tier: competency.tier,
      order: competency.order,
      sectionId: section.id,
      sectionTitle: section.title,
      prerequisites: competency.prerequisites,
      knowledge: competency.knowledge,
      skills: competency.skills,
      sources: competency.sources
        .filter((source) => !reviewIndex.hidden.has(`${competency.id}|${source.id}`))
        .map((source) => {
          const review = reviewIndex.byPair.get(`${competency.id}|${source.id}`);
          return {
            ...source,
            ...(review ? { reviewStatus: review.status, myReviewAction: review.myAction } : {}),
            ...(viewedSourceIds.has(source.id) ? { viewed: true } : {}),
          };
        }),
      occurrences: findCompetencies(competency.id).map((occurrence) => ({
        professionSlug: occurrence.profession.slug,
        professionTitle: occurrence.profession.title,
        sectionTitle: occurrence.section.title,
      })),
    })),
  );

  const sphere = professionSphere(profession);
  const canvasProfession: CanvasProfession = {
    slug: profession.slug,
    title: profession.title,
    sphere: { title: sphere.title, color: sphere.color },
    ...(profession.titleEn ? { titleEn: profession.titleEn } : {}),
    description: profession.description,
    published: profession.coverage.published,
    total: profession.coverage.total,
    percent: profession.coverage.percent,
    sections: profession.sections.map((section) => ({
      id: section.id,
      title: section.title,
      competencyIds: section.competencies.map((competency) => competency.id),
    })),
  };

  const initialCompetencyId =
    query.competency && competencyIds.includes(query.competency) ? query.competency : undefined;
  const initialView = query.view === "network" ? "network" : "board";

  return (
    <>
      <ViewEvent name="profession_view" props={{ profession_id: profession.id }} />
      <ProfessionCanvas
        profession={canvasProfession}
        competencies={competencies}
        states={states}
        viewer={user ? { email: user.email } : null}
        professionSaved={professionSaved}
        initialCompetencyId={initialCompetencyId}
        initialView={initialView}
      />
    </>
  );
}
