import type { Metadata } from "next";

/**
 * Служебные страницы: не для выдачи.
 *
 * `Disallow` в robots.txt не защищает от индексации — внешняя ссылка или
 * история переходов всё равно могут привести краулер. Поэтому приватные
 * маршруты закрываются здесь же, метатегом robots.
 *
 * `index: false` — не индексировать; `follow` — оставляем как есть по смыслу
 * страницы: у формы входа и регистрации ссылки полезные, у личных разделов
 * следовать некуда.
 */
export const NOINDEX_FOLLOW: Metadata = {
  robots: { index: false, follow: true },
};

/** Личные и технические страницы: закрыты полностью. */
export const NOINDEX_NOFOLLOW: Metadata = {
  robots: { index: false, follow: false },
};
