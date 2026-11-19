"use client";

import { useEffect, useRef, useState } from "react";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { createPortal } from "react-dom";
import { IconCloseCircle } from "@/components/icons";

/** Дизайн-системный диалог подтверждения вместо window.confirm/prompt. */
export function ConfirmPrompt({
  open,
  title,
  description,
  inputLabel,
  defaultValue = "",
  confirmLabel = "Подтвердить",
  cancelLabel = "Отмена",
  danger = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  inputLabel?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setValue(defaultValue);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [open, defaultValue]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="feedback-dialog confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <div className="feedback-dialog-top">
          <Eyebrow>Подтверждение</Eyebrow>
          <button className="account-close" type="button" onClick={onClose} aria-label="Закрыть">
            <IconCloseCircle />
          </button>
        </div>
        <h2 id="confirm-title">{title}</h2>
        {description ? <p className="feedback-lead">{description}</p> : null}
        {inputLabel ? (
          <label className="field">
            <span className="field-label">{inputLabel}</span>
            <input
              ref={inputRef}
              className="input"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </label>
        ) : null}
        <div className="form-row">
          <button
            className={`button${danger ? " danger" : ""}`}
            type="button"
            onClick={() => {
              if (inputLabel && !value.trim()) return;
              onConfirm(value.trim());
            }}
            disabled={Boolean(inputLabel) && !value.trim()}
          >
            {confirmLabel}
          </button>
          <button className="button secondary" type="button" onClick={onClose}>
            {cancelLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
