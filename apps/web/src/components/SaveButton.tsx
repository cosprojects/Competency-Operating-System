"use client";

import { useEffect, useRef, useState } from "react";
import { IconAcademicCap, IconAcademicCapOutline, IconStar, IconStarFilled } from "@/components/icons";
import { useRouter } from "next/navigation";
import { showToast } from "@/components/ui/Toast";


export function SaveButton({
  targetType,
  targetId,
  initialSaved,
  variant = "default",
  contextProfession,
  title,
  description,
}: {
  targetType: "COMPETENCY" | "SOURCE" | "PROFESSION";
  targetId: string;
  initialSaved: boolean;
  variant?: "default" | "icon";
  contextProfession?: string;
  /** Название элемента для алерта «Теперь в сохранённых». */
  title?: string;
  /** Короткое описание элемента — вторая строка алерта. */
  description?: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Отклик на действие: звёздочка «щёлкает» только в момент сохранения, а не
  // при каждом монтировании списка (COS-EAR-016, микро-фидбек).
  const [popping, setPopping] = useState(false);
  const popTimerRef = useRef<number | null>(null);
  // Профессии не «сохраняют в избранное», а добавляют в «Изучаю»: шляпа
  // (заливка — изучаю, контур — нет) и соответствующие подписи.
  const isProfession = targetType === "PROFESSION";
  const savedLabel = isProfession ? "Прекратить изучение" : "Убрать из избранного";
  const unsavedLabel = isProfession ? "Изучать профессию" : "Сохранить в избранное";

  useEffect(() => {
    return () => {
      if (popTimerRef.current) window.clearTimeout(popTimerRef.current);
    };
  }, []);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/favorites", {
        method: saved ? "DELETE" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetType, targetId, ...(contextProfession ? { professionSlug: contextProfession } : {}) }),
      });
      if (!response.ok) throw new Error("Не удалось сохранить");
      const data = (await response.json()) as { saved: boolean };
      setSaved(data.saved);
      if (data.saved) {
        setPopping(true);
        if (popTimerRef.current) window.clearTimeout(popTimerRef.current);
        popTimerRef.current = window.setTimeout(() => {
          popTimerRef.current = null;
          setPopping(false);
        }, 320);
        const typeLabel =
          targetType === "PROFESSION"
            ? "Профессия"
            : targetType === "COMPETENCY"
              ? "Компетенция"
              : "Материал";
        showToast({
          title: "Теперь в «Изучаю»",
          ...(title ? { headline: title } : {}),
          text: description ? `${typeLabel} • ${description}` : typeLabel,
          actionLabel: "Посмотреть",
          duration: 3000,
          onAction: () => router.push("/saved"),
        });
      }
    } catch {
      setError("Не удалось сохранить. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    try {
      const response = await fetch("/api/favorites", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetType, targetId }),
      });
      if (!response.ok) throw new Error("fail");
      setSaved(false);
    } catch {
      // Отмена не удалась — оставляем сохранение.
    }
  }

  if (variant === "icon") {
    return (
      <button
        className={`icon-button${saved ? " is-saved" : ""}${popping ? " is-popping" : ""}`}
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={saved}
        aria-label={saved ? savedLabel : unsavedLabel}
        title={saved ? savedLabel : unsavedLabel}
      >
        {isProfession ? (
          saved ? (
            <IconAcademicCap />
          ) : (
            <IconAcademicCapOutline />
          )
        ) : saved ? (
          <IconStarFilled />
        ) : (
          <IconStar />
        )}
        {error ? <span className="sr-only">{error}</span> : null}
      </button>
    );
  }

  return (
    <div>
      <button
        className={saved ? "button secondary small" : "button small"}
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={saved}
      >
        {isProfession
          ? saved
            ? "В изучении"
            : "Изучать профессию"
          : saved
            ? "★ В сохранённом"
            : "☆ Сохранить"}
      </button>
      {error ? (
        <div className="small" style={{ color: "var(--danger)", marginTop: 6 }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}
