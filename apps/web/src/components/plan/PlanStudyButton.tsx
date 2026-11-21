"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconAcademicCapOutline, IconGraduation } from "@/components/icons";
import { showToast } from "@/components/ui/Toast";
import { trackClient } from "@/lib/client-analytics";

/**
 * «Добавить в Изучаю» из результата матрицы: сохранение + статус «Изучаю».
 *
 * appearance="card" — вид из макета карточки компетенции (node 474:11360/474:11361):
 * контурная кнопка до добавления и залитая — после.
 */
export function PlanStudyButton({
  competencyId,
  professionSlug,
  saved,
  appearance = "default",
}: {
  competencyId: string;
  professionSlug: string;
  saved: boolean;
  appearance?: "default" | "card";
}) {
  const isCard = appearance === "card";
  const router = useRouter();
  const [isSaved, setIsSaved] = useState(saved);
  const [busy, setBusy] = useState(false);

  if (isSaved) {
    if (isCard) {
      return (
        <Link className="plan-study-button is-added" href="/saved" title="Открыть в Изучаю">
          Добавлено к изучению
          <IconAcademicCapOutline />
        </Link>
      );
    }
    return (
      <Link className="button secondary small" href="/saved">
        Открыть в Изучаю
      </Link>
    );
  }

  async function add() {
    setBusy(true);
    try {
      const favorite = await fetch("/api/favorites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetType: "COMPETENCY", targetId: competencyId, professionSlug }),
      });
      if (!favorite.ok) throw new Error("favorite");
      const status = await fetch("/api/study-status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ competencyId, status: "LEARNING" }),
      });
      if (!status.ok) throw new Error("status");
      setIsSaved(true);
      trackClient("matrix_plan_to_study", { competency_id: competencyId });
      showToast({
        title: "Теперь в «Изучаю»",
        text: "Компетенция добавлена. Отмечай знания и навыки — это поможет увидеть прогресс.",
        actionLabel: "Открыть",
        duration: 4000,
        onAction: () => router.push("/saved"),
      });
      router.refresh();
    } catch {
      showToast({
        title: "Не добавилось",
        text: "Компетенция не попала в «Изучаю»: попробуй ещё раз.",
        actionLabel: "Закрыть",
        duration: 4000,
      });
    } finally {
      setBusy(false);
    }
  }

  if (isCard) {
    return (
      <button className="plan-study-button" type="button" onClick={() => void add()} disabled={busy}>
        {busy ? "Сохраняю…" : "Добавить к изучению"}
        <IconAcademicCapOutline />
      </button>
    );
  }

  return (
    <button className="button secondary small" type="button" onClick={() => void add()} disabled={busy}>
      <IconGraduation />
      {busy ? "Сохраняю…" : "Добавить в Изучаю"}
    </button>
  );
}
