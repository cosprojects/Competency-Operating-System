import Link from "next/link";
import type { LatestMatrix } from "@/lib/matrix-server";

/** Карточка последней матрицы — компонент 459-9400. */
export function MatrixCard({
  latest,
  met,
  total,
}: {
  latest: LatestMatrix;
  met: number;
  total: number;
}) {
  const ratio = total === 0 ? 0 : Math.round((met / total) * 100);
  const filledSegments = Math.round((ratio / 100) * 12);

  return (
    <Link className="plan-matrix-card-result" href="/plan/result" aria-label="Открыть последнюю матрицу">
      <div className="plan-matrix-card-result-head">
        <span>Твоя последняя матрица</span>
        <span>Открыть</span>
      </div>
      <h2>
        {latest.profession.title} <span aria-hidden="true">•</span> {latest.grade.title}
      </h2>
      <div className="plan-matrix-card-result-track" aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => (
          <span className={index < filledSegments ? "is-filled" : ""} key={index} />
        ))}
      </div>
      <div className="plan-matrix-card-result-foot">
        <span>
          {met} из {total} требований
        </span>
        <span>Знания: {ratio}%</span>
      </div>
    </Link>
  );
}
