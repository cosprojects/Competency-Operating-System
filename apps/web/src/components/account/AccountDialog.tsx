"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { IconCloseCircle, IconLink, IconMail } from "@/components/icons";
import { showToast } from "@/components/ui/Toast";

type View = "main" | "email" | "delete";

/** Аккаунт-модалка по макету: email, смена, повтор ссылки, выход, удаление. */
export function AccountDialog({
  open,
  onClose,
  email,
}: {
  open: boolean;
  onClose: () => void;
  email: string;
}) {
  const router = useRouter();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [view, setView] = useState<View>("main");
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setView("main");
    setNewEmail("");
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  async function resendLink() {
    setBusy(true);
    try {
      const response = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) throw new Error("Не получилось отправить");
      showToast({
        title: "Ссылка для входа отправлена",
        text: "Ссылка для входа ушла на этот адрес. Проверь почту и перейди по ссылке из письма.",
        actionLabel: "Закрыть",
        duration: 6000,
      });
    } catch {
      showToast({
        title: "Письмо не ушло",
        text: "Проверь адрес и попробуй ещё раз.",
        actionLabel: "Закрыть",
        duration: 5000,
      });
    } finally {
      setBusy(false);
    }
  }

  async function requestEmailChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/account/email-change", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ newEmail }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Не получилось отправить письмо");
      showToast({
        title: "Ссылка для входа отправлена",
        text: "Ссылка ушла на новый адрес. Проверь почту и подтверди его — после этого старый адрес отвяжется от аккаунта.",
        actionLabel: "Закрыть",
        duration: 7000,
      });
      setView("main");
    } catch (caught) {
      showToast({
        title: "Не получилось",
        text: caught instanceof Error ? caught.message : "Попробуй ещё раз",
        actionLabel: "Закрыть",
        duration: 5000,
      });
    } finally {
      setBusy(false);
    }
  }

  async function removeAccount() {
    setBusy(true);
    try {
      const response = await fetch("/api/account/delete", { method: "POST" });
      if (!response.ok) throw new Error("Не удалось удалить аккаунт");
      router.push("/");
      router.refresh();
    } catch (caught) {
      showToast({
        title: "Не удалось удалить аккаунт",
        text: caught instanceof Error ? caught.message : "Попробуй ещё раз",
        actionLabel: "Закрыть",
        duration: 5000,
      });
      setBusy(false);
    }
  }

  return createPortal(
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-dialog-title">
        <div className="account-dialog-top">
          <p className="eyebrow">Ваш аккаунт</p>
          <button className="account-close" type="button" onClick={onClose} ref={closeRef} aria-label="Закрыть">
            <IconCloseCircle />
          </button>
        </div>

        {view === "main" ? (
          <>
            <h2 id="account-dialog-title">{email}</h2>
            <p className="account-lead">
              Авторизация и вход осуществляются через ссылку в письме. Если вы потеряли письмо или
              доступ к почте, воспользуйтесь инструментами для смены почты или запросите повторную
              отправку ссылки. Мы не сохраняем ваши данные после удаления.
            </p>

            <div className="account-row">
              <span className="account-row-icon"><IconMail /></span>
              <span className="account-row-label">Email</span>
              <span className="account-row-value">{email}</span>
              <button className="button secondary small account-button-email" type="button" onClick={() => setView("email")}>
                Сменить
              </button>
            </div>

            <div className="account-row">
              <span className="account-row-icon"><IconLink /></span>
              <span className="account-row-label">Получить ссылку для входа</span>
              <button className="button secondary small account-button-send" type="button" onClick={() => void resendLink()} disabled={busy}>
                {busy ? "Отправляем…" : "Отправить"}
              </button>
            </div>

            <form action="/api/auth/logout" method="post">
              <button className="button secondary block account-action" type="submit">
                Выйти из аккаунта
              </button>
            </form>
            <button className="button block account-delete" type="button" onClick={() => setView("delete")}>
              Удалить аккаунт
            </button>
          </>
        ) : null}

        {view === "email" ? (
          <form className="account-email-form" onSubmit={requestEmailChange}>
            <h2 id="account-dialog-title">Сменить email</h2>
            <p className="account-lead">Пришлем ссылку для входа на новый адрес.</p>
            <div className="field">
              <label htmlFor="account-new-email">Новый email</label>
              <input
                className="input"
                id="account-new-email"
                type="email"
                autoComplete="email"
                required
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="account-form-actions">
              <button className="button" type="submit" disabled={busy}>
                {busy ? "Отправляем…" : "Получить ссылку для входа"}
              </button>
              <button className="button secondary" type="button" onClick={() => setView("main")}>
                Назад
              </button>
            </div>
          </form>
        ) : null}

        {view === "delete" ? (
          <>
            <h2 id="account-dialog-title">Удалить аккаунт?</h2>
            <p className="account-lead">
              Пропадут сохранения, отметки о просмотре, отзывы и голоса за материалы. Вернуть нельзя.
            </p>
            <div className="account-form-actions">
              <button className="button danger" type="button" onClick={() => void removeAccount()} disabled={busy}>
                {busy ? "Удаляем…" : "Удалить"}
              </button>
              <button className="button secondary" type="button" onClick={() => setView("main")}>
                Отмена
              </button>
            </div>
          </>
        ) : null}
      </section>
    </div>,
    document.body,
  );
}
