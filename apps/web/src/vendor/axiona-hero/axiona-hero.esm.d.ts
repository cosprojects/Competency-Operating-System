/* Типы для собранного бандла 3D-фигуры героя (axiona-hero).
   Исходники и сборка: default-workspace/axiona-hero (npm run build). */

export type AxionaHeroTheme = "light" | "dark";

export interface AxionaHeroOptions {
  /** Палитра сцены. По умолчанию "light". */
  theme?: AxionaHeroTheme;
  /** Верхний предел devicePixelRatio. По умолчанию 2. */
  dpr?: number;
  /** Реакция на курсор: 0 — выключить. По умолчанию 1. */
  parallax?: number;
  /** false — статичный кадр без requestAnimationFrame. */
  animated?: boolean;
  /** false — не запускать цикл сразу (кадр рисуется через renderAt). */
  autoStart?: boolean;
  /** Кадрирование: >1 — больше воздуха вокруг фигуры, <1 — крупнее. По умолчанию 1. */
  frame?: number;
}

export interface AxionaHeroInstance {
  readonly canvas: HTMLCanvasElement;
  readonly scene: unknown;
  readonly camera: unknown;
  readonly root: unknown;
  readonly renderer: { dispose: () => void; info: { render: { calls: number; triangles: number } } };
  readonly theme: AxionaHeroTheme;
  /** Рендер детерминированного кадра (секунды с начала сцены). */
  renderAt(seconds: number): void;
  play(): void;
  pause(): void;
  destroy(): void;
  /** Резолвится, когда асинхронные текстуры (логотип) загружены. */
  ready: Promise<void>;
}

export function createAxionaHero(
  container: HTMLElement,
  options?: AxionaHeroOptions,
): AxionaHeroInstance;

export function autoMount(root?: Document): AxionaHeroInstance[];

export const THEMES: Record<AxionaHeroTheme, Record<string, unknown>>;
export const LAYOUT: Record<string, unknown>;
