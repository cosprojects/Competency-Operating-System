"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Изменение решения по аналитике из аккаунта: запись фиксируется на сервере. */
export function ConsentControls() {
  const router = useRouter();
  const [busy, setBusy] = useState<"all" | "necessary" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function apply(decision: "all" | "necessary") {
    setBusy(decision);
    setError(null);
    try {
      const response = await fetch("/api/consent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!response.ok) throw new Error("Не удалось сохранить решение");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось сохранить решение");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="actions">
      <button className="button secondary small" type="button" disabled={busy !== null} onClick={() => apply("necessary")}>
        {busy === "necessary" ? "Сохраняем…" : "Только необходимое"}
      </button>
      <button className="button small" type="button" disabled={busy !== null} onClick={() => apply("all")}>
        {busy === "all" ? "Сохраняем…" : "Разрешить аналитику"}
      </button>
      {error ? <span className="small" role="alert">{error}</span> : null}
    </div>
  );
}
