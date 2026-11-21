"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { showToast } from "@/components/ui/Toast";
import { ConfirmPrompt } from "@/components/ui/ConfirmPrompt";

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
  const [dialog, setDialog] = useState<"RESET" | "BLOCK" | null>(null);

  async function submit(action: "APPROVE" | "BLOCK" | "RESET") {
    if (action === "RESET") {
      setDialog("RESET");
      return;
    }
    if (action === "BLOCK") {
      setDialog("BLOCK");
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
        throw new Error(data.error ?? "Решение не записалось");
      }
      showToast({ title: "Решение записано", text: "Материал обновлён в продукте.", duration: 4000 });
      router.refresh();
    } catch (caught) {
      showToast({
        title: "Решение не записалось",
        text: caught instanceof Error ? caught.message : "Попробуй ещё раз",
        duration: 4000,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-actions">
      <ConfirmPrompt
        open={dialog === "RESET"}
        title="Снять решение?"
        description="Материал вернётся в очередь на проверку."
        confirmLabel="Снять решение"
        onClose={() => setDialog(null)}
        onConfirm={() => {
          setDialog(null);
          void send("RESET");
        }}
      />
      <ConfirmPrompt
        open={dialog === "BLOCK"}
        title="Опровергнуть материал?"
        description="Укажи причину — она сохранится в решении."
        inputLabel="Причина опровержения"
        defaultValue="устаревшие примеры"
        confirmLabel="Опровергнуть"
        onClose={() => setDialog(null)}
        onConfirm={(reason) => {
          setDialog(null);
          void send("BLOCK", reason);
        }}
      />
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
