import type { Metadata } from "next";
import { Eyebrow } from "@/components/ui/Eyebrow";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProfessionCard } from "@/components/plan/ProfessionCard";
import { PlanStepper } from "@/components/plan/PlanStepper";
import { getCurrentUser } from "@/lib/auth";
import { listMatrixFamilies, listMatrixProfessions } from "@/lib/matrix";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "План — выбор профессии",
};

const OTHER_FAMILIES = new Set(["spatial", "presentation", "research", "game"]);

export default async function PlanStartPage({
  searchParams,
}: {
  searchParams: Promise<{ family?: string; profession?: string }>;
}) {
  const { family, profession: legacyProfession } = await searchParams;
  if (legacyProfession) redirect(`/plan/grade?profession=${encodeURIComponent(legacyProfession)}`);
  const user = await getCurrentUser();
  if (!user) redirect(`/login?returnTo=${encodeURIComponent("/plan/start")}`);

  const families = listMatrixFamilies();
  const professions = listMatrixProfessions();
  const filtered = !family
    ? professions
    : family === "other"
      ? professions.filter((profession) => OTHER_FAMILIES.has(profession.family))
      : professions.filter((profession) => profession.family === family);

  return (
    <div className="plan-page">
      <PlanStepper current="profession" links={{ profession: "/plan/start" }} />
      <header className="plan-page-head">
        <Eyebrow>План · шаг 1</Eyebrow>
        <h1>Выбери профессию</h1>
        <p className="plan-lead">
          Матрица будет основана на требованиях выбранной роли. У каждой профессии свой пакет
          компетенций и свой профиль грейдов.
        </p>
      </header>

      <div className="plan-filter-row" role="group" aria-label="Фильтр профессий">
        <Link className={`plan-filter${!family ? " is-active" : ""}`} href="/plan/start">
          Все <span>{professions.length}</span>
        </Link>
        {families
          .filter((item) => item.count > 0)
          .slice(0, 3)
          .map((item) => (
            <Link
              className={`plan-filter${family === item.key ? " is-active" : ""}`}
              href={`/plan/start?family=${item.key}`}
              key={item.key}
            >
              {item.label} <span>{item.count}</span>
            </Link>
          ))}
        <Link className={`plan-filter${family === "other" ? " is-active" : ""}`} href="/plan/start?family=other">
          Ещё <span>{professions.length - families.slice(0, 3).reduce((sum, item) => sum + item.count, 0)}</span>
        </Link>
      </div>

      <div className="plan-matrix-grid">
        {filtered.map((profession) => (
          <ProfessionCard
            href={`/plan/grade?profession=${profession.slug}`}
            key={profession.slug}
            profession={profession}
          />
        ))}
      </div>

      {filtered.length === 0 ? <p className="plan-empty">В этом семействе пока нет профессий.</p> : null}

      <div className="plan-actions">
        <Link className="button secondary" href="/plan">
          ← Назад
        </Link>
        <p className="small muted">Можно вернуться и выбрать другую профессию в любой момент.</p>
      </div>
    </div>
  );
}
