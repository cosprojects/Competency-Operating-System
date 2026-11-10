"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Приглашение нового email: письмо со ссылкой входа (COS-EAR-014). */
export function UserInviteForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "invite", email }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Не получилось");
      setMessage("Ссылка отправлена. Адрес появится в списке после подтверждения.");
      setEmail("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не получилось");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-invite" onSubmit={submit}>
      <div className="field">
        <label htmlFor="admin-invite-email">Добавить email</label>
        <input
          className="input"
          id="admin-invite-email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />
      </div>
      <button className="button small" type="submit" disabled={busy}>
        {busy ? "Отправляем…" : "Пригласить"}
      </button>
      {message ? <div className="notice success">{message}</div> : null}
      {error ? <div className="notice error">{error}</div> : null}
    </form>
  );
}
