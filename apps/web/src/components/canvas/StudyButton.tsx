"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconGraduation } from "@/components/icons";
import { showToast } from "@/components/ui/Toast";

/** «Изучать» — сохраняет компетенцию в раздел «Изучаю» (COS-EAR-017). */
export function StudyButton({
  competencyId,
  professionSlug,
  initialSaved,
  isAuthed,
}: {
  competencyId: string;
  professionSlug: string;
  initialSaved: boolean;
  isAuthed: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const returnTo = `/professions/${professionSlug}?competency=${competencyId}`;
  const className = `study-button${saved ? " is-saved" : ""}`;

  if (!isAuthed) {
    return (
      <Link className={className} href={`/register?returnTo=${encodeURIComponent(returnTo)}`}>
        <IconGraduation />
        <span>Изучать</span>
      </Link>
    );
  }

  async function toggle() {
    setBusy(true);
    setError(false);
    try {
      const response = await fetch("/api/favorites", {
        method: saved ? "DELETE" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetType: "COMPETENCY", targetId: competencyId, professionSlug }),
      });
      if (!response.ok) throw new Error("fail");
      const data = (await response.json()) as { saved: boolean };
      setSaved(data.saved);
      if (data.saved) {
        showToast({
          title: "Теперь в «Изучаю»",
          text: "Отметки «Усвоено» помогут видеть прогресс",
          actionLabel: "Посмотреть",
          onAction: () => router.push("/saved"),
          duration: 3000,
        });
      }
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      className={className}
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      aria-pressed={saved}
      title={error ? "Не удалось сохранить. Попробуйте ещё раз" : saved ? "Изучаю" : "Изучать"}
    >
      <IconGraduation />
      <span>{saved ? "Изучаю" : "Изучать"}</span>
    </button>
  );
}
