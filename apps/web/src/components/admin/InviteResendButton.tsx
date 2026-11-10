"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { showToast } from "@/components/ui/Toast";

/** Переотправка приглашения (предыдущая ссылка отзывается на сервере). */
export function InviteResendButton({ email }: { email: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function resend() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "invite", email }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Не получилось");
      }
      showToast({ title: "Приглашение отправлено", text: "Старая ссылка отозвана.", duration: 4000 });
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
    <button className="button secondary small" type="button" disabled={busy} onClick={() => void resend()}>
      {busy ? "Отправляем…" : "Отправить снова"}
    </button>
  );
}
