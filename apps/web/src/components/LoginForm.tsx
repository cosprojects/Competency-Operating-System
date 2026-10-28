"use client";

import Link from "next/link";
import { useState } from "react";
import { trackClient } from "@/lib/client-analytics";

export function LoginForm({ returnTo }: { returnTo: string }) {
  const [email, setEmail] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setError(null);
    trackClient("signup_start", { method: "email" });
    try {
      const response = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, returnTo, acceptTerms: accepted }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Проверьте email");
      }
      setStatus("sent");
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Не удалось отправить письмо");
    }
  }

  if (status === "sent") {
    return (
      <div>
        <h1>Проверьте почту</h1>
        <p className="muted">
          Если адрес <strong>{email}</strong> может получать письма, мы отправили ссылку для входа.
          Она действует 15 минут и работает один раз.
        </p>
        <div className="notice info">
          Не пришло письмо? Проверьте спам или{" "}
          <button className="button ghost small" type="button" onClick={() => setStatus("idle")}>
            запросите новое
          </button>
          .
        </div>
      </div>
    );
  }

  return (
    <form className="forms" onSubmit={submit}>
      <div>
        <h1>Вход в AXIONA</h1>
        <p className="muted">
          Введите email — пришлём ссылку для входа. Пароль не нужен. Регистрация происходит при
          первом входе.
        </p>
      </div>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          className="input"
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />
      </div>
      <label className="small" style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          required
          style={{ marginTop: 3 }}
        />
        <span>
          Я принимаю <Link href="/legal/terms">условия использования</Link> и{" "}
          <Link href="/legal/privacy">политику конфиденциальности</Link>. Мне 18 лет или больше.
        </span>
      </label>
      {error ? <div className="notice error">{error}</div> : null}
      <button className="button" type="submit" disabled={status === "sending" || !accepted}>
        {status === "sending" ? "Отправляем…" : "Получить ссылку"}
      </button>

    </form>
  );
}
