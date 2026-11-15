/**
 * Система движения AXIONA — значения и чистая математика (COS-EAR-016).
 *
 * Модуль намеренно не трогает DOM на уровне импорта: его использует и браузер
 * (компоненты, хуки), и node-тесты (`tests/motion.test.ts`).
 *
 * Источник языка движения — `COS-COM-006 §7` и `COS-COM-011 §2.5`: ease-out,
 * без overshoot/bounce/spring, движение объясняет изменение, а не развлекает.
 * Значения ниже обязаны совпадать с CSS-токенами в `app/globals.css`.
 */

/** Максимальный сдвиг ближнего слоя за курсором, px. Больше — уже карусель. */
export const PARALLAX_MAX_PX = 6;

/** Глубина слоёв: чем ближе к зрителю, тем сильнее отклик на курсор. */
export const DEPTH = {
  far: 0.25,
  mid: 0.55,
  near: 1,
} as const;

export type DepthLayer = keyof typeof DEPTH;

/** Стаггер появления: шаг и потолок задержки, мс. */
export const ENTER_STEP_MS = 60;
export const ENTER_MAX_MS = 240;

/** Стаггер роста нитей графа, мс. */
export const EDGE_DRAW_STEP_MS = 12;
export const EDGE_DRAW_MAX_MS = 400;

/**
 * Выше этого числа рёбер рисование нитей по одной заменяется общим
 * проявлением слоя: `stroke-dashoffset` — paint-нагрузка на кадр.
 */
export const EDGE_DRAW_MAX = 60;

/** Длительность перелёта вида графа (фокус на узле, смена режима), мс. */
export const GRAPH_VIEW_MS = 280;

/** Постоянная времени следования курсора: критически задемпфировано, без отскока. */
export const POINTER_TAU = 0.09;

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
export const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";

export interface Point {
  x: number;
  y: number;
}

export interface ViewState {
  zoom: number;
  pan: Point;
}

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/** Кадровонезависимый коэффициент следования (экспоненциальное сглаживание). */
export function followFactor(dtSeconds: number, tau = POINTER_TAU): number {
  if (dtSeconds <= 0) return 0;
  return 1 - Math.exp(-dtSeconds / tau);
}

/**
 * Положение курсора в координатах −1…1 относительно центра окна.
 * Центр — 0, правый/нижний край — 1, левый/верхний — −1.
 */
export function normalizedPointer(
  clientX: number,
  clientY: number,
  width: number,
  height: number,
): Point {
  if (width <= 0 || height <= 0) return { x: 0, y: 0 };
  return {
    x: clamp((clientX / width) * 2 - 1, -1, 1),
    y: clamp((clientY / height) * 2 - 1, -1, 1),
  };
}

/**
 * Смещение слоя за курсором. Знак отрицательный: элемент «отстаёт» от
 * курсора, поэтому бумага под ним читается как плоскость, а карточка — как
 * объект над ней (`COS-COM-006 §8`).
 */
export function depthOffset(
  pointer: number,
  depth: number,
  max = PARALLAX_MAX_PX,
): number {
  const value = -pointer * depth * max;
  const rounded = Math.round(value * 100) / 100;
  // −0 в CSS-переменной выглядит как «слой дёрнулся»: нормализуем к нулю.
  return rounded === 0 ? 0 : rounded;
}

/** Задержка появления элемента в списке: шаг растёт линейно и упирается в потолок. */
export function enterDelay(
  index: number,
  step = ENTER_STEP_MS,
  cap = ENTER_MAX_MS,
): number {
  if (index <= 0) return 0;
  return Math.min(cap, index * step);
}

/**
 * Задержка роста нити. Если рёбер больше `EDGE_DRAW_MAX`, рисование не
 * запускаем вовсе — отдаём 0, компонент показывает слой общим fade.
 */
export function edgeDelay(
  index: number,
  count: number,
  step = EDGE_DRAW_STEP_MS,
  cap = EDGE_DRAW_MAX_MS,
): number {
  if (count > EDGE_DRAW_MAX || index <= 0) return 0;
  return Math.min(cap, index * step);
}

/** Нужно ли вообще следить за курсором в этом окружении. */
export function shouldTrackPointer(state: {
  reducedMotion: boolean;
  finePointer: boolean;
  pointerType?: string;
  hidden?: boolean;
}): boolean {
  if (state.reducedMotion) return false;
  if (!state.finePointer) return false;
  if (state.hidden) return false;
  if (state.pointerType && state.pointerType !== "mouse") return false;
  return true;
}

/** Ease-out без перелёта: приближение cubic-bezier(0.33, 1, 0.68, 1). */
export function easeOutStructure(t: number): number {
  const clamped = clamp(t, 0, 1);
  return 1 - (1 - clamped) ** 3;
}

/** Интерполяция вида графа — используется анимацией фокуса и смены режима. */
export function interpolateView(from: ViewState, to: ViewState, t: number): ViewState {
  const k = easeOutStructure(t);
  return {
    zoom: lerp(from.zoom, to.zoom, k),
    pan: {
      x: lerp(from.pan.x, to.pan.x, k),
      y: lerp(from.pan.y, to.pan.y, k),
    },
  };
}

/** Числовой вид CSS-переменной глубины: `--depth` для `[data-depth]`. */
export function depthFor(layer: DepthLayer): number {
  return DEPTH[layer];
}
