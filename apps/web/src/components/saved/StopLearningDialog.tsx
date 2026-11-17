"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { IconCloseCircle } from "@/components/icons";

/**
 * Подтверждение «Прекратить изучение?» для карточки компетенции в «Изучаю».
 * Само действие — удаление компетенции из сохранённых (Favorite), отметки
 * знаний и навыков остаются.
 */
export function StopLearningDialog({
  open,
  competencyTitle,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  competencyTitle: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open, onCancel]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        className="stop-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stop-dialog-title"
      >
        <div className="stop-dialog-top">
          <h2 id="stop-dialog-title">Прекратить изучение?</h2>
          <button
            className="account-close"
            type="button"
            onClick={onCancel}
            aria-label="Закрыть"
          >
            <IconCloseCircle />
          </button>
        </div>
        <p>
          Компетенция «{competencyTitle}» больше не будет в активном маршруте «Изучаю». Отметки
          знаний и навыков сохранятся — к изучению можно вернуться в любой момент.
        </p>
        <div className="stop-dialog-actions">
          <button className="button secondary" type="button" onClick={onCancel} ref={cancelRef}>
            Отмена
          </button>
          <button className="button" type="button" onClick={onConfirm} disabled={busy}>
            {busy ? "Прекращаем…" : "Прекратить"}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
