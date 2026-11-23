import type { Metadata } from "next";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { NextStepCard } from "@/components/ui/NextStepCard";
import { IconArrowRight } from "@/components/icons";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PlanStepper } from "@/components/plan/PlanStepper";
import { getCurrentUser } from "@/lib/auth";
import { getLatestMatrix } from "@/lib/matrix-server";
import { getGradeHighlightRows, getMatrixGrades, getMatrixProfession } from "@/lib/matrix";
import { NOINDEX_NOFOLLOW } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...NOINDEX_NOFOLLOW,
  title: "План — выбор грейда",
};

export default async function PlanGradePage({
  searchParams,
}: {
  searchParams: Promise<{ profession?: string; grade?: string }>;
}) {
  const { profession: requestedProfession, grade: requestedGrade } = await searchParams;
  const profession = getMatrixProfession(requestedProfession ?? "uxui");
  if (!profession) redirect("/plan/start");

  const grades = getMatrixGrades(profession.slug);
  // Грейд из последней матрицы подставляем только своему аккаунту; без входа — просто выбор.
  const user = await getCurrentUser();
  const latest = user ? await getLatestMatrix(user.id) : null;
  const fallbackGrade =
    latest && latest.profession.slug === profession.slug ? latest.grade.code : undefined;
  const selectedCode = requestedGrade && grades.some((grade) => grade.code === requestedGrade)
    ? requestedGrade
    : fallbackGrade;
  const selected = selectedCode ? grades.find((grade) => grade.code === selectedCode) : undefined;
  const selectedHighlights = selected ? getGradeHighlightRows(profession.slug, selected.code) : [];

  return (
    <div className="plan-page">
      <PlanStepper current="grade" links={{ profession: "/plan/start" }} />
      <header className="plan-page-head">
        <Eyebrow>План · {profession.title}</Eyebrow>
        <h1>Какой грейд тебе ближе?</h1>
        <p className="plan-lead">
          Выбери тот, который описывает твою текущую работу, а не желаемую должность. Это ориентир: в
          компании грейды могут называться иначе.
        </p>
        <Link className="plan-back" href="/plan/start">
          ← Другая профессия
        </Link>
      </header>

      <div className="plan-grade-layout">
        <div className="plan-grade-options" role="radiogroup" aria-label="Грейд">
          {grades.map((grade) => {
            const active = selected?.code === grade.code;
            return (
              <Link
                className={`plan-grade-option${active ? " is-active" : ""}`}
                href={`/plan/grade?profession=${profession.slug}&grade=${grade.code}`}
                key={grade.code}
                aria-current={active ? "true" : undefined}
                aria-checked={active}
                role="radio"
              >
                <span className="plan-grade-order">{String(grade.order).padStart(2, "0")}</span>
                <span className="plan-grade-option-main">
                  <strong>{grade.title}</strong>
                  <span>{grade.scope}</span>
                  <span className="plan-grade-option-meta">{grade.requirements.length} компетенций</span>
                </span>
                <span className="plan-grade-radio" aria-hidden="true" />
              </Link>
            );
          })}
        </div>

        {selected ? (
          <NextStepCard
            className="plan-grade-panel"
            label="Твой выбор"
            title={selected.title}
            note={`${selected.requirements.length} компетенций в матрице`}
          >
              {!requestedGrade && fallbackGrade ? (
                <p className="small muted">Подставили грейд из последней матрицы — можно выбрать другой.</p>
              ) : null}
              <p>{selected.scope}</p>
              <div className="plan-grade-highlights">
                <p className="small muted">Ключевые требования</p>
                <ul>
                  {selectedHighlights.map((item) => (
                    <li key={item.id}>
                      <span>{item.title}</span>
                      <span className="plan-target">цель {item.targetLevel}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Link
                className="learning-next-cta"
                href={`/plan/assess?profession=${profession.slug}&grade=${selected.code}`}
              >
                Далее
                <IconArrowRight />
              </Link>
          </NextStepCard>
        ) : (
          <NextStepCard className="plan-grade-panel" label="Твой выбор" title="Сначала выбери грейд">
            <p>Слева — пять уровней. Посмотри, что на каждом из них делает дизайнер, и выбери близкий к текущей работе.</p>
          </NextStepCard>
        )}
      </div>

      <p className="small muted plan-form-foot">
        Грейд — ориентир, а не формальная аттестация. Уровень ты определяешь сам.
      </p>
    </div>
  );
}
