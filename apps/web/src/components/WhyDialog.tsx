"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { IconCloseCircle } from "@/components/icons";

/** Модалка «Зачем мы это делаем» (rail: «Зачем это?»). */
export function WhyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
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

  return createPortal(
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="why-dialog" role="dialog" aria-modal="true" aria-labelledby="why-dialog-title">
        <div className="why-dialog-top">
          <h2 id="why-dialog-title">Зачем мы это делаем</h2>
          <button className="account-close" type="button" onClick={onClose} ref={closeRef} aria-label="Закрыть">
            <IconCloseCircle />
          </button>
        </div>
        <p>
          В эпоху ИИ учиться придётся постоянно: то, что вчера было профессией, завтра становится
          кнопкой в инструменте. При этом хорошее обучение стоит дорого, а курсы часто продают часы
          видео вместо понятного следующего шага.
        </p>
        <p>
          AXIONA — попытка сделать развитие дешевле, быстрее и точнее. Сначала показать, что уже
          есть и чего действительно не хватает, и только потом предлагать учиться.
        </p>
        <p>
          Продукт молодой. Мы (по сути я один + агенты) разбираем обратную связь по каждому проходу
          и меняем его по ней, улучшая продукт. Поэтому очень важно знать, что у вас получилось, а
          что нет.
        </p>
        <div className="why-actions">
          <a className="button" href="mailto:hi.axiona@protonmail.com">
            Написать мне →
          </a>
          <a className="button secondary" href="https://t.me/myaxiona" target="_blank" rel="noopener noreferrer">
            Канал в Telegram
          </a>
          <a className="why-link" href="https://axiona.world" target="_blank" rel="noopener noreferrer">
            Узнать о продукте подробнее
          </a>
        </div>
        <p className="why-note">
          Если вам зайдёт и мы запустимся — здесь появится ссылка на раздел «Карьера»!
        </p>
      </section>
    </div>,
    document.body,
  );
}
