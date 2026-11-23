import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MatrixForm } from "@/components/plan/MatrixForm";
import { PlanStepper } from "@/components/plan/PlanStepper";
import { ViewEvent } from "@/components/ViewEvent";
import { getCurrentUser } from "@/lib/auth";
import { getLatestMatrix } from "@/lib/matrix-server";
import { getMatrixGrade, getMatrixProfession, getMatrixRows } from "@/lib/matrix";
import { NOINDEX_NOFOLLOW } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...NOINDEX_NOFOLLOW,
  title: "План — самооценка",
};

export default async function PlanAssessPage({
  searchParams,
}: {
  searchParams: Promise<{ profession?: string; grade?: string }>;
}) {
  const { profession: requestedProfession, grade: requestedGrade } = await searchParams;
  const professionSlug = requestedProfession ?? "uxui";
  const gradeCode = requestedGrade ?? "designer";
  const user = await getCurrentUser();
  const profession = getMatrixProfession(professionSlug);
  if (!profession) redirect("/plan");
  const grade = getMatrixGrade(professionSlug, gradeCode);
  if (!grade) redirect(`/plan/grade?profession=${professionSlug}`);
  const rows = getMatrixRows(professionSlug, gradeCode);

  const latest = user ? await getLatestMatrix(user.id) : null;
  const initialLevels =
    latest && latest.profession.slug === professionSlug && latest.grade.code === gradeCode ? latest.levels : {};

  return (
    <div className="plan-page">
      <ViewEvent name="matrix_start" props={{ profession_slug: professionSlug, grade_code: gradeCode }} />
      <PlanStepper
        current="assess"
        links={{
          profession: "/plan/start",
          grade: `/plan/grade?profession=${professionSlug}&grade=${gradeCode}`,
          assess: `/plan/assess?profession=${professionSlug}&grade=${gradeCode}`,
        }}
      />
      <MatrixForm
        professionSlug={professionSlug}
        professionTitle={profession.title}
        gradeCode={gradeCode}
        gradeTitle={grade.title}
        gradeScope={grade.scope}
        rows={rows}
        initialLevels={initialLevels}
        isAuthed={Boolean(user)}
      />
      <p className="small muted plan-form-foot">
        Хочешь другой грейд? <Link href={`/plan/grade?profession=${professionSlug}`}>Вернуться к выбору</Link>.
      </p>
    </div>
  );
}
