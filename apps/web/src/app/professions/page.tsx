import type { Metadata } from "next";
import type { SearchGroup } from "@/components/ProfessionSearch";
import { ProfessionSearch } from "@/components/ProfessionSearch";
import { competencySearchText, getProfessionGroups, normalizeQuery } from "@/lib/content";

export const metadata: Metadata = {
  title: "Профессии — AXIONA",
  description:
    "Выбор профессии дизайнера: поиск по названию профессии и навыкам, которые её составляют.",
};

export default function ProfessionsPage() {
  const groups: SearchGroup[] = getProfessionGroups().map((group) => ({
    id: group.id,
    title: group.title,
    professions: group.professions.map((profession) => ({
      slug: profession.slug,
      title: profession.title,
      description: profession.description,
      published: profession.coverage.published,
      total: profession.coverage.total,
      percent: profession.coverage.percent,
      searchText: normalizeQuery(
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
    })),
  }));

  return <ProfessionSearch groups={groups} />;
}
