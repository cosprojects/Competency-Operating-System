/**
 * Контракт файла лога обновлений.
 *
 * Источник правды для блока «Лог обновлений» на главной —
 * `apps/web/src/content/changelog.ts`. Здесь живут парсинг, валидация и
 * вставка записей. Экран ничего не знает про этот скрипт: он просто читает
 * массив `ENTRIES` через `latestChangelog()`.
 *
 * Формат записи:
 *   1. date        — `YYYY-MM-DD`, локальная дата логирования;
 *   2. title       — общее название работ, до 60 символов, без точки в конце;
 *   3. description — ровно три предложения, до 450 символов:
 *                    что сделано → что это меняет для пользователя → что дальше.
 *
 * Новые записи идут первыми, даты — по убыванию, одна запись в день.
 * Повторное логирование в тот же день заменяет запись (`--replace`).
 */
import { readFileSync } from "node:fs";

export interface ChangelogEntry {
  date: string;
  title: string;
  description: string;
}

export const TITLE_MAX_LENGTH = 60;
export const DESCRIPTION_MAX_LENGTH = 450;
export const DESCRIPTION_SENTENCES = 3;

const ARRAY_PATTERN = /const ENTRIES: ChangelogEntry\[\] = \[\n([\s\S]*?)\n\];/u;
const ENTRY_PATTERN =
  /\{\s*date:\s*("(?:[^"\\]|\\.)*"),\s*title:\s*("(?:[^"\\]|\\.)*"),\s*description:\s*\n?\s*("(?:[^"\\]|\\.)*"),?\s*\}/gu;

/**
 * Известные сокращения, которые не завершают предложение. Защищаем их
 * плейсхолдером, иначе «и т. д.» даёт лишнее предложение.
 */
const ABBREVIATIONS = [
  "и т. д.",
  "и т. п.",
  "т. д.",
  "т. п.",
  "т. е.",
  "т. к.",
  "тыс.",
  "млн.",
  "млрд.",
  "напр.",
  "см.",
  "др.",
  "пр.",
  "рис.",
  "стр.",
  "руб.",
  "гг.",
  "г.",
];

const DOT_PLACEHOLDER = "\u0002";
const INITIALS_PLACEHOLDER = "\u0001";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

const ABBREVIATION_PATTERN = new RegExp(
  [...ABBREVIATIONS].sort((left, right) => right.length - left.length).map(escapeRegExp).join("|"),
  "gu",
);

/** Разбить текст на предложения, не спотыкаясь о «т. д.», «см.» и инициалы. */
export function splitSentences(text: string): string[] {
  const normalized = text.replace(/\s+/gu, " ").trim();
  if (!normalized) return [];
  const protectedText = normalized
    .replace(/([А-ЯЁA-Z])\.(?=\s+[А-ЯЁA-Z][а-яёa-z]|\s+[А-ЯЁA-Z]\.)/gu, `$1${INITIALS_PLACEHOLDER}`)
    .replace(ABBREVIATION_PATTERN, (match) => match.replace(/\./gu, DOT_PLACEHOLDER));
  return protectedText
    .split(/(?<=[.!?…])\s+/u)
    .map((part) => part.split(INITIALS_PLACEHOLDER).join(".").split(DOT_PLACEHOLDER).join(".").trim())
    .filter((part) => part.length > 0);
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function characterLength(value: string): number {
  return [...value].length;
}

/** Проверить одну запись. Возвращает список человекочитаемых ошибок. */
export function validateEntry(entry: ChangelogEntry): string[] {
  const errors: string[] = [];

  if (typeof entry.date !== "string" || !isValidIsoDate(entry.date)) {
    errors.push("date: нужна дата в формате YYYY-MM-DD");
  }

  if (typeof entry.title !== "string" || entry.title.trim().length === 0) {
    errors.push("title: название не должно быть пустым");
  } else {
    if (entry.title !== entry.title.trim()) errors.push("title: убери пробелы по краям");
    if (characterLength(entry.title) > TITLE_MAX_LENGTH) {
      errors.push(`title: не длиннее ${TITLE_MAX_LENGTH} символов, сейчас ${characterLength(entry.title)}`);
    }
    if (/[.!?…]$/u.test(entry.title.trim())) errors.push("title: без точки в конце");
    if (/[\r\n]/u.test(entry.title)) errors.push("title: в одну строку");
  }

  if (typeof entry.description !== "string" || entry.description.trim().length === 0) {
    errors.push("description: описание не должно быть пустым");
  } else {
    if (entry.description !== entry.description.trim()) errors.push("description: убери пробелы по краям");
    if (/[\r\n]/u.test(entry.description)) errors.push("description: в одну строку");
    if (characterLength(entry.description) > DESCRIPTION_MAX_LENGTH) {
      errors.push(
        `description: не длиннее ${DESCRIPTION_MAX_LENGTH} символов, сейчас ${characterLength(entry.description)}`,
      );
    }
    const sentences = splitSentences(entry.description);
    if (sentences.length !== DESCRIPTION_SENTENCES) {
      errors.push(
        `description: нужно ровно ${DESCRIPTION_SENTENCES} предложения, получилось ${sentences.length}`,
      );
    }
    const unfinished = sentences.find((sentence) => !/[.!?…]$/u.test(sentence));
    if (unfinished) errors.push(`description: предложение без точки в конце — «${unfinished}»`);
  }

  return errors;
}

function decodeJsonString(raw: string): string {
  return JSON.parse(raw) as string;
}

/** Разобрать массив записей из исходника `changelog.ts`. */
export function parseChangelog(source: string): ChangelogEntry[] {
  const arrayMatch = ARRAY_PATTERN.exec(source);
  if (!arrayMatch) throw new Error("Не найден массив ENTRIES: ChangelogEntry[] в changelog.ts");
  const body = arrayMatch[1] ?? "";
  const entries: ChangelogEntry[] = [];
  for (const match of body.matchAll(ENTRY_PATTERN)) {
    const date = match[1];
    const title = match[2];
    const description = match[3];
    if (!date || !title || !description) continue;
    entries.push({
      date: decodeJsonString(date),
      title: decodeJsonString(title),
      description: decodeJsonString(description),
    });
  }
  if (entries.length === 0) throw new Error("В changelog.ts не найдено ни одной записи");
  return entries;
}

export function readChangelog(filePath: string): ChangelogEntry[] {
  return parseChangelog(readFileSync(filePath, "utf8"));
}

/** Проверить весь файл: записи, даты по убыванию, без дублей. */
export function validateEntries(entries: ChangelogEntry[]): string[] {
  const errors: string[] = [];
  if (entries.length === 0) errors.push("нет ни одной записи");
  const seenDates = new Set<string>();
  entries.forEach((entry, index) => {
    const prefix = `запись ${index + 1}`;
    for (const error of validateEntry(entry)) errors.push(`${prefix}: ${error}`);
    if (seenDates.has(entry.date)) errors.push(`${prefix}: дата ${entry.date} повторяется`);
    seenDates.add(entry.date);
  });
  for (let index = 1; index < entries.length; index += 1) {
    const previous = entries[index - 1];
    const current = entries[index];
    if (previous && current && previous.date < current.date) {
      errors.push(`нарушен порядок: ${previous.date} идёт раньше ${current.date}`);
    }
  }
  return errors;
}

export function sortEntriesDescending(entries: ChangelogEntry[]): ChangelogEntry[] {
  return [...entries].sort((left, right) => right.date.localeCompare(left.date));
}

export function latestEntryDate(entries: ChangelogEntry[]): string {
  return entries.reduce((latest, entry) => (entry.date > latest ? entry.date : latest), "");
}

function formatEntry(entry: ChangelogEntry): string {
  return [
    "  {",
    `    date: ${JSON.stringify(entry.date)},`,
    `    title: ${JSON.stringify(entry.title)},`,
    "    description:",
    `      ${JSON.stringify(entry.description)},`,
    "  },",
  ].join("\n");
}

/** Собрать исходник обратно: шапка и код модуля сохраняются байт в байт. */
export function renderChangelog(source: string, entries: ChangelogEntry[]): string {
  const body = entries.map(formatEntry).join("\n");
  if (!ARRAY_PATTERN.test(source)) throw new Error("Не найден массив ENTRIES: ChangelogEntry[] в changelog.ts");
  return source.replace(ARRAY_PATTERN, `const ENTRIES: ChangelogEntry[] = [\n${body}\n];`);
}

export interface UpsertResult {
  entries: ChangelogEntry[];
  action: "inserted" | "replaced";
}

/**
 * Вставить новую запись или заменить запись за ту же дату.
 * `replace: false` защищает от случайной перезаписи дня.
 */
export function upsertEntry(
  entries: ChangelogEntry[],
  entry: ChangelogEntry,
  options: { replace?: boolean } = {},
): UpsertResult {
  const sameDateIndex = entries.findIndex((candidate) => candidate.date === entry.date);
  if (sameDateIndex !== -1) {
    if (!options.replace) {
      throw new Error(`Запись за ${entry.date} уже есть. Для повторного логирования добавь --replace`);
    }
    const next = [...entries];
    next[sameDateIndex] = entry;
    return { entries: sortEntriesDescending(next), action: "replaced" };
  }
  return { entries: sortEntriesDescending([...entries, entry]), action: "inserted" };
}
