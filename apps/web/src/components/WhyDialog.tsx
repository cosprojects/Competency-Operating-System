"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { IconArrowRight, IconCloseCircle } from "@/components/icons";

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
          Привет! Я Кирилл, основатель AXIONA. Я пытаюсь переосмыслить то, как люди развиваются
          профессионально.
        </p>
        <p>
          В эпоху ИИ учиться придётся постоянно. Инструменты меняются, привычные задачи
          автоматизируются, а требования к специалистам становятся другими. При этом качественное
          обучение часто стоит дорого, а профессиональные знания разбросаны по разным источникам, и
          разобраться в них самостоятельно бывает непросто.
        </p>
        <p>
          AXIONA - попытка сделать профессиональное развитие доступнее, понятнее и эффективнее. Мы
          начинаем с простого: показываем, из чего складывается профессия, какие компетенции, знания
          и навыки нужны специалисту и где можно найти материалы для их развития. В перспективе
          хотим помогать людям определять индивидуальные направления и следующие шаги развития.
        </p>
        <div className="why-callout">
          <h3>Сейчас продукт находится на ранней стадии.</h3>
          <p>
            Я развиваю его вместе с AI-агентами: проверяю гипотезы, экспериментирую с методологиями
            и интеграциями, анализирую обратную связь и постепенно улучшаю систему. Поэтому мне
            особенно важно ваше мнение. Расскажите, что оказалось полезным, что вызвало вопросы,
            чего не хватает и что не сработало. Обратная связь напрямую влияет на то, каким станет
            AXIONA.
          </p>
        </div>
        <div className="why-actions">
          <a className="button" href="https://t.me/avertino" target="_blank" rel="noopener noreferrer">
            Написать мне <IconArrowRight />
          </a>
          <a className="button secondary" href="https://t.me/myaxiona" target="_blank" rel="noopener noreferrer">
            Канал в Telegram
          </a>
          <a className="why-link" href="https://axiona.world" target="_blank" rel="noopener noreferrer">
            Узнать о продукте
          </a>
        </div>
      </section>
    </div>,
    document.body,
  );
}
