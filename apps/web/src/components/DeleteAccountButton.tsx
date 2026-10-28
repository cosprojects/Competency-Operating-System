"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteAccountButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm("Удалить аккаунт и все сохранённые данные? Это действие нельзя отменить.")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/account/delete", { method: "POST" });
      if (!response.ok) throw new Error("Не удалось удалить аккаунт");
      router.push("/");
      router.refresh();
    } catch {
      setError("Не удалось удалить аккаунт. Напишите в support@axiona.world.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button className="button danger small" type="button" onClick={() => void remove()} disabled={busy}>
        {busy ? "Удаляем…" : "Удалить аккаунт"}
      </button>
      {error ? (
        <div className="small" style={{ color: "var(--danger)", marginTop: 6 }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}
