"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconCheckCircle, IconCloseCircle } from "@/components/icons";
import { trackClient } from "@/lib/client-analytics";
import { showToast } from "@/components/ui/Toast";
import {
  sourceReviewBadge,
  type SourceReviewReason,
  type SourceReviewStatus,
} from "@/lib/source-review";

const REASONS: Array<[SourceReviewReason, string]> = [
  ["OFF_TOPIC", "Не по теме"],
  ["UNRELIABLE", "Недостоверный"],
  ["BROKEN", "Ссылка не работает"],
  ["LOCKED", "Платный или закрытый"],
  ["OTHER", "Другое"],
];

type ReviewAction = "CONFIRM" | "BLOCK";

interface ReviewResponse {
  ok?: boolean;
  status?: SourceReviewStatus;
  confirms?: number;
  blocks?: number;
  error?: string;
}

/**
 * Бейдж «Подтвердить» в карточке материала и модалка подтверждения/блокировки.
 * Голосуют только залогиненные: гость уходит на вход с возвратом к материалу.
 * После действия показываем алерт внизу экрана с благодарностью и отменой (COS-EAR-013).
 */
export function SourceReviewBadge({
  sourceId,
  sourceTitle,
  competencyId,
  competencyTitle,
  initialStatus,
  canReview,
  returnTo,
  myReviewAction,
  onDecided,
}: {
  sourceId: string;
  sourceTitle: string;
  competencyId: string;
  competencyTitle: string;
  initialStatus?: SourceReviewStatus;
  canReview: boolean;
  returnTo: string;
  myReviewAction?: ReviewAction | null;
  onDecided?: (action: ReviewAction | null) => void;
}) {
  const router = useRouter();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [status, setStatus] = useState<SourceReviewStatus | undefined>(initialStatus);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"choice" | "block" | "done">("choice");
  const [reason, setReason] = useState<SourceReviewReason | null>(null);
  const [comment, setComment] = useState("");
  const [submitState, setStatus2] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [decided, setDecided] = useState<ReviewAction | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const badge = status ? sourceReviewBadge(status) : null;
  if (!badge || decided || myReviewAction) return null;

  function start() {
    trackClient("source_review_open", { source_id: sourceId, competency_id: competencyId });
    if (!canReview) {
      router.push(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    setMode("choice");
    setReason(null);
    setComment("");
    setStatus2("idle");
    setError(null);
    setOpen(true);
  }

  async function undo(action: ReviewAction) {
    try {
      const response = await fetch("/api/source-reviews", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceId, competencyId }),
      });
      if (!response.ok) throw new Error("fail");
      setDecided(null);
      onDecided?.(null);
      router.refresh();
    } catch {
      // Отмена не удалась — оставляем голос.
    }
    void action;
  }

  async function submit(action: ReviewAction) {
    setStatus2("sending");
    setError(null);
    try {
      const response = await fetch("/api/source-reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceId,
          competencyId,
          action,
          ...(action === "BLOCK" && reason ? { reason } : {}),
          ...(comment.trim() ? { comment } : {}),
          pagePath: window.location.pathname,
        }),
      });
      const data = (await response.json()) as ReviewResponse;
      if (!response.ok) {
        if (response.status === 401) {
          router.push(`/login?returnTo=${encodeURIComponent(returnTo)}`);
          return;
        }
        throw new Error(data.error ?? "Не получилось отправить");
      }
      trackClient("source_review_submit", {
        source_id: sourceId,
        competency_id: competencyId,
        action,
        ...(action === "BLOCK" && reason ? { reason } : {}),
      });
      if (data.status) {
        setStatus(data.status);
      }
      setStatus2("idle");
      setDecided(action);
      setOpen(false);
      onDecided?.(action);

      const gratitude =
        "Спасибо, что проверил материал на достоверность. Твой голос делает карту точнее.";
      if (action === "CONFIRM") {
        showToast({
          title: "Материал подтверждён",
          text: `${gratitude} Бейдж исчезнет, когда подтвердят другие.`,
          actionLabel: "Отменить",
          duration: 5000,
          onAction: () => void undo("CONFIRM"),
        });
      } else {
        showToast({
          title: "Материал опровергнут",
          text: gratitude,
          actionLabel: "Отменить удаление",
          duration: 5000,
          onAction: () => void undo("BLOCK"),
        });
      }
    } catch (caught) {
      setStatus2("error");
      setError(caught instanceof Error ? caught.message : "Не получилось отправить");
    }
  }

  return (
    <>
      <button
        type="button"
        className="material-confirm"
        data-hint={badge.hint}
        aria-label={`${badge.label}. ${badge.hint}`}
        onClick={start}
      >
        {badge.label}
      </button>

      {open ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            className="feedback-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="source-review-title"
          >
            <div className="feedback-dialog-top">
              <p className="eyebrow">Проверка материала</p>
              <button
                className="detail-close"
                type="button"
                onClick={() => setOpen(false)}
                ref={closeRef}
                aria-label="Закрыть"
              >
                <IconCloseCircle />
              </button>
            </div>

            {mode === "done" ? (
              <div className="feedback-success">
                <span className="success-icon">
                  <IconCheckCircle />
                </span>
                <h3 id="source-review-title">Спасибо, учли</h3>
                <button className="button" type="button" onClick={() => setOpen(false)}>
                  Закрыть
                </button>
              </div>
            ) : (
              <>
                <h2 id="source-review-title">Материал подходит?</h2>
                <p className="feedback-lead">
                  «{sourceTitle}» — проверь, что он по теме компетенции «{competencyTitle}», ссылка
                  открывается, а доступ соответствует метке.
                </p>

                {mode === "choice" ? (
                  <div className="form-row">
                    <button
                      className="button"
                      type="button"
                      disabled={submitState === "sending"}
                      onClick={() => void submit("CONFIRM")}
                    >
                      {submitState === "sending" ? "Отправляем…" : "Да, подходит"}
                    </button>
                    <button
                      className="button secondary"
                      type="button"
                      disabled={submitState === "sending"}
                      onClick={() => setMode("block")}
                    >
                      Не подходит
                    </button>
                  </div>
                ) : (
                  <form
                    className="feedback-form-card"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (reason) void submit("BLOCK");
                    }}
                  >
                    <fieldset className="field">
                      <span className="field-label">Что не так?</span>
                      <div className="rating" role="radiogroup" aria-label="Причина">
                        {REASONS.map(([value, label]) => (
                          <label key={value} className={reason === value ? "is-checked" : undefined}>
                            <input
                              type="radio"
                              name="source-review-reason"
                              value={value}
                              checked={reason === value}
                              onChange={() => setReason(value)}
                            />
                            <span className="rating-box" aria-hidden="true" />
                            {label}
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    <div className="field">
                      <label htmlFor="source-review-comment">Комментарий (необязательно)</label>
                      <textarea
                        className="textarea"
                        id="source-review-comment"
                        value={comment}
                        maxLength={500}
                        onChange={(event) => setComment(event.target.value)}
                        placeholder="Что именно не так — это поможет проверить быстрее"
                      />
                      <small>{comment.length}/500</small>
                    </div>

                    {error ? <div className="notice error">{error}</div> : null}

                    <div className="form-row">
                      <button className="button" type="submit" disabled={!reason || submitState === "sending"}>
                        {submitState === "sending" ? "Отправляем…" : "Отправить"}
                      </button>
                      <button
                        className="button secondary"
                        type="button"
                        disabled={submitState === "sending"}
                        onClick={() => setMode("choice")}
                      >
                        Назад
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
