"use client";

import { useEffect, type RefObject } from "react";

import { REDUCED_MOTION_QUERY } from "@/lib/motion/tokens";

/** Пиксели, после которых жест считается перетаскиванием, а не кликом. */
const DRAG_THRESHOLD = 6;
/** Сколько держать «клик после перетаскивания» заблокированным. */
const CLICK_SUPPRESS_MS = 250;

/** Доводим карусель до ближайшей карточки после перетаскивания. */
function snapToNearest(track: HTMLElement) {
  const tiles = track.querySelectorAll<HTMLElement>(".competency-tile");
  const first = tiles[0];
  const second = tiles[1];
  if (!first || !second) return;
  const step = Math.max(1, second.offsetLeft - first.offsetLeft);
  const index = Math.round(track.scrollLeft / step);
  const max = track.scrollWidth - track.clientWidth;
  const left = Math.max(0, Math.min(index * step, max));
  if (Math.abs(left - track.scrollLeft) < 1) return;
  const reduceMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
  track.scrollTo({ left, behavior: reduceMotion ? "auto" : "smooth" });
}

/**
 * Горизонтальный скролл перетягиванием для карусели карточек в рейле.
 *
 * Колесо и тачпад листают такой ряд по-разному (у мыши вертикальное колесо
 * горизонтальный ряд не двигает вообще), а перетаскивание работает одинаково.
 * На тач-устройствах не вмешиваемся: там нативный свайп и scroll-snap.
 *
 * Слушатели вешаем на контейнер-делегат и ловим жест на ближайшем `selector`,
 * поэтому не нужно заводить ref на каждую карусель.
 */
export function useDragToScroll(
  containerRef: RefObject<HTMLElement | null>,
  selector: string,
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let drag: {
      track: HTMLElement;
      pointerId: number;
      startX: number;
      startScroll: number;
      moved: boolean;
    } | null = null;
    let suppressClickUntil = 0;

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch" || event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      const track = target?.closest<HTMLElement>(selector);
      // Тянуть нечего, если ряд не переполнен: обычный клик по карточке.
      if (!track || track.scrollWidth <= track.clientWidth + 1) return;
      drag = {
        track,
        pointerId: event.pointerId,
        startX: event.clientX,
        startScroll: track.scrollLeft,
        moved: false,
      };
      track.classList.add("is-dragging");
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const dx = event.clientX - drag.startX;
      if (!drag.moved) {
        if (Math.abs(dx) < DRAG_THRESHOLD) return;
        drag.moved = true;
      }
      drag.track.scrollLeft = drag.startScroll - dx;
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const { track, moved } = drag;
      drag = null;
      track.classList.remove("is-dragging");
      if (!moved) return;
      // Карточка не должна открыться после того, как её протащили.
      suppressClickUntil = Date.now() + CLICK_SUPPRESS_MS;
      snapToNearest(track);
    };

    const onPointerCancel = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      drag.track.classList.remove("is-dragging");
      drag = null;
    };

    const onClickCapture = (event: Event) => {
      if (Date.now() > suppressClickUntil) return;
      suppressClickUntil = 0;
      event.preventDefault();
      event.stopPropagation();
    };

    container.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    container.addEventListener("click", onClickCapture, true);

    return () => {
      container.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      container.removeEventListener("click", onClickCapture, true);
      drag?.track.classList.remove("is-dragging");
      drag = null;
    };
  }, [containerRef, selector]);
}
