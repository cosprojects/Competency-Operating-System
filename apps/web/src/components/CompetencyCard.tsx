import Link from "next/link";
import type { ContentCompetency } from "@/lib/content-types";
import { contentTypeSummary, tierLabel } from "@/lib/content";

export function CompetencyCard({ competency }: { competency: ContentCompetency }) {
  return (
    <Link className="competency-card" href={`/competencies/${competency.id}`}>
      <div className="meta" style={{ justifyContent: "space-between" }}>
        <span className={`badge ${competency.tier}`}>{tierLabel(competency.tier)}</span>
        <span>#{competency.order}</span>
      </div>
      <h3>{competency.title}</h3>
      <p>{competency.definition}</p>
      <div className="meta">{contentTypeSummary(competency)}</div>
    </Link>
  );
}
