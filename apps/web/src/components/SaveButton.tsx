"use client";

import { useState } from "react";

export function SaveButton({
  targetType,
  targetId,
  initialSaved,
}: {
  targetType: "COMPETENCY" | "SOURCE";
  targetId: string;
  initialSaved: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/favorites", {
        method: saved ? "DELETE" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetType, targetId }),
      });
      if (!response.ok) throw new Error("Не удалось сохранить");
      const data = (await response.json()) as { saved: boolean };
      setSaved(data.saved);
    } catch {
      setError("Не удалось сохранить. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
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
        {saved ? "★ В сохранённом" : "☆ Сохранить"}
      </button>
      {error ? (
        <div className="small" style={{ color: "var(--danger)", marginTop: 6 }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}
