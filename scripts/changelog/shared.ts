/**
 * Общие утилиты агента лога обновлений: разбор флагов, даты, текст, пути.
 *
 * Скрипты запускаются через `node --experimental-strip-types` и не должны
 * тянуть внешние зависимости: агент лога обязан работать в чистом репозитории.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

/**
 * Node 24 умеет zstd, но @types/node в проекте старше и не знает этих методов.
 * Держим приведение в одном месте, чтобы не размазывать `as unknown as`.
 */
export const zstd = zlib as unknown as {
  zstdDecompressSync(data: Buffer): Buffer;
  zstdCompressSync(data: Buffer): Buffer;
};

export type FlagValue = string | boolean;
export type Flags = Record<string, FlagValue>;

/** Минимальный парсер `--name value` / `--name=value` / `--flag`. */
export function parseFlags(argv: string[]): Flags {
  const flags: Flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument || !argument.startsWith("--")) continue;
    const equals = argument.indexOf("=");
    if (equals !== -1) {
      flags[argument.slice(2, equals)] = argument.slice(equals + 1);
      continue;
    }
    const name = argument.slice(2);
    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith("--")) {
      flags[name] = next;
      index += 1;
    } else {
      flags[name] = true;
    }
  }
  return flags;
}

export function flagValue(flags: Flags, name: string): string | undefined {
  const value = flags[name];
  return typeof value === "string" ? value : undefined;
}

export function hasFlag(flags: Flags, name: string): boolean {
  const value = flags[name];
  return value === true || typeof value === "string";
}

/** Корень репозитория: `scripts/changelog/shared.ts` → `../../`. */
export function projectRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
}

/**
 * `2026-11-03` — локальная полночь, `2026-11-03T19:09:46+03:00` — как есть.
 * `new Date("2026-11-03")` парсится как UTC, поэтому дату без времени
 * разбираем вручную, чтобы окно совпадало с локальным календарём пользователя.
 */
export function parseDateArgument(value: string, label: string): Date {
  const trimmed = value.trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    const valid =
      date.getFullYear() === Number(year) &&
      date.getMonth() === Number(month) - 1 &&
      date.getDate() === Number(day);
    if (!valid) throw new Error(`${label}: некорректная дата — ${value}`);
    return date;
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) throw new Error(`${label}: некорректная дата — ${value}`);
  return date;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Локальная дата `YYYY-MM-DD` (без UTC-сдвига). */
export function localDateString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Локальное время `HH:mm`. */
export function localTimeString(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Локальные дата и время `YYYY-MM-DD HH:mm`. */
export function localDateTimeString(date: Date): string {
  return `${localDateString(date)} ${localTimeString(date)}`;
}

/** Плоский текст: схлопнуть пробелы и обрезать до `max` символов. */
export function truncatePlainText(text: string, max: number): string {
  const normalized = text.replace(/\s+/gu, " ").trim();
  const characters = [...normalized];
  if (characters.length <= max) return normalized;
  return `${characters.slice(0, Math.max(0, max - 1)).join("")}…`;
}

export function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

/** Частотная карта: что чаще всего менялось. */
export function countBy(values: string[]): Array<{ value: string; count: number }> {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
}
