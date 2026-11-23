import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import type { ContentProfession } from "@/lib/content-types";
import { primaryCompetencyPath } from "@/lib/competency-routes";
import { findCompetencies, getProfession } from "@/lib/content";
import { canonical, socialMetadata } from "@/lib/site";
import { ProfessionView } from "../profession-view";

export const dynamic = "force-dynamic";

function findInProfession(profession: ContentProfession, id: string) {
  for (const section of profession.sections) {
    for (const competency of section.competencies) {
      if (competency.id === id) return competency;
    }
  }
  return undefined;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; competency: string }>;
}): Promise<Metadata> {
  const { slug, competency } = await params;
  const profession = getProfession(slug);
  const item = profession ? findInProfession(profession, competency) : undefined;
  if (!profession || !item) {
    return { title: "Компетенция — AXIONA", robots: { index: false, follow: false } };
  }
  const title = `${item.title} — ${profession.title} — AXIONA`;
  // Канонический адрес — основная страница компетенции (первое вхождение в
  // модели). Когда компетенция входит в несколько профессий, остальные адреса
  // открываются, но не делят с ней индексацию: содержание у них одно.
  const path = primaryCompetencyPath(item.id) ?? `/professions/${profession.slug}/${item.id}`;
  return {
    title,
    description: item.definition,
    alternates: canonical(path),
    ...socialMetadata({ title, description: item.definition, path }),
  };
}

/**
 * Страница компетенции внутри профессии: своё название, описание, canonical и
 * микроразметка. Адрес `/professions/[slug]/[competency]` — точка входа по
 * длинному хвосту («что входит в компетенцию…», «навыки …»).
 *
 * Если компетенция принадлежит другой профессии, ведём туда постоянным
 * редиректом; неизвестный id — честный 404.
 */
export default async function CompetencyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; competency: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const [{ slug, competency }, query] = await Promise.all([params, searchParams]);
  const profession = getProfession(slug);
  if (!profession) notFound();

  const item = findInProfession(profession, competency);
  if (!item) {
    const occurrence = findCompetencies(competency)[0];
    if (occurrence) {
      permanentRedirect(`/professions/${occurrence.profession.slug}/${occurrence.competency.id}`);
    }
    notFound();
  }

  return <ProfessionView slug={profession.slug} competencyId={item.id} view={query.view} />;
}
