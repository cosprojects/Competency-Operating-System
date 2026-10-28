"use client";

import { useState } from "react";
import { trackClient } from "@/lib/client-analytics";

const STATUSES = ["NOT_STARTED", "LEARNING", "LEARNED"] as const;
type Status = (typeof STATUSES)[number];

function label(value: Status): string {
  if (value === "LEARNING") return "Изучаю";
  if (value === "LEARNED") return "Изучено";
  return "Не изучено";
}

export function StatusSelect({
  competencyId,
  initialStatus,
}: {
  competencyId: string;
  initialStatus: Status;
}) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update(next: Status) {
    if (next === status) return;
    setBusy(true);
    setError(null);
    const previous = status;
    setStatus(next);
    try {
      const response = await fetch("/api/study-status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ competencyId, status: next }),
      });
      if (!response.ok) throw new Error("Не удалось сохранить статус");
      trackClient("study_status_change", { competency_id: competencyId, from: previous, to: next });
    } catch {
      setStatus(previous);
      setError("Не удалось сохранить статус. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="status-group" role="group" aria-label="Статус изучения">
        {STATUSES.map((value) => (
          <button
            key={value}
            type="button"
            className={status === value ? "active" : ""}
            onClick={() => void update(value)}
            disabled={busy}
            aria-pressed={status === value}
          >
            {label(value)}
          </button>
        ))}
      </div>
      <div className="small muted" style={{ marginTop: 6 }}>
        Это ваша самоотметка, а не подтверждение уровня.
      </div>
      {error ? (
        <div className="small" style={{ color: "var(--danger)", marginTop: 6 }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}
