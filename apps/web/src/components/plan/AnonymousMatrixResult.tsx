"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MatrixResult, type MatrixResultData } from "@/components/plan/MatrixResult";
import { PlanStepper } from "@/components/plan/PlanStepper";
import { readMatrixDraft } from "@/lib/matrix-draft";
import type { MatrixPreview, MatrixSummary } from "@/lib/matrix";

type Preview = MatrixPreview & { summary: MatrixSummary };

type State =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error" }
  | { status: "ready"; preview: Preview };

/**
 * Результат матрицы без аккаунта.
 *
 * Уровни лежат в localStorage, сводку считает сервер (`POST /api/matrix/preview`).
 * В БД ничего не пишется; «Добавить к изучению» ведёт к регистрации.
 */
export function AnonymousMatrixResult() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const draft = readMatrixDraft();
    if (!draft) {
      setState({ status: "empty" });
      return;
    }
    let cancelled = false;
    fetch("/api/matrix/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        professionSlug: draft.professionSlug,
        gradeCode: draft.gradeCode,
        levels: draft.levels,
      }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        return (await response.json()) as Preview;
      })
      .then((preview) => {
        if (!cancelled) setState({ status: "ready", preview });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return <p className="plan-empty">Собираем матрицу…</p>;
  }

  if (state.status !== "ready") {
    return (
      <div className="plan-page">
        <p className="plan-empty">
          {state.status === "empty"
            ? "Матрица ещё не собрана: выбери профессию и грейд, отметь уровни."
            : "Матрица не открылась. Собери её заново — это займёт несколько минут."}
        </p>
        <div className="plan-actions">
          <Link className="button" href="/plan/start">
            Собрать матрицу
          </Link>
          <Link className="button secondary" href="/plan">
            К плану
          </Link>
        </div>
      </div>
    );
  }

  const data = state.preview;
  const latest: MatrixResultData = {
    profession: data.profession,
    grade: data.grade,
    rows: data.rows,
    levels: data.levels,
    stale: false,
  };
  const professionHref = `/plan/grade?profession=${data.profession.slug}&grade=${data.grade.code}`;

  return (
    <div className="plan-page">
      <PlanStepper
        current="result"
        links={{
          profession: "/plan/start",
          grade: professionHref,
          assess: `/plan/assess?profession=${data.profession.slug}&grade=${data.grade.code}`,
        }}
      />
      <MatrixResult latest={latest} summary={data.summary} study={{}} anonymous />
    </div>
  );
}
