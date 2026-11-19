import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MatrixResult } from "@/components/plan/MatrixResult";
import { PlanStepper } from "@/components/plan/PlanStepper";
import { ViewEvent } from "@/components/ViewEvent";
import { getCurrentUser } from "@/lib/auth";
import { getLatestMatrix, loadStudyProgress } from "@/lib/matrix-server";
import { summarizeMatrix } from "@/lib/matrix";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "План — матрица компетенций",
};

export default async function PlanResultPage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?returnTo=${encodeURIComponent("/plan/result")}`);

  const latest = await getLatestMatrix(user.id);
  if (!latest) redirect("/plan");

  const titles = Object.fromEntries(latest.rows.map((row) => [row.id, row.title]));
  const summary = summarizeMatrix(latest.grade.requirements, latest.levels, titles);
  const study = await loadStudyProgress(
    user.id,
    latest.rows.map((row) => row.id),
  );

  return (
    <div className="plan-page">
      <ViewEvent name="matrix_view" props={{ profession_slug: latest.profession.slug, grade_code: latest.grade.code }} />
      <PlanStepper
        current="result"
        links={{
          profession: "/plan/start",
          grade: `/plan/grade?profession=${latest.profession.slug}&grade=${latest.grade.code}`,
          assess: `/plan/assess?profession=${latest.profession.slug}&grade=${latest.grade.code}`,
        }}
      />
      <MatrixResult latest={latest} summary={summary} study={study} />
    </div>
  );
}
