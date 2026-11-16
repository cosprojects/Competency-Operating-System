import type { Metadata } from "next";
import type { SearchGroup } from "@/components/ProfessionSearch";
import { ProfessionSearch } from "@/components/ProfessionSearch";
import { getCurrentUser } from "@/lib/auth";
import {
  competencySearchText,
  countLabel,
  getProfessionGroups,
  pluralWord,
  professionSphere,
} from "@/lib/content";
import { compactSearchText } from "@/lib/search-index";
import { sphereBadgeStyle } from "@/lib/spheres";
import { getDb } from "@/lib/db";

export const metadata: Metadata = {
  title: "Направления — AXIONA",
  description:
    "Выбор профессии дизайнера: поиск по названию профессии и навыкам, которые её составляют.",
};

export default async function ProfessionsPage() {
  const user = await getCurrentUser();
  let savedSlugs: string[] = [];
  if (user) {
    const favorites = await getDb().favorite.findMany({
      where: { userId: user.id, targetType: "PROFESSION" },
    });
    savedSlugs = favorites.map((favorite) => favorite.targetId);
  }
  const groups: SearchGroup[] = getProfessionGroups().map((group) => ({
    id: group.id,
    title: group.title,
    professions: group.professions.map((profession) => {
      const sphere = professionSphere(profession);
      return {
      slug: profession.slug,
      title: profession.title,
      description: profession.description,
      sphereTitle: sphere.title,
      sphereStyle: sphereBadgeStyle(sphere.color),
      countText: `${profession.coverage.published} из ${profession.coverage.total} ${pluralWord(
        profession.coverage.total,
        ["компетенции", "компетенций", "компетенций"],
      )}`,
      percent: profession.coverage.percent,
      searchText: compactSearchText(
        [
          profession.title,
          profession.titleEn ?? "",
          profession.description,
          ...profession.sections.flatMap((section) => [
            section.title,
            ...section.competencies.map((competency) => competencySearchText(competency)),
          ]),
        ].join(" "),
      ),
      };
    }),
  }));

  return (
    <ProfessionSearch
      groups={groups}
      viewer={user ? { email: user.email } : null}
      savedSlugs={savedSlugs}
    />
  );
}
