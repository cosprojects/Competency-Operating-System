import type { ItemInput, SearchHit } from "./types.ts";

/** Служебные префиксы названий пунктов, которые мешают поиску. */
const TITLE_PREFIXES = [
  /^Понятие:\s*/i,
  /^Понятие\s+/i,
  /^Роль\s+/i,
  /^Работа с\s+/i,
  /^Использование\s+/i,
  /^Основы\s+/i,
  /^Принципы\s+/i,
  /^Виды\s+/i,
  /^Типы\s+/i,
];

/** Название без служебного префикса: «Понятие: Автолейауты» → «Автолейауты». */
export function normalizeTitle(title: string): string {
  let value = title.trim();
  for (const prefix of TITLE_PREFIXES) value = value.replace(prefix, "");
  return value.replace(/\s+/g, " ").trim();
}

/** Значимые слова названия: длиннее 3 символов, без пунктуации.
 *  Для коротких названий-аббревиатур (API, Git, MCP, CJM) значимых длинных слов нет —
 *  тогда берём сами токены от 2 символов, иначе пункт никогда не пройдёт порог темы. */
export function titleWords(title: string): string[] {
  // Разбиваем по всем не-буквам: «бизнес-эмпатия» → [бизнес, эмпатия], «AI-аудио» → [аудио].
  const words = normalizeTitle(title)
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const long = words.filter((word) => word.length > 3);
  return long.length > 0 ? long : words.filter((word) => word.length > 1);
}

/** Короткая сущность для запроса: не больше 5 значимых слов, без пунктуации. */
export function searchPhrase(title: string): string {
  const words = normalizeTitle(title)
    .replace(/[«»"(),.:;!?]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  return words.slice(0, 5).join(" ");
}

/** Запасной план запросов, если LLM-планировщик недоступен. */
export function fallbackQueries(item: ItemInput): { ru: string; en?: string } {
  const phrase = searchPhrase(item.title);
  const ru = item.kind === "skill" ? `как ${phrase.toLowerCase()}` : `${phrase} что это`;
  return { ru };
}

const DENY_HOSTS = [
  "hh.ru",
  "career.",
  "linkedin.",
  "facebook.",
  "instagram.",
  "pinterest.",
  "t.me",
  "vk.com",
  "youtube.com",
  "youtu.be",
  "avito.",
  "ozon.",
  "wildberries.",
  "market.yandex",
  "otzyv",
  "vacancy",
  "rabota",
  "kariernik.",
  "newsspartak.",
];

const GOOD_HOSTS = [
  "habr.com",
  "ru.wikipedia.org",
  "en.wikipedia.org",
  "practicum.yandex.ru",
  "tilda.education",
  "uprock.ru",
  "ux-journal.ru",
  "usabilitylab.ru",
  "qarocks.ru",
  "productlab.ru",
  "kokoc.com",
  "contented.ru",
  "hightime.media",
  "infogra.ru",
  "smashingmagazine.com",
  "justinmind.com",
  "nngroup.com",
  "figma.com",
  "help.figma.com",
  "developer.mozilla.org",
  "medium.com",
  "vc.ru",
  "skillbox.ru",
  "netology.ru",
  "bureau.ru",
  "dsgners.ru",
  "ux.pub",
  "adobe.com",
  "html5book.ru",
];

export function hostOf(url: string): string {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return "";
  }
}

export function isDeniedUrl(url: string): boolean {
  const host = hostOf(url);
  if (!host) return true;
  return DENY_HOSTS.some((deny) => host === deny || host.includes(deny));
}

/** Эвристическая оценка кандидата: домен, описание, позиция в выдаче. */
export function scoreHit(hit: Omit<SearchHit, "score">, index: number): number {
  const host = hostOf(hit.url);
  let score = 0;
  if (GOOD_HOSTS.some((good) => host === good || host.endsWith(`.${good}`))) score += 3;
  if (host.endsWith(".ru") || host.endsWith(".рф")) score += 0.3;
  if (hit.description.length >= 80) score += 0.5;
  score -= index * 0.15;
  return Math.round(score * 100) / 100;
}

/** Отбирает кандидатов на загрузку: без мусорных доменов, по убыванию оценки. */
export function pickCandidates(hits: SearchHit[], limit: number): SearchHit[] {
  const seen = new Set<string>();
  return hits
    .filter((hit) => !isDeniedUrl(hit.url))
    .filter((hit) => {
      const key = hit.url.replace(/[?#].*$/, "").replace(/\/$/, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Язык источника по доле кириллицы: ru при > 0.5, иначе en. */
export function sourceLang(cyrShare: number): "ru" | "en" {
  return cyrShare > 0.5 ? "ru" : "en";
}

/** Минимальный объём текста, чтобы источник годился для разбора. */
export function isUsableSource(page: { chars: number; cyrShare: number }): boolean {
  return page.chars >= 1200;
}

/** Совпадение названия пункта с заголовком и началом текста источника. */
export function keywordRelevance(
  page: { title: string; text: string },
  item: Pick<ItemInput, "title">,
): number {
  const words = titleWords(item.title);
  if (words.length === 0) return 0;
  const haystack = `${page.title} ${page.text.slice(0, 2500)}`.toLowerCase();
  // Сравниваем по основе слова: «автолейауты» в тексте встречается как «автолейаут».
  const hits = words.filter((word) => haystack.includes(word.length > 5 ? word.slice(0, word.length - 2) : word)).length;
  return hits / words.length;
}

/** Порог тематического совпадения: ниже — источник считаем нерелевантным. */
export const MIN_RELEVANCE = 0.2;

/** Проверка, что источник действительно про этот пункт, а не «рядом по теме». */
export function isTopicRelevant(
  page: { title: string; text: string },
  item: Pick<ItemInput, "title">,
): boolean {
  const words = titleWords(item.title);
  if (words.length === 0) return false;
  const haystack = `${page.title} ${page.text.slice(0, 2500)}`.toLowerCase();
  const hits = words.filter((word) => haystack.includes(word.length > 5 ? word.slice(0, word.length - 2) : word)).length;
  // Достаточно одного тематического слова, остальное решает LLM-синтез (вернёт no_data, если тема не та).
  return hits >= 1 && hits / words.length >= MIN_RELEVANCE;
}
