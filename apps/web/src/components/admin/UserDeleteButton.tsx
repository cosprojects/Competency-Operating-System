"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmPrompt } from "@/components/ui/ConfirmPrompt";

/** Полное удаление пользователя (COS-EAR-014). */
export function UserDeleteButton({ userId, email }: { userId: string; email: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function remove() {
    setConfirmOpen(false);
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "delete", userId }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Не получилось");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не получилось");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <ConfirmPrompt
        open={confirmOpen}
        title={`Удалить ${email}?`}
        description="Пропадут сохранения, просмотры, отзывы и голоса. Вернуть нельзя."
        confirmLabel="Удалить"
        danger
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void remove()}
      />
      <button className="button danger small" type="button" disabled={busy} onClick={() => setConfirmOpen(true)}>
        {busy ? "Удаляем…" : "Удалить"}
      </button>
      {error ? <div className="small muted">{error}</div> : null}
    </div>
  );
}
