/**
 * Компактный поисковый индекс для каталога профессий.
 *
 * Полный текст компетенций в RSC-пейлоаде занимал ~490 КБ — больше половины
 * веса страницы «Направления». Токенизация с дедупликацией режет его вдвое,
 * а поиск по токенам не хуже: запрос «ux исследование» находится в любом
 * порядке слов, а не только подряд.
 *
 * Модуль намеренно без зависимостей (не тянет content-модель и JSON), чтобы
 * его можно было покрыть node-тестами.
 */

function normalize(value: string): string {
  return value.trim().toLowerCase().replaceAll("ё", "е");
}

/** Уникальные слова через пробел: нижний регистр, без пунктуации и дублей. */
export function compactSearchText(value: string): string {
  const normalized = normalize(value);
  const words = normalized.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return [...new Set(words)].join(" ");
}

/** Совпадение по всем словам запроса; подстрока — для недописанного слова. */
export function matchesSearchTokens(searchText: string, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  return tokens.every((token) => searchText.includes(token));
}
