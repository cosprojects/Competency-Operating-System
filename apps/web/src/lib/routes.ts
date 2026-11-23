/**
 * Определение маршрута для каркаса страницы.
 *
 * Карта профессии — это и `/professions/[slug]`, и страница компетенции
 * `/professions/[slug]/[competency]`: обе рисуют один и тот же канвас. Раньше
 * проверка стояла в двух местах (`AppShell`, `NavRail`) и понимала только один
 * сегмент — на новой странице компетенции каркас считал её обычной страницей и
 * сжимал схему. Одно определение на оба места, чтобы это не повторилось.
 */
export const CANVAS_PATH = /^\/professions\/[^/]+(\/[^/]+)?$/;

export function isCanvasPath(pathname: string): boolean {
  return CANVAS_PATH.test(pathname);
}
