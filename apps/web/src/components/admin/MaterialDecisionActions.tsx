"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { showToast } from "@/components/ui/Toast";

/** Решение владельца по материалу: одобрить, опровергнуть, снять (COS-EAR-014). */
export function MaterialDecisionActions({
  sourceId,
  decision,
}: {
  sourceId: string;
  decision: "APPROVE" | "BLOCK" | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function submit(action: "APPROVE" | "BLOCK" | "RESET") {
    if (action === "RESET" && !window.confirm("Снять решение и вернуть материал в очередь?")) return;
    if (action === "BLOCK") {
      const reason = window.prompt("Причина опровержения (обязательно):", "устаревшие примеры");
      if (!reason?.trim()) return;
      await send(action, reason.trim());
      return;
    }
    await send(action);
  }

  async function send(action: "APPROVE" | "BLOCK" | "RESET", reason?: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/materials", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceId, action, ...(reason ? { reason } : {}) }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Не получилось");
      }
      showToast({ title: "Решение записано", text: "Материал обновлён в продукте.", duration: 4000 });
      router.refresh();
    } catch (caught) {
      showToast({
        title: "Не получилось",
        text: caught instanceof Error ? caught.message : "Попробуй ещё раз",
        duration: 4000,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-actions">
      {decision ? (
        <button className="button secondary small" type="button" disabled={busy} onClick={() => void submit("RESET")}>
          Снять решение
        </button>
      ) : (
        <>
          <button className="button small" type="button" disabled={busy} onClick={() => void submit("APPROVE")}>
            Одобрить
          </button>
          <button className="button secondary small" type="button" disabled={busy} onClick={() => void submit("BLOCK")}>
            Опровергнуть
          </button>
        </>
      )}
    </div>
  );
}
