"use client";

import { useEffect, useRef, useState } from "react";

export interface ToastOptions {
  title: string;
  text?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Длительность в мс; по умолчанию 5000. */
  duration?: number;
}

interface ToastState extends ToastOptions {
  id: number;
}

let listener: ((toast: ToastState) => void) | null = null;

/** Показать алерт внизу экрана по центру над тулбаром (COS-EAR-013). */
export function showToast(options: ToastOptions): void {
  listener?.({ ...options, id: Date.now() + Math.random() });
}

export function ToastHost() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    listener = (next) => setToast(next);
    return () => {
      listener = null;
    };
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
        setToast(null);
      }
    }, 250);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [toast]);

  if (!toast) return null;

  return (
    <div className="toast-host" role="status" aria-live="polite">
      <div className="toast-card">
        <h3 className="toast-title">{toast.title}</h3>
        {toast.text ? <p className="toast-text">{toast.text}</p> : null}
        {toast.actionLabel ? (
          <button
            className="button block toast-action"
            type="button"
            onClick={() => {
              toast.onAction?.();
              setToast(null);
            }}
          >
            {toast.actionLabel}
            {seconds > 0 ? ` (${seconds} сек)` : ""}
          </button>
        ) : (
          <button className="button block toast-action" type="button" onClick={() => setToast(null)}>
            Хорошо
          </button>
        )}
      </div>
    </div>
  );
}
