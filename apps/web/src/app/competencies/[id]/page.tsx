import { redirect } from "next/navigation";
import { findCompetencies } from "@/lib/content";

export default async function CompetencyRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const occurrence = findCompetencies(id)[0];
  redirect(occurrence ? `/professions/${occurrence.profession.slug}?competency=${id}` : "/professions");
}
