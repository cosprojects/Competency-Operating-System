/**
 * Один трекер курсора на всё приложение (COS-EAR-016).
 *
 * Пишет в `<html>` две CSS-переменные `--pointer-nx`/`--pointer-ny` (−1…1) —
 * бумага-канвас (`.paper-layer`) читает их через `calc()`, поэтому React не
 * участвует в движении и не перерисовывается.
 *
 * Ограничения, заложенные намеренно:
 * - только точный указатель (`(hover: hover) and (pointer: fine)`) — на тач-
 *   устройствах параллакса нет;
 * - при `prefers-reduced-motion: reduce` подписки не создаются вовсе;
 * - при скрытой вкладке rAF останавливается и переменные обнуляются;
 * - следование экспоненциальное (без отскока), один листенер, пассивный.
 */

import {
  FINE_POINTER_QUERY,
  REDUCED_MOTION_QUERY,
  followFactor,
  normalizedPointer,
  shouldTrackPointer,
} from "./tokens";

type Cleanup = () => void;

let active: Cleanup | null = null;

const IDLE_EPSILON = 0.0005;

/**
 * Запускает трекер, если окружение это позволяет. Повторный вызов возвращает
 * уже активную остановку — трекер всегда один.
 */
export function startPointerTracking(): Cleanup {
  if (typeof window === "undefined") return () => {};
  if (active) return active;

  const reducedQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  const fineQuery = window.matchMedia(FINE_POINTER_QUERY);

  const allowed = () =>
    shouldTrackPointer({
      reducedMotion: reducedQuery.matches,
      finePointer: fineQuery.matches,
      hidden: document.hidden,
    });

  if (!allowed()) return () => {};

  const root = document.documentElement;
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  let frame = 0;
  let lastTime = 0;

  const write = () => {
    root.style.setProperty("--pointer-nx", currentX.toFixed(4));
    root.style.setProperty("--pointer-ny", currentY.toFixed(4));
  };

  const reset = () => {
    targetX = 0;
    targetY = 0;
  };

  const tick = (time: number) => {
    frame = 0;
    const dt = lastTime ? Math.min(0.05, (time - lastTime) / 1000) : 1 / 60;
    lastTime = time;

    const k = followFactor(dt);
    currentX += (targetX - currentX) * k;
    currentY += (targetY - currentY) * k;

    if (
      Math.abs(targetX - currentX) < IDLE_EPSILON &&
      Math.abs(targetY - currentY) < IDLE_EPSILON
    ) {
      currentX = targetX;
      currentY = targetY;
      write();
      lastTime = 0;
      return;
    }

    write();
    frame = window.requestAnimationFrame(tick);
  };

  const schedule = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(tick);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType && event.pointerType !== "mouse") return;
    const point = normalizedPointer(
      event.clientX,
      event.clientY,
      window.innerWidth,
      window.innerHeight,
    );
    targetX = point.x;
    targetY = point.y;
    schedule();
  };

  const onPointerLeave = () => {
    reset();
    schedule();
  };

  const onVisibilityChange = () => {
    if (document.hidden) {
      if (frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
      currentX = 0;
      currentY = 0;
      reset();
      lastTime = 0;
      write();
      return;
    }
    schedule();
  };

  const onPreferenceChange = () => {
    if (allowed()) return;
    stopTracking();
  };

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("pointerleave", onPointerLeave);
  document.addEventListener("visibilitychange", onVisibilityChange);
  reducedQuery.addEventListener("change", onPreferenceChange);
  fineQuery.addEventListener("change", onPreferenceChange);

  function stopTracking() {
    window.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerleave", onPointerLeave);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    reducedQuery.removeEventListener("change", onPreferenceChange);
    fineQuery.removeEventListener("change", onPreferenceChange);
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    root.style.removeProperty("--pointer-nx");
    root.style.removeProperty("--pointer-ny");
    active = null;
  }

  active = stopTracking;
  return stopTracking;
}
