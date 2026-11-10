"use client";

import Link from "next/link";
import { useState } from "react";
import { trackClient } from "@/lib/client-analytics";

type Mode = "login" | "register";

interface Copy {
  title: string;
  description: string;
  sentNote: string;
  submit: string;
  sending: string;
  consentVerb: string;
}

function copyFor(mode: Mode, ttlText: string): Copy {
  if (mode === "register") {
    return {
      title: "Создай аккаунт",
      description:
        "Введи email — пришлём ссылку. Аккаунт создаётся при первом входе и бесплатный: без пароля и лишних анкет.",
      sentNote: `Ссылка действует ${ttlText} и работает один раз.`,
      submit: "Создать аккаунт",
      sending: "Отправляем…",
      consentVerb: "Создать аккаунт",
    };
  }
  return {
    title: "Войди в AXIONA",
    description: `Введи email — пришлём ссылку для входа. Без пароля: ссылка действует ${ttlText} и работает один раз.`,
    sentNote: `Ссылка действует ${ttlText} и работает один раз.`,
    submit: "Получить ссылку для входа",
    sending: "Отправляем…",
    consentVerb: "Войти",
  };
}

export function LoginForm({
  returnTo,
  mode = "login",
  linkTtlText = "15 минут",
}: {
  returnTo: string;
  mode?: Mode;
  linkTtlText?: string;
}) {
  const copy = copyFor(mode, linkTtlText);
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setError(null);
    // signup_start — только осознанный вход в регистрацию, а не любой повторный вход.
    if (mode === "register") trackClient("signup_start", { method: "email", context: "register" });
    try {
      const response = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, returnTo, website }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Проверь email");
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
        <h1>Проверь почту</h1>
        <p className="auth-desc">
          Если адрес <strong>{email}</strong> может получать письма, мы отправили ссылку.{" "}
          {copy.sentNote}
        </p>
        <div className="notice info">
          Не пришло письмо? Проверь папку «Спам» или{" "}
          <button className="button ghost small" type="button" onClick={() => setStatus("idle")}>
            запроси новое
          </button>
          .
        </div>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <h1>{copy.title}</h1>
      <p className="auth-desc">{copy.description}</p>

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

      {/* Honeypot для ботов: поле скрыто от людей и должно остаться пустым. */}
      <div aria-hidden="true" className="auth-honeypot">
        <label htmlFor="website">Не заполняй это поле</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </div>

      <p className="auth-politics">
        Нажимая «{copy.consentVerb}», ты принимаешь{" "}
        <Link href="/legal/terms">Условия использования</Link> и{" "}
        <Link href="/legal/privacy">Политику конфиденциальности</Link>
      </p>

      {error ? (
        <div className="notice error" role="alert">
          {error}
        </div>
      ) : null}

      <button className="button block auth-submit" type="submit" disabled={status === "sending"}>
        {status === "sending" ? copy.sending : copy.submit}
      </button>
    </form>
  );
}
