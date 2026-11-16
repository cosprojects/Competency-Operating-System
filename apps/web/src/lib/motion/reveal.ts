/**
 * Появление секций при скролле (COS-EAR-016).
 *
 * Правило безопасности: прячем только то, что ниже вьюпорта, и только после
 * гидрации. Контент, видимый на первом экране, не мигает; без JS ничего не
 * прячется вовсе (стартовое состояние `out` ставит этот модуль, а не разметка).
 */

const REVEAL_ROOT_MARGIN = "0px 0px -10% 0px";
/** Ниже этой доли вьюпорта элемент считается «за кадром» и его можно прятать. */
const HIDDEN_TOP_RATIO = 0.92;
/** Страховка: если IO не сработал (элемент в скрытом контейнере), показываем. */
const SAFETY_TIMEOUT_MS = 6000;

let observer: IntersectionObserver | null = null;

function getObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === "undefined") return null;
  if (observer) return observer;
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const element = entry.target as HTMLElement;
        element.dataset.reveal = "in";
        observer?.unobserve(element);
      }
    },
    { rootMargin: REVEAL_ROOT_MARGIN, threshold: 0.01 },
  );
  return observer;
}

/**
 * Помечает цели в `root` и наблюдает за теми, что ниже первого экрана.
 * Возвращает остановку: наблюдатели и таймеры снимаются.
 */
export function prepareReveals(root: ParentNode = document): () => void {
  if (typeof window === "undefined") return () => {};
  const activeObserver = getObserver();
  const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));

  const pending: HTMLElement[] = [];
  for (const element of targets) {
    const top = element.getBoundingClientRect().top;
    if (top > window.innerHeight * HIDDEN_TOP_RATIO) {
      element.dataset.reveal = "out";
      pending.push(element);
    } else {
      element.dataset.reveal = "in";
    }
  }

  if (pending.length === 0 || !activeObserver) return () => {};

  for (const element of pending) activeObserver.observe(element);

  const safety = window.setTimeout(() => {
    for (const element of pending) {
      if (element.dataset.reveal === "out") element.dataset.reveal = "in";
      activeObserver.unobserve(element);
    }
  }, SAFETY_TIMEOUT_MS);

  return () => {
    window.clearTimeout(safety);
    for (const element of pending) activeObserver.unobserve(element);
  };
}
