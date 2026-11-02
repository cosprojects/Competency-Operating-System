import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProfessionCanvas } from "@/components/canvas/ProfessionCanvas";
import type { CanvasCompetency, CanvasProfession, CompetencyStates } from "@/components/canvas/types";
import { ViewEvent } from "@/components/ViewEvent";
import { getCurrentUser } from "@/lib/auth";
import { findCompetencies, getProfession } from "@/lib/content";
import { getDb } from "@/lib/db";

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
  searchParams: Promise<{ competency?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const profession = getProfession(slug);
  if (!profession) notFound();

  const user = await getCurrentUser();
  const competencyIds = profession.sections.flatMap((section) =>
    section.competencies.map((competency) => competency.id),
  );

  const states: CompetencyStates = {};
  if (user) {
    const db = getDb();
    const [favorites, studyStatuses] = await Promise.all([
      db.favorite.findMany({ where: { userId: user.id, targetType: "COMPETENCY" } }),
      db.studyStatus.findMany({ where: { userId: user.id } }),
    ]);
    const savedIds = new Set(favorites.map((favorite) => favorite.targetId));
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
      sources: competency.sources,
      occurrences: findCompetencies(competency.id).map((occurrence) => ({
        professionSlug: occurrence.profession.slug,
        professionTitle: occurrence.profession.title,
        sectionTitle: occurrence.section.title,
      })),
    })),
  );

  const canvasProfession: CanvasProfession = {
    slug: profession.slug,
    title: profession.title,
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

  return (
    <>
      <ViewEvent name="profession_view" props={{ profession_id: profession.id }} />
      <ProfessionCanvas
        profession={canvasProfession}
        competencies={competencies}
        states={states}
        viewer={user ? { email: user.email } : null}
        initialCompetencyId={initialCompetencyId}
      />
    </>
  );
}
