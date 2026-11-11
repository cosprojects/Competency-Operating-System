"use client";

import { useEffect } from "react";

/**
 * Автоматическое подтверждение входа по ссылке из письма: пользователю не нужно
 * нажимать «Войти» повторно — форма отправляется сама, веб-сервер ставит сессию
 * и редиректит на целевую страницу.
 */
export function AutoVerify({ token }: { token: string }) {
  useEffect(() => {
    const form = document.getElementById("auto-verify-form");
    if (form instanceof HTMLFormElement) form.requestSubmit();
  }, []);

  return (
    <div className="auth-card">
      <h1>Входим в AXIONA</h1>
      <p className="auth-desc">Секунду — открываем карту компетенций.</p>
      <form id="auto-verify-form" action="/api/auth/verify" method="post">
        <input type="hidden" name="token" value={token} />
        <noscript>
          <button className="button block" type="submit">
            Войти
          </button>
        </noscript>
      </form>
    </div>
  );
}
