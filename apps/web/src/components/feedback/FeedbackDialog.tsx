"use client";

import { usePathname } from "next/navigation";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { useEffect, useRef, useState } from "react";
import { IconCheckCircle, IconCloseCircle } from "@/components/icons";
import { trackClient } from "@/lib/client-analytics";
import type { FeedbackOptions, FeedbackType } from "./FeedbackProvider";

const TYPES: Array<[FeedbackType, string]> = [
  ["GENERAL", "Общий отзыв"],
  ["CONTENT_ERROR", "Ошибка или неточность"],
  ["MISSING_COMPETENCY", "Не хватает компетенции или навыка"],
  ["BAD_MATERIAL", "Не подходит материал"],
  ["MISSING_FEATURE", "Не хватает функциональности"],
  ["IMPROVEMENT", "Предложение по улучшению"],
];

const RATINGS = [1, 2, 3, 4, 5];

export function FeedbackDialog({
  options,
  onClose,
}: {
  options: FeedbackOptions | null;
  onClose: () => void;
}) {
  const open = options !== null;
  const pathname = usePathname();
  // Фокус ставим на сам диалог, а не на крестик: иначе программный фокус
  // рисует на кнопке акцентную плашку и она выглядит как лишняя обводка.
  const dialogRef = useRef<HTMLElement>(null);
  const openedRef = useRef(false);

  const context = options?.context ?? "general";
  const [type, setType] = useState<FeedbackType>("GENERAL");
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  // Обязательный для отправки минимум: комментарий. Email — необязательный,
  // но если его ввели, он должен быть валидным.
  const trimmedComment = comment.trim();
  const trimmedEmail = email.trim();
  const emailValid = trimmedEmail === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);
  const canSubmit = trimmedComment.length > 0 && emailValid;

  // На каждое открытие — чистая форма и нужный тип отзыва.
  useEffect(() => {
    if (!open) return;
    setType(
      options?.type ??
        (context === "source" ? "BAD_MATERIAL" : context === "competency" ? "CONTENT_ERROR" : "GENERAL"),
    );
    setRating(null);
    setComment("");
    setEmail("");
    setWebsite("");
    setStatus("idle");
    setError(null);
    dialogRef.current?.focus();
    if (!openedRef.current) {
      openedRef.current = true;
      trackClient("feedback_open", {
        context,
        ...(options?.targetType ? { target_type: options.targetType } : {}),
      });
    }
  }, [open, options, context]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setError(null);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type,
          ...(options?.targetType ? { targetType: options.targetType } : {}),
          ...(options?.targetId ? { targetId: options.targetId } : {}),
          rating,
          comment,
          contactEmail: email,
          pagePath: pathname,
          website,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Отзыв не ушёл");
      trackClient("feedback_submit", {
        feedback_type: type,
        ...(options?.targetType ? { target_type: options.targetType } : {}),
        has_rating: Boolean(rating),
        has_comment: Boolean(comment.trim()),
      });
      setStatus("sent");
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Отзыв не ушёл: попробуй ещё раз.");
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="feedback-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="feedback-dialog-top">
          <Eyebrow>Обратная связь</Eyebrow>
          <button className="account-close" type="button" onClick={onClose} aria-label="Закрыть">
            <IconCloseCircle />
          </button>
        </div>

        {status === "sent" ? (
          <div className="feedback-success">
            <span className="success-icon">
              <IconCheckCircle />
            </span>
            <h3 id="feedback-title">Спасибо, отзыв ушёл</h3>
            <p>
              Мы отправили его на <span className="mail">hi.axiona@protonmail.com</span> и читаем
              каждое сообщение. Если оставил email — ответим на него.
            </p>
            <button className="button" type="button" onClick={onClose}>
              Закрыть
            </button>
          </div>
        ) : (
          <>
            <h2 id="feedback-title">Что стоит исправить или добавить</h2>
            <p className="feedback-lead">
              Отзывы идут в работу: по ним правим материалы и карту. Можно отправить анонимно;
              email нужен только если хочешь ответ.
            </p>

            <form className="feedback-form" onSubmit={submit}>
              <div className="field">
                <label htmlFor="feedback-type">Тип обратной связи</label>
                <select
                  className="select"
                  id="feedback-type"
                  value={type}
                  onChange={(event) => setType(event.target.value as FeedbackType)}
                >
                  {TYPES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <span className="field-label">Насколько это полезно? (необязательно)</span>
                <div className="rating" role="group" aria-label="Оценка полезности">
                  {RATINGS.map((value) => (
                    <label key={value} className={rating === value ? "is-checked" : undefined}>
                      <input
                        type="radio"
                        name="feedback-rating"
                        value={value}
                        checked={rating === value}
                        onChange={() => setRating(value)}
                      />
                      <span className="rating-box" aria-hidden="true" />
                      {value}
                    </label>
                  ))}
                </div>
              </div>

              <div className="field">
                <label htmlFor="feedback-comment">Комментарий</label>
                <textarea
                  className="textarea"
                  id="feedback-comment"
                  value={comment}
                  maxLength={4000}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Что было непонятно, неточно или чего не хватило?"
                />
                <small>
                  {comment.length}/4000
                </small>
              </div>

              <div className="field">
                <label htmlFor="feedback-email">Email для ответа (необязательно)</label>
                <input
                  className="input"
                  id="feedback-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
                <small>Оставь, только если хочешь получить ответ. Мы не передаём email третьим лицам.</small>
              </div>

              <div style={{ display: "none" }} aria-hidden="true">
                <label htmlFor="feedback-website">Website</label>
                <input
                  id="feedback-website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                />
              </div>

              {error ? <div className="notice error">{error}</div> : null}

              <div className="form-row">
                <button
                  className="button"
                  type="submit"
                  disabled={!canSubmit || status === "sending"}
                  title={canSubmit ? undefined : "Добавь комментарий, чтобы отправить отзыв"}
                >
                  {status === "sending" ? "Отправляем…" : "Отправить отзыв"}
                </button>
                <span className="small muted">
                  {canSubmit
                    ? "Можно отправить без имени и email."
                    : "Комментарий обязателен — без него отправить нельзя."}
                </span>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
