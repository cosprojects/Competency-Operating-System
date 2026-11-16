"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ToastOptions {
  title: string;
  /** Имя сохранённого элемента: одна строка с многоточием. */
  headline?: string;
  text?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Длительность в мс; по умолчанию 5000. */
  duration?: number;
}

interface ToastState extends ToastOptions {
  id: number;
}

/** Сколько держим карточку после команды закрыть, пока играет выход. */
const EXIT_MS = 140;

let listener: ((toast: ToastState) => void) | null = null;

/** Показать алерт внизу экрана по центру над тулбаром (COS-EAR-013). */
export function showToast(options: ToastOptions): void {
  listener?.({ ...options, id: Date.now() + Math.random() });
}

export function ToastHost() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const timerRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    listener = (next) => {
      if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
      setLeaving(false);
      setToast(next);
    };
    return () => {
      listener = null;
    };
  }, []);

  /**
   * Закрытие с коротким выходом: 140 мс карточка уезжает, затем снимаем её из
   * DOM. Один таймер, сигнал доступности остаётся у контейнера.
   */
  const dismiss = useCallback(() => {
    setLeaving(true);
    if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
    exitTimerRef.current = window.setTimeout(() => {
      exitTimerRef.current = null;
      setToast(null);
      setLeaving(false);
    }, EXIT_MS);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const duration = toast.duration ?? 5000;
    const started = Date.now();
    setSeconds(Math.ceil(duration / 1000));
    timerRef.current = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((duration - (Date.now() - started)) / 1000));
      setSeconds(left);
      if (left <= 0) {
        if (timerRef.current) window.clearInterval(timerRef.current);
        dismiss();
      }
    }, 250);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [toast, dismiss]);

  useEffect(() => {
    return () => {
      if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
    };
  }, []);

  if (!toast) return null;

  const duration = toast.duration ?? 5000;

  return (
    <div className="toast-host" role="status" aria-live="polite" data-state={leaving ? "out" : "in"}>
      <div className={`toast-card${toast.headline ? " has-headline" : ""}`}>
        <span
          className="toast-progress"
          aria-hidden="true"
          style={{ animationDuration: `${duration}ms` }}
        />
        <h3 className="toast-title">{toast.title}</h3>
        {toast.headline ? <p className="toast-headline">{toast.headline}</p> : null}
        {toast.text ? <p className="toast-text">{toast.text}</p> : null}
        {toast.actionLabel ? (
          <button
            className="button block toast-action"
            type="button"
            onClick={() => {
              toast.onAction?.();
              dismiss();
            }}
          >
            {toast.actionLabel}
            {seconds > 0 ? ` (${seconds} сек)` : ""}
          </button>
        ) : (
          <button className="button block toast-action" type="button" onClick={dismiss}>
            Хорошо
          </button>
        )}
      </div>
    </div>
  );
}
