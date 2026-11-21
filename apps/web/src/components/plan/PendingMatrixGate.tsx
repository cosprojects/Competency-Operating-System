"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { clearMatrixDraft, readMatrixDraft } from "@/lib/matrix-draft";

/**
 * Мост «матрица без аккаунта → аккаунт».
 *
 * После регистрации человек возвращается на `/plan/result`, где ещё нет снимка в БД:
 * этот компонент сохраняет черновик из браузера и обновляет страницу. Если черновика
 * нет — уводит на `/plan`.
 */
export function PendingMatrixGate() {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const draft = readMatrixDraft();
    if (!draft) {
      router.replace("/plan");
      return;
    }
    fetch("/api/matrix", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        professionSlug: draft.professionSlug,
        gradeCode: draft.gradeCode,
        levels: draft.levels,
      }),
    })
      .then((response) => {
        if (!response.ok) throw new Error("save");
        clearMatrixDraft();
        router.refresh();
      })
      .catch(() => {
        router.replace("/plan");
      });
  }, [router]);

  return <p className="plan-empty">Сохраняем твою матрицу…</p>;
}
