import type { Metadata } from "next";
import { AnonymousMatrixResult } from "@/components/plan/AnonymousMatrixResult";
import { MatrixResult } from "@/components/plan/MatrixResult";
import { PendingMatrixGate } from "@/components/plan/PendingMatrixGate";
import { PlanStepper } from "@/components/plan/PlanStepper";
import { ViewEvent } from "@/components/ViewEvent";
import { getCurrentUser } from "@/lib/auth";
import { getLatestMatrix, loadStudyProgress } from "@/lib/matrix-server";
import { summarizeMatrix } from "@/lib/matrix";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "План — матрица компетенций",
};

/**
 * Результат матрицы.
 *
 * Без аккаунта матрица живёт в localStorage: сводку считает `/api/matrix/preview`,
 * «Добавить к изучению» ведёт к регистрации. После входа `PendingMatrixGate`
 * сохраняет черновик из браузера и страница перерисовывается уже из БД.
 */
export default async function PlanResultPage() {
  const user = await getCurrentUser();
  if (!user) {
    return <AnonymousMatrixResult />;
  }

  const latest = await getLatestMatrix(user.id);
  if (!latest) {
    return (
      <div className="plan-page">
        <PendingMatrixGate />
      </div>
    );
  }

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
