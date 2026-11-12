"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteAccountButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/account/delete", { method: "POST" });
      if (!response.ok) throw new Error("Не удалось удалить аккаунт");
      setOpen(false);
      router.push("/");
      router.refresh();
    } catch {
      setError("Не удалось удалить аккаунт. Напишите в hi.axiona@protonmail.com.");
      setBusy(false);
    }
  }

  return (
    <div>
      <button className="button danger small" type="button" onClick={() => setOpen(true)}>
        Удалить аккаунт
      </button>
      {open ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !busy) setOpen(false);
        }}>
          <section className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-account-title">
            <h2 id="delete-account-title">Удалить аккаунт?</h2>
            <p className="account-lead">
              Пропадут аккаунт, сохранения, статусы, просмотры, отзывы и голоса за материалы.
              Сессия будет отозвана. Вернуть данные нельзя.
            </p>
            {error ? <div className="notice" style={{ color: "var(--danger)" }}>{error}</div> : null}
            <div className="account-form-actions">
              <button className="button danger" type="button" onClick={() => void remove()} disabled={busy}>
                {busy ? "Удаляем…" : "Удалить"}
              </button>
              <button className="button secondary" type="button" onClick={() => setOpen(false)} disabled={busy}>
                Отмена
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
