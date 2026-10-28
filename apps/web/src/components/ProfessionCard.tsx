import Link from "next/link";
import type { ContentProfession } from "@/lib/content-types";

export function ProfessionCard({ profession }: { profession: ContentProfession }) {
  return (
    <Link className="card profession-card" href={`/professions/${profession.slug}`}>
      <div className="meta" style={{ justifyContent: "space-between" }}>
        <span className="badge">{profession.titleEn ?? "Профессия"}</span>
        <span className="small muted">{profession.coverage.published} компетенций</span>
      </div>
      <h3 style={{ marginTop: 10 }}>{profession.title}</h3>
      <p>{profession.description}</p>
      <div className="coverage">
        <div className="coverage-bar" aria-hidden="true">
          <span style={{ width: `${profession.coverage.percent}%` }} />
        </div>
        <div className="coverage-text">
          <span>
            Опубликовано {profession.coverage.published} из {profession.coverage.total}
          </span>
          <span>{profession.coverage.percent}%</span>
        </div>
      </div>
    </Link>
  );
}
