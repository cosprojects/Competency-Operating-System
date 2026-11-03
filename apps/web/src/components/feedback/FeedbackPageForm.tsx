"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { IconCheckCircle, IconCloseCircle } from "@/components/icons";
import { trackClient } from "@/lib/client-analytics";
import type { FeedbackType } from "./FeedbackProvider";

const TYPES: Array<[FeedbackType, string]> = [
  ["GENERAL", "Общий отзыв"],
  ["CONTENT_ERROR", "Ошибка или неточность"],
  ["MISSING_COMPETENCY", "Не хватает компетенции или навыка"],
  ["BAD_MATERIAL", "Не подходит материал"],
  ["MISSING_FEATURE", "Не хватает функциональности"],
  ["IMPROVEMENT", "Предложение по улучшению"],
];

const RATINGS = [1, 2, 3, 4, 5];

/** Страница обратной связи по макету 151-20275. */
export function FeedbackPageForm() {
  const pathname = usePathname();
  const [type, setType] = useState<FeedbackType>("GENERAL");
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const trimmedComment = comment.trim();
  const trimmedEmail = email.trim();
  const emailValid = trimmedEmail === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);
  const canSubmit = trimmedComment.length > 0 && emailValid;

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
          rating,
          comment,
          contactEmail: email,
          pagePath: pathname,
          website,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Не удалось отправить отзыв");
      trackClient("feedback_submit", {
        feedback_type: type,
        has_rating: Boolean(rating),
        has_comment: Boolean(trimmedComment),
      });
      setStatus("sent");
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Не удалось отправить отзыв");
    }
  }

  return (
    <div className="feedback-page">
      <div className="feedback-page-top">
        <p className="eyebrow">Обратная связь</p>
        <Link className="icon-button" href="/" aria-label="Закрыть и вернуться на главную">
          <IconCloseCircle />
        </Link>
      </div>

      {status === "sent" ? (
        <div className="feedback-success">
          <span className="success-icon">
            <IconCheckCircle />
          </span>
          <h1>Спасибо, отзыв ушёл</h1>
          <p>
            Мы читаем каждое сообщение. Если оставил email — ответим на него; если нет, отзыв
            останется анонимным.
          </p>
          <Link className="button" href="/">
            Вернуться на главную
          </Link>
        </div>
      ) : (
        <>
          <h1 className="feedback-page-title">Что стоит исправить или добавить</h1>
          <p className="feedback-page-lead">
            Мы читаем отзывы и используем их для исправления контента и развития карты. Можно
            отправить анонимно; email нужен только если ты хочешь получить ответ.
          </p>

          <form className="feedback-form-card" onSubmit={submit}>
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
              <small>{comment.length}/4000</small>
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
              <small>
                Оставь, только если хочешь получить ответ. Мы не передаём email третьим лицам.
              </small>
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

            <div className="feedback-page-actions">
              <button className="button" type="submit" disabled={!canSubmit || status === "sending"}>
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
    </div>
  );
}
