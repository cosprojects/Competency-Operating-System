"use client";

import { useEffect } from "react";
import { FINE_POINTER_QUERY, REDUCED_MOTION_QUERY, followFactor } from "@/lib/motion/tokens";

/**
 * «Жидкая» подсветка кнопок за курсором (COS-EAR-016).
 *
 * Тот же язык, что у `PrimaryCta` на главной, но без переписывания каждой
 * кнопки: компонент один раз вешает делегированный pointermove и двигает
 * CSS-переменные `--hl-x/--hl-y` у ближайшей кнопки. Слой подсветки —
 * `::before` с `z-index: -1` внутри изолированного stacking context, поэтому
 * он лежит над фоном кнопки, но под подписью.
 *
 * Ничего не рендерит. На тач-устройствах и при `prefers-reduced-motion`
 * слушатель не включается.
 */
const BUTTON_SELECTOR = [
  "button.button",
  "a.button",
  ".material-cta",
  ".learning-next-cta",
  ".learning-row-open",
  ".studying-tab",
  ".learning-profession-card .icon-button",
  ".profession-tile",
  ".competency-card",
  ".home2-plan-banner",
  ".plan-matrix-card",
].join(",");

/** Тон подсветки по фактическому фону кнопки: на светлой — мягкий индиго. */
function applyTone(element: HTMLElement): void {
  const background = window.getComputedStyle(element).backgroundColor;
  const match = background.match(/rgba?\(([^)]+)\)/);
  const channels = match?.[1];
  if (!channels) return;
  const [r = 255, g = 255, b = 255, a = 1] = channels
    .split(/[,\s/]+/)
    .filter(Boolean)
    .map(Number);
  const alpha = Number.isFinite(a) ? a : 1;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  element.dataset.tone = alpha < 0.35 ? "transparent" : luminance >= 0.7 ? "light" : "solid";
}

export function ButtonHoverLights() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia(FINE_POINTER_QUERY).matches) return;

    const reduced = window.matchMedia(REDUCED_MOTION_QUERY);
    let element: HTMLElement | null = null;
    let raf = 0;
    let last = 0;
    const state = { x: 50, y: 50, tx: 50, ty: 50 };

    function paint(): void {
      if (element) {
        element.style.setProperty("--hl-x", `${state.x.toFixed(2)}%`);
        element.style.setProperty("--hl-y", `${state.y.toFixed(2)}%`);
      }
    }

    function tick(time: number): void {
      raf = 0;
      const dt = last ? Math.min(0.05, (time - last) / 1000) : 1 / 60;
      last = time;
      const k = followFactor(dt);
      state.x += (state.tx - state.x) * k;
      state.y += (state.ty - state.y) * k;
      paint();
      if (Math.abs(state.tx - state.x) < 0.05 && Math.abs(state.ty - state.y) < 0.05) {
        state.x = state.tx;
        state.y = state.ty;
        last = 0;
        return;
      }
      raf = window.requestAnimationFrame(tick);
    }

    function schedule(): void {
      if (!raf) raf = window.requestAnimationFrame(tick);
    }

    function onMove(event: PointerEvent): void {
      if (reduced.matches) return;
      if (event.pointerType && event.pointerType !== "mouse") return;
      if (document.documentElement.dataset.motion === "off") return;
      const target =
        event.target instanceof Element ? event.target.closest(BUTTON_SELECTOR) : null;
      if (!(target instanceof HTMLElement)) return;
      // У главных CTA уже есть собственный эффект — второй слой не нужен.
      if (target.classList.contains("cta-primary")) return;

      const rect = target.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;

      if (element !== target) {
        element = target;
        if (!element.classList.contains("has-hover-light")) {
          element.classList.add("has-hover-light");
          applyTone(element);
        }
        state.x = x;
        state.y = y;
      }
      state.tx = x;
      state.ty = y;
      paint();
      schedule();
    }

    document.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
