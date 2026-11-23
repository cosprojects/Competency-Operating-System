import Link from "next/link";

export interface CompetencyCardData {
  id: string;
  title: string;
  definition: string;
  tierLabel: string;
  tierClass: "foundation" | "core" | "optional";
  professionSlug: string;
  meta: string;
}

/** Единая карточка компетенции: bg #F9FAFB, ховер как у карточек профессий. */
export function CompetencyCard({ item }: { item: CompetencyCardData }) {
  return (
    <Link
      className="competency-card"
      href={`/professions/${item.professionSlug}/${item.id}`}
    >
      <span className="competency-card-top">
        <span className={`badge ${item.tierClass}`}>{item.tierLabel}</span>
        <img className="competency-card-cap" src="/icons/home/cap.svg" alt="" aria-hidden="true" />
      </span>
      <span className="competency-card-title">{item.title}</span>
      <span className="competency-card-desc">{item.definition}</span>
      <span className="competency-card-meta">{item.meta}</span>
    </Link>
  );
}
