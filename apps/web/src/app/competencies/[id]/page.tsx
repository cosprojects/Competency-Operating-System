import { notFound, permanentRedirect } from "next/navigation";
import { findCompetencies } from "@/lib/content";

/**
 * Старые адреса компетенций (`/competencies/[id]`) ведут на страницу
 * компетенции внутри профессии. Постоянный редирект, а не временный:
 * адрес изменился навсегда.
 */
export default async function CompetencyRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const occurrence = findCompetencies(id)[0];
  if (!occurrence) notFound();
  permanentRedirect(`/professions/${occurrence.profession.slug}/${occurrence.competency.id}`);
}
