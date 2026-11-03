"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Кнопки админ-блокировки/разблокировки материала. */
export function AdminReviewActions({
  sourceId,
  adminBlocked,
}: {
  sourceId: string;
  adminBlocked: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(action: "BLOCK" | "UNBLOCK") {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/source-reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceId, action }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Не получилось");
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не получилось");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="form-row" style={{ gap: 8, flexWrap: "wrap" }}>
      {adminBlocked ? (
        <button
          className="button secondary small"
          type="button"
          disabled={pending}
          onClick={() => submit("UNBLOCK")}
        >
          {pending ? "Снимаем…" : "Снять админ-блок"}
        </button>
      ) : (
        <button
          className="button secondary small"
          type="button"
          disabled={pending}
          onClick={() => submit("BLOCK")}
        >
          {pending ? "Блокируем…" : "Заблокировать"}
        </button>
      )}
      {error ? <span className="small muted">{error}</span> : null}
    </div>
  );
}
