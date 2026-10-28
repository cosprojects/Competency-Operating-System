"use client";

import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { trackClient } from "@/lib/client-analytics";

const TYPES = [
  ["CONTENT_ERROR", "Ошибка или неточность"],
  ["MISSING_COMPETENCY", "Не хватает компетенции или навыка"],
  ["BAD_MATERIAL", "Не подходит материал"],
  ["MISSING_FEATURE", "Не хватает функциональности"],
  ["IMPROVEMENT", "Предложение по улучшению"],
  ["GENERAL", "Общий отзыв"],
] as const;

type FeedbackType = (typeof TYPES)[number][0];

export function FeedbackForm({
  context,
  targetType,
  targetId,
  initialType,
}: {
  context: "competency" | "source" | "general";
  targetType?: "COMPETENCY" | "SOURCE";
  targetId?: string;
  initialType?: FeedbackType;
}) {
  const pathname = usePathname();
  const [type, setType] = useState<FeedbackType>(
    initialType ??
      (context === "source"
        ? "BAD_MATERIAL"
        : context === "competency"
          ? "CONTENT_ERROR"
          : "GENERAL"),
  );
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const opened = useRef(false);

  function markOpen() {
    if (opened.current) return;
    opened.current = true;
    trackClient("feedback_open", {
      context,
      ...(targetType ? { target_type: targetType } : {}),
    });
  }

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
          ...(targetType ? { targetType } : {}),
          ...(targetId ? { targetId } : {}),
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
        ...(targetType ? { target_type: targetType } : {}),
        has_rating: Boolean(rating),
        has_comment: Boolean(comment.trim()),
      });
      setStatus("sent");
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Не удалось отправить отзыв");
    }
  }

  if (status === "sent") {
    return (
      <div className="notice success">
        Спасибо! Отзыв сохранён. Мы читаем их и используем для исправлений.
        <div style={{ marginTop: 10 }}>
          <button className="button secondary small" type="button" onClick={() => setStatus("idle")}>
            Отправить ещё
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="forms" onSubmit={submit} onFocus={markOpen}>
      <div className="field">
        <label htmlFor={`feedback-type-${context}`}>Тип обратной связи</label>
        <select
          className="select"
          id={`feedback-type-${context}`}
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
        <span className="small" style={{ fontWeight: 700 }}>
          Насколько это полезно? (необязательно)
        </span>
        <div className="rating" role="group" aria-label="Оценка полезности">
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value}>
              <input
                type="radio"
                name={`rating-${context}`}
                value={value}
                checked={rating === value}
                onChange={() => setRating(value)}
              />{" "}
              {value}
            </label>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor={`feedback-comment-${context}`}>Комментарий</label>
        <textarea
          className="textarea"
          id={`feedback-comment-${context}`}
          value={comment}
          maxLength={4000}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Что было непонятно, неточно или чего не хватило?"
        />
        <small>{comment.length}/4000</small>
      </div>

      <div className="field">
        <label htmlFor={`feedback-email-${context}`}>Email для ответа (необязательно)</label>
        <input
          className="input"
          id={`feedback-email-${context}`}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
        />
        <small>Оставьте, только если хотите получить ответ. Мы не передаём email третьим лицам.</small>
      </div>

      <div style={{ display: "none" }} aria-hidden="true">
        <label htmlFor={`feedback-website-${context}`}>Website</label>
        <input
          id={`feedback-website-${context}`}
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </div>

      {error ? <div className="notice error">{error}</div> : null}

      <div className="form-row">
        <button className="button" type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Отправляем…" : "Отправить отзыв"}
        </button>
        <span className="small muted">Можно отправить без имени и email.</span>
      </div>
    </form>
  );
}
