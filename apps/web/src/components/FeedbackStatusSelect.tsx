"use client";

import { useState } from "react";

const STATUSES = ["NEW", "TRIAGED", "RESOLVED"] as const;

export function FeedbackStatusSelect({
  feedbackId,
  initialStatus,
}: {
  feedbackId: string;
  initialStatus: (typeof STATUSES)[number];
}) {
  const [status, setStatus] = useState<(typeof STATUSES)[number]>(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update(next: (typeof STATUSES)[number]) {
    setBusy(true);
    setError(null);
    const previous = status;
    setStatus(next);
    try {
      const response = await fetch("/api/admin/feedback/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: feedbackId, status: next }),
      });
      if (!response.ok) throw new Error("fail");
    } catch {
      setStatus(previous);
      setError("Не удалось");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <select
        className="select"
        style={{ minWidth: 130 }}
        value={status}
        onChange={(event) => void update(event.target.value as (typeof STATUSES)[number])}
        disabled={busy}
      >
        {STATUSES.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      {error ? <div className="small" style={{ color: "var(--danger)" }}>{error}</div> : null}
    </div>
  );
}
