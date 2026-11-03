"use client";

import Link from "next/link";
import { useState } from "react";
import { trackClient } from "@/lib/client-analytics";

export function LoginForm({ returnTo }: { returnTo: string }) {
  const [email, setEmail] = useState("");
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
        body: JSON.stringify({ email, returnTo, acceptTerms: true }),
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
      <div className="auth-sent">
        <h1>Проверьте почту</h1>
        <p className="auth-desc">
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
    <form className="auth-form" onSubmit={submit}>
      <h1>Войдите в AXIONA</h1>
      <p className="auth-desc">
        Введите email — пришлём ссылку для входа. Без паролей и доступов. Регистрация происходит при
        первом входе.
      </p>

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

      <p className="auth-politics">
        Нажимая «Войти» вы принимаете{" "}
        <Link href="/legal/terms">Условия использования</Link> и{" "}
        <Link href="/legal/privacy">Политику конфиденциальности</Link>
      </p>

      {error ? <div className="notice error">{error}</div> : null}

      <button className="button block auth-submit" type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Отправляем…" : "Получить ссылку для входа"}
      </button>
    </form>
  );
}
