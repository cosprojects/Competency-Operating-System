import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getProfession } from "@/lib/content";
import { canonical, socialMetadata } from "@/lib/site";
import { ProfessionView } from "./profession-view";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const profession = getProfession(slug);
  if (!profession) return { title: "Профессия — AXIONA", robots: { index: false, follow: false } };
  const title = `${profession.title} — карта компетенций AXIONA`;
  const path = `/professions/${profession.slug}`;
  return {
    title,
    description: profession.description,
    alternates: canonical(path),
    ...socialMetadata({ title, description: profession.description, path }),
  };
}

/**
 * Страница профессии. Открытая компетенция живёт по своему адресу
 * (`/professions/[slug]/[competency]`), поэтому старый адрес с параметром
 * отдаём постоянным редиректом — так внешние ссылки и закладки не ломаются,
 * а поисковик видит один канонический адрес вместо фильтра.
 */
export default async function ProfessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ competency?: string; view?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const profession = getProfession(slug);
  if (!profession) notFound();

  if (query.competency) {
    const ids = profession.sections.flatMap((section) =>
      section.competencies.map((competency) => competency.id),
    );
    permanentRedirect(
      ids.includes(query.competency)
        ? `/professions/${profession.slug}/${query.competency}`
        : `/professions/${profession.slug}`,
    );
  }

  return <ProfessionView slug={profession.slug} view={query.view} />;
}
